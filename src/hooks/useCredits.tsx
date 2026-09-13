import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useSuperAdmin } from './useSuperAdmin';
import { apiRequest } from '@/lib/api';

// Diamond costs for different AI operations
export const DIAMOND_COSTS = {
  // Customer-facing diamond prices (minimum 10x measured provider cost).
  JOB_PROFILE: 50,
  INTERVIEW_GUIDE: 100,
  INTERVIEW_KIT: 100,
  SMART_AD_TEXT: 10,

  ONBOARDING_PLAN: 50,
  ONBOARDING_CERTIFICATE: 20,
  LEARNING_PATH: 30,
  LEGAL_ADVISOR: 20,
  LABOR_COMPLAINT: 250,
  LEGAL_DEFENSE: 200,
  HR_SUPPORT: 10,

  // Retired/undefined modules stay unavailable until product scope is approved.
  STRATEGIC_ANALYSIS: 0,

  SMART_AD_IMAGE: 1500,
  HR_DASHBOARD: 0,
  HR_DASHBOARD_UPLOAD: 100,
  COST_CALCULATOR: 20,
  ANALYTICS_HUB: 0,
  HEADHUNTING: 600,
} as const;

// Labels for display (Persian)
export const DIAMOND_COST_LABELS: Record<keyof typeof DIAMOND_COSTS, string> = {
  JOB_PROFILE: 'شناسنامه شغل',
  INTERVIEW_GUIDE: 'راهنمای مصاحبه',
  INTERVIEW_KIT: 'کیت مصاحبه',
  SMART_AD_TEXT: 'متن آگهی هوشمند',
  ONBOARDING_PLAN: 'برنامه آنبوردینگ ۹۰ روزه',
  ONBOARDING_CERTIFICATE: 'گواهی پایان دوره ۹۰ روزه',
  LEARNING_PATH: 'مسیر یادگیری',
  LEGAL_ADVISOR: 'مشاور حقوقی',
  LABOR_COMPLAINT: 'تنظیم شکایت کار',
  LEGAL_DEFENSE: 'دفاعیه حقوقی',
  HR_SUPPORT: 'پشتیبانی هوشمند',
  STRATEGIC_ANALYSIS: 'قابلیت راهبردی (غیرفعال)',
  SMART_AD_IMAGE: 'تصویر آگهی هوشمند',
  HR_DASHBOARD: 'داشبورد منابع انسانی (دمو)',
  HR_DASHBOARD_UPLOAD: 'داشبورد منابع انسانی (اکسل)',
  COST_CALCULATOR: 'ماشین‌حساب هزینه نیروی انسانی',
  ANALYTICS_HUB: 'قابلیت تحلیلی (غیرفعال)',
  HEADHUNTING: 'هدهانتینگ هوشمند',
};

// Tooltips for premium features
export const DIAMOND_COST_TOOLTIPS: Partial<Record<keyof typeof DIAMOND_COSTS, string>> = {
  HEADHUNTING: 'از جستجوی پیشرفته بلادرنگ و تحلیل عمیق AI استفاده می‌کند',
  STRATEGIC_ANALYSIS: 'این قابلیت تا تعیین دامنه محصول غیرفعال است',
  ANALYTICS_HUB: 'این قابلیت تا تعیین دامنه محصول غیرفعال است',
};

// Backward compatibility
export const CREDIT_COSTS = DIAMOND_COSTS;

export type CreditOperation = keyof typeof CREDIT_COSTS;

interface CreditBalance {
  available_credits: number;
}

interface CreditPreflight {
  allowed: boolean;
  available_credits: number;
}

interface CreditRateCard { rates: Partial<Record<CreditOperation, number>>; }

export const useCredits = () => {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<Record<CreditOperation, number>>({ ...DIAMOND_COSTS });
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();

  // Kept only as a source-compatible alias for legacy consumers.
  // Authorization and billing bypasses must be decided server-side, never from browser identity data.
  const isFatherAdmin = isSuperAdmin;

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setCredits(0);
      setLoading(false);
      return;
    }

    try {
      const balance = await apiRequest<CreditBalance>('/billing/credits/me');
      setCredits(balance.available_credits);
      try {
        const rateCard = await apiRequest<CreditRateCard>('/billing/credits/rate-card');
        setCosts((current) => ({ ...current, ...rateCard.rates }));
      } catch (error) {
        console.error('Credit rate card fetch failed; using release defaults:', error);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      setCredits(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchCredits();
    const handleCreditsChanged = () => void fetchCredits();
    window.addEventListener('hring:credits-changed', handleCreditsChanged);
    return () => window.removeEventListener('hring:credits-changed', handleCreditsChanged);
  }, [fetchCredits]);

  // Transitional name: this performs an authoritative server preflight only.
  // Metered operations reserve and consume credits inside the backend transaction.
  const preflightCredits = useCallback(async (amount: number, featureKey?: string): Promise<boolean> => {
    try {
      const result = await apiRequest<CreditPreflight>('/billing/credits/preflight', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      setCredits(result.available_credits);
      return result.allowed;
    } catch (error) {
      console.error(`Credit preflight failed${featureKey ? ` for ${featureKey}` : ''}:`, error);
      return false;
    }
  }, []);

  const hasEnoughCredits = (operation: CreditOperation): boolean => {
    return credits >= costs[operation];
  };

  const getCost = (operation: CreditOperation): number => {
    return costs[operation];
  };

  const getLabel = (operation: CreditOperation): string => {
    return DIAMOND_COST_LABELS[operation];
  };

  const getTooltip = (operation: CreditOperation): string | undefined => {
    return DIAMOND_COST_TOOLTIPS[operation];
  };

  const deductForOperation = async (operation: CreditOperation): Promise<boolean> => {
    const cost = costs[operation];
    if (credits < cost) {
      return false;
    }
    return preflightCredits(cost, operation);
  };

  // Source-compatible aliases. They never mutate balance in the browser.
  const deductCredits = preflightCredits;

  return {
    credits,
    loading,
    preflightCredits,
    deductCredits,
    deductForOperation,
    hasEnoughCredits,
    getCost,
    getLabel,
    getTooltip,
    costs,
    refetch: fetchCredits,
    isFatherAdmin,
  };
};
