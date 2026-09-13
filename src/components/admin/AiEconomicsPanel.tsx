import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Loader2, Plus, RefreshCw } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

interface UsageRow {
  feature_key: string;
  provider: string;
  model: string;
  requests: number;
  failures: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  credits_charged: number;
  estimated_cost_microusd: number;
  provider_cost_microusd: number;
}

interface UsageSummary {
  since: string;
  rows: UsageRow[];
  total_requests: number;
  total_failures: number;
  total_estimated_cost_microusd: number;
  total_provider_cost_microusd: number;
  total_credits_charged: number;
}

interface CompanyUsageRow {
  company_id: string | null;
  requests: number;
  failures: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  credits_charged: number;
  estimated_cost_microusd: number;
  provider_cost_microusd: number;
}

interface CompanyUsageSummary {
  since: string;
  rows: CompanyUsageRow[];
  total_requests: number;
  total_failures: number;
  total_estimated_cost_microusd: number;
  total_provider_cost_microusd: number;
  total_credits_charged: number;
}

interface UsageEvent {
  id: string;
  request_id: string;
  feature_key: string;
  provider: string;
  model: string;
  metrics_json: Record<string, number>;
  provider_cost_microusd: number | null;
  estimated_cost_microusd: number;
  credits_charged: number;
  status: string;
  error_code: string | null;
  created_at: string;
}

interface PlatformCompany {
  id: string;
  name: string;
}

