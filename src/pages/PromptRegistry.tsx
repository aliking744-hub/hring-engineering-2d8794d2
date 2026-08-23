import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArchiveRestore,
  ArrowRight,
  BrainCircuit,
  Code2,
  FileDiff,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  SlidersHorizontal,
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

interface PromptSummary {
  id: string;
  prompt_key: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  published_version: number | null;
  published_provider_alias: string | null;
  published_model: string | null;
  draft_version: number | null;
  draft_provider_alias: string | null;
  draft_model: string | null;
  version_count: number;
  created_at: string;
  updated_at: string;
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  provider_alias: string;
  model: string;
  system_template: string | null;
  user_template: string;
  input_variables: string[];
  response_format: 'text' | 'json_object';
  output_schema: Record<string, unknown> | null;
  temperature: number | null;
  max_output_tokens: number | null;
  test_status: 'untested' | 'passed' | 'failed';
  last_tested_at: string | null;
  last_test_error: string | null;
  created_by: string | null;
  published_by: string | null;
  created_at: string;
  published_at: string | null;
}

interface PromptDetail extends PromptSummary {
  versions: PromptVersion[];
}

interface AiFeatureRoute {
  feature_key: string;
  display_name: string;
  category: string;
  description: string;
  provider_alias: string;
  model: string;
  source: 'environment_default' | 'admin_override';
  updated_at: string | null;
}

interface IntegrationProvider {
  id: string;
  provider_key: string;
  display_name: string;
  provider_type: string;
  adapter: string;
  default_model: string | null;
  is_active: boolean;
  status: 'untested' | 'healthy' | 'unhealthy' | 'disabled';
  settings: Record<string, unknown>;
}

interface TestResult {
  passed: boolean;
  schema_valid: boolean | null;
  rendered_system: string | null;
  rendered_user: string;
  content: string | null;
  provider: string | null;
  model: string | null;
  usage: Record<string, number>;
  error: string | null;
  tested_at: string;
}

interface VersionEditor {
  providerAlias: string;
  model: string;
  systemTemplate: string;
  userTemplate: string;
  inputVariables: string;
  responseFormat: 'text' | 'json_object';
  outputSchema: string;
  temperature: string;
  maxOutputTokens: string;
}

const emptyVersion: VersionEditor = {
  providerAlias: 'gemini',
  model: '',
  systemTemplate: '',
  userTemplate: '',
  inputVariables: '',
  responseFormat: 'text',
  outputSchema: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
  temperature: '0.2',
  maxOutputTokens: '1000',
};

const editorFromVersion = (version: PromptVersion): VersionEditor => ({
  providerAlias: version.provider_alias,
  model: version.model,
  systemTemplate: version.system_template || '',
  userTemplate: version.user_template,
  inputVariables: version.input_variables.join(', '),
  responseFormat: version.response_format,
  outputSchema: JSON.stringify(version.output_schema || {}, null, 2),
  temperature: version.temperature === null ? '' : String(version.temperature),
  maxOutputTokens: version.max_output_tokens === null ? '' : String(version.max_output_tokens),
});

const versionPayload = (editor: VersionEditor) => {
  const variables = editor.inputVariables
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  let outputSchema: Record<string, unknown> | null = null;
  if (editor.responseFormat === 'json_object') {
    const parsed: unknown = JSON.parse(editor.outputSchema || '{}');
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Schema خروجی باید JSON object باشد');
    }
    outputSchema = parsed as Record<string, unknown>;
  }
  return {
    provider_alias: editor.providerAlias.trim(),
    model: editor.model.trim(),
    system_template: editor.systemTemplate.trim() || null,
    user_template: editor.userTemplate.trim(),
    input_variables: variables,
    response_format: editor.responseFormat,
    output_schema: outputSchema,
    temperature: editor.temperature.trim() ? Number(editor.temperature) : null,
    max_output_tokens: editor.maxOutputTokens.trim() ? Number(editor.maxOutputTokens) : null,
  };
};

const statusLabel: Record<PromptVersion['status'], string> = {
  draft: 'پیش‌نویس',
  published: 'منتشرشده',
  archived: 'آرشیو',
};

const testLabel: Record<PromptVersion['test_status'], string> = {
  untested: 'تست‌نشده',
  passed: 'تست موفق',
  failed: 'تست ناموفق',
};

