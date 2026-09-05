import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useSuperAdmin } from './useSuperAdmin';
import { apiRequest } from '@/lib/api';

// Diamond costs for different AI operations
export const DIAMOND_COSTS = {
  // Simple Text Generation - 5 Diamonds
  JOB_PROFILE: 8,
  INTERVIEW_GUIDE: 10,
  INTERVIEW_KIT: 10,
  SMART_AD_TEXT: 5,

  // Medium Text Generation - 15 Diamonds
  ONBOARDING_PLAN: 12,
  LEARNING_PATH: 12,
  LEGAL_ADVISOR: 5,
  LABOR_COMPLAINT: 25,
  LEGAL_DEFENSE: 20,
  HR_SUPPORT: 1,

  // Complex Analysis - 20 Diamonds
  STRATEGIC_ANALYSIS: 20,

  // Image Generation - 25 Diamonds
  SMART_AD_IMAGE: 50,
  HR_DASHBOARD: 0,
  HR_DASHBOARD_UPLOAD: 10,
  COST_CALCULATOR: 2,
  ANALYTICS_HUB: 25,

  // Premium Deep Search (Perplexity + Gemini Pro) - 60 Diamonds
  HEADHUNTING: 60,
} as const;

// Labels for display (Persian)
export const DIAMOND_COST_LABELS: Record<keyof typeof DIAMOND_COSTS, string> = {
  JOB_PROFILE: 'شناسنامه شغل',
  INTERVIEW_GUIDE: 'راهنمای مصاحبه',
  INTERVIEW_KIT: 'کیت مصاحبه',
  SMART_AD_TEXT: 'متن آگهی هوشمند',
  ONBOARDING_PLAN: 'برنامه آنبوردینگ ۹۰ روزه',
  LEARNING_PATH: 'مسیر یادگیری',
  LEGAL_ADVISOR: 'مشاور حقوقی',
  LABOR_COMPLAINT: 'تنظیم شکایت کار',
  LEGAL_DEFENSE: 'دفاعیه حقوقی',
  HR_SUPPORT: 'پشتیبانی هوشمند',
  STRATEGIC_ANALYSIS: 'تحلیل قطب‌نمای استراتژیک',
  SMART_AD_IMAGE: 'تصویر آگهی هوشمند',
  HR_DASHBOARD: 'داشبورد منابع انسانی (دمو)',
  HR_DASHBOARD_UPLOAD: 'داشبورد منابع انسانی (اکسل)',
  COST_CALCULATOR: 'ماشین‌حساب هزینه نیروی انسانی',
  ANALYTICS_HUB: 'هاب تحلیلی',
  HEADHUNTING: 'هدهانتینگ هوشمند',
};

// Tooltips for premium features
export const DIAMOND_COST_TOOLTIPS: Partial<Record<keyof typeof DIAMOND_COSTS, string>> = {
  HEADHUNTING: 'از جستجوی پیشرفته بلادرنگ و تحلیل عمیق AI استفاده می‌کند',
  STRATEGIC_ANALYSIS: 'تحلیل چندلایه با مدل‌های پیشرفته',
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
