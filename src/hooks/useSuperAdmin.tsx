import { useAuth } from './useAuth';

// Super Admin / Father Admin email
const SUPER_ADMIN_EMAIL = 'ali_king744@yahoo.com';

export const useSuperAdmin = () => {
  const { user, loading } = useAuth();

  const isSuperAdmin = !loading && user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isFatherAdmin = isSuperAdmin; // Father Admin is the same user with bypass privileges

  return { 
    isSuperAdmin, 
    isFatherAdmin,
    loading,
    // Helper to check if credits/plans should be bypassed
    shouldBypassRestrictions: isFatherAdmin,
  };
};
