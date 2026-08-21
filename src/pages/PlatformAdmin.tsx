import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Activity,
  Building2,
  ChevronLeft,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';
import type { PlatformRole, SubscriptionTier } from '@/types/multiTenant';
import { TIER_NAMES } from '@/types/multiTenant';
import { toast } from 'sonner';

interface Overview {
  total_users: number;
  active_users: number;
  total_companies: number;
  active_companies: number;
  trial_companies: number;
  suspended_companies: number;
}

interface PlatformUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  platform_roles: PlatformRole[];
  app_roles: string[];
  created_at: string;
}

interface PlatformCompany {
  id: string;
  name: string;
  domain: string | null;
  status: 'active' | 'suspended' | 'trial';
  subscription_tier: SubscriptionTier;
  monthly_credits: number;
  used_credits: number;
  max_members: number;
  credit_pool: number | null;
  credit_pool_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  actor_user_id: string | null;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const PLATFORM_ROLES: PlatformRole[] = ['super_admin', 'platform_admin', 'content_admin', 'support_admin'];
const ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: 'سوپر ادمین',
  platform_admin: 'ادمین پلتفرم',
  content_admin: 'ادمین محصول/محتوا',
  support_admin: 'پشتیبانی',
};

const COMPANY_TIERS: SubscriptionTier[] = [
  'corporate_expert',
  'corporate_decision_support',
  'corporate_decision_making',
];

