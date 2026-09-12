import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, ExternalLink, Eye, Loader2, Play, Save, ShieldCheck } from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AgentSettings {
  id: string; enabled: boolean; auto_publish: boolean; daily_article_count: number;
  publishing_times_json: string[]; timezone: string; source_domains_json: string[];
  topic_keywords_json: string[]; lookback_days: number; minimum_credibility_score: number;
  minimum_quality_score: number; author_name: string; author_disclosure: string; updated_at: string;
}
interface AgentRun {
  id: string; slot_key: string; status: string; trigger: string; article_id: string | null;
  sources_checked: number; credibility_score: number | null; quality_score: number | null;
  error_message: string | null; started_at: string; finished_at: string | null;
}
interface Article {
  id: string; title: string; slug: string; status: string; excerpt: string;
  content_markdown: string; seo_title: string; meta_description: string;
  focus_keyword: string; related_keywords: string[];
  sources: Array<{ url: string; title: string | null; published_at: string | null }>;
  credibility_score: number; quality_score: number; published_at: string | null;
}

const statusLabel: Record<string, string> = {
  published: 'منتشرشده', rejected: 'رد کنترل کیفیت', failed: 'ناموفق', running: 'در حال اجرا',
  draft: 'پیش‌نویس', archived: 'بایگانی', skipped: 'ردشده',
};

