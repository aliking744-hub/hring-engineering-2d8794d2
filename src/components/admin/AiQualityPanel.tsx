import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, RefreshCw, Search, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

type QualityStatus = 'unreviewed' | 'correct' | 'needs_review' | 'incorrect';

interface AiInteraction {
  id: string;
  request_id: string;
  company_id: string | null;
  user_id: string | null;
  feature_key: string;
  provider: string;
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  response_text: string | null;
  status: 'success' | 'failure';
  error_code: string | null;
  latency_ms: number | null;
  session_id: string | null;
  quality_status: QualityStatus;
  admin_note: string | null;
  created_at: string;
}

interface UserFeedback {
  id: string;
  user_id?: string | null;
  rating: number;
  comment?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  rewarded?: boolean;
  created_at: string;
}

const QUALITY_LABELS: Record<QualityStatus, string> = {
  unreviewed: 'بررسی‌نشده',
  correct: 'پاسخ درست',
  needs_review: 'نیازمند بررسی',
  incorrect: 'پاسخ نادرست',
};

const TOPIC_RULES: Array<[string, RegExp]> = [
  ['قیمت، پلن و اعتبار', /قیمت|هزینه|خرید|اعتبار|کردیت|پلن|بسته|پرداخت/],
  ['قانون کار و شکایت', /قانون|شکایت|بیمه|حقوق|سنوات|عیدی|قرارداد کار|اخراج/],
  ['استخدام و مصاحبه', /استخدام|مصاحبه|رزومه|شغل|آگهی|کاندیدا|متقاضی/],
  ['آموزش و توسعه', /آموزش|یادگیری|توسعه|آن‌بوردینگ|مسیر یادگیری/],
  ['حساب و ورود', /ورود|ثبت.?نام|رمز|حساب|پروفایل|کاربر/],
  ['خطا و مشکل فنی', /خطا|مشکل|باز نمی|کار نمی|خراب|گیر|کند/],
];

const questionText = (item: AiInteraction) =>
  item.messages.filter((message) => message.role === 'user').at(-1)?.content || 'بدون متن سؤال';

const topicFor = (item: AiInteraction) => {
  const text = questionText(item);
  return TOPIC_RULES.find(([, pattern]) => pattern.test(text))?.[0] || 'سایر موضوعات';
};

