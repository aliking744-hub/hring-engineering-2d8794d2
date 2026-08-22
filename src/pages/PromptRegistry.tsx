import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArchiveRestore,
  ChevronLeft,
  Code2,
  FileDiff,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
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
  draft_version: number | null;
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

const VersionFields = ({
  value,
  onChange,
  disabled = false,
}: {
  value: VersionEditor;
  onChange: (value: VersionEditor) => void;
  disabled?: boolean;
}) => (
  <div className="grid gap-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label>مسیر Provider</Label><Input dir="ltr" disabled={disabled} value={value.providerAlias} onChange={(event) => onChange({ ...value, providerAlias: event.target.value })} placeholder="gemini / openai / ollama" /></div>
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
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
      const rows = await apiRequest<PromptSummary[]>('/admin/platform/ai/prompts');
      setPrompts(rows);
      const selectedId = detail?.id && rows.some((item) => item.id === detail.id) ? detail.id : rows[0]?.id;
      if (selectedId) await loadDetail(selectedId);
      else setDetail(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت Promptها انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [canRead, detail?.id, loadDetail]);

  useEffect(() => {
    if (!contextLoading) void load();
  }, [contextLoading, load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return prompts;
    return prompts.filter((item) => [item.prompt_key, item.feature_key, item.display_name].some((value) => value.toLowerCase().includes(query)));
  }, [prompts, search]);

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
      <Helmet><title>Prompt Registry | HRing</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link to="/admin"><ChevronLeft className="h-5 w-5" /></Link></Button><div><h1 className="text-2xl font-bold">Prompt Registry</h1><p className="text-sm text-muted-foreground">نسخه‌بندی، تست، انتشار و Rollback بدون تغییر کد</p></div></div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>{canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="ml-2 h-4 w-4" />Prompt جدید</Button>}</div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit"><CardHeader><CardTitle className="text-base">قابلیت‌ها</CardTitle><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجو..." /></CardHeader><CardContent className="space-y-2">{filtered.map((prompt) => <button key={prompt.id} type="button" onClick={() => void loadDetail(prompt.id)} className={`w-full rounded-xl border p-3 text-right transition ${detail?.id === prompt.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}><div className="flex items-start justify-between gap-2"><div className="font-medium">{prompt.display_name}</div><Badge variant={prompt.is_active ? 'default' : 'secondary'}>{prompt.is_active ? 'فعال' : 'غیرفعال'}</Badge></div><div dir="ltr" className="mt-1 truncate font-mono text-xs text-muted-foreground">{prompt.prompt_key}</div><div className="mt-2 text-xs text-muted-foreground">منتشرشده: {prompt.published_version ?? '—'} · پیش‌نویس: {prompt.draft_version ?? '—'}</div></button>)}{!filtered.length && <div className="py-8 text-center text-sm text-muted-foreground">Promptی ثبت نشده است.</div>}</CardContent></Card>

            {detail ? <div className="space-y-5">
              <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{detail.display_name}</CardTitle><CardDescription dir="ltr" className="mt-1 font-mono">{detail.prompt_key} · {detail.feature_key}</CardDescription></div><div className="flex items-center gap-2"><span className="text-sm">فعال</span><Switch checked={detail.is_active} disabled={!canManage || busy === 'active'} onCheckedChange={(checked) => void toggleActive(checked)} /></div></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{detail.description || 'بدون توضیح'}</p></CardContent></Card>

              {draft ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>پیش‌نویس نسخه {draft.version.toLocaleString('fa-IR')}</CardTitle><CardDescription>هر ویرایش نتیجهٔ تست قبلی را باطل می‌کند.</CardDescription></div><Badge variant={draft.test_status === 'passed' ? 'default' : draft.test_status === 'failed' ? 'destructive' : 'outline'}>{testLabel[draft.test_status]}</Badge></div></CardHeader><CardContent className="space-y-5"><VersionFields value={editor} onChange={setEditor} disabled={!canManage} />{canManage && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void saveDraft()} disabled={busy !== null}><Save className="ml-2 h-4 w-4" />ذخیره</Button><Button variant="outline" onClick={() => { setTestOpen(true); setTestResult(null); }} disabled={busy !== null}><FlaskConical className="ml-2 h-4 w-4" />تست با داده نمونه</Button>{canPublish && <Button onClick={() => void publishDraft()} disabled={busy !== null || draft.test_status !== 'passed'}><Rocket className="ml-2 h-4 w-4" />انتشار نسخهٔ تست‌شده</Button>}</div>}</CardContent></Card> : <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6"><div><div className="font-medium">نسخهٔ پیش‌نویس وجود ندارد</div><div className="text-sm text-muted-foreground">برای تغییر Prompt، از نسخهٔ منتشرشده یک Draft بسازید.</div></div>{canManage && detail.published_version !== null && <Button onClick={() => void createDraft()} disabled={busy !== null}><Plus className="ml-2 h-4 w-4" />ساخت Draft</Button>}</CardContent></Card>}

              <Card><CardHeader><CardTitle>تاریخچه نسخه‌ها</CardTitle><CardDescription>نسخه‌های منتشرشده تغییرناپذیرند؛ Rollback همیشه یک نسخهٔ جدید می‌سازد.</CardDescription></CardHeader><CardContent className="space-y-3">{detail.versions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div className="flex items-center gap-3"><Badge variant={version.status === 'published' ? 'default' : 'outline'}>v{version.version.toLocaleString('fa-IR')}</Badge><div><div>{statusLabel[version.status]} · <span dir="ltr" className="font-mono text-xs">{version.provider_alias} / {version.model}</span></div><div className="text-xs text-muted-foreground">{testLabel[version.test_status]} · {new Date(version.created_at).toLocaleString('fa-IR')}</div></div></div>{canPublish && version.status === 'archived' && !draft && <Button size="sm" variant="outline" onClick={() => void rollback(version)} disabled={busy !== null}><ArchiveRestore className="ml-2 h-4 w-4" />Rollback</Button>}</div>)}</CardContent></Card>

              {detail.versions.length > 1 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileDiff className="h-5 w-5" />مقایسه نسخه‌ها</CardTitle></CardHeader><CardContent><div className="mb-4 grid gap-3 sm:grid-cols-2"><Select value={compareA} onValueChange={setCompareA}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{detail.versions.map((version) => <SelectItem key={version.id} value={version.id}>نسخه {version.version} — {statusLabel[version.status]}</SelectItem>)}</SelectContent></Select><Select value={compareB} onValueChange={setCompareB}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{detail.versions.map((version) => <SelectItem key={version.id} value={version.id}>نسخه {version.version} — {statusLabel[version.status]}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 lg:grid-cols-2">{[comparedA, comparedB].map((version, index) => version && <div key={`${version.id}-${index}`} className="space-y-3 rounded-xl border p-4"><div className="font-medium">v{version.version} · <span dir="ltr">{version.provider_alias} / {version.model}</span></div><pre dir="ltr" className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{version.system_template || '—'}</pre><pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{version.user_template}</pre><pre dir="ltr" className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{JSON.stringify(version.output_schema, null, 2)}</pre></div>)}</div></CardContent></Card>}
            </div> : <Card><CardContent className="flex min-h-80 flex-col items-center justify-center text-center"><Code2 className="mb-3 h-12 w-12 text-muted-foreground" /><div className="font-medium">یک Prompt را انتخاب کنید</div></CardContent></Card>}
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent dir="rtl" className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Prompt جدید</DialogTitle><DialogDescription>کلیدها پس از ساخت ثابت می‌مانند؛ محتوا در نسخه‌های جدا مدیریت می‌شود.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div><Label>کلید Prompt</Label><Input dir="ltr" value={createMeta.promptKey} onChange={(event) => setCreateMeta({ ...createMeta, promptKey: event.target.value })} placeholder="recruiting.candidate_summary" /></div><div><Label>کلید قابلیت</Label><Input dir="ltr" value={createMeta.featureKey} onChange={(event) => setCreateMeta({ ...createMeta, featureKey: event.target.value })} placeholder="recruiting.candidate_summary" /></div><div><Label>نام نمایشی</Label><Input value={createMeta.displayName} onChange={(event) => setCreateMeta({ ...createMeta, displayName: event.target.value })} /></div><div><Label>توضیح</Label><Input value={createMeta.description} onChange={(event) => setCreateMeta({ ...createMeta, description: event.target.value })} /></div></div><VersionFields value={createVersion} onChange={setCreateVersion} /><DialogFooter><Button onClick={() => void createPrompt()} disabled={busy === 'create'}>{busy === 'create' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ساخت پیش‌نویس</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}><DialogContent dir="rtl" className="max-w-3xl"><DialogHeader><DialogTitle>تست Prompt</DialogTitle><DialogDescription>دادهٔ نمونه و خروجی در Registry ذخیره نمی‌شود؛ فقط وضعیت، Provider، مدل و متریک ثبت می‌شود.</DialogDescription></DialogHeader><div><Label>متغیرهای نمونه (JSON)</Label><Textarea dir="ltr" className="min-h-36 font-mono text-xs" value={testVariables} onChange={(event) => setTestVariables(event.target.value)} placeholder={'{\n  "candidate_name": "Sara"\n}'} /></div>{testResult && <div className={`rounded-xl border p-4 ${testResult.passed ? 'border-emerald-500/50' : 'border-destructive/50'}`}><div className="mb-2 font-medium">{testResult.passed ? 'تست موفق' : testResult.error || 'تست ناموفق'}</div>{testResult.provider && <div dir="ltr" className="mb-2 text-xs text-muted-foreground">{testResult.provider} / {testResult.model}</div>}<pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{testResult.content || 'بدون خروجی'}</pre></div>}<DialogFooter><Button onClick={() => void testDraft()} disabled={busy === 'test'}>{busy === 'test' && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}اجرای تست واقعی</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
};

export default PromptRegistry;
