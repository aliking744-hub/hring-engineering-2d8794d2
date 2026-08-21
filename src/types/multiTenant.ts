// Multi-tenant type definitions for HRing platform

export type CompanyStatus = 'active' | 'suspended' | 'trial';

export type SubscriptionTier =
  | 'individual_free'
  | 'individual_expert'
  | 'individual_pro'
  | 'individual_plus'
  | 'corporate_expert'
  | 'corporate_decision_support'
  | 'corporate_decision_making';

export type CompanyRole = 'ceo' | 'deputy' | 'manager' | 'employee';
export type PlatformRole = 'super_admin' | 'platform_admin' | 'content_admin' | 'support_admin';
export type UserType = 'individual' | 'corporate';

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  status: CompanyStatus;
  subscription_tier: SubscriptionTier;
  monthly_credits: number;
  used_credits: number;
  max_members: number;
  credit_pool: number;
  credit_pool_enabled: boolean;
  last_credit_reset: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  can_invite: boolean;
  is_active: boolean;
  invited_by: string | null;
  joined_at: string;
  company?: Company;
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  user_type: UserType;
  subscription_tier: SubscriptionTier | null;
  monthly_credits: number;
  used_credits: number;
  is_active: boolean;
  created_at: string;
}

export interface FeaturePermission {
  id: string;
  feature_key: string;
  feature_name: string;
  feature_category: string;
  description: string | null;
  allowed_tiers: SubscriptionTier[];
  allowed_company_roles: CompanyRole[] | null;
  allow_view: boolean;
  allow_edit: boolean;
  credit_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyInvite {
  id: string;
  company_id: string;
  invite_code: string;
  role: CompanyRole;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface CreditTransaction {
  id: string;
  user_id: string | null;
  company_id: string | null;
  amount: number;
  transaction_type: 'usage' | 'purchase' | 'refund' | 'monthly_reset';
  feature_key: string | null;
  description: string | null;
  created_at: string;
}

export interface UserContext {
  userId: string;
  email: string | null;
  userType: UserType;
  subscriptionTier: SubscriptionTier | null;
  isAdmin: boolean;
  platformRoles: PlatformRole[];
  appRoles: string[];
  companyId: string | null;
  companyRole: CompanyRole | null;
  companyTier: SubscriptionTier | null;
  credits: number;
  usedCredits: number;
  companyCreditPool: number;
  companyCreditPoolEnabled: boolean;
  fullName: string | null;
  title: string | null;
  avatarUrl: string | null;
}

export interface FeatureAccess {
  hasAccess: boolean;
  canEdit: boolean;
  creditCost: number;
  reason?: string;
}

export const TIER_NAMES: Record<SubscriptionTier, string> = {
  individual_free: 'رایگان',
  individual_expert: 'کارشناس',
  individual_pro: 'حرفه‌ای',
  individual_plus: 'پلاس',
  corporate_expert: 'شرکتی - کارشناس',
  corporate_decision_support: 'شرکتی - پشتیبان تصمیم',
  corporate_decision_making: 'شرکتی - تصمیم‌ساز',
};

export const ROLE_NAMES: Record<CompanyRole, string> = {
  ceo: 'مدیرعامل',
  deputy: 'معاون',
  manager: 'مدیر',
  employee: 'کارشناس',
};

export const STATUS_NAMES: Record<CompanyStatus, string> = {
  active: 'فعال',
  suspended: 'معلق',
  trial: 'آزمایشی',
};
