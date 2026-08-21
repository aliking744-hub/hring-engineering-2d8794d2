import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  Coins,
  Crown,
  Gem,
  KeyRound,
  Loader2,
  Save,
  Shield,
  Users,
} from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/hooks/useCompany';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';
import { CompanyRole, ROLE_NAMES, STATUS_NAMES, TIER_NAMES } from '@/types/multiTenant';
import { toast } from 'sonner';

interface PermissionDefinition {
  key: string;
  label: string;
}

interface PermissionState {
  role: CompanyRole;
  permission_key: string;
  allowed: boolean;
  source: string;
}

interface PermissionMatrixResponse {
  catalog: PermissionDefinition[];
  matrix: PermissionState[];
}

const EDITABLE_ROLES: CompanyRole[] = ['deputy', 'manager', 'employee'];

const CompanySettings = () => {
  const navigate = useNavigate();
  const { context, loading: contextLoading, refetch: refetchContext } = useUserContext();
  const { company, members, loading, refetch } = useCompany();
  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [creditPoolEnabled, setCreditPoolEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState<string | null>(null);

  const canManageSettings = Boolean(context?.companyPermissions.includes('company.settings.manage'));
  const isCEO = context?.companyRole === 'ceo';

  useEffect(() => {
    if (!company) return;
    setCompanyName(company.name);
    setCompanyDomain(company.domain || '');
    setCreditPoolEnabled(Boolean(company.credit_pool_enabled));
  }, [company]);

  const loadMatrix = async () => {
    if (!context?.companyId || !isCEO) {
      setMatrix(null);
      return;
    }
    setMatrixLoading(true);
    try {
      setMatrix(await apiRequest<PermissionMatrixResponse>(`/company-admin/${context.companyId}/permissions`));
    } catch (error) {
      console.error('Permission matrix load failed:', error);
      toast.error('دریافت ماتریس دسترسی انجام نشد');
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    void loadMatrix();
  }, [context?.companyId, isCEO]);

  const saveCompany = async () => {
    if (!company || !context?.companyId || !canManageSettings) return;
    setSaving(true);
    try {
      await apiRequest(`/companies/${context.companyId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: companyName.trim(),
          domain: companyDomain.trim() || null,
          credit_pool_enabled: creditPoolEnabled,
        }),
      });
      await Promise.all([refetch(), refetchContext()]);
      toast.success('تنظیمات شرکت ذخیره شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره تنظیمات انجام نشد');
    } finally {
      setSaving(false);
    }
  };

  const stateFor = (role: CompanyRole, permissionKey: string) =>
    matrix?.matrix.find((item) => item.role === role && item.permission_key === permissionKey);

  const togglePermission = async (role: CompanyRole, permissionKey: string, allowed: boolean) => {
    if (!context?.companyId || !isCEO) return;
    const busyKey = `${role}:${permissionKey}`;
    setPermissionBusy(busyKey);
    try {
      const updated = await apiRequest<PermissionState>(`/company-admin/${context.companyId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ role, permission_key: permissionKey, allowed }),
      });
      setMatrix((current) => {
        if (!current) return current;
        return {
          ...current,
          matrix: current.matrix.map((item) =>
            item.role === role && item.permission_key === permissionKey ? updated : item,
          ),
        };
      });
      await refetchContext();
      toast.success('سطح دسترسی به‌روزرسانی شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر سطح دسترسی انجام نشد');
    } finally {
      setPermissionBusy(null);
    }
  };

  const creditsUsedPercent = useMemo(() => {
    if (!company?.monthly_credits) return 0;
    return Math.min(100, (company.used_credits / company.monthly_credits) * 100);
  }, [company]);
  const membersPercent = useMemo(() => {
    if (!company?.max_members) return 0;
    return Math.min(100, (members.length / company.max_members) * 100);
  }, [company, members.length]);

  if (contextLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!company || !context?.companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md"><CardContent className="p-8 text-center"><Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h2 className="mb-2 text-xl font-bold">شرکت فعالی برای این حساب یافت نشد</h2><Button onClick={() => navigate('/dashboard')}>بازگشت</Button></CardContent></Card>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>تنظیمات شرکت | {company.name}</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ChevronLeft className="h-5 w-5" /></Link></Button>
              <div><h1 className="text-2xl font-bold">تنظیمات شرکت</h1><p className="text-sm text-muted-foreground">{company.name} · {context.companyRole ? ROLE_NAMES[context.companyRole] : ''}</p></div>
            </div>
            {canManageSettings && <Button onClick={() => void saveCompany()} disabled={saving}>{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره تنظیمات</Button>}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> اطلاعات شرکت</CardTitle><CardDescription>تنظیماتی که tenant مجاز است خودش مدیریت کند.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>نام شرکت</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canManageSettings} /></div>
                <div className="space-y-2"><Label>دامنه</Label><Input dir="ltr" value={companyDomain} onChange={(e) => setCompanyDomain(e.target.value)} disabled={!canManageSettings} placeholder="company.com" /></div>
                <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-medium">استخر اعتبار شرکت</div><div className="text-xs text-muted-foreground">مصرف اعتبار در سطح شرکت</div></div><Switch checked={creditPoolEnabled} onCheckedChange={setCreditPoolEnabled} disabled={!canManageSettings} /></div>
                <div className="flex gap-2"><Badge variant="outline">{STATUS_NAMES[company.status]}</Badge><Badge variant="secondary">{TIER_NAMES[company.subscription_tier]}</Badge></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" /> قرارداد و مصرف</CardTitle><CardDescription>این موارد فقط توسط Platform Control Center قابل تغییرند.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div><div className="mb-2 flex justify-between text-sm"><span className="flex items-center gap-2"><Gem className="h-4 w-4" /> اعتبار ماهانه</span><span>{company.used_credits.toLocaleString('fa-IR')} / {company.monthly_credits.toLocaleString('fa-IR')}</span></div><Progress value={creditsUsedPercent} /></div>
                <div><div className="mb-2 flex justify-between text-sm"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> ظرفیت اعضا</span><span>{members.length.toLocaleString('fa-IR')} / {company.max_members.toLocaleString('fa-IR')}</span></div><Progress value={membersPercent} /></div>
                <div className="rounded-xl border p-4"><div className="flex items-center gap-2 font-medium"><Coins className="h-4 w-4" /> اعتبار تجمیعی</div><div className="mt-2 text-2xl font-bold">{company.credit_pool.toLocaleString('fa-IR')}</div></div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> سطح دسترسی نقش‌های شرکت</CardTitle><CardDescription>{isCEO ? 'مدیرعامل می‌تواند مجوزهای معاون، مدیر و کارشناس را برای همین شرکت تنظیم کند.' : 'فقط مدیرعامل شرکت به ماتریس سطح دسترسی دسترسی دارد.'}</CardDescription></CardHeader>
            <CardContent>
              {!isCEO ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground"><Shield className="mx-auto mb-3 h-8 w-8" />ماتریس مجوز برای حساب شما قابل ویرایش نیست.</div>
              ) : matrixLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : matrix ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>مجوز</TableHead>{EDITABLE_ROLES.map((role) => <TableHead key={role} className="text-center">{ROLE_NAMES[role]}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {matrix.catalog.map((permission) => (
                        <TableRow key={permission.key}>
                          <TableCell><div className="font-medium">{permission.label}</div><code className="text-[11px] text-muted-foreground">{permission.key}</code></TableCell>
                          {EDITABLE_ROLES.map((role) => {
                            const item = stateFor(role, permission.key);
                            const busy = permissionBusy === `${role}:${permission.key}`;
                            return <TableCell key={role} className="text-center"><div className="flex justify-center"><Switch checked={Boolean(item?.allowed)} disabled={busy} onCheckedChange={(checked) => void togglePermission(role, permission.key, checked)} /></div></TableCell>;
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <div className="text-sm text-muted-foreground">ماتریس دسترسی در دسترس نیست.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default CompanySettings;