const friendlyProviderName = (alias: string): string => {
  const normalized = alias.toLowerCase();
  if (normalized.includes('anthropic') || normalized === 'claude') return 'Anthropic (Claude)';
  if (normalized.includes('openai')) return 'OpenAI (ChatGPT)';
  if (normalized.includes('gemini')) return 'Google Gemini';
  if (normalized.includes('perplexity')) return 'Perplexity';
  if (normalized.includes('ollama')) return 'Ollama لوکال';
  if (normalized.includes('vllm')) return 'vLLM لوکال';
  return alias;
};

const aliasesForProvider = (provider: IntegrationProvider): string[] => {
  const aliases = provider.settings.aliases;
  return [
    provider.provider_key,
    provider.provider_key.split('.', 1)[0],
    ...(Array.isArray(aliases) ? aliases.filter((item): item is string => typeof item === 'string') : []),
  ].map((item) => item.toLowerCase());
};

const providerForAlias = (
  providers: IntegrationProvider[],
  alias: string,
): IntegrationProvider | undefined => (
  providers.find((provider) => aliasesForProvider(provider).includes(alias.toLowerCase()))
);

const VersionFields = ({
  value,
  onChange,
  providers,
  disabled = false,
}: {
  value: VersionEditor;
  onChange: (value: VersionEditor) => void;
  providers: IntegrationProvider[];
  disabled?: boolean;
}) => (
  <div className="grid gap-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label>سرویس هوش مصنوعی</Label>{providers.length ? <Select disabled={disabled} value={value.providerAlias} onValueChange={(next) => { const provider = providers.find((item) => item.provider_key === next); onChange({ ...value, providerAlias: next, model: provider?.default_model || value.model }); }}><SelectTrigger><SelectValue placeholder="انتخاب سرویس" /></SelectTrigger><SelectContent>{!providers.some((provider) => provider.provider_key === value.providerAlias && provider.provider_type === 'llm' && provider.is_active) && <SelectItem value={value.providerAlias}>{friendlyProviderName(value.providerAlias)} — مسیر فعلی</SelectItem>}{providers.filter((provider) => provider.provider_type === 'llm' && provider.is_active).map((provider) => <SelectItem key={provider.id} value={provider.provider_key}>{provider.display_name}</SelectItem>)}</SelectContent></Select> : <Input dir="ltr" disabled={disabled} value={value.providerAlias} onChange={(event) => onChange({ ...value, providerAlias: event.target.value })} placeholder="ابتدا یک سرویس AI در بخش اتصال‌ها ثبت کنید" />}</div>
      <div><Label>مدل</Label><Input dir="ltr" disabled={disabled} value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} placeholder="gemini-2.5-flash یا qwen3:8b" /></div>
    </div>
    <div><Label>System Prompt</Label><Textarea dir="ltr" disabled={disabled} className="min-h-28 font-mono text-xs" value={value.systemTemplate} onChange={(event) => onChange({ ...value, systemTemplate: event.target.value })} placeholder="You are an HR analyst for {company_name}." /></div>
    <div><Label>User Prompt</Label><Textarea dir="ltr" disabled={disabled} className="min-h-36 font-mono text-xs" value={value.userTemplate} onChange={(event) => onChange({ ...value, userTemplate: event.target.value })} placeholder="Analyze {candidate_name}." /></div>
    <div><Label>متغیرها (با ویرگول)</Label><Input dir="ltr" disabled={disabled} value={value.inputVariables} onChange={(event) => onChange({ ...value, inputVariables: event.target.value })} placeholder="company_name, candidate_name" /></div>
    <div className="grid gap-4 sm:grid-cols-4">
      <div><Label>نوع خروجی</Label><Select disabled={disabled} value={value.responseFormat} onValueChange={(next: 'text' | 'json_object') => onChange({ ...value, responseFormat: next })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">متن</SelectItem><SelectItem value="json_object">JSON</SelectItem></SelectContent></Select></div>
      <div><Label>Temperature</Label><Input dir="ltr" type="number" min="0" max="2" step="0.1" disabled={disabled} value={value.temperature} onChange={(event) => onChange({ ...value, temperature: event.target.value })} /></div>
      <div><Label>حداکثر توکن خروجی</Label><Input dir="ltr" type="number" min="1" disabled={disabled} value={value.maxOutputTokens} onChange={(event) => onChange({ ...value, maxOutputTokens: event.target.value })} /></div>
      <div className="rounded-lg border p-3 text-xs text-muted-foreground">Placeholders فقط به شکل <code dir="ltr">{'{name}'}</code> پذیرفته می‌شوند.</div>
    </div>
    {value.responseFormat === 'json_object' && <div><Label>قرارداد JSON خروجی</Label><Textarea dir="ltr" disabled={disabled} className="min-h-44 font-mono text-xs" value={value.outputSchema} onChange={(event) => onChange({ ...value, outputSchema: event.target.value })} /></div>}
  </div>
);

