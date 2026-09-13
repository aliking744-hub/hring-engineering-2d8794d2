import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, Save, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import AuroraBackground from '@/components/AuroraBackground';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';

type BillingPlan = {
  plan_type: string;
  display_name: string;
  scope: string;
  price_toman: number;
  price_usd_cents: number | null;
  monthly_credits: number;
  is_active: boolean;
  updated_at: string;
};

type ExchangeRate = {
  market_rate_toman: number | null;
  manual_rate_toman: number | null;
  markup_toman: number;
  effective_rate_toman: number | null;
  mode: 'automatic' | 'manual';
  source: string;
  source_url: string;
  source_fetched_at: string | null;
  stale: boolean;
  stale_after_hours: number;
  auto_refresh_enabled: boolean;
  last_error: string | null;
};

const toman = (value: number | null) => value == null ? '—' : `${value.toLocaleString('fa-IR')} تومان`;

const toLatinDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const normalizeUsdDraft = (value: string) => {
  const normalized = toLatinDigits(value)
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.]/g, '');
  const [whole = '', ...fractions] = normalized.split('.');
  return fractions.length === 0 ? whole : `${whole}.${fractions.join('').slice(0, 2)}`;
};

const usdCentsToDraft = (value: number | null) => {
  if (value == null) return '';
  const whole = Math.floor(value / 100);
  const fraction = String(value % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
};

const usdDraftToCents = (value: string): number | null | undefined => {
  const normalized = normalizeUsdDraft(value);
  if (normalized === '') return null;
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : undefined;
};

const PricingAdmin = () => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [usdDrafts, setUsdDrafts] = useState<Record<string, string>>({});
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState({ manual: '', markup: '10000', stale: '36', auto: true });

  const load = useCallback(async () => {
    try {
      const [nextPlans, nextRate] = await Promise.all([
        apiRequest<BillingPlan[]>('/platform/billing/plans'),
        apiRequest<ExchangeRate>('/platform/billing/exchange-rate'),
      ]);
      setPlans(nextPlans);
      setUsdDrafts(Object.fromEntries(nextPlans.map((plan) => [plan.plan_type, usdCentsToDraft(plan.price_usd_cents)])));
      setRate(nextRate);
      setRateDraft({
        manual: nextRate.manual_rate_toman?.toString() || '',
        markup: nextRate.markup_toman.toString(),
        stale: nextRate.stale_after_hours.toString(),
        auto: nextRate.auto_refresh_enabled,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'بارگذاری قیمت‌گذاری ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveRate = async () => {
    setBusy('rate');
    try {
      await apiRequest('/platform/billing/exchange-rate', {
        method: 'PATCH',
        body: JSON.stringify({
          manual_rate_toman: rateDraft.manual ? Number(rateDraft.manual) : null,
          markup_toman: Number(rateDraft.markup),
          stale_after_hours: Number(rateDraft.stale),
          auto_refresh_enabled: rateDraft.auto,
        }),
      });
      toast.success('تنظیمات نرخ ذخیره شد');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره نرخ ناموفق بود');
    } finally {
      setBusy(null);
    }
  };

  const refreshRate = async () => {
    setBusy('refresh');
    try {
      await apiRequest('/platform/billing/exchange-rate/refresh', { method: 'POST' });
      toast.success('نرخ بازار و قیمت پلن‌ها به‌روز شد');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت نرخ ناموفق بود');
    } finally {
      setBusy(null);
    }
  };

  const patchPlan = (planType: string, changes: Partial<BillingPlan>) => {
    setPlans((current) => current.map((plan) => plan.plan_type === planType ? { ...plan, ...changes } : plan));
  };

  const updateUsdDraft = (planType: string, value: string) => {
    const normalized = normalizeUsdDraft(value);
    if (/^\d*(?:\.\d{0,2})?$/.test(normalized)) {
      setUsdDrafts((current) => ({ ...current, [planType]: normalized }));
    }
  };

  const savePlan = async (plan: BillingPlan) => {
    const priceUsdCents = usdDraftToCents(usdDrafts[plan.plan_type] ?? '');
    if (priceUsdCents === undefined) {
      toast.error('قیمت دلاری باید یک عدد معتبر با حداکثر دو رقم اعشار باشد');
      return;
    }
    setBusy(plan.plan_type);
    try {
      await apiRequest(`/platform/billing/plans/${encodeURIComponent(plan.plan_type)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: plan.display_name,
          price_usd_cents: priceUsdCents,
          monthly_credits: plan.monthly_credits,
          is_active: plan.is_active,
        }),
      });
      toast.success(`پلن ${plan.display_name} ذخیره شد`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره پلن ناموفق بود');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-background" aria-busy="true" />;

  return (
    <>
      <Helmet><title>قیمت‌گذاری و پلن‌ها | HRing</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <main className="container relative z-10 mx-auto max-w-6xl px-4 py-10">
          <div className="mb-7 flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild><Link to="/admin"><ArrowRight className="h-5 w-5" /></Link></Button>
            <div><h1 className="text-3xl font-bold">قیمت‌گذاری و پلن‌ها</h1><p className="mt-1 text-sm text-muted-foreground">کنترل قیمت دلاری، اعتبار و نرخ تبدیل به تومان</p></div>
          </div>

          <Card className={rate?.stale ? 'border-destructive' : ''}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>نرخ دلار</CardTitle><CardDescription>نرخ آزاد بازار به‌علاوه حاشیه محافظتی</CardDescription></div>
                <Button onClick={refreshRate} disabled={busy !== null}><RefreshCw className={`ml-2 h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />به‌روزرسانی همین حالا</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">نرخ بازار</div><div className="mt-1 font-bold">{toman(rate?.market_rate_toman ?? null)}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">نرخ مؤثر فروش</div><div className="mt-1 font-bold text-primary">{toman(rate?.effective_rate_toman ?? null)}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">حالت</div><div className="mt-1 font-bold">{rate?.mode === 'manual' ? 'دستی' : 'خودکار'}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">آخرین دریافت</div><div className="mt-1 text-sm font-medium">{rate?.source_fetched_at ? new Date(rate.source_fetched_at).toLocaleString('fa-IR') : 'هنوز دریافت نشده'}</div></div>
              </div>
              {(rate?.stale || rate?.last_error) && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{rate.last_error || 'نرخ خودکار قدیمی است؛ خرید پلن دلاری تا بروزرسانی نرخ متوقف می‌شود.'}</div>}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2"><Label>نرخ دستی (تومان)</Label><Input inputMode="numeric" value={rateDraft.manual} onChange={(e) => setRateDraft({ ...rateDraft, manual: e.target.value.replace(/\D/g, '') })} placeholder="خالی = نرخ خودکار" /></div>
                <div className="space-y-2"><Label>حاشیه روی دلار (تومان)</Label><Input inputMode="numeric" value={rateDraft.markup} onChange={(e) => setRateDraft({ ...rateDraft, markup: e.target.value.replace(/\D/g, '') })} /></div>
                <div className="space-y-2"><Label>حداکثر عمر نرخ (ساعت)</Label><Input inputMode="numeric" value={rateDraft.stale} onChange={(e) => setRateDraft({ ...rateDraft, stale: e.target.value.replace(/\D/g, '') })} /></div>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={rateDraft.auto} onChange={(e) => setRateDraft({ ...rateDraft, auto: e.target.checked })} className="h-4 w-4" />به‌روزرسانی روزانه فعال</label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3"><a href={rate?.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">مشاهده منبع نرخ ({rate?.source})</a><Button variant="outline" onClick={saveRate} disabled={busy !== null}><Save className="ml-2 h-4 w-4" />ذخیره تنظیمات نرخ</Button></div>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.plan_type}>
                <CardHeader><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" /><CardTitle>{plan.display_name}</CardTitle></div><CardDescription>{plan.plan_type} · {plan.scope === 'corporate' ? 'سازمانی' : 'شخصی'}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>نام نمایشی</Label><Input value={plan.display_name} onChange={(e) => patchPlan(plan.plan_type, { display_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>قیمت پایه (دلار)</Label><Input inputMode="decimal" value={usdDrafts[plan.plan_type] ?? ''} onChange={(e) => updateUsdDraft(plan.plan_type, e.target.value)} placeholder="مثلاً 1.5" aria-label={`قیمت دلاری ${plan.display_name}`} /></div>
                    <div className="space-y-2"><Label>الماس پلن</Label><Input inputMode="numeric" value={plan.monthly_credits} onChange={(e) => patchPlan(plan.plan_type, { monthly_credits: Number(e.target.value.replace(/\D/g, '')) })} /></div>
                  </div>
                  <div className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">قیمت نهایی فعلی</div><div className="mt-1 text-lg font-bold">{toman(plan.price_toman)}</div></div>
                  <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.is_active} onChange={(e) => patchPlan(plan.plan_type, { is_active: e.target.checked })} className="h-4 w-4" />فعال برای فروش</label><Button onClick={() => savePlan(plan)} disabled={busy !== null}><Save className="ml-2 h-4 w-4" />ذخیره پلن</Button></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default PricingAdmin;