const AiQualityPanel = () => {
  const [interactions, setInteractions] = useState<AiInteraction[]>([]);
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [selected, setSelected] = useState<AiInteraction | null>(null);
  const [search, setSearch] = useState('');
  const [quality, setQuality] = useState<QualityStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (search.trim()) params.set('search', search.trim());
      if (quality !== 'all') params.set('quality_status', quality);
      const [interactionRows, feedbackRows] = await Promise.all([
        apiRequest<AiInteraction[]>(`/admin/platform/ai/interactions?${params.toString()}`),
        apiRequest<UserFeedback[]>('/admin/platform/ai/feedback?limit=1000'),
      ]);
      setInteractions(interactionRows);
      setFeedback(feedbackRows);
      setSelected((current) => interactionRows.find((row) => row.id === current?.id) || interactionRows[0] || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت مکالمات و بازخوردها انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [quality, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setNote(selected?.admin_note || ''); }, [selected]);

  const topicRows = useMemo(() => {
    const counts = new Map<string, number>();
    interactions.forEach((item) => counts.set(topicFor(item), (counts.get(topicFor(item)) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [interactions]);

  const averageRating = feedback.length
    ? feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length
    : 0;
  const failures = interactions.filter((item) => item.status === 'failure').length;
  const qualityProblems = interactions.filter((item) => ['needs_review', 'incorrect'].includes(item.quality_status)).length;

  const review = async (qualityStatus: QualityStatus) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await apiRequest<AiInteraction>(`/admin/platform/ai/interactions/${selected.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ quality_status: qualityStatus, admin_note: note.trim() || null }),
      });
      setInteractions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      toast.success('ارزیابی پاسخ ثبت شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت ارزیابی انجام نشد');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">مکالمات و کیفیت AI</h2>
          <p className="text-sm text-muted-foreground">مشاهده سؤال و پاسخ، خطاها، موضوعات پرتکرار و نظر واقعی کاربران.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 text-sm leading-6"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-500" /><span>این بخش ممکن است حاوی اطلاعات منابع انسانی باشد؛ فقط برای کنترل کیفیت و پشتیبانی استفاده شود. System Prompt و کلیدهای سرویس در این گزارش ذخیره نمی‌شوند.</span></CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">درخواست ثبت‌شده</div><div className="mt-1 text-2xl font-bold">{interactions.length.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">خطای فنی</div><div className="mt-1 text-2xl font-bold">{failures.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ایراد کیفی</div><div className="mt-1 text-2xl font-bold">{qualityProblems.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">تعداد نظر</div><div className="mt-1 text-2xl font-bold">{feedback.length.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">میانگین امتیاز</div><div className="mt-1 text-2xl font-bold">{averageRating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} / ۵</div></CardContent></Card>
      </div>

      <Tabs defaultValue="conversations">
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="conversations">سؤال و پاسخ‌ها</TabsTrigger><TabsTrigger value="topics">تحلیل موضوعات</TabsTrigger><TabsTrigger value="feedback">امتیاز و نظرات</TabsTrigger></TabsList>

        <TabsContent value="conversations" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-64 flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در سؤال یا پاسخ…" /></div>
            <Select value={quality} onValueChange={(value) => setQuality(value as QualityStatus | 'all')}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">همه ارزیابی‌ها</SelectItem>{Object.entries(QUALITY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <Card><CardHeader><CardTitle className="text-base">آخرین درخواست‌ها</CardTitle></CardHeader><CardContent><ScrollArea className="h-[560px]"><div className="space-y-2 pl-3">{interactions.map((item) => <button key={item.id} onClick={() => setSelected(item)} className={`w-full rounded-xl border p-3 text-right transition ${selected?.id === item.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><Badge variant={item.status === 'failure' ? 'destructive' : 'secondary'}>{item.status === 'failure' ? 'خطا' : item.feature_key}</Badge><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('fa-IR')}</span></div><p className="line-clamp-2 text-sm">{questionText(item)}</p><div className="mt-2 text-xs text-muted-foreground">{QUALITY_LABELS[item.quality_status || 'unreviewed']}</div></button>)}{!interactions.length && <p className="py-12 text-center text-sm text-muted-foreground">پس از انتشار این نسخه، درخواست‌های AI اینجا ثبت می‌شوند.</p>}</div></ScrollArea></CardContent></Card>

            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" />جزئیات پاسخ</CardTitle><CardDescription>{selected ? `${selected.provider} / ${selected.model} · ${selected.latency_ms?.toLocaleString('fa-IR') || '—'} ms` : 'یک درخواست را انتخاب کنید'}</CardDescription></CardHeader><CardContent>{selected ? <div className="space-y-4"><ScrollArea className="h-[330px] rounded-xl border p-4"><div className="space-y-4">{selected.messages.map((message, index) => <div key={`${message.role}-${index}`} className="rounded-xl bg-primary/10 p-3"><Badge variant="outline" className="mb-2">کاربر</Badge><p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p></div>)}<div className={`rounded-xl p-3 ${selected.status === 'failure' ? 'bg-destructive/10' : 'bg-muted'}`}><Badge variant={selected.status === 'failure' ? 'destructive' : 'outline'} className="mb-2">پاسخ AI</Badge><p className="whitespace-pre-wrap text-sm leading-7">{selected.response_text || selected.error_code || 'پاسخی ثبت نشده است'}</p></div></div></ScrollArea><Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="یادداشت داخلی بررسی کیفیت…" /><div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => void review('correct')}><CheckCircle2 className="ml-2 h-4 w-4" />درست</Button><Button disabled={saving} variant="secondary" onClick={() => void review('needs_review')}>نیازمند بررسی</Button><Button disabled={saving} variant="destructive" onClick={() => void review('incorrect')}>نادرست</Button></div></div> : <div className="py-24 text-center text-muted-foreground">درخواستی انتخاب نشده است.</div>}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="topics"><Card><CardHeader><CardTitle>موضوعات پرتکرار</CardTitle><CardDescription>دسته‌بندی اولیه از متن سؤال‌های کاربران؛ برای کشف نیازها و ایرادهای پرتکرار.</CardDescription></CardHeader><CardContent className="space-y-3">{topicRows.map(([topic, count]) => <div key={topic} className="flex items-center justify-between rounded-xl border p-4"><span>{topic}</span><Badge>{count.toLocaleString('fa-IR')} درخواست</Badge></div>)}{!topicRows.length && <p className="py-10 text-center text-muted-foreground">هنوز داده‌ای برای تحلیل وجود ندارد.</p>}</CardContent></Card></TabsContent>

        <TabsContent value="feedback"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" />امتیازها و متن نظرات</CardTitle><CardDescription>بازخورد ثبت‌شده در ویجت سایت، همراه با شناسه مکالمه یا درخواست در صورت وجود.</CardDescription></CardHeader><CardContent><div className="space-y-3">{feedback.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= Number(item.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />)}</div><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('fa-IR')}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{item.comment || 'بدون توضیح متنی'}</p>{(item.sessionId || item.requestId) && <div className="mt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">{item.requestId || item.sessionId}</div>}</div>)}{!feedback.length && <p className="py-10 text-center text-muted-foreground">هنوز نظری ثبت نشده است.</p>}</div></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
};

export default AiQualityPanel;
