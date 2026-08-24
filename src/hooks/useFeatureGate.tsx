import { useCallback } from 'react';
import { toast } from 'sonner';
import { useFeaturePermissions } from '@/hooks/useFeaturePermissions';
import { useCredits } from '@/hooks/useCredits';

/**
 * Hook for checking feature access and performing a credit preflight.
 * Use this when you need programmatic access control (not just UI gating).
 */
export const useFeatureGate = () => {
  const { checkAccess, getCreditCost, hasFeature, canEdit } = useFeaturePermissions();
  const { credits, preflightCredits } = useCredits();

  /**
   * Check if user can use a feature and optionally preflight credits.
   * Actual reservation and consumption always happen in the backend operation.
   * Returns true if access was granted, false otherwise.
   */
  const useFeature = useCallback(async (featureKey: string, deductOnUse = true): Promise<boolean> => {
    const access = checkAccess(featureKey);
    
    if (!access.hasAccess) {
      toast.error(access.reason || 'شما به این قابلیت دسترسی ندارید');
      return false;
    }

    const cost = getCreditCost(featureKey);
    
    if (cost > 0 && deductOnUse) {
      if (credits < cost) {
        toast.error(`اعتبار کافی ندارید. هزینه: ${cost} اعتبار`);
        return false;
      }

      const success = await preflightCredits(cost, featureKey);
      if (!success) {
        toast.error('اعتبار کافی نیست یا بررسی موجودی انجام نشد');
        return false;
      }
    }

    return true;
  }, [checkAccess, getCreditCost, credits, preflightCredits]);

  /**
   * Check access without deducting credits.
   * Useful for UI state before user takes action.
   */
  const canUseFeature = useCallback((featureKey: string): boolean => {
    const access = checkAccess(featureKey);
    if (!access.hasAccess) return false;

    const cost = getCreditCost(featureKey);
    if (cost > 0 && credits < cost) return false;

    return true;
  }, [checkAccess, getCreditCost, credits]);

  /**
   * Get detailed access info for a feature.
   */
  const getFeatureInfo = useCallback((featureKey: string) => {
    const access = checkAccess(featureKey);
    const cost = getCreditCost(featureKey);
    const hasEnoughCredits = credits >= cost;

    return {
      hasAccess: access.hasAccess,
      canEdit: access.canEdit,
      creditCost: cost,
      hasEnoughCredits,
      reason: access.reason,
      canUse: access.hasAccess && hasEnoughCredits
    };
  }, [checkAccess, getCreditCost, credits]);

  return {
    useFeature,
    canUseFeature,
    getFeatureInfo,
    hasFeature,
    canEdit,
    credits
  };
};

export default useFeatureGate;