const PromptRegistry = () => {
  const { context, loading: contextLoading } = useUserContext();
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [featureRoutes, setFeatureRoutes] = useState<AiFeatureRoute[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<AiFeatureRoute | null>(null);
  const [routeProvider, setRouteProvider] = useState('');
  const [routeModel, setRouteModel] = useState('');
  const [editor, setEditor] = useState<VersionEditor>(emptyVersion);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMeta, setCreateMeta] = useState({ promptKey: '', featureKey: '', displayName: '', description: '' });
  const [createVersion, setCreateVersion] = useState<VersionEditor>(emptyVersion);
  const [testOpen, setTestOpen] = useState(false);
  const [testVariables, setTestVariables] = useState('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  const roles = context?.platformRoles || [];
  const legacyAdmin = context?.appRoles.includes('admin') || false;
  const canRead = roles.some((role) => ['super_admin', 'platform_admin', 'content_admin'].includes(role)) || legacyAdmin;
  const canManage = roles.some((role) => ['super_admin', 'content_admin'].includes(role));
  const canPublish = roles.includes('super_admin');
  const canManageRoutes = roles.includes('super_admin');
  const canReadIntegrations = roles.some((role) => ['super_admin', 'platform_admin'].includes(role)) || legacyAdmin;

  const loadDetail = useCallback(async (promptId: string) => {
    const loaded = await apiRequest<PromptDetail>(`/admin/platform/ai/prompts/${promptId}`);
    setDetail(loaded);
    const draft = loaded.versions.find((item) => item.status === 'draft');
    if (draft) setEditor(editorFromVersion(draft));
    const first = loaded.versions[0]?.id || '';
    const second = loaded.versions[1]?.id || first;
    setCompareA((current) => loaded.versions.some((item) => item.id === current) ? current : first);
    setCompareB((current) => loaded.versions.some((item) => item.id === current) ? current : second);
  }, []);

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rows, routes] = await Promise.all([
        apiRequest<PromptSummary[]>('/admin/platform/ai/prompts'),
        apiRequest<AiFeatureRoute[]>('/admin/platform/ai/routes'),
      ]);
      setPrompts(rows);
      setFeatureRoutes(routes);
      if (canReadIntegrations) {
        try {
          setProviders(await apiRequest<IntegrationProvider[]>('/admin/platform/integrations/providers'));
        } catch (error) {
          console.error('AI provider choices could not be loaded:', error);
          setProviders([]);
        }
      }
      const selectedId = detail?.id && rows.some((item) => item.id === detail.id) ? detail.id : rows[0]?.id;
      if (selectedId) await loadDetail(selectedId);
      else setDetail(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت تنظیمات هوش مصنوعی انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [canRead, canReadIntegrations, detail?.id, loadDetail]);

  useEffect(() => {
    if (!contextLoading) void load();
  }, [contextLoading, load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return prompts;
    return prompts.filter((item) => [item.prompt_key, item.feature_key, item.display_name].some((value) => value.toLowerCase().includes(query)));
  }, [prompts, search]);

  const filteredRoutes = useMemo(() => {
    const query = routeSearch.trim().toLowerCase();
    if (!query) return featureRoutes;
    return featureRoutes.filter((item) => [
      item.display_name,
      item.category,
      item.feature_key,
      item.provider_alias,
      item.model,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [featureRoutes, routeSearch]);

  const draft = detail?.versions.find((item) => item.status === 'draft') || null;
  const comparedA = detail?.versions.find((item) => item.id === compareA) || null;
  const comparedB = detail?.versions.find((item) => item.id === compareB) || null;

  const refreshCurrent = async () => {
    if (!detail) return;
    await loadDetail(detail.id);
    const rows = await apiRequest<PromptSummary[]>('/admin/platform/ai/prompts');
    setPrompts(rows);
  };

  const createPrompt = async () => {
    try {
      const payload = {
        prompt_key: createMeta.promptKey.trim(),
        feature_key: createMeta.featureKey.trim(),
        display_name: createMeta.displayName.trim(),
        description: createMeta.description.trim() || null,
        version: versionPayload(createVersion),
      };
      setBusy('create');
      const created = await apiRequest<PromptDetail>('/admin/platform/ai/prompts', { method: 'POST', body: JSON.stringify(payload) });
      setCreateOpen(false);
      setCreateMeta({ promptKey: '', featureKey: '', displayName: '', description: '' });
      setCreateVersion(emptyVersion);
      await load();
      await loadDetail(created.id);
      toast.success('Prompt و نسخهٔ پیش‌نویس ساخته شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت Prompt انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = async () => {
    if (!detail || !draft) return;
    try {
      setBusy('save');
      await apiRequest(`/admin/platform/ai/prompts/${detail.id}/versions/${draft.id}`, { method: 'PATCH', body: JSON.stringify(versionPayload(editor)) });
      await refreshCurrent();
      toast.success('پیش‌نویس ذخیره شد؛ برای انتشار دوباره تست کنید');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره پیش‌نویس انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const createDraft = async () => {
    if (!detail) return;
    try {
      setBusy('draft');
      await apiRequest(`/admin/platform/ai/prompts/${detail.id}/drafts`, { method: 'POST', body: '{}' });
      await refreshCurrent();
      toast.success('نسخهٔ پیش‌نویس جدید از نسخهٔ منتشرشده ساخته شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت پیش‌نویس انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const testDraft = async () => {
    if (!detail || !draft) return;
    try {
      const parsed: unknown = JSON.parse(testVariables || '{}');
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object' || Object.values(parsed).some((item) => typeof item !== 'string')) {
        throw new Error('ورودی تست باید JSON object با مقدارهای متنی باشد');
      }
      setBusy('test');
      const result = await apiRequest<TestResult>(`/admin/platform/ai/prompts/${detail.id}/versions/${draft.id}/test`, { method: 'POST', body: JSON.stringify({ variables: parsed }) });
      setTestResult(result);
      await refreshCurrent();
      result.passed ? toast.success('تست Prompt موفق بود') : toast.error(result.error || 'تست Prompt ناموفق بود');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تست Prompt انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const publishDraft = async () => {
    if (!detail || !draft) return;
    try {
      setBusy('publish');
      await apiRequest(`/admin/platform/ai/prompts/${detail.id}/versions/${draft.id}/publish`, { method: 'POST' });
      await refreshCurrent();
      toast.success('نسخهٔ تست‌شده منتشر شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'انتشار انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const rollback = async (version: PromptVersion) => {
    if (!detail) return;
    try {
      setBusy(`rollback:${version.id}`);
      await apiRequest(`/admin/platform/ai/prompts/${detail.id}/rollback`, { method: 'POST', body: JSON.stringify({ target_version_id: version.id }) });
      await refreshCurrent();
      toast.success(`نسخه ${version.version.toLocaleString('fa-IR')} به‌صورت نسخهٔ جدید بازگردانی شد`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rollback انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const openRouteEditor = (route: AiFeatureRoute) => {
    setEditingRoute(route);
    const provider = providerForAlias(providers, route.provider_alias);
    setRouteProvider(provider?.provider_key || route.provider_alias);
    setRouteModel(route.model);
    setRouteEditorOpen(true);
  };

  const changeRouteProvider = (providerKey: string) => {
    const provider = providers.find((item) => item.provider_key === providerKey);
    setRouteProvider(providerKey);
    if (provider?.default_model) setRouteModel(provider.default_model);
  };

  const saveFeatureRoute = async () => {
    if (!editingRoute || !routeProvider.trim() || !routeModel.trim()) {
      toast.error('سرویس و مدل را انتخاب کنید');
      return;
    }
    try {
      setBusy('route-save');
      const updated = await apiRequest<AiFeatureRoute>(
        `/admin/platform/ai/routes/${encodeURIComponent(editingRoute.feature_key)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            provider_alias: routeProvider.trim(),
            model: routeModel.trim(),
          }),
        },
      );
      setFeatureRoutes((current) => current.map((item) => item.feature_key === updated.feature_key ? updated : item));
      setRouteEditorOpen(false);
      toast.success('هوش و مدل این قابلیت تغییر کرد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر مسیر هوش انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const resetFeatureRoute = async (route: AiFeatureRoute) => {
    if (!window.confirm(`انتخاب «${route.display_name}» به تنظیم پیش‌فرض staging برگردد؟`)) return;
    try {
      setBusy(`route-reset:${route.feature_key}`);
      const updated = await apiRequest<AiFeatureRoute>(
        `/admin/platform/ai/routes/${encodeURIComponent(route.feature_key)}`,
        { method: 'DELETE' },
      );
      setFeatureRoutes((current) => current.map((item) => item.feature_key === updated.feature_key ? updated : item));
      toast.success('مسیر پیش‌فرض دوباره فعال شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'بازگردانی مسیر انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (checked: boolean) => {
    if (!detail) return;
    try {
      setBusy('active');
      await apiRequest(`/admin/platform/ai/prompts/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: checked }) });
      await refreshCurrent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  if (contextLoading || loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!canRead) return <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl"><Card className="max-w-md"><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto mb-3 h-12 w-12 text-destructive" /><h1 className="text-xl font-bold">دسترسی به Prompt Registry ندارید</h1><Button asChild className="mt-5"><Link to="/admin">بازگشت</Link></Button></CardContent></Card></div>;

  return (
    <>
      <Helmet><title>مدیریت هوش قابلیت‌ها | HRing</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
          <Button variant="outline" asChild className="mb-5"><Link to="/admin"><ArrowRight className="ml-2 h-4 w-4" />بازگشت به مرکز مدیریت</Link></Button>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="flex items-center gap-2 text-2xl font-bold"><BrainCircuit className="h-7 w-7 text-primary" />مدیریت هوش مصنوعی قابلیت‌ها</h1><p className="mt-1 text-sm text-muted-foreground">در یک نگاه ببینید هر بخش HRing از کدام سرویس و مدل استفاده می‌کند و همان‌جا تغییرش دهید.</p></div>
            <Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>
          </div>

          <Card className="mb-5 border-primary/30 bg-primary/5">
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <div className="flex items-start gap-3"><SlidersHorizontal className="mt-0.5 h-5 w-5 text-primary" /><div><div className="font-medium">جدول اول: انتخاب هوش هر قابلیت</div><div className="mt-1 text-sm text-muted-foreground">تغییر این جدول مستقیماً مسیر اجرای همان قابلیت را عوض می‌کند. API Key سرویس باید قبلاً در بخش اتصال‌ها ثبت شده باشد.</div><Button asChild variant="link" className="h-auto p-0 pt-2"><Link to="/admin/integrations">رفتن به اتصال سرویس‌ها و APIها</Link></Button></div></div>
              <div className="flex items-start gap-3"><Code2 className="mt-0.5 h-5 w-5 text-primary" /><div><div className="font-medium">بخش دوم: مدیریت پیشرفتهٔ متن دستورها</div><div className="mt-1 text-sm text-muted-foreground">Prompt Registry برای نسخه‌بندی متن دستور AI است: تغییر را ابتدا پیش‌نویس می‌کنید، با داده نمونه تست می‌گیرید و بعد منتشر می‌کنید؛ نسخه قبلی هم قابل بازگشت است. فقط دستورهایی که در کد محصول به Registry متصل شده‌اند از انتشار آن اثر می‌گیرند.</div></div></div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle>نقشه هوش فعال HRing</CardTitle><CardDescription>{featureRoutes.length.toLocaleString('fa-IR')} قابلیت AI فعلی؛ «انتخاب مدیر» یعنی این ردیف از پیش‌فرض staging جدا شده است.</CardDescription></div>
                <Input className="max-w-sm" value={routeSearch} onChange={(event) => setRouteSearch(event.target.value)} placeholder="جست‌وجوی قابلیت، سرویس یا مدل..." />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>قابلیت</TableHead><TableHead>دسته</TableHead><TableHead>هوش فعال</TableHead><TableHead>مدل</TableHead><TableHead>منبع تنظیم</TableHead>{canManageRoutes && <TableHead>تغییر</TableHead>}</TableRow></TableHeader>
                  <TableBody>
                    {filteredRoutes.map((route) => {
                      const provider = providerForAlias(providers, route.provider_alias);
                      return (
                        <TableRow key={route.feature_key}>
                          <TableCell><div className="font-medium">{route.display_name}</div><div className="mt-1 max-w-md text-xs text-muted-foreground">{route.description}</div><div dir="ltr" className="mt-1 text-left font-mono text-[11px] text-muted-foreground">{route.feature_key}</div></TableCell>
                          <TableCell><Badge variant="outline">{route.category}</Badge></TableCell>
                          <TableCell><div className="font-medium">{provider?.display_name || friendlyProviderName(route.provider_alias)}</div><div dir="ltr" className="text-left font-mono text-xs text-muted-foreground">{route.provider_alias}</div></TableCell>
                          <TableCell dir="ltr" className="text-left font-mono text-xs">{route.model}</TableCell>
                          <TableCell><Badge variant={route.source === 'admin_override' ? 'default' : 'secondary'}>{route.source === 'admin_override' ? 'انتخاب مدیر' : 'پیش‌فرض staging'}</Badge></TableCell>
                          {canManageRoutes && <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => openRouteEditor(route)}><Pencil className="ml-1 h-3.5 w-3.5" />تغییر</Button>{route.source === 'admin_override' && <Button size="icon" variant="ghost" title="بازگشت به پیش‌فرض" disabled={busy === `route-reset:${route.feature_key}`} onClick={() => void resetFeatureRoute(route)}><RotateCcw className="h-4 w-4" /></Button>}</div></TableCell>}
                        </TableRow>
                      );
                    })}
                    {!filteredRoutes.length && <TableRow><TableCell colSpan={canManageRoutes ? 6 : 5} className="py-10 text-center text-muted-foreground">قابلیتی با این جست‌وجو پیدا نشد.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">مدیریت پیشرفتهٔ متن دستورها (Prompt Registry)</h2><p className="mt-1 text-sm text-muted-foreground">این بخش فقط دستورهای متصل‌شده و قرارداد خروجی AI را نسخه‌بندی می‌کند؛ جدول بالا مستقل است و همین حالا مسیر تمام قابلیت‌های AI فعلی را کنترل می‌کند.</p></div>
            {canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="ml-2 h-4 w-4" />دستور جدید</Button>}
          </div>

          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit"><CardHeader><CardTitle className="text-base">دستورهای ثبت‌شده</CardTitle><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی دستور..." /></CardHeader><CardContent className="space-y-2">{filtered.map((prompt) => <button key={prompt.id} type="button" onClick={() => void loadDetail(prompt.id)} className={`w-full rounded-xl border p-3 text-right transition ${detail?.id === prompt.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}><div className="flex items-start justify-between gap-2"><div className="font-medium">{prompt.display_name}</div><Badge variant={prompt.is_active ? 'default' : 'secondary'}>{prompt.is_active ? 'فعال' : 'غیرفعال'}</Badge></div><div dir="ltr" className="mt-1 truncate font-mono text-xs text-muted-foreground">{prompt.prompt_key}</div><div className="mt-2 text-xs text-muted-foreground">نسخه فعال: {prompt.published_version ?? '—'} · پیش‌نویس: {prompt.draft_version ?? '—'}</div>{prompt.published_provider_alias && <div className="mt-1 text-xs text-muted-foreground">{friendlyProviderName(prompt.published_provider_alias)} · <span dir="ltr">{prompt.published_model}</span></div>}</button>)}{!filtered.length && <div className="py-8 text-center text-sm text-muted-foreground">هنوز دستور نسخه‌بندی‌شده‌ای ثبت نشده است. این موضوع مانع کار جدول هوش قابلیت‌ها در بالا نیست.</div>}</CardContent></Card>

            {detail ? <div className="space-y-5">
              <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{detail.display_name}</CardTitle><CardDescription dir="ltr" className="mt-1 font-mono">{detail.prompt_key} · {detail.feature_key}</CardDescription></div><div className="flex items-center gap-2"><span className="text-sm">فعال</span><Switch checked={detail.is_active} disabled={!canManage || busy === 'active'} onCheckedChange={(checked) => void toggleActive(checked)} /></div></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{detail.description || 'بدون توضیح'}</p></CardContent></Card>

              {draft ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>پیش‌نویس نسخه {draft.version.toLocaleString('fa-IR')}</CardTitle><CardDescription>هر ویرایش نتیجهٔ تست قبلی را باطل می‌کند.</CardDescription></div><Badge variant={draft.test_status === 'passed' ? 'default' : draft.test_status === 'failed' ? 'destructive' : 'outline'}>{testLabel[draft.test_status]}</Badge></div></CardHeader><CardContent className="space-y-5"><VersionFields value={editor} onChange={setEditor} providers={providers} disabled={!canManage} />{canManage && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void saveDraft()} disabled={busy !== null}><Save className="ml-2 h-4 w-4" />ذخیره</Button><Button variant="outline" onClick={() => { setTestOpen(true); setTestResult(null); }} disabled={busy !== null}><FlaskConical className="ml-2 h-4 w-4" />تست با داده نمونه</Button>{canPublish && <Button onClick={() => void publishDraft()} disabled={busy !== null || draft.test_status !== 'passed'}><Rocket className="ml-2 h-4 w-4" />انتشار نسخهٔ تست‌شده</Button>}</div>}</CardContent></Card> : <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6"><div><div className="font-medium">نسخهٔ پیش‌نویس وجود ندارد</div><div className="text-sm text-muted-foreground">برای تغییر دستور، از نسخهٔ منتشرشده یک پیش‌نویس بسازید.</div></div>{canManage && detail.published_version !== null && <Button onClick={() => void createDraft()} disabled={busy !== null}><Plus className="ml-2 h-4 w-4" />ساخت پیش‌نویس</Button>}</CardContent></Card>}

              <Card><CardHeader><CardTitle>تاریخچه نسخه‌ها</CardTitle><CardDescription>نسخه‌های منتشرشده تغییرناپذیرند؛ Rollback همیشه یک نسخهٔ جدید می‌سازد.</CardDescription></CardHeader><CardContent className="space-y-3">{detail.versions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div className="flex items-center gap-3"><Badge variant={version.status === 'published' ? 'default' : 'outline'}>v{version.version.toLocaleString('fa-IR')}</Badge><div><div>{statusLabel[version.status]} · <span dir="ltr" className="font-mono text-xs">{version.provider_alias} / {version.model}</span></div><div className="text-xs text-muted-foreground">{testLabel[version.test_status]} · {new Date(version.created_at).toLocaleString('fa-IR')}</div></div></div>{canPublish && version.status === 'archived' && !draft && <Button size="sm" variant="outline" onClick={() => void rollback(version)} disabled={busy !== null}><ArchiveRestore className="ml-2 h-4 w-4" />Rollback</Button>}</div>)}</CardContent></Card>

              {detail.versions.length > 1 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileDiff className="h-5 w-5" />مقایسه نسخه‌ها</CardTitle></CardHeader><CardContent><div className="mb-4 grid gap-3 sm:grid-cols-2"><Select value={compareA} onValueChange={setCompareA}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{detail.versions.map((version) => <SelectItem key={version.id} value={version.id}>نسخه {version.version} — {statusLabel[version.status]}</SelectItem>)}</SelectContent></Select><Select value={compareB} onValueChange={setCompareB}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{detail.versions.map((version) => <SelectItem key={version.id} value={version.id}>نسخه {version.version} — {statusLabel[version.status]}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 lg:grid-cols-2">{[comparedA, comparedB].map((version, index) => version && <div key={`${version.id}-${index}`} className="space-y-3 rounded-xl border p-4"><div className="font-medium">v{version.version} · <span dir="ltr">{version.provider_alias} / {version.model}</span></div><pre dir="ltr" className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{version.system_template || '—'}</pre><pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{version.user_template}</pre><pre dir="ltr" className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{JSON.stringify(version.output_schema, null, 2)}</pre></div>)}</div></CardContent></Card>}
            </div> : <Card><CardContent className="flex min-h-80 flex-col items-center justify-center text-center"><Code2 className="mb-3 h-12 w-12 text-muted-foreground" /><div className="font-medium">یک Prompt را انتخاب کنید</div></CardContent></Card>}
          </div>
        </div>
      </div>

      <Dialog open={routeEditorOpen} onOpenChange={setRouteEditorOpen}>
        <DialogContent dir="rtl" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>تغییر هوش «{editingRoute?.display_name}»</DialogTitle>
            <DialogDescription>بعد از ذخیره، درخواست بعدی همین قابلیت از سرویس و مدل انتخاب‌شده استفاده می‌کند. کلید API در این صفحه وارد نمی‌شود.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>سرویس هوش مصنوعی</Label>
              {providers.filter((provider) => provider.provider_type === 'llm' && provider.is_active).length ? (
                <Select value={routeProvider} onValueChange={changeRouteProvider}>
                  <SelectTrigger><SelectValue placeholder="انتخاب سرویس" /></SelectTrigger>
                  <SelectContent>
                    {!providers.some((provider) => provider.provider_key === routeProvider && provider.provider_type === 'llm' && provider.is_active) && routeProvider && <SelectItem value={routeProvider}>{friendlyProviderName(routeProvider)} — مسیر فعلی</SelectItem>}
                    {providers.filter((provider) => provider.provider_type === 'llm' && provider.is_active).map((provider) => <SelectItem key={provider.id} value={provider.provider_key}>{provider.display_name} {provider.status === 'healthy' ? '— سالم' : '— نیازمند تست'}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input dir="ltr" value={routeProvider} onChange={(event) => setRouteProvider(event.target.value)} />
              )}
              {!providers.filter((provider) => provider.provider_type === 'llm' && provider.is_active).length && <p className="text-xs text-amber-700">هنوز اتصال AI فعالی در Integration Center دیده نمی‌شود. ابتدا سرویس و API Key را ثبت و تست کنید. <Link className="underline" to="/admin/integrations">رفتن به اتصال‌ها</Link></p>}
            </div>
            <div className="grid gap-2"><Label>مدل</Label><Input dir="ltr" value={routeModel} onChange={(event) => setRouteModel(event.target.value)} placeholder="نام دقیق مدل در حساب سرویس" /></div>
            {editingRoute && <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground"><div>{editingRoute.description}</div><div dir="ltr" className="mt-2 text-left font-mono">{editingRoute.feature_key}</div></div>}
          </div>
          <DialogFooter><Button onClick={() => void saveFeatureRoute()} disabled={busy === 'route-save'}>{busy === 'route-save' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ذخیره انتخاب این قابلیت</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent dir="rtl" className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>دستور AI جدید</DialogTitle><DialogDescription>کلیدها پس از ساخت ثابت می‌مانند؛ محتوا در نسخه‌های جدا مدیریت می‌شود.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div><Label>کلید دستور</Label><Input dir="ltr" value={createMeta.promptKey} onChange={(event) => setCreateMeta({ ...createMeta, promptKey: event.target.value })} placeholder="recruiting.candidate_summary" /></div><div><Label>کلید قابلیت</Label><Input dir="ltr" value={createMeta.featureKey} onChange={(event) => setCreateMeta({ ...createMeta, featureKey: event.target.value })} placeholder="recruiting.candidate_summary" /></div><div><Label>نام نمایشی</Label><Input value={createMeta.displayName} onChange={(event) => setCreateMeta({ ...createMeta, displayName: event.target.value })} /></div><div><Label>توضیح</Label><Input value={createMeta.description} onChange={(event) => setCreateMeta({ ...createMeta, description: event.target.value })} /></div></div><VersionFields value={createVersion} onChange={setCreateVersion} providers={providers} /><DialogFooter><Button onClick={() => void createPrompt()} disabled={busy === 'create'}>{busy === 'create' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ساخت پیش‌نویس</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}><DialogContent dir="rtl" className="max-w-3xl"><DialogHeader><DialogTitle>تست Prompt</DialogTitle><DialogDescription>دادهٔ نمونه و خروجی در Registry ذخیره نمی‌شود؛ فقط وضعیت، Provider، مدل و متریک ثبت می‌شود.</DialogDescription></DialogHeader><div><Label>متغیرهای نمونه (JSON)</Label><Textarea dir="ltr" className="min-h-36 font-mono text-xs" value={testVariables} onChange={(event) => setTestVariables(event.target.value)} placeholder={'{\n  "candidate_name": "Sara"\n}'} /></div>{testResult && <div className={`rounded-xl border p-4 ${testResult.passed ? 'border-emerald-500/50' : 'border-destructive/50'}`}><div className="mb-2 font-medium">{testResult.passed ? 'تست موفق' : testResult.error || 'تست ناموفق'}</div>{testResult.provider && <div dir="ltr" className="mb-2 text-xs text-muted-foreground">{testResult.provider} / {testResult.model}</div>}<pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{testResult.content || 'بدون خروجی'}</pre></div>}<DialogFooter><Button onClick={() => void testDraft()} disabled={busy === 'test'}>{busy === 'test' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}اجرای تست واقعی</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
};

export default PromptRegistry;