const PlatformAdmin = () => {
  const { context, loading: contextLoading } = useUserContext();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [companyTier, setCompanyTier] = useState<SubscriptionTier>('corporate_expert');
  const [monthlyCredits, setMonthlyCredits] = useState(100);
  const [maxMembers, setMaxMembers] = useState(10);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const roles = context?.platformRoles || [];
  const isSuperAdmin = roles.includes('super_admin');
  const canReadPlatform = isSuperAdmin || roles.includes('platform_admin') || roles.includes('support_admin') || context?.appRoles.includes('admin');
  const canManagePlatform = isSuperAdmin || roles.includes('platform_admin') || context?.appRoles.includes('admin');

  const load = useCallback(async () => {
    if (!canReadPlatform) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [overviewData, usersData, companiesData, auditData] = await Promise.all([
        apiRequest<Overview>('/admin/platform/overview'),
        apiRequest<PlatformUser[]>('/admin/platform/users?limit=200'),
        apiRequest<PlatformCompany[]>('/admin/platform/companies?limit=200'),
        apiRequest<AuditLog[]>('/admin/platform/audit-logs?limit=100'),
      ]);
      setOverview(overviewData);
      setUsers(usersData);
      setCompanies(companiesData);
      setAuditLogs(auditData);
    } catch (error) {
      console.error('Platform admin load failed:', error);
      toast.error(error instanceof Error ? error.message : 'دریافت اطلاعات پنل مدیریت انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [canReadPlatform]);

  useEffect(() => {
    if (!contextLoading) void load();
  }, [contextLoading, load]);

  const updateUserStatus = async (user: PlatformUser, isActive: boolean) => {
    setBusyKey(`user-status:${user.id}`);
    try {
      const updated = await apiRequest<PlatformUser>(`/admin/platform/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item));
      toast.success(isActive ? 'کاربر فعال شد' : 'کاربر غیرفعال شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر وضعیت کاربر انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const togglePlatformRole = async (user: PlatformUser, role: PlatformRole, enabled: boolean) => {
    if (!isSuperAdmin) return;
    setBusyKey(`role:${user.id}:${role}`);
    const nextRoles = enabled
      ? Array.from(new Set([...user.platform_roles, role]))
      : user.platform_roles.filter((item) => item !== role);
    try {
      const updated = await apiRequest<PlatformUser>(`/admin/platform/users/${user.id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: nextRoles }),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item));
      toast.success('نقش سراسری به‌روزرسانی شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر نقش انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const updateCompany = async (company: PlatformCompany, values: Partial<PlatformCompany>) => {
    setBusyKey(`company:${company.id}`);
    try {
      const updated = await apiRequest<PlatformCompany>(`/admin/platform/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setCompanies((current) => current.map((item) => item.id === company.id ? updated : item));
      toast.success('شرکت به‌روزرسانی شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'به‌روزرسانی شرکت انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const createCompany = async () => {
    if (!companyName.trim() || !ownerName.trim() || !ownerEmail.trim() || ownerPassword.length < 10) {
      toast.error('اطلاعات شرکت، مالک و رمز حداقل ۱۰ کاراکتری کامل نیست');
      return;
    }
    setBusyKey('create-company');
    try {
      await apiRequest('/admin/platform/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: companyName.trim(),
          domain: companyDomain.trim() || null,
          status: 'active',
          subscription_tier: companyTier,
          monthly_credits: monthlyCredits,
          max_members: maxMembers,
          owner: {
            email: ownerEmail.trim(),
            password: ownerPassword,
            full_name: ownerName.trim(),
          },
        }),
      });
      toast.success('شرکت و حساب مدیرعامل ساخته شد');
      setCreateOpen(false);
      setCompanyName(''); setCompanyDomain(''); setOwnerName(''); setOwnerEmail(''); setOwnerPassword('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت شرکت انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const cards = useMemo(() => [
    { label: 'کل کاربران', value: overview?.total_users || 0, icon: Users },
    { label: 'کاربران فعال', value: overview?.active_users || 0, icon: Activity },
    { label: 'کل شرکت‌ها', value: overview?.total_companies || 0, icon: Building2 },
    { label: 'شرکت فعال', value: overview?.active_companies || 0, icon: ShieldCheck },
  ], [overview]);

  if (contextLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!canReadPlatform) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Card className="max-w-md"><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto mb-3 h-12 w-12 text-destructive" /><h1 className="text-xl font-bold">دسترسی به Platform Control Center ندارید</h1><Button asChild className="mt-5"><Link to="/dashboard">بازگشت</Link></Button></CardContent></Card></div>;
  }

  return (
    <>
      <Helmet><title>Platform Control Center | HRing</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link to="/admin"><ChevronLeft className="h-5 w-5" /></Link></Button><div><h1 className="text-2xl font-bold">Platform Control Center</h1><p className="text-sm text-muted-foreground">مدیریت سراسری کاربران، شرکت‌ها، قرارداد و Audit</p></div></div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>{canManagePlatform && <Button onClick={() => setCreateOpen(true)}><Plus className="ml-2 h-4 w-4" />شرکت جدید</Button>}</div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map((item) => <Card key={item.label}><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3"><item.icon className="h-5 w-5 text-primary" /></div><div><div className="text-sm text-muted-foreground">{item.label}</div><div className="text-2xl font-bold">{item.value.toLocaleString('fa-IR')}</div></div></CardContent></Card>)}</div>

          <Tabs defaultValue="companies">
            <TabsList className="mb-5"><TabsTrigger value="companies">شرکت‌ها</TabsTrigger><TabsTrigger value="users">کاربران</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger></TabsList>
            <TabsContent value="companies"><Card><CardHeader><CardTitle>شرکت‌ها</CardTitle><CardDescription>پلن، وضعیت و ظرفیت قرارداد در سطح پلتفرم مدیریت می‌شود.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>شرکت</TableHead><TableHead>پلن</TableHead><TableHead>وضعیت</TableHead><TableHead>اعتبار</TableHead><TableHead>ظرفیت</TableHead></TableRow></TableHeader><TableBody>{companies.map((company) => <TableRow key={company.id}><TableCell><div className="font-medium">{company.name}</div><div className="text-xs text-muted-foreground" dir="ltr">{company.domain || '—'}</div></TableCell><TableCell><Select value={company.subscription_tier} disabled={!canManagePlatform || busyKey === `company:${company.id}`} onValueChange={(value) => void updateCompany(company, { subscription_tier: value as SubscriptionTier })}><SelectTrigger className="min-w-48"><SelectValue /></SelectTrigger><SelectContent>{COMPANY_TIERS.map((tier) => <SelectItem key={tier} value={tier}>{TIER_NAMES[tier]}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Select value={company.status} disabled={!canManagePlatform || busyKey === `company:${company.id}`} onValueChange={(value) => void updateCompany(company, { status: value as PlatformCompany['status'] })}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">فعال</SelectItem><SelectItem value="trial">آزمایشی</SelectItem><SelectItem value="suspended">معلق</SelectItem></SelectContent></Select></TableCell><TableCell>{company.used_credits.toLocaleString('fa-IR')} / {company.monthly_credits.toLocaleString('fa-IR')}</TableCell><TableCell>{company.max_members.toLocaleString('fa-IR')}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
            <TabsContent value="users"><Card><CardHeader><CardTitle>کاربران پلتفرم</CardTitle><CardDescription>{isSuperAdmin ? 'سوپر ادمین می‌تواند نقش‌های سراسری را مدیریت کند.' : 'نقش‌های سراسری فقط توسط سوپر ادمین تغییر می‌کنند.'}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>کاربر</TableHead><TableHead>وضعیت</TableHead><TableHead>نقش‌های سراسری</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell><div className="font-medium">{user.full_name || user.email}</div><div className="text-xs text-muted-foreground" dir="ltr">{user.email}</div></TableCell><TableCell><div className="flex items-center gap-2"><Switch checked={user.is_active} disabled={!canManagePlatform || busyKey === `user-status:${user.id}`} onCheckedChange={(checked) => void updateUserStatus(user, checked)} /><Badge variant={user.is_active ? 'default' : 'destructive'}>{user.is_active ? 'فعال' : 'غیرفعال'}</Badge></div></TableCell><TableCell><div className="flex flex-wrap gap-3">{PLATFORM_ROLES.map((role) => <label key={role} className="flex items-center gap-2 text-xs"><Switch checked={user.platform_roles.includes(role)} disabled={!isSuperAdmin || busyKey === `role:${user.id}:${role}`} onCheckedChange={(checked) => void togglePlatformRole(user, role, checked)} />{ROLE_LABELS[role]}</label>)}</div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
            <TabsContent value="audit"><Card><CardHeader><CardTitle>Audit Log</CardTitle><CardDescription>ردپای تغییرات مدیریتی و امنیتی.</CardDescription></CardHeader><CardContent className="space-y-2">{auditLogs.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><div className="font-mono text-sm">{row.action}</div><div className="text-xs text-muted-foreground">{row.resource_type} · {row.resource_id || '—'}</div></div><div className="text-xs text-muted-foreground" dir="ltr">{new Date(row.created_at).toLocaleString('fa-IR')}</div></div>)}</CardContent></Card></TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>ساخت شرکت و حساب مدیرعامل</DialogTitle><DialogDescription>هر شرکت tenant مستقل و CEO اختصاصی خودش را دریافت می‌کند.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div><Label>نام شرکت</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div><div><Label>دامنه</Label><Input dir="ltr" value={companyDomain} onChange={(e) => setCompanyDomain(e.target.value)} /></div><div><Label>پلن</Label><Select value={companyTier} onValueChange={(v) => setCompanyTier(v as SubscriptionTier)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMPANY_TIERS.map((tier) => <SelectItem key={tier} value={tier}>{TIER_NAMES[tier]}</SelectItem>)}</SelectContent></Select></div><div><Label>اعتبار ماهانه</Label><Input type="number" min={0} value={monthlyCredits} onChange={(e) => setMonthlyCredits(Number(e.target.value) || 0)} /></div><div><Label>حداکثر عضو</Label><Input type="number" min={1} value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value) || 1)} /></div><div><Label>نام مدیرعامل</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div><div><Label>ایمیل مدیرعامل</Label><Input dir="ltr" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></div><div><Label>رمز اولیه</Label><Input dir="ltr" type="password" minLength={10} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} /></div></div><DialogFooter><Button onClick={() => void createCompany()} disabled={busyKey === 'create-company'}>{busyKey === 'create-company' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ساخت شرکت</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
};

export default PlatformAdmin;
