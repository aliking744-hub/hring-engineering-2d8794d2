import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useUserContext } from './useUserContext';
import type {
  Company,
  CompanyInvite,
  CompanyMember,
  CompanyRole,
  UserProfile,
} from '@/types/multiTenant';

interface ApiCompany {
  id: string;
  name: string;
  domain: string | null;
  status: Company['status'];
  subscription_tier: Company['subscription_tier'];
  monthly_credits: number;
  used_credits: number;
  max_members: number;
  credit_pool: number | null;
  credit_pool_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ApiMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  can_invite: boolean;
  is_active: boolean;
  invited_by: string | null;
  joined_at: string;
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    title: string | null;
    avatar_url: string | null;
  } | null;
}

interface UseCompanyReturn {
  company: Company | null;
  members: CompanyMember[];
  invites: CompanyInvite[];
  loading: boolean;
  isCEO: boolean;
  canInvite: boolean;
  createInvite: (role: CompanyRole, maxUses?: number, expiresIn?: number) => Promise<CompanyInvite | null>;
  removeMember: (memberId: string) => Promise<boolean>;
  updateMemberRole: (memberId: string, role: CompanyRole) => Promise<boolean>;
  toggleInvitePermission: (memberId: string, canInvite: boolean) => Promise<boolean>;
  deactivateInvite: (inviteId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const mapCompany = (item: ApiCompany): Company => ({
  ...item,
  credit_pool: item.credit_pool || 0,
  credit_pool_enabled: Boolean(item.credit_pool_enabled),
  last_credit_reset: null,
  created_by: null,
});

const mapMember = (item: ApiMember): CompanyMember => {
  let profile: UserProfile | undefined;
  if (item.profile) {
    profile = {
      id: item.profile.id,
      email: item.profile.email,
      full_name: item.profile.full_name,
      title: item.profile.title,
      avatar_url: item.profile.avatar_url,
      user_type: 'corporate',
      subscription_tier: null,
      monthly_credits: 0,
      used_credits: 0,
      is_active: item.is_active,
      created_at: item.joined_at,
    };
  }
  return { ...item, profile };
};

export const useCompany = (): UseCompanyReturn => {
  const { context, loading: contextLoading } = useUserContext();
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanyData = useCallback(async () => {
    const companyId = context?.companyId;
    if (!companyId) {
      setCompany(null);
      setMembers([]);
      setInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [companyData, memberData] = await Promise.all([
        apiRequest<ApiCompany>(`/companies/${companyId}`),
        context.companyPermissions.includes('company.members.read')
          ? apiRequest<ApiMember[]>(`/companies/${companyId}/members`)
          : Promise.resolve([]),
      ]);
      setCompany(mapCompany(companyData));
      setMembers(memberData.map(mapMember));

      if (
        context.companyPermissions.includes('company.invites.read') ||
        context.companyPermissions.includes('company.invites.manage')
      ) {
        try {
          const inviteData = await apiRequest<CompanyInvite[]>(`/companies/${companyId}/invites`);
          setInvites(inviteData);
        } catch (error) {
          console.error('Unable to read company invites:', error);
          setInvites([]);
        }
      } else {
        setInvites([]);
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
      setCompany(null);
      setMembers([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [context?.companyId, context?.companyPermissions]);

  useEffect(() => {
    if (!contextLoading) void fetchCompanyData();
  }, [contextLoading, fetchCompanyData]);

  const createInvite = useCallback(
    async (
      role: CompanyRole,
      maxUses = 1,
      expiresInDays = 7,
    ): Promise<CompanyInvite | null> => {
      if (!context?.companyId) return null;
      try {
        const invite = await apiRequest<CompanyInvite>(`/companies/${context.companyId}/invites`, {
          method: 'POST',
          body: JSON.stringify({
            role,
            max_uses: maxUses,
            expires_in_days: expiresInDays,
          }),
        });
        await fetchCompanyData();
        return invite;
      } catch (error) {
        console.error('Error creating invite:', error);
        return null;
      }
    },
    [context?.companyId, fetchCompanyData],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!context?.companyId) return false;
      try {
        await apiRequest<void>(`/companies/${context.companyId}/members/${memberId}`, {
          method: 'DELETE',
        });
        await fetchCompanyData();
        return true;
      } catch (error) {
        console.error('Error removing member:', error);
        return false;
      }
    },
    [context?.companyId, fetchCompanyData],
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: CompanyRole) => {
      if (!context?.companyId) return false;
      try {
        await apiRequest(`/companies/${context.companyId}/members/${memberId}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        });
        await fetchCompanyData();
        return true;
      } catch (error) {
        console.error('Error updating member role:', error);
        return false;
      }
    },
    [context?.companyId, fetchCompanyData],
  );

  const toggleInvitePermission = useCallback(
    async (memberId: string, canInvite: boolean) => {
      if (!context?.companyId) return false;
      try {
        await apiRequest(`/companies/${context.companyId}/members/${memberId}/invite-permission`, {
          method: 'PATCH',
          body: JSON.stringify({ can_invite: canInvite }),
        });
        await fetchCompanyData();
        return true;
      } catch (error) {
        console.error('Error updating invite permission:', error);
        return false;
      }
    },
    [context?.companyId, fetchCompanyData],
  );

  const deactivateInvite = useCallback(
    async (inviteId: string) => {
      if (!context?.companyId) return false;
      try {
        await apiRequest<void>(`/companies/${context.companyId}/invites/${inviteId}`, {
          method: 'DELETE',
        });
        await fetchCompanyData();
        return true;
      } catch (error) {
        console.error('Error deactivating invite:', error);
        return false;
      }
    },
    [context?.companyId, fetchCompanyData],
  );

  return {
    company,
    members,
    invites,
    loading: loading || contextLoading,
    isCEO: context?.companyRole === 'ceo',
    canInvite: Boolean(
      context?.companyPermissions.includes('company.invites.manage') || context?.companyCanInvite,
    ),
    createInvite,
    removeMember,
    updateMemberRole,
    toggleInvitePermission,
    deactivateInvite,
    refetch: fetchCompanyData,
  };
};
