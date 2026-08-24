import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  Cloud,
  KeyRound,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  TestTube2,
  Trash2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

type ProviderStatus = 'untested' | 'healthy' | 'unhealthy' | 'disabled';

interface IntegrationProvider {
  id: string;
  provider_key: string;
  display_name: string;
  provider_type: string;
  adapter: string;
  base_url: string | null;
  default_model: string | null;
  auth_scheme: string;
  secret_configured: boolean;
  secret_hint: string | null;
  is_active: boolean;
  is_internal: boolean;
  priority: number;
  timeout_seconds: number;
  max_retries: number;
  capabilities: string[];
  settings: Record<string, unknown>;
  quota: Record<string, unknown>;
  status: ProviderStatus;
  last_tested_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectionTestResult {
  healthy: boolean;
  status: ProviderStatus;
  http_status: number | null;
  latency_ms: number | null;
  message: string;
}

interface EditorState {
  providerKey: string;
  displayName: string;
  providerType: string;
  adapter: string;
  baseUrl: string;
  defaultModel: string;
  authScheme: string;
  secret: string;
  isActive: boolean;
  isInternal: boolean;
  priority: number;
  timeoutSeconds: number;
  maxRetries: number;
  capabilities: string;
  routingAliases: string;
  fallbackFor: string;
  settings: string;
  quota: string;
}

const PROVIDER_TYPES = [
  ['llm', 'مدل زبانی'],
  ['email', 'ایمیل'],
  ['sms', 'پیامک'],
  ['payment', 'پرداخت'],
] as const;

const RUNTIME_ADAPTERS_BY_TYPE: Record<string, readonly string[]> = {
  llm: [
    'openai_compatible',
    'openai',
    'anthropic',
    'gemini_openai',
    'perplexity',
    'ollama',
    'vllm',
  ],
  email: ['resend'],
  sms: ['kavenegar'],
  payment: ['zarinpal'],
};

const emptyEditor: EditorState = {
  providerKey: '',
  displayName: '',
  providerType: 'llm',
  adapter: 'openai_compatible',
  baseUrl: '',
  defaultModel: '',
  authScheme: 'bearer',
  secret: '',
  isActive: true,
  isInternal: false,
  priority: 100,
  timeoutSeconds: 15,
  maxRetries: 2,
  capabilities: '',
  routingAliases: '',
  fallbackFor: '',
  settings: '{}',
  quota: '{}',
};

const statusLabel: Record<ProviderStatus, string> = {
  untested: 'تست‌نشده',
  healthy: 'سالم',
  unhealthy: 'خطا',
  disabled: 'غیرفعال',
};

const statusVariant = (status: ProviderStatus): 'default' | 'destructive' | 'secondary' | 'outline' => {
  if (status === 'healthy') return 'default';
  if (status === 'unhealthy') return 'destructive';
  if (status === 'disabled') return 'secondary';
  return 'outline';
};

type PresetKey = 'zarinpal' | 'kavenegar' | 'resend' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

const parseObject = (value: string, label: string): Record<string, unknown> => {
  const parsed: unknown = value.trim() ? JSON.parse(value) : {};
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${label} باید یک JSON object باشد`);
  }
  return parsed as Record<string, unknown>;
};

const stringListSetting = (settings: Record<string, unknown>, key: string): string => {
  const value = settings[key];
  if (!Array.isArray(value)) return '';
  return value.filter((item): item is string => typeof item === 'string').join(', ');
};

const IntegrationCenter = () => {
  const { context, loading: contextLoading } = useUserContext();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretProvider, setSecretProvider] = useState<IntegrationProvider | null>(null);
  const [replacementSecret, setReplacementSecret] = useState('');

  const roles = context?.platformRoles || [];
  const hasLegacyAdmin = context?.appRoles.includes('admin') || false;
  const canRead = roles.some((role) => ['super_admin', 'platform_admin', 'support_admin'].includes(role)) || hasLegacyAdmin;
  const canManage = roles.includes('super_admin');
  const supportedAdapters = RUNTIME_ADAPTERS_BY_TYPE[editor.providerType] || [];

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProviders(await apiRequest<IntegrationProvider[]>('/admin/platform/integrations/providers'));
    } catch (error) {
      console.error('Integration center load failed:', error);
      toast.error(error instanceof Error ? error.message : 'دریافت اتصال‌ها انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    if (!contextLoading) void load();
  }, [contextLoading, load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((provider) => [
      provider.provider_key,
      provider.display_name,
      provider.provider_type,
      provider.adapter,
      provider.default_model || '',
    ].some((value) => value.toLowerCase().includes(query)));
  }, [providers, search]);

  const runtimeReadiness = useMemo(() => {
    const specs = [
      { type: 'llm', label: 'هوش مصنوعی' },
      { type: 'payment', label: 'پرداخت' },
      { type: 'sms', label: 'پیامک OTP' },
      { type: 'email', label: 'ایمیل تراکنشی' },
    ];
    return specs.map((spec) => {
      const candidates = providers.filter(
        (provider) =>
          provider.provider_type === spec.type &&
          (RUNTIME_ADAPTERS_BY_TYPE[spec.type] || []).includes(provider.adapter),
      );
      const configured = candidates[0];
      const active = candidates.find((provider) => provider.is_active);
      const ready = candidates.some(
        (provider) =>
          provider.is_active &&
          provider.status === 'healthy' &&
          ((provider.is_internal && provider.auth_scheme === 'none') || provider.secret_configured),
      );
      let state = 'ثبت نشده';
      if (ready) state = 'آماده';
      else if (configured && !active) state = 'غیرفعال';
      else if (active && !active.secret_configured && !active.is_internal) state = 'نیازمند کلید';
      else if (active?.status === 'untested') state = 'نیازمند تست';
      else if (active?.status === 'unhealthy') state = 'خطای اتصال';
      return { ...spec, ready, state };
    });
  }, [providers]);

  const openNew = () => {
    setEditingId(null);
    setEditor(emptyEditor);
    setEditorOpen(true);
  };

  const applyPreset = (adapter: PresetKey) => {
    const presets: Record<typeof adapter, Partial<EditorState>> = {
      zarinpal: {
        providerKey: 'zarinpal.primary',
        displayName: 'زرین‌پال اصلی',
        providerType: 'payment',
        adapter: 'zarinpal',
        baseUrl: 'https://api.zarinpal.com/pg/v4/payment',
        authScheme: 'none',
        isInternal: false,
        routingAliases: '',
        fallbackFor: '',
        settings: '{}',
      },
      kavenegar: {
        providerKey: 'kavenegar.otp',
        displayName: 'پیامک OTP کاوه‌نگار',
        providerType: 'sms',
        adapter: 'kavenegar',
        baseUrl: 'https://api.kavenegar.com/v1',
        authScheme: 'none',
        isInternal: false,
        routingAliases: '',
        fallbackFor: '',
        settings: '{\n  "otp_template": "hringotp"\n}',
      },
      resend: {
        providerKey: 'resend.transactional',
        displayName: 'ایمیل تراکنشی Resend',
        providerType: 'email',
        adapter: 'resend',
        baseUrl: 'https://api.resend.com',
        authScheme: 'bearer',
        isInternal: false,
        routingAliases: '',
        fallbackFor: '',
        settings: '{\n  "from_address": "HRing <noreply@hring.ir>"\n}',
      },
      openai: {
        providerKey: 'openai.primary',
        displayName: 'OpenAI (ChatGPT)',
        providerType: 'llm',
        adapter: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: '',
        authScheme: 'bearer',
        isInternal: false,
        capabilities: 'chat',
        routingAliases: 'openai',
        fallbackFor: '',
        settings: '{}',
      },
      anthropic: {
        providerKey: 'anthropic.primary',
        displayName: 'Anthropic (Claude)',
        providerType: 'llm',
        adapter: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        defaultModel: '',
        authScheme: 'x-api-key',
        isInternal: false,
        capabilities: 'chat',
        routingAliases: 'anthropic, claude',
        fallbackFor: '',
        settings: '{}',
      },
      gemini: {
        providerKey: 'gemini.primary',
        displayName: 'Gemini اصلی',
        providerType: 'llm',
        adapter: 'gemini_openai',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: '',
        authScheme: 'bearer',
        isInternal: false,
        capabilities: 'chat',
        routingAliases: 'gemini',
        fallbackFor: '',
        settings: '{}',
      },
      ollama: {
        providerKey: 'ollama.local',
        displayName: 'مدل لوکال Ollama',
        providerType: 'llm',
        adapter: 'ollama',
        baseUrl: 'http://ollama:11434/v1',
        defaultModel: '',
        authScheme: 'none',
        isInternal: true,
        capabilities: 'chat',
        routingAliases: 'ollama',
        fallbackFor: 'gemini, openai',
        settings: '{}',
      },
      custom: {
        providerKey: 'custom.primary',
        displayName: 'سرویس سازگار با OpenAI',
        providerType: 'llm',
        adapter: 'openai_compatible',
        baseUrl: '',
        defaultModel: '',
        authScheme: 'bearer',
        isInternal: false,
        capabilities: 'chat',
        routingAliases: 'custom',
        fallbackFor: '',
        settings: '{}',
      },
    };
    setEditor((current) => ({ ...current, ...presets[adapter] }));
  };

  const openPreset = (preset: PresetKey) => {
    setEditingId(null);
    setEditor(emptyEditor);
    applyPreset(preset);
    setEditorOpen(true);
  };

  const openEdit = (provider: IntegrationProvider) => {
    setEditingId(provider.id);
    setEditor({
      providerKey: provider.provider_key,
      displayName: provider.display_name,
      providerType: provider.provider_type,
      adapter: provider.adapter,
      baseUrl: provider.base_url || '',
      defaultModel: provider.default_model || '',
      authScheme: provider.auth_scheme,
      secret: '',
      isActive: provider.is_active,
      isInternal: provider.is_internal,
      priority: provider.priority,
      timeoutSeconds: provider.timeout_seconds,
      maxRetries: provider.max_retries,
      capabilities: provider.capabilities.join(', '),
      routingAliases: stringListSetting(provider.settings, 'aliases'),
      fallbackFor: stringListSetting(provider.settings, 'fallback_for'),
      settings: JSON.stringify(provider.settings, null, 2),
      quota: JSON.stringify(provider.quota, null, 2),
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!canManage) return;
    if (!/^[a-z0-9][a-z0-9_.-]+$/.test(editor.providerKey.trim())) {
      toast.error('کلید اتصال فقط می‌تواند شامل حروف کوچک انگلیسی، عدد، نقطه، خط تیره و زیرخط باشد');
      return;
    }
    if (!editor.displayName.trim() || !editor.adapter.trim()) {
      toast.error('نام نمایشی و Adapter الزامی است');
      return;
    }
    if (!supportedAdapters.includes(editor.adapter)) {
      toast.error('این Adapter هنوز به مسیر اجرایی نوع انتخاب‌شده متصل نیست');
      return;
    }
    if (editor.providerType === 'llm' && !editor.defaultModel.trim()) {
      toast.error('برای اتصال هوش مصنوعی، نام مدل پیش‌فرض را وارد کنید');
      return;
    }

    let settings: Record<string, unknown>;
    let quota: Record<string, unknown>;
    try {
      settings = parseObject(editor.settings, 'تنظیمات');
      quota = parseObject(editor.quota, 'سقف مصرف');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'JSON نامعتبر است');
      return;
    }
    const aliases = editor.routingAliases.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const fallbackFor = editor.fallbackFor.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (aliases.length) settings.aliases = Array.from(new Set(aliases));
    else delete settings.aliases;
    if (fallbackFor.length) settings.fallback_for = Array.from(new Set(fallbackFor));
    else delete settings.fallback_for;

    setBusyKey('save');
    try {
      const common = {
        display_name: editor.displayName.trim(),
        provider_type: editor.providerType,
        adapter: editor.adapter.trim(),
        base_url: editor.baseUrl.trim() || null,
        default_model: editor.defaultModel.trim() || null,
        auth_scheme: editor.authScheme,
        is_active: editor.isActive,
        is_internal: editor.isInternal,
        priority: editor.priority,
        timeout_seconds: editor.timeoutSeconds,
        max_retries: editor.maxRetries,
        capabilities: editor.capabilities.split(',').map((item) => item.trim()).filter(Boolean),
        settings,
        quota,
      };
      const updated = editingId
        ? await apiRequest<IntegrationProvider>(`/admin/platform/integrations/providers/${editingId}`, {
            method: 'PATCH',
            body: JSON.stringify(common),
          })
        : await apiRequest<IntegrationProvider>('/admin/platform/integrations/providers', {
            method: 'POST',
            body: JSON.stringify({
              provider_key: editor.providerKey.trim(),
              ...common,
              secret: editor.secret || null,
            }),
          });
      setProviders((current) => {
        const exists = current.some((item) => item.id === updated.id);
        return exists
          ? current.map((item) => item.id === updated.id ? updated : item)
          : [...current, updated];
      });
      setEditorOpen(false);
      toast.success(editingId ? 'اتصال به‌روزرسانی شد' : 'اتصال جدید ثبت شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره اتصال انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const testConnection = async (provider: IntegrationProvider) => {
    if (!canManage) return;
    setBusyKey(`test:${provider.id}`);
    try {
      const result = await apiRequest<ConnectionTestResult>(
        `/admin/platform/integrations/providers/${provider.id}/test`,
        { method: 'POST' },
      );
      if (result.healthy) {
        toast.success(
          provider.adapter === 'zarinpal'
            ? 'درگاه رسمی در دسترس است و قالب Merchant ID معتبر است؛ برای ایمنی هیچ تراکنشی در تست ساخته نشد'
            : `اتصال سالم است${result.latency_ms !== null ? ` (${result.latency_ms}ms)` : ''}`,
        );
      } else {
        toast.error(result.message);
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تست اتصال انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const openSecret = (provider: IntegrationProvider) => {
    setSecretProvider(provider);
    setReplacementSecret('');
    setSecretOpen(true);
  };

  const rotateSecret = async () => {
    if (!canManage || !secretProvider || !replacementSecret) return;
    setBusyKey(`secret:${secretProvider.id}`);
    try {
      const updated = await apiRequest<IntegrationProvider>(
        `/admin/platform/integrations/providers/${secretProvider.id}/rotate-secret`,
        { method: 'POST', body: JSON.stringify({ secret: replacementSecret }) },
      );
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
      setReplacementSecret('');
      setSecretOpen(false);
      toast.success('کلید با موفقیت تعویض شد؛ برای فعال‌سازی تست اتصال بگیرید');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعویض کلید انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  const revokeSecret = async (provider: IntegrationProvider) => {
    if (!canManage || !provider.secret_configured) return;
    if (!window.confirm(`کلید «${provider.display_name}» لغو شود؟ این عملیات سرویس وابسته را متوقف می‌کند.`)) return;
    setBusyKey(`revoke:${provider.id}`);
    try {
      const updated = await apiRequest<IntegrationProvider>(
        `/admin/platform/integrations/providers/${provider.id}/secret`,
        { method: 'DELETE' },
      );
      setProviders((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('کلید اتصال لغو شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'لغو کلید انجام نشد');
    } finally {
      setBusyKey(null);
    }
  };

  if (contextLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">دسترسی به مرکز یکپارچه‌سازی ندارید</h1>
            <Button asChild className="mt-5"><Link to="/admin">بازگشت</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>مرکز یکپارچه‌سازی | HRing</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
          <Button variant="outline" asChild className="mb-5"><Link to="/admin"><ArrowRight className="ml-2 h-4 w-4" />بازگشت به مرکز مدیریت</Link></Button>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold"><PlugZap className="h-6 w-6 text-primary" />اتصال سرویس‌ها و APIها</h1>
              <p className="mt-1 text-sm text-muted-foreground">ثبت امن کلیدها، آدرس سرویس‌ها و تست سلامت اتصال؛ از AI تا پرداخت، پیامک و ایمیل.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>
              {canManage && <Button onClick={openNew}><Plus className="ml-2 h-4 w-4" />اتصال جدید</Button>}
            </div>
          </div>

          <Card className="mb-5 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-start gap-3">
                <BrainCircuit className="mt-0.5 h-6 w-6 text-primary" />
                <div><div className="font-medium">این صفحه فقط اتصال سرویس‌ها را مدیریت می‌کند</div><div className="mt-1 text-sm text-muted-foreground">فقط Adapterهای متصل به runtime قابل ثبت‌اند. برای تغییر هوش هر قابلیت، وارد «مدیریت هوش قابلیت‌ها» شوید.</div></div>
              </div>
              <Button asChild><Link to="/admin/prompts">مدیریت هوش قابلیت‌ها</Link></Button>
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardHeader><CardTitle className="text-base">آمادگی سرویس‌های اجرایی</CardTitle><CardDescription>سرویس فقط پس از ثبت کلید و تست موفق وارد مسیر واقعی HRing می‌شود.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {runtimeReadiness.map((item) => (
                <div key={item.type} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant={item.ready ? 'default' : item.state === 'خطای اتصال' ? 'destructive' : 'secondary'}>{item.state}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {canManage && (
            <Card className="mb-5">
              <CardHeader><CardTitle className="text-base">اتصال سریع سرویس‌های هوش مصنوعی</CardTitle><CardDescription>سرویس را انتخاب کنید، نام مدل و API Key همان حساب را وارد کنید و سپس تست اتصال بگیرید.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openPreset('openai')}>OpenAI (ChatGPT)</Button>
                <Button variant="outline" onClick={() => openPreset('anthropic')}>Anthropic (Claude)</Button>
                <Button variant="outline" onClick={() => openPreset('gemini')}>Google Gemini</Button>
                <Button variant="outline" onClick={() => openPreset('ollama')}>Ollama لوکال</Button>
                <Button variant="outline" onClick={() => openPreset('custom')}>سرویس سازگار با OpenAI</Button>
              </CardContent>
            </Card>
          )}

          {!canManage && (
            <Card className="mb-5 border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 p-4 text-sm">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />
                <div><div className="font-medium">حالت فقط خواندنی</div><div className="text-muted-foreground">برای جلوگیری از افشای کلیدها، ایجاد اتصال، تست و تعویض Secret فقط برای سوپر ادمین فعال است.</div></div>
              </CardContent>
            </Card>
          )}

          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">کل اتصال‌ها</div><div className="mt-1 text-2xl font-bold">{providers.length.toLocaleString('fa-IR')}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">سالم</div><div className="mt-1 text-2xl font-bold text-emerald-600">{providers.filter((item) => item.status === 'healthy').length.toLocaleString('fa-IR')}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">نیازمند بررسی</div><div className="mt-1 text-2xl font-bold text-destructive">{providers.filter((item) => item.status === 'unhealthy').length.toLocaleString('fa-IR')}</div></CardContent></Card>
            <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">مدل/AI</div><div className="mt-1 text-2xl font-bold">{providers.filter((item) => item.provider_type === 'llm').length.toLocaleString('fa-IR')}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle>فهرست اتصال‌های ثبت‌شده</CardTitle><CardDescription>کلیدهای محرمانه هرگز به مرورگر برگردانده نمی‌شوند؛ فقط چهار نویسه آخر برای تشخیص کلید نمایش داده می‌شود.</CardDescription></div>
                <Input className="max-w-sm" placeholder="جستجو در نام، نوع، مدل یا adapter..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>اتصال</TableHead><TableHead>نوع</TableHead><TableHead>مدل/Adapter</TableHead><TableHead>کلید</TableHead><TableHead>وضعیت</TableHead><TableHead>آخرین تست</TableHead>{canManage && <TableHead>عملیات</TableHead>}</TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell><div className="flex items-center gap-2">{provider.is_internal ? <Server className="h-4 w-4 text-primary" /> : <Cloud className="h-4 w-4 text-primary" />}<div><div className="font-medium">{provider.display_name}</div><div dir="ltr" className="text-left font-mono text-xs text-muted-foreground">{provider.provider_key}</div></div></div></TableCell>
                        <TableCell><Badge variant="outline">{provider.provider_type}</Badge></TableCell>
                        <TableCell><div className="text-sm">{provider.default_model || '—'}</div><div dir="ltr" className="text-left text-xs text-muted-foreground">{provider.adapter}</div></TableCell>
                        <TableCell>{provider.secret_configured ? <span dir="ltr" className="font-mono text-xs">{provider.secret_hint}</span> : <span className="text-xs text-muted-foreground">بدون کلید</span>}</TableCell>
                        <TableCell><Badge variant={statusVariant(provider.status)}>{statusLabel[provider.status]}</Badge>{provider.last_error && <div className="mt-1 max-w-48 truncate text-xs text-destructive" title={provider.last_error}>{provider.last_error}</div>}</TableCell>
                        <TableCell className="text-xs">{provider.last_tested_at ? new Date(provider.last_tested_at).toLocaleString('fa-IR') : '—'}</TableCell>
                        {canManage && (
                          <TableCell><div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="ویرایش" onClick={() => openEdit(provider)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="تست اتصال" disabled={busyKey === `test:${provider.id}`} onClick={() => void testConnection(provider)}>{busyKey === `test:${provider.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}</Button>
                            <Button size="icon" variant="ghost" title="تعویض کلید" onClick={() => openSecret(provider)}><KeyRound className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="لغو کلید" disabled={!provider.secret_configured || busyKey === `revoke:${provider.id}`} onClick={() => void revokeSecret(provider)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div></TableCell>
                        )}
                      </TableRow>
                    ))}
                    {!filtered.length && <TableRow><TableCell colSpan={canManage ? 7 : 6} className="py-10 text-center text-muted-foreground">اتصالی ثبت نشده است.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingId ? 'ویرایش اتصال' : 'اتصال جدید'}</DialogTitle><DialogDescription>کلید محرمانه رمزنگاری و فقط روی سرور ذخیره می‌شود. URL خارجی باید HTTPS باشد؛ سرویس لوکال فقط از hostهای allowlist پذیرفته می‌شود.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            {!editingId && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">قالب آماده:</span>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('zarinpal')}>زرین‌پال</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('kavenegar')}>کاوه‌نگار OTP</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('resend')}>Resend</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('openai')}>OpenAI (ChatGPT)</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('anthropic')}>Anthropic (Claude)</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('gemini')}>Gemini</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('ollama')}>Ollama لوکال</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('custom')}>سرویس سازگار با OpenAI</Button>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>کلید یکتا</Label><Input dir="ltr" disabled={Boolean(editingId)} value={editor.providerKey} onChange={(event) => setEditor((current) => ({ ...current, providerKey: event.target.value.toLowerCase() }))} placeholder="openai.primary" /></div>
              <div className="grid gap-2"><Label>نام نمایشی</Label><Input value={editor.displayName} onChange={(event) => setEditor((current) => ({ ...current, displayName: event.target.value }))} placeholder="OpenAI اصلی" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2"><Label>نوع</Label><Select value={editor.providerType} onValueChange={(value) => { const adapters = RUNTIME_ADAPTERS_BY_TYPE[value] || []; setEditor((current) => ({ ...current, providerType: value, adapter: adapters[0] || '' })); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROVIDER_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label>Adapter</Label><Select value={editor.adapter} onValueChange={(value) => setEditor((current) => ({ ...current, adapter: value }))}><SelectTrigger dir="ltr"><SelectValue /></SelectTrigger><SelectContent>{supportedAdapters.map((adapter) => <SelectItem key={adapter} value={adapter}>{adapter}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label>روش احراز</Label><Select value={editor.authScheme} onValueChange={(value) => setEditor((current) => ({ ...current, authScheme: value }))}><SelectTrigger dir="ltr"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">none</SelectItem><SelectItem value="bearer">Bearer</SelectItem><SelectItem value="x-api-key">X-API-Key</SelectItem><SelectItem value="api-key">Api-Key</SelectItem><SelectItem value="x-goog-api-key">X-Goog-Api-Key</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>Base URL</Label><Input dir="ltr" value={editor.baseUrl} onChange={(event) => setEditor((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.example.com/v1" /></div>
              <div className="grid gap-2"><Label>مدل پیش‌فرض</Label><Input dir="ltr" value={editor.defaultModel} onChange={(event) => setEditor((current) => ({ ...current, defaultModel: event.target.value }))} placeholder="model-name" /></div>
            </div>
            {!editingId && <div className="grid gap-2"><Label>Secret / API Key (اختیاری)</Label><Input dir="ltr" type="password" autoComplete="new-password" value={editor.secret} onChange={(event) => setEditor((current) => ({ ...current, secret: event.target.value }))} /><p className="text-xs text-muted-foreground">پس از ذخیره قابل مشاهده نیست؛ برای تغییر از «تعویض کلید» استفاده کنید.</p></div>}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2"><Label>اولویت</Label><Input type="number" min={0} value={editor.priority} onChange={(event) => setEditor((current) => ({ ...current, priority: Number(event.target.value) }))} /></div>
              <div className="grid gap-2"><Label>Timeout (ثانیه)</Label><Input type="number" min={1} max={60} value={editor.timeoutSeconds} onChange={(event) => setEditor((current) => ({ ...current, timeoutSeconds: Number(event.target.value) }))} /></div>
              <div className="grid gap-2"><Label>تعداد Retry</Label><Input type="number" min={0} max={10} value={editor.maxRetries} onChange={(event) => setEditor((current) => ({ ...current, maxRetries: Number(event.target.value) }))} /></div>
            </div>
            <div className="grid gap-2"><Label>قابلیت‌ها (با کاما جدا کنید)</Label><Input dir="ltr" value={editor.capabilities} onChange={(event) => setEditor((current) => ({ ...current, capabilities: event.target.value }))} placeholder="chat, embedding, vision" /></div>
            {editor.providerType === 'llm' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2"><Label>نام‌های مسیریابی Primary</Label><Input dir="ltr" value={editor.routingAliases} onChange={(event) => setEditor((current) => ({ ...current, routingAliases: event.target.value }))} placeholder="gemini, default" /><p className="text-xs text-muted-foreground">قابلیت‌هایی که مستقیماً این Provider را صدا می‌زنند.</p></div>
                <div className="grid gap-2"><Label>Fallback برای</Label><Input dir="ltr" value={editor.fallbackFor} onChange={(event) => setEditor((current) => ({ ...current, fallbackFor: event.target.value }))} placeholder="gemini, openai" /><p className="text-xs text-muted-foreground">در صورت خطای Provider اصلی، این اتصال با مدل خودش استفاده می‌شود.</p></div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>تنظیمات غیرمحرمانه (JSON)</Label><Textarea dir="ltr" rows={5} value={editor.settings} onChange={(event) => setEditor((current) => ({ ...current, settings: event.target.value }))} /></div>
              <div className="grid gap-2"><Label>سقف مصرف (JSON)</Label><Textarea dir="ltr" rows={5} value={editor.quota} onChange={(event) => setEditor((current) => ({ ...current, quota: event.target.value }))} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>فعال</Label><p className="text-xs text-muted-foreground">اتصال غیرفعال وارد مسیر اجرا نمی‌شود.</p></div><Switch checked={editor.isActive} onCheckedChange={(checked) => setEditor((current) => ({ ...current, isActive: checked }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>سرویس داخلی/لوکال</Label><p className="text-xs text-muted-foreground">برای Ollama، vLLM یا سرویس داخل شبکه Docker.</p></div><Switch checked={editor.isInternal} onCheckedChange={(checked) => setEditor((current) => ({ ...current, isInternal: checked }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => void save()} disabled={busyKey === 'save'}>{busyKey === 'save' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PlugZap className="ml-2 h-4 w-4" />}ذخیره اتصال</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secretOpen} onOpenChange={setSecretOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader><DialogTitle>تعویض کلید {secretProvider?.display_name}</DialogTitle><DialogDescription>کلید جدید جایگزین مقدار قبلی می‌شود و مقدار قبلی قابل بازیابی نیست. بعد از تعویض حتماً تست اتصال بگیرید.</DialogDescription></DialogHeader>
          <div className="grid gap-2 py-3"><Label>Secret / API Key جدید</Label><Input dir="ltr" type="password" autoComplete="new-password" value={replacementSecret} onChange={(event) => setReplacementSecret(event.target.value)} /></div>
          <DialogFooter><Button onClick={() => void rotateSecret()} disabled={!replacementSecret || busyKey === `secret:${secretProvider?.id}`}>{busyKey === `secret:${secretProvider?.id}` ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <KeyRound className="ml-2 h-4 w-4" />}تعویض کلید</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IntegrationCenter;
