import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from './useAuth';
import type {
  CompanyRole,
  PlatformRole,
  SubscriptionTier,
  UserContext,
  UserType,
} from '@/types/multiTenant';

interface UserContextState {
  context: UserContext | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

interface ApiUserContext {
  user_id: string;
  email: string;
  user_type: string;
  subscription_tier: string | null;
  is_admin: boolean;
  platform_roles: string[];
  app_roles: string[];
  company_id: string | null;
  company_role: string | null;
  company_can_invite: boolean;
  company_permissions: string[];
  company_tier: string | null;
  credits: number;
  used_credits: number;
  company_credit_pool: number;
  company_credit_pool_enabled: boolean;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  phone_e164: string | null;
  phone_verified_at: string | null;
}

const UserContextContext = createContext<UserContextState | undefined>(undefined);

export const UserContextProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, mfaRequired, mfaVerified } = useAuth();
  const [context, setContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserContext = useCallback(async () => {
    if (!user) {
      setContext(null);
      setLoading(false);
      return;
    }
    if (mfaRequired && !mfaVerified) {
      setContext(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<ApiUserContext>('/auth/context');
      setContext({
        userId: data.user_id,
        email: data.email,
        userType: data.user_type as UserType,
        subscriptionTier: data.subscription_tier as SubscriptionTier | null,
        isAdmin: data.is_admin,
        platformRoles: data.platform_roles as PlatformRole[],
        appRoles: data.app_roles,
        companyId: data.company_id,
        companyRole: data.company_role as CompanyRole | null,
        companyCanInvite: data.company_can_invite,
        companyPermissions: data.company_permissions,
        companyTier: data.company_tier as SubscriptionTier | null,
        credits: data.credits,
        usedCredits: data.used_credits,
        companyCreditPool: data.company_credit_pool,
        companyCreditPoolEnabled: data.company_credit_pool_enabled,
        fullName: data.full_name,
        title: data.title,
        avatarUrl: data.avatar_url,
        phoneE164: data.phone_e164,
        phoneVerifiedAt: data.phone_verified_at,
      });
    } catch (error) {
      console.error('Error fetching independent user context:', error);
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [user, mfaRequired, mfaVerified]);

  useEffect(() => {
    if (authLoading) return;
    void fetchUserContext();
  }, [authLoading, fetchUserContext]);

  return (
    <UserContextContext.Provider value={{ context, loading, refetch: fetchUserContext }}>
      {children}
    </UserContextContext.Provider>
  );
};

export const useUserContext = () => {
  const ctx = useContext(UserContextContext);
  if (ctx === undefined) {
    throw new Error('useUserContext must be used within a UserContextProvider');
  }
  return ctx;
};