interface RateCard {
  id: string;
  provider: string;
  model: string;
  metric: string;
  unit_size: number;
  cost_microusd: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

const METRICS = [
  'input_tokens',
  'output_tokens',
  'cached_input_tokens',
  'reasoning_tokens',
  'characters',
  'audio_seconds',
  'video_seconds',
  'images',
  'requests',
] as const;

const usd = (microUsd: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(microUsd / 1_000_000);

const integer = (value: number) => value.toLocaleString('fa-IR');
const toman = (value: number) => `${Math.round(value).toLocaleString('fa-IR')} تومان`;

const numberValue = (value: string) => {
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const AiEconomicsPanel = () => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [companySummary, setCompanySummary] = useState<CompanyUsageSummary | null>(null);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [rates, setRates] = useState<RateCard[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateOpen, setRateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('');
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('input_tokens');
  const [unitSize, setUnitSize] = useState(1_000_000);
  const [costUsd, setCostUsd] = useState('');

  const [contractRevenueToman, setContractRevenueToman] = useState('200000000');
  const [usdTomanRate, setUsdTomanRate] = useState('');
  const [targetGrossMargin, setTargetGrossMargin] = useState('70');
  const [otherMonthlyCostToman, setOtherMonthlyCostToman] = useState('0');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, companyData, rateData, companyList, eventData] = await Promise.all([
        apiRequest<UsageSummary>('/admin/platform/ai/usage-summary?days=30'),
        apiRequest<CompanyUsageSummary>('/admin/platform/ai/company-summary?days=30'),
        apiRequest<RateCard[]>('/admin/platform/ai/rates'),
        apiRequest<PlatformCompany[]>('/admin/platform/companies?limit=500'),
        apiRequest<UsageEvent[]>('/admin/platform/ai/usage-events?days=30&limit=500'),
      ]);
      setSummary(summaryData);
      setCompanySummary(companyData);
      setRates(rateData);
      setCompanies(companyList);
      setEvents(eventData);
    } catch (error) {
      console.error('AI economics load failed:', error);
      toast.error(error instanceof Error ? error.message : 'دریافت آمار مصرف هوش مصنوعی انجام نشد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const companyNames = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  const activeRates = useMemo(() => rates.filter((rate) => rate.is_active), [rates]);

  const saveRate = async () => {
    const parsedCost = Number(costUsd);
    if (!provider.trim() || !model.trim() || !Number.isFinite(parsedCost) || parsedCost < 0) {
      toast.error('Provider، model و هزینه معتبر را وارد کنید');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/admin/platform/ai/rates', {
        method: 'POST',
        body: JSON.stringify({
          provider: provider.trim().toLowerCase(),
          model: model.trim(),
          metric,
          unit_size: unitSize,
          cost_microusd: Math.round(parsedCost * 1_000_000),
        }),
      });
      toast.success('Rate Card جدید ثبت شد؛ نرخ قبلی برای تاریخچه حفظ شد');
      setRateOpen(false);
      setCostUsd('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت Rate Card انجام نشد');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  const totalCostMicro = summary?.total_provider_cost_microusd || summary?.total_estimated_cost_microusd || 0;
  const totalCostUsd = totalCostMicro / 1_000_000;
  const failedPercent = summary?.total_requests
    ? (summary.total_failures / summary.total_requests) * 100
    : 0;
  const avgCostPerRequestUsd = summary?.total_requests ? totalCostUsd / summary.total_requests : 0;
  const avgCostPerCreditUsd = summary?.total_credits_charged ? totalCostUsd / summary.total_credits_charged : 0;
  const summaryTokenTotal = (summary?.rows || []).reduce(
    (total, row) => total + row.input_tokens + row.output_tokens + row.cached_input_tokens + row.reasoning_tokens,
    0,
  );
  const eventTokenTotal = events.reduce(
    (total, event) =>
      total +
      (event.metrics_json.input_tokens || 0) +
      (event.metrics_json.output_tokens || 0) +
      (event.metrics_json.cached_input_tokens || 0) +
      (event.metrics_json.reasoning_tokens || 0),
    0,
  );
  const tokenDelta = eventTokenTotal - summaryTokenTotal;

  const revenue = numberValue(contractRevenueToman);
  const fx = numberValue(usdTomanRate);
  const margin = Math.min(99.9, numberValue(targetGrossMargin));
  const otherCosts = numberValue(otherMonthlyCostToman);
  const maxVariableCostToman = Math.max(0, revenue * (1 - margin / 100) - otherCosts);
  const safeAiCalls = fx > 0 && avgCostPerRequestUsd > 0
    ? Math.floor(maxVariableCostToman / (avgCostPerRequestUsd * fx))
    : null;
  const safeCredits = fx > 0 && avgCostPerCreditUsd > 0
    ? Math.floor(maxVariableCostToman / (avgCostPerCreditUsd * fx))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">AI Economics</h2>
          <p className="text-sm text-muted-foreground">مصرف ۳۰ روز اخیر؛ هزینه provider، توکن، Credit و failure به تفکیک قابلیت و شرکت.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />تازه‌سازی</Button>
          <Button onClick={() => setRateOpen(true)}><Plus className="ml-2 h-4 w-4" />Rate Card</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">درخواست AI</div><div className="mt-1 text-2xl font-bold">{integer(summary?.total_requests || 0)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">هزینه ۳۰ روز</div><div className="mt-1 text-2xl font-bold" dir="ltr">{usd(totalCostMicro)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Credit مصرف‌شده</div><div className="mt-1 text-2xl font-bold">{integer(summary?.total_credits_charged || 0)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Failure rate</div><div className="mt-1 text-2xl font-bold" dir="ltr">{failedPercent.toFixed(1)}%</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" />Pricing Simulator</CardTitle>
          <CardDescription>برآورد اولیه بر اساس میانگین هزینه واقعی ۳۰ روز اخیر. هزینه زیرساخت، نیروی انسانی، مالیات و فروش را در «سایر هزینه‌ها» وارد کنید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div><Label>مبلغ قرارداد ماهانه (تومان)</Label><Input dir="ltr" inputMode="numeric" value={contractRevenueToman} onChange={(event) => setContractRevenueToman(event.target.value)} /></div>
            <div><Label>نرخ هر دلار (تومان)</Label><Input dir="ltr" inputMode="numeric" value={usdTomanRate} onChange={(event) => setUsdTomanRate(event.target.value)} placeholder="نرخ واقعی روز" /></div>
            <div><Label>Gross Margin هدف (%)</Label><Input dir="ltr" inputMode="decimal" value={targetGrossMargin} onChange={(event) => setTargetGrossMargin(event.target.value)} /></div>
            <div><Label>سایر هزینه ماهانه (تومان)</Label><Input dir="ltr" inputMode="numeric" value={otherMonthlyCostToman} onChange={(event) => setOtherMonthlyCostToman(event.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">بودجه امن متغیر</div><div className="mt-1 font-bold">{toman(maxVariableCostToman)}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">AI cost / call مشاهده‌شده</div><div className="mt-1 font-bold" dir="ltr">${avgCostPerRequestUsd.toFixed(6)}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">حداکثر AI call تقریبی</div><div className="mt-1 font-bold">{safeAiCalls === null ? 'نیاز به داده و نرخ دلار' : integer(safeAiCalls)}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">حداکثر Credit تقریبی</div><div className="mt-1 font-bold">{safeCredits === null ? 'پس از کالیبراسیون Credit' : integer(safeCredits)}</div></div>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">این خروجی «قیمت قطعی فروش» نیست. بعد از چند هفته مصرف واقعی، بهتر است Credit هر feature بر مبنای هزینه P95 آن feature تنظیم شود تا کاربران سنگین حاشیه سود قرارداد را نخورند.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>هزینه به تفکیک شرکت</CardTitle><CardDescription>برای Drill-down هر شرکت، `company_id` به گزارش feature-level ارسال می‌شود؛ این جدول نمای اقتصادی کل tenant است.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>شرکت</TableHead><TableHead>Calls</TableHead><TableHead>Input</TableHead><TableHead>Output</TableHead><TableHead>Credits</TableHead><TableHead>Failure</TableHead><TableHead>AI Cost</TableHead></TableRow></TableHeader><TableBody>{(companySummary?.rows || []).map((row) => <TableRow key={row.company_id || 'individual'}><TableCell>{row.company_id ? companyNames.get(row.company_id) || row.company_id : 'کاربران فردی / بدون شرکت'}</TableCell><TableCell>{integer(row.requests)}</TableCell><TableCell>{integer(row.input_tokens)}</TableCell><TableCell>{integer(row.output_tokens)}</TableCell><TableCell>{integer(row.credits_charged)}</TableCell><TableCell>{integer(row.failures)}</TableCell><TableCell dir="ltr">{usd(row.provider_cost_microusd || row.estimated_cost_microusd)}</TableCell></TableRow>)}{!companySummary?.rows.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">هنوز مصرف شرکتی ثبت نشده است.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>هزینه به تفکیک قابلیت</CardTitle><CardDescription>بعد از مهاجرت هر feature به AI Gateway، مصرف واقعی آن اینجا ظاهر می‌شود.</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead>Provider / Model</TableHead><TableHead>Calls</TableHead><TableHead>Input</TableHead><TableHead>Output</TableHead><TableHead>Credits</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
              <TableBody>
                {(summary?.rows || []).map((row) => (
                  <TableRow key={`${row.feature_key}:${row.provider}:${row.model}`}>
                    <TableCell className="font-mono text-xs">{row.feature_key}</TableCell>
                    <TableCell><div>{row.provider}</div><div className="text-xs text-muted-foreground" dir="ltr">{row.model}</div></TableCell>
                    <TableCell>{integer(row.requests)}{row.failures > 0 && <Badge className="mr-2" variant="destructive">{integer(row.failures)} خطا</Badge>}</TableCell>
                    <TableCell>{integer(row.input_tokens)}</TableCell>
                    <TableCell>{integer(row.output_tokens)}</TableCell>
                    <TableCell>{integer(row.credits_charged)}</TableCell>
                    <TableCell dir="ltr">{usd(row.provider_cost_microusd || row.estimated_cost_microusd)}</TableCell>
                  </TableRow>
                ))}
                {!summary?.rows.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">هنوز featureای از Gateway مصرف ثبت نکرده است.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ردیابی و تطبیق هر درخواست</CardTitle>
          <CardDescription>
            هر فراخوانی با request_id، توکن خام مدل، الماس کسرشده و هزینه دلار ثبت می‌شود؛
            اختلاف تجمیع فعلی: <span dir="ltr">{integer(tokenDelta)}</span> توکن.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokenDelta !== 0 && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
              هشدار تطبیق: جمع ردیف‌های درخواست با خلاصه برابر نیست. تا رفع اختلاف، این داده برای قیمت‌گذاری قطعی معتبر نیست.
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>زمان / request_id</TableHead><TableHead>Feature</TableHead><TableHead>Model</TableHead><TableHead>Input</TableHead><TableHead>Output</TableHead><TableHead>Cache</TableHead><TableHead>Reasoning</TableHead><TableHead>الماس</TableHead><TableHead>هزینه</TableHead><TableHead>وضعیت</TableHead></TableRow></TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell><div>{new Date(event.created_at).toLocaleString('fa-IR')}</div><div className="max-w-40 truncate font-mono text-[10px]" dir="ltr" title={event.request_id}>{event.request_id}</div></TableCell>
                    <TableCell className="font-mono text-xs">{event.feature_key}</TableCell>
                    <TableCell><div>{event.provider}</div><div className="text-xs text-muted-foreground" dir="ltr">{event.model}</div></TableCell>
                    <TableCell>{integer(event.metrics_json.input_tokens || 0)}</TableCell>
                    <TableCell>{integer(event.metrics_json.output_tokens || 0)}</TableCell>
                    <TableCell>{integer(event.metrics_json.cached_input_tokens || 0)}</TableCell>
                    <TableCell>{integer(event.metrics_json.reasoning_tokens || 0)}</TableCell>
                    <TableCell>{integer(event.credits_charged)}</TableCell>
                    <TableCell dir="ltr">{usd(event.provider_cost_microusd ?? event.estimated_cost_microusd)}</TableCell>
                    <TableCell>{event.status === 'success' ? 'موفق' : event.error_code || event.status}</TableCell>
                  </TableRow>
                ))}
                {!events.length && <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">هنوز درخواست قابل تطبیقی ثبت نشده است.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rate Cards فعال</CardTitle><CardDescription>قیمت provider در زمان مصرف نگهداری می‌شود؛ تغییر نرخ جدید تاریخچه قبلی را بازنویسی نمی‌کند.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Metric</TableHead><TableHead>Unit</TableHead><TableHead>Cost</TableHead><TableHead>از تاریخ</TableHead></TableRow></TableHeader><TableBody>{activeRates.map((rate) => <TableRow key={rate.id}><TableCell>{rate.provider}</TableCell><TableCell dir="ltr">{rate.model}</TableCell><TableCell className="font-mono text-xs">{rate.metric}</TableCell><TableCell>{integer(rate.unit_size)}</TableCell><TableCell dir="ltr">{usd(rate.cost_microusd)}</TableCell><TableCell>{new Date(rate.effective_from).toLocaleString('fa-IR')}</TableCell></TableRow>)}{!activeRates.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Rate Card ثبت نشده است.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
      </Card>

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>Rate Card جدید</DialogTitle><DialogDescription>قیمت را به دلار برای واحد مشخص وارد کنید. API key در این پنل وارد نمی‌شود.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3"><div><Label>Provider</Label><Input dir="ltr" value={provider} onChange={(event) => setProvider(event.target.value)} /></div><div><Label>Model</Label><Input dir="ltr" value={model} onChange={(event) => setModel(event.target.value)} placeholder="model-id" /></div></div>
            <div><Label>Metric</Label><Select value={metric} onValueChange={(value) => setMetric(value as (typeof METRICS)[number])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METRICS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Unit size</Label><Input type="number" min={1} value={unitSize} onChange={(event) => setUnitSize(Math.max(1, Number(event.target.value) || 1))} /></div><div><Label>Cost USD / unit</Label><Input dir="ltr" inputMode="decimal" value={costUsd} onChange={(event) => setCostUsd(event.target.value)} placeholder="5.00" /></div></div>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground"><Calculator className="ml-2 inline h-4 w-4" />مثال: برای $5 به ازای یک میلیون input token، Unit size = 1,000,000 و Cost = 5.</div>
          </div>
          <DialogFooter><Button onClick={() => void saveRate()} disabled={saving}>{saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ثبت نرخ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AiEconomicsPanel;