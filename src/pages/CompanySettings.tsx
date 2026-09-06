import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Cpu,
  Crown,
  Gem,
  KeyRound,
  Loader2,
  Save,
  Shield,
  TestTube2,
  Trash2,
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

type CompanyAiMode = 'byok' | 'hring_managed';

interface CompanyAiConnection {
  id: string;
  company_id: string;
  capability_key: string;
  mode: CompanyAiMode;
  provider_key: string | null;
  adapter: string | null;
  base_url: string | null;
  default_model: string | null;
  auth_scheme: 'bearer' | 'x-api-key' | 'api-key' | 'x-goog-api-key';
  secret_configured: boolean;
  secret_hint: string | null;
  is_active: boolean;
  status: 'untested' | 'healthy' | 'unhealthy' | 'disabled';
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface CompanyAiCapability {
  feature_key: string;
  display_name: string;
  category: string;
  description: string;
  connection: CompanyAiConnection | null;
}

interface CompanyAiDraft {
  mode: CompanyAiMode;
  provider_key: string;
  adapter: string;
  base_url: string;
  default_model: string;
  auth_scheme: CompanyAiConnection['auth_scheme'];
  secret: string;
  is_active: boolean;
}

const emptyAiDraft = (): CompanyAiDraft => ({
  mode: 'hring_managed',
  provider_key: '',
  adapter: 'openai_compatible',
  base_url: '',
  default_model: '',
  auth_scheme: 'bearer',
  secret: '',
  is_active: true,
});

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
  const [aiCatalog, setAiCatalog] = useState<CompanyAiCapability[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedAiFeature, setSelectedAiFeature] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<CompanyAiDraft>(emptyAiDraft);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiDeleting, setAiDeleting] = useState(false);

  const canManageSettings = Boolean(context?.companyPermissions.includes('company.settings.manage'));
  const isCEO = context?.companyRole === 'ceo';
  const canReadAiConnections = Boolean(context?.companyPermissions.includes('company.integrations.read'));
  const canManageAiConnections = Boolean(context?.companyPermissions.includes('company.integrations.manage'));
  const selectedAiCapability = aiCatalog.find((item) => item.feature_key === selectedAiFeature) ?? null;

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

  const loadAiCatalog = async () => {
    if (!context?.companyId || !canReadAiConnections) {
      setAiCatalog([]);
      setSelectedAiFeature(null);
      return;
    }
    setAiLoading(true);
    try {
      const catalog = await apiRequest<CompanyAiCapability[]>(
        `/companies/${context.companyId}/ai-connections/catalog`,
      );
      setAiCatalog(catalog);
      setSelectedAiFeature((current) => current && catalog.some((item) => item.feature_key === current)
        ? current
        : catalog[0]?.feature_key ?? null);
    } catch (error) {
      console.error('Company AI catalog load failed:', error);
      toast.error('دریافت اتصال‌های هوش مصنوعی انجام نشد');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    void loadAiCatalog();
  }, [context?.companyId, canReadAiConnections]);

  useEffect(() => {
    const connection = selectedAiCapability?.connection;
    setAiDraft(connection ? {
      mode: connection.mode,
      provider_key: connection.provider_key || '',
      adapter: connection.adapter || 'openai_compatible',
      base_url: connection.base_url || '',
      default_model: connection.default_model || '',
      auth_scheme: connection.auth_scheme,
      secret: '',
      is_active: connection.is_active,
    } : emptyAiDraft());
  }, [selectedAiFeature, selectedAiCapability?.connection?.id, selectedAiCapability?.connection?.updated_at]);

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

  const saveAiConnection = async () => {
    if (!context?.companyId || !selectedAiCapability || !canManageAiConnections) return;
    if (
      aiDraft.mode === 'byok'
      && !selectedAiCapability.connection?.secret_configured
      && !aiDraft.secret.trim()
    ) {
      toast.error('برای نخستین اتصال BYOK، کلید Provider لازم است');
      return;
    }
    setAiSaving(true);
    try {
      await apiRequest<CompanyAiConnection>(
        `/companies/${context.companyId}/ai-connections/${selectedAiCapability.feature_key}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            ...aiDraft,
            secret: aiDraft.secret.trim() || undefined,
          }),
        },
      );
      setAiDraft((current) => ({ ...current, secret: '' }));
      await loadAiCatalog();
      toast.success(aiDraft.mode === 'byok' ? 'تنظیم اتصال AI ذخیره شد؛ برای فعال شدن ابتدا تست کنید' : 'مسیر مدیریت‌شدهٔ HRing ذخیره شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره اتصال AI انجام نشد');
    } finally {
      setAiSaving(false);
    }
  };

  const testAiConnection = async () => {
    if (!context?.companyId || !selectedAiCapability || !canManageAiConnections) return;
    setAiTesting(true);
    try {
      const result = await apiRequest<{ healthy: boolean; message: string }>(
        `/companies/${context.companyId}/ai-connections/${selectedAiCapability.feature_key}/test`,
        { method: 'POST' },
      );
      await loadAiCatalog();
      if (result.healthy) toast.success('اتصال AI با موفقیت تست شد');
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تست اتصال انجام نشد');
    } finally {
      setAiTesting(false);
    }
  };

  const deleteAiConnection = async () => {
    if (!context?.companyId || !selectedAiCapability?.connection || !canManageAiConnections) return;
    setAiDeleting(true);
    try {
      await apiRequest<void>(
        `/companies/${context.companyId}/ai-connections/${selectedAiCapability.feature_key}`,
        { method: 'DELETE' },
      );
      await loadAiCatalog();
      toast.success('اتصال اختصاصی این قابلیت حذف شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف اتصال انجام نشد');
    } finally {
      setAiDeleting(false);
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
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link to="/company-members"><Users className="ml-2 h-4 w-4" />کاربران، نقش‌ها و اعتبار</Link></Button>
              {canManageSettings && <Button onClick={() => void saveCompany()} disabled={saving}>{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره تنظیمات</Button>}
            </div>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5 text-primary" /> اتصال هوش مصنوعی شرکت</CardTitle>
              <CardDescription>برای هر قابلیت، کلید اختصاصی شرکت یا سرویس مدیریت‌شدهٔ HRing را انتخاب کنید. کلید فقط هنگام ذخیره ارسال می‌شود و هرگز دوباره نمایش داده نمی‌شود.</CardDescription>
            </CardHeader>
            <CardContent>
              {!canReadAiConnections ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">مجوز مشاهدهٔ اتصال‌های AI برای این حساب فعال نیست.</div>
              ) : aiLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : selectedAiCapability ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <div className="max-h-[34rem] space-y-2 overflow-y-auto rounded-xl border p-2">
                    {aiCatalog.map((capability) => {
                      const active = capability.feature_key === selectedAiCapability.feature_key;
                      const connection = capability.connection;
                      return (
                        <button
                          type="button"
                          key={capability.feature_key}
                          onClick={() => setSelectedAiFeature(capability.feature_key)}
                          className={`w-full rounded-lg border p-3 text-right transition ${active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{capability.display_name}</span>
                            {connection?.mode === 'hring_managed' || connection?.status === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{connection?.mode === 'byok' ? `کلید اختصاصی شرکت · ${connection.status === 'healthy' ? 'تست‌شده' : 'نیازمند تست'}` : 'سرویس مدیریت‌شدهٔ HRing'}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><div className="font-semibold">{selectedAiCapability.display_name}</div><div className="mt-1 text-sm text-muted-foreground">{selectedAiCapability.description}</div></div>
                        <Badge variant={selectedAiCapability.connection?.mode === 'hring_managed' || selectedAiCapability.connection?.status === 'healthy' ? 'default' : 'outline'}>{selectedAiCapability.connection?.mode === 'hring_managed' ? 'مدیریت‌شده' : selectedAiCapability.connection?.status === 'healthy' ? 'تست موفق' : 'فعال‌سازی پس از تست'}</Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button type="button" variant={aiDraft.mode === 'hring_managed' ? 'default' : 'outline'} disabled={!canManageAiConnections} onClick={() => setAiDraft((current) => ({ ...current, mode: 'hring_managed' }))}>اعتبار مدیریت‌شدهٔ HRing</Button>
                      <Button type="button" variant={aiDraft.mode === 'byok' ? 'default' : 'outline'} disabled={!canManageAiConnections} onClick={() => setAiDraft((current) => ({ ...current, mode: 'byok' }))}>کلید اختصاصی شرکت</Button>
                    </div>
                    {aiDraft.mode === 'hring_managed' ? (
                      <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">این قابلیت با Provider و قیمت‌گذاری پلتفرم اجرا می‌شود. هزینه فقط هنگام اجرای موفق از اعتبار شرکت کم می‌شود.</div>
                    ) : (
                      <div className="space-y-3 rounded-xl border p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1"><Label>شناسه Provider</Label><Input dir="ltr" value={aiDraft.provider_key} disabled={!canManageAiConnections} placeholder="openai-company" onChange={(event) => setAiDraft((current) => ({ ...current, provider_key: event.target.value }))} /></div>
                          <div className="space-y-1"><Label>Adapter</Label><Input dir="ltr" value={aiDraft.adapter} disabled={!canManageAiConnections} placeholder="openai_compatible" onChange={(event) => setAiDraft((current) => ({ ...current, adapter: event.target.value }))} /></div>
                          <div className="space-y-1"><Label>Base URL</Label><Input dir="ltr" value={aiDraft.base_url} disabled={!canManageAiConnections} placeholder="https://api.example.com/v1" onChange={(event) => setAiDraft((current) => ({ ...current, base_url: event.target.value }))} /></div>
                          <div className="space-y-1"><Label>مدل پیش‌فرض</Label><Input dir="ltr" value={aiDraft.default_model} disabled={!canManageAiConnections} placeholder="gpt-4.1-mini" onChange={(event) => setAiDraft((current) => ({ ...current, default_model: event.target.value }))} /></div>
                        </div>
                        <div className="space-y-1"><Label>کلید Provider {selectedAiCapability.connection?.secret_configured ? `(ثبت‌شده: ${selectedAiCapability.connection.secret_hint || '••••'})` : ''}</Label><Input dir="ltr" type="password" autoComplete="new-password" value={aiDraft.secret} disabled={!canManageAiConnections} placeholder={selectedAiCapability.connection?.secret_configured ? 'فقط برای تعویض کلید وارد کنید' : 'کلید Provider'} onChange={(event) => setAiDraft((current) => ({ ...current, secret: event.target.value }))} /></div>
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm"><span>اتصال برای اجرا فعال باشد</span><Switch checked={aiDraft.is_active} disabled={!canManageAiConnections} onCheckedChange={(checked) => setAiDraft((current) => ({ ...current, is_active: checked }))} /></div>
                      </div>
                    )}
                    {canManageAiConnections && <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void saveAiConnection()} disabled={aiSaving}>{aiSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره اتصال</Button>
                      {selectedAiCapability.connection?.mode === 'byok' && <Button type="button" variant="secondary" onClick={() => void testAiConnection()} disabled={aiTesting}>{aiTesting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <TestTube2 className="ml-2 h-4 w-4" />}تست اتصال</Button>}
                      {selectedAiCapability.connection && <Button type="button" variant="outline" onClick={() => void deleteAiConnection()} disabled={aiDeleting}>{aiDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Trash2 className="ml-2 h-4 w-4" />}حذف تنظیم اختصاصی</Button>}
                    </div>}
                    {selectedAiCapability.connection?.last_error && <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{selectedAiCapability.connection.last_error}</div>}
                  </div>
                </div>
              ) : <div className="text-sm text-muted-foreground">قابلیت قابل‌تنظیمی برای این شرکت پیدا نشد.</div>}
            </CardContent>
          </Card>

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
