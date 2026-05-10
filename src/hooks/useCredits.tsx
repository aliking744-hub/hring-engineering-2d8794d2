import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Father Admin email for bypass
const FATHER_ADMIN_EMAIL = 'ali_king744@yahoo.com';

// Diamond costs for different AI operations
export const DIAMOND_COSTS = {
  // Simple Text Generation - 5 Diamonds
  JOB_PROFILE: 5,
  INTERVIEW_GUIDE: 5,
  INTERVIEW_KIT: 5,
  SMART_AD_TEXT: 5,
  
  // Medium Text Generation - 15 Diamonds
  ONBOARDING_PLAN: 15,
  
  // Complex Analysis - 20 Diamonds
  STRATEGIC_ANALYSIS: 20,
  
  // Image Generation - 25 Diamonds
  SMART_AD_IMAGE: 25,
  HR_DASHBOARD: 25,
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
  STRATEGIC_ANALYSIS: 'تحلیل قطب‌نمای استراتژیک',
  SMART_AD_IMAGE: 'تصویر آگهی هوشمند',
  HR_DASHBOARD: 'داشبورد منابع انسانی',
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

export const useCredits = () => {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Check if current user is Father Admin (bypasses all credit restrictions)
  const isFatherAdmin = user?.email?.toLowerCase() === FATHER_ADMIN_EMAIL.toLowerCase();

  const fetchCredits = async () => {
    if (!user) {
      setCredits(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_credits');
      
      if (error) throw error;
      setCredits(data ?? 0);
    } catch (error) {
      console.error('Error fetching credits:', error);
      setCredits(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [user]);

  const deductCredits = async (amount: number, featureKey?: string): Promise<boolean> => {
    // Father Admin bypasses credit deduction
    if (isFatherAdmin) {
      return true;
    }

    try {
      const { data, error } = await supabase.rpc('deduct_credits', { amount });
      
      if (error) throw error;
      
      if (data && user) {
        // Log the transaction with feature_key for analytics
        await supabase.from('credit_transactions').insert({
          user_id: user.id,
          amount: -amount,
          transaction_type: 'deduction',
          feature_key: featureKey || null,
          description: featureKey ? DIAMOND_COST_LABELS[featureKey as CreditOperation] : null,
        });
        
        await fetchCredits(); // Refresh credits after deduction
      }
      
      return data ?? false;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  };

  const hasEnoughCredits = (operation: CreditOperation): boolean => {
    // Father Admin always has enough credits
    if (isFatherAdmin) {
      return true;
    }
    return credits >= CREDIT_COSTS[operation];
  };

  const getCost = (operation: CreditOperation): number => {
    return CREDIT_COSTS[operation];
  };

  const getLabel = (operation: CreditOperation): string => {
    return DIAMOND_COST_LABELS[operation];
  };

  const getTooltip = (operation: CreditOperation): string | undefined => {
    return DIAMOND_COST_TOOLTIPS[operation];
  };

  const deductForOperation = async (operation: CreditOperation): Promise<boolean> => {
    // Father Admin bypasses credit deduction
    if (isFatherAdmin) {
      return true;
    }
    const cost = CREDIT_COSTS[operation];
    if (credits < cost) {
      return false;
    }
    return deductCredits(cost, operation);
  };

  return { 
    credits: isFatherAdmin ? 999999 : credits, // Father Admin sees "infinite" credits
    loading, 
    deductCredits, 
    deductForOperation,
    hasEnoughCredits,
    getCost,
    getLabel,
    getTooltip,
    refetch: fetchCredits,
    isFatherAdmin,
  };
};