const ContentAgentAdmin = () => {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [busy, setBusy] = useState('');
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    try {
      const [nextSettings, nextRuns, nextArticles] = await Promise.all([
        apiRequest<AgentSettings>('/admin/content-agent/settings'),
        apiRequest<AgentRun[]>('/admin/content-agent/runs?limit=20'),
        apiRequest<Article[]>('/admin/content-agent/articles?limit=30'),
      ]);
      setSettings(nextSettings); setRuns(nextRuns); setArticles(nextArticles);
    } catch (error) { console.error(error); toast.error('دریافت اطلاعات ایجنت ناموفق بود'); }
    finally { setBusy(''); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setBusy('save');
    try {
      const saved = await apiRequest<AgentSettings>('/admin/content-agent/settings', {
        method: 'PUT', body: JSON.stringify(settings),
      });
      setSettings(saved); toast.success('تنظیمات ایجنت ذخیره شد');
    } catch (error) { console.error(error); toast.error('ذخیره تنظیمات ناموفق بود'); }
    finally { setBusy(''); }
  };

  const runNow = async () => {
    setBusy('run');
    try {
      await apiRequest('/admin/content-agent/run', { method: 'POST' });
      toast.success('اجرای ایجنت در صف قرار گرفت');
      window.setTimeout(() => void load(), 5000);
    } catch (error) { console.error(error); toast.error('اجرای ایجنت شروع نشد'); }
    finally { setBusy(''); }
  };

  const changeStatus = async (article: Article, status: 'published' | 'archived') => {
    setBusy(article.id);
    try {
      await apiRequest(`/admin/content-agent/articles/${article.id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      await load(); toast.success(status === 'archived' ? 'مقاله از سایت برداشته شد' : 'مقاله منتشر شد');
    } catch (error) { console.error(error); toast.error('تغییر وضعیت مقاله ناموفق بود'); }
    finally { setBusy(''); }
  };

  if (!settings || busy === 'load') return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const set = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => setSettings(current => current ? { ...current, [key]: value } : current);

  return <><Helmet><title>ایجنت تحریریه | HRing</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="relative min-h-screen" dir="rtl"><AuroraBackground /><main className="container relative z-10 mx-auto max-w-7xl px-4 py-8">
      <Button asChild variant="outline" className="mb-5"><Link to="/admin"><ArrowRight className="ml-2 h-4 w-4" />بازگشت</Link></Button>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-7 w-7 text-primary" />ایجنت تحریریه منابع انسانی</h1><p className="mt-1 text-sm text-muted-foreground">پژوهش چندمنبعی، کنترل اعتبار، تولید فارسی و انتشار خودکار مقاله.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void runNow()} disabled={busy === 'run'}>{busy === 'run' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Play className="ml-2 h-4 w-4" />}اجرای آزمایشی</Button><Button onClick={() => void save()} disabled={busy === 'save'}><Save className="ml-2 h-4 w-4" />ذخیره</Button></div></div>
      <Card className="mb-5 border-amber-500/30 bg-amber-500/5"><CardContent className="flex items-start gap-3 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-500" /><p>انتشار خودکار فقط وقتی انجام می‌شود که حداقل سه لینک مستقیم از دو دامنه معتبر، امتیاز اعتبار و امتیاز کیفیت تعیین‌شده را پاس کنند. کلید خاموش‌کردن فوری همیشه در دسترس است.</p></CardContent></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>انتشار</CardTitle><CardDescription>ساعت‌ها بر اساس تهران و در بازه‌های ۱۵ دقیقه‌ای هستند.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>فعال‌بودن ایجنت</Label><p className="text-xs text-muted-foreground">کلید توقف اضطراری تمام اجراهای زمان‌بندی‌شده</p></div><Switch checked={settings.enabled} onCheckedChange={value => set('enabled', value)} /></div>
          <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>انتشار کاملاً خودکار</Label><p className="text-xs text-muted-foreground">روشن: انتشار مستقیم پس از قبولی کیفیت؛ خاموش: ذخیره به‌صورت پیش‌نویس برای بازبینی و انتشار دستی</p></div><Switch checked={settings.auto_publish} onCheckedChange={value => set('auto_publish', value)} /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>تعداد روزانه</Label><Input type="number" min={1} max={2} value={settings.daily_article_count} onChange={e => set('daily_article_count', Number(e.target.value))} /></div><div><Label>بازه تازگی منابع (روز)</Label><Input type="number" min={1} max={30} value={settings.lookback_days} onChange={e => set('lookback_days', Number(e.target.value))} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>ساعت انتشار اول</Label><Input type="time" step={900} value={settings.publishing_times_json[0] || '09:00'} onChange={e => set('publishing_times_json', [e.target.value, settings.publishing_times_json[1] || '17:00'])} /></div><div><Label>ساعت انتشار دوم</Label><Input type="time" step={900} disabled={settings.daily_article_count < 2} value={settings.publishing_times_json[1] || '17:00'} onChange={e => set('publishing_times_json', [settings.publishing_times_json[0] || '09:00', e.target.value])} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>حداقل اعتبار منبع</Label><Input type="number" min={60} max={100} value={settings.minimum_credibility_score} onChange={e => set('minimum_credibility_score', Number(e.target.value))} /></div><div><Label>حداقل کیفیت مقاله</Label><Input type="number" min={60} max={100} value={settings.minimum_quality_score} onChange={e => set('minimum_quality_score', Number(e.target.value))} /></div></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>منابع و هویت تحریریه</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><Label>دامنه‌های مجاز — هر خط یک دامنه</Label><Textarea dir="ltr" className="mt-2 min-h-32" value={settings.source_domains_json.join('\n')} onChange={e => set('source_domains_json', e.target.value.split(/\s+/).filter(Boolean))} /></div>
          <div><Label>موضوعات — هر خط یک موضوع</Label><Textarea className="mt-2 min-h-28" value={settings.topic_keywords_json.join('\n')} onChange={e => set('topic_keywords_json', e.target.value.split('\n').map(v => v.trim()).filter(Boolean))} /></div>
          <div><Label>نام نویسنده</Label><Input className="mt-2" value={settings.author_name} onChange={e => set('author_name', e.target.value)} /></div>
          <div><Label>شفاف‌سازی استفاده از AI</Label><Textarea className="mt-2" value={settings.author_disclosure} onChange={e => set('author_disclosure', e.target.value)} /></div>
        </CardContent></Card>
      </div>
      <Card className="mt-5"><CardHeader><CardTitle>مقالات تولیدشده</CardTitle><CardDescription>مقاله‌های پیش‌نویس را پیش از انتشار بازبینی کنید. در حالت انتشار خودکار، مقالهٔ تأییدشده مستقیماً روی بلاگ قرار می‌گیرد.</CardDescription></CardHeader><CardContent className="space-y-2">{articles.length === 0 ? <p className="text-sm text-muted-foreground">هنوز مقاله‌ای تولید نشده است.</p> : articles.map(article => {
        const isPreviewOpen = previewArticleId === article.id;
        return <div key={article.id} className="rounded-xl border">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <button type="button" className="text-right font-medium underline-offset-4 hover:text-primary hover:underline" aria-expanded={isPreviewOpen} onClick={() => setPreviewArticleId(isPreviewOpen ? null : article.id)}>{article.title}</button>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{statusLabel[article.status] || article.status}</Badge><span>اعتبار {article.credibility_score}</span><span>کیفیت {article.quality_score}</span></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewArticleId(isPreviewOpen ? null : article.id)}><Eye className="ml-1 h-4 w-4" />{isPreviewOpen ? 'بستن' : 'پیش‌نمایش'}</Button>
              {article.status === 'published' && <Button asChild size="sm" variant="outline"><a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="ml-1 h-4 w-4" />مشاهده در سایت</a></Button>}
              <Button size="sm" variant="ghost" disabled={busy === article.id} onClick={() => void changeStatus(article, article.status === 'published' ? 'archived' : 'published')}>{article.status === 'published' ? 'برداشتن از سایت' : 'انتشار دستی'}</Button>
            </div>
          </div>
          {isPreviewOpen && <div className="border-t p-4 md:p-6">
            <div className="mb-5 rounded-lg bg-muted/40 p-4">
              <p className="font-medium">{article.excerpt}</p>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div><dt className="text-muted-foreground">عنوان سئو</dt><dd>{article.seo_title}</dd></div>
                <div><dt className="text-muted-foreground">کلمه کلیدی</dt><dd>{article.focus_keyword}</dd></div>
                <div className="md:col-span-2"><dt className="text-muted-foreground">توضیح متا</dt><dd>{article.meta_description}</dd></div>
              </dl>
            </div>
            <article className="prose prose-invert max-w-none text-right prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-primary" dir="rtl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content_markdown}</ReactMarkdown>
            </article>
          </div>}
        </div>;
      })}</CardContent></Card>
      <Card className="mt-5"><CardHeader><CardTitle>گزارش اجرا</CardTitle></CardHeader><CardContent className="space-y-2">{runs.length === 0 ? <p className="text-sm text-muted-foreground">اجرایی ثبت نشده است.</p> : runs.map(run => <div key={run.id} className="grid gap-2 rounded-xl border p-3 text-sm md:grid-cols-5"><span>{new Date(run.started_at).toLocaleString('fa-IR')}</span><Badge variant="outline">{statusLabel[run.status] || run.status}</Badge><span>منابع: {run.sources_checked}</span><span>اعتبار: {run.credibility_score ?? '—'} / کیفیت: {run.quality_score ?? '—'}</span><span className="text-destructive">{run.error_message || ''}</span></div>)}</CardContent></Card>
    </main></div></>;
};

export default ContentAgentAdmin;

