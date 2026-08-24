import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, Loader2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';

type OwnerType = 'user' | 'company';

interface CreditAccount {
  account_id: string | null;
  owner_type: OwnerType;
  owner_id: string;
  owner_label: string;
  owner_secondary_label: string | null;
  available_credits: number;
  reserved_credits: number;
  total_credits: number;
  legacy_available_credits: number;
  projection_reconciled: boolean;
}

interface CreditLedgerEntry {
  id: string;
  account_id: string;
  reservation_id: string | null;
  actor_user_id: string | null;
  event_type: 'grant' | 'reserve' | 'consume' | 'release' | 'refund' | 'expire' | 'admin_adjustment';
  amount: number;
  available_delta: number;
  reserved_delta: number;
  feature_key: string | null;
  reason: string | null;
  description: string | null;
  request_id: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<CreditLedgerEntry['event_type'], string> = {
  grant: 'اعطای اعتبار',
  reserve: 'رزرو',
  consume: 'مصرف',
  release: 'آزادسازی',
  refund: 'بازپرداخت',
  expire: 'انقضا',
  admin_adjustment: 'اصلاح ادمین',
};

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('fa-IR')}`;

const idempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `admin-${crypto.randomUUID()}`;
  }
  return `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface CreditLedgerPanelProps {
  canManage: boolean;
}

const CreditLedgerPanel = ({ canManage }: CreditLedgerPanelProps) => {
  const [ownerType, setOwnerType] = useState<OwnerType>('user');
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [selected, setSelected] = useState<CreditAccount | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentKey, setAdjustmentKey] = useState(idempotencyKey);
  const [saving, setSaving] = useState(false);

  const loadLedger = useCallback(async (account: CreditAccount | null) => {
    setSelected(account);
    if (!account?.account_id) {
      setLedger([]);
      return;
    }
    setLedgerLoading(true);
    try {
      const rows = await apiRequest<CreditLedgerEntry[]>(
        `/platform/billing/credits/ledger?account_id=${encodeURIComponent(account.account_id)}&limit=100`,
      );
      setLedger(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت دفترکل اعتبار انجام نشد');
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ owner_type: ownerType, limit: '200' });
      if (search.trim()) params.set('search', search.trim());
      const rows = await apiRequest<CreditAccount[]>(
        `/platform/billing/credits/accounts?${params.toString()}`,
      );
      setAccounts(rows);
      const nextSelected = rows.find((row) => row.owner_id === selected?.owner_id) || rows[0] || null;
      await loadLedger(nextSelected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت حساب‌های اعتباری انجام نشد');
    } finally {
      setLoading(false);
    }
  }, [loadLedger, ownerType, search, selected?.owner_id]);

  useEffect(() => {
    void loadAccounts();
  }, [ownerType]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => accounts.reduce(
    (value, account) => ({
      available: value.available + account.available_credits,
      reserved: value.reserved + account.reserved_credits,
      mismatches: value.mismatches + (account.projection_reconciled ? 0 : 1),
    }),
    { available: 0, reserved: 0, mismatches: 0 },
  ), [accounts]);

  const openAdjustment = (account: CreditAccount) => {
    setSelected(account);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentKey(idempotencyKey());
    setAdjustmentOpen(true);
  };

  const submitAdjustment = async () => {
    if (!selected || !canManage) return;
    const amount = Number(adjustmentAmount);
    if (!Number.isSafeInteger(amount) || amount === 0) {
      toast.error('مقدار باید یک عدد صحیحِ مثبت یا منفی و غیرصفر باشد');
      return;
    }
    if (adjustmentReason.trim().length < 3) {
      toast.error('دلیل اصلاح اعتبار را بنویس');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/platform/billing/credits/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          owner_type: selected.owner_type,
          owner_id: selected.owner_id,
          amount,
          reason: adjustmentReason.trim(),
          idempotency_key: adjustmentKey,
        }),
      });
      toast.success('اصلاح اعتبار در دفترکل ثبت شد');
      setAdjustmentOpen(false);
      window.dispatchEvent(new Event('hring:credits-changed'));
      await loadAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'اصلاح اعتبار انجام نشد');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">اعتبار قابل‌مصرف</div><div className="mt-1 text-2xl font-bold">{totals.available.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">اعتبار رزروشده</div><div className="mt-1 text-2xl font-bold">{totals.reserved.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">مغایرت projection</div><div className="mt-1 text-2xl font-bold">{totals.mismatches.toLocaleString('fa-IR')}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><CardTitle>حساب‌های اعتباری</CardTitle><CardDescription>موجودی عملیاتی از دفترکل append-only محاسبه و با projection قدیمی تطبیق داده می‌شود.</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              <Select value={ownerType} onValueChange={(value) => setOwnerType(value as OwnerType)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="user">کاربران</SelectItem><SelectItem value="company">شرکت‌ها</SelectItem></SelectContent>
              </Select>
              <Input className="w-56" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadAccounts(); }} placeholder="جست‌وجوی نام یا ایمیل" />
              <Button variant="outline" onClick={() => void loadAccounts()} disabled={loading}><Search className="ml-2 h-4 w-4" />جست‌وجو</Button>
              <Button variant="outline" size="icon" onClick={() => void loadAccounts()} disabled={loading} aria-label="تازه‌سازی"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>مالک</TableHead><TableHead>قابل‌مصرف</TableHead><TableHead>رزرو</TableHead><TableHead>تطبیق</TableHead><TableHead>عملیات</TableHead></TableRow></TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={`${account.owner_type}:${account.owner_id}`} className={selected?.owner_id === account.owner_id ? 'bg-muted/50' : undefined}>
                    <TableCell><div className="font-medium">{account.owner_label}</div><div className="text-xs text-muted-foreground" dir="ltr">{account.owner_secondary_label || account.owner_id}</div></TableCell>
                    <TableCell>{account.available_credits.toLocaleString('fa-IR')}</TableCell>
                    <TableCell>{account.reserved_credits.toLocaleString('fa-IR')}</TableCell>
                    <TableCell>{account.projection_reconciled ? <Badge variant="outline" className="gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />سالم</Badge> : <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3.5 w-3.5" />مغایرت</Badge>}</TableCell>
                    <TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void loadLedger(account)}>دفترکل</Button>{canManage && <Button size="sm" onClick={() => openAdjustment(account)}>اصلاح اعتبار</Button>}</div></TableCell>
                  </TableRow>
                ))}
                {!loading && accounts.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">حسابی پیدا نشد.</TableCell></TableRow>}
                {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5" />دفترکل {selected ? selected.owner_label : ''}</CardTitle><CardDescription>این رکوردها قابل ویرایش یا حذف نیستند؛ هر اصلاح یک رویداد جدید می‌سازد.</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>زمان</TableHead><TableHead>رویداد</TableHead><TableHead>قابل‌مصرف</TableHead><TableHead>رزرو</TableHead><TableHead>قابلیت / دلیل</TableHead></TableRow></TableHeader>
              <TableBody>
                {ledger.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap">{new Date(entry.created_at).toLocaleString('fa-IR')}</TableCell><TableCell><Badge variant="secondary">{EVENT_LABELS[entry.event_type]}</Badge></TableCell><TableCell dir="ltr" className={entry.available_delta < 0 ? 'text-destructive' : 'text-emerald-600'}>{signed(entry.available_delta)}</TableCell><TableCell dir="ltr">{signed(entry.reserved_delta)}</TableCell><TableCell><div className="max-w-80 text-xs">{entry.feature_key || entry.reason || entry.description || '—'}</div>{entry.request_id && <div className="mt-1 max-w-80 truncate font-mono text-[10px] text-muted-foreground" dir="ltr">{entry.request_id}</div>}</TableCell></TableRow>)}
                {!ledgerLoading && ledger.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">رویدادی ثبت نشده است.</TableCell></TableRow>}
                {ledgerLoading && <TableRow><TableCell colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>اصلاح اعتبار {selected?.owner_label}</DialogTitle><DialogDescription>مقدار مثبت اعتبار اضافه و مقدار منفی کم می‌کند. دلیل و هویت ادمین در Audit ثبت می‌شود.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div><Label htmlFor="credit-adjustment-amount">مقدار صحیحِ مثبت یا منفی</Label><Input id="credit-adjustment-amount" dir="ltr" type="number" step="1" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="مثلاً 100 یا -25" /></div><div><Label htmlFor="credit-adjustment-reason">دلیل</Label><Textarea id="credit-adjustment-reason" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="علت اصلاح اعتبار را دقیق ثبت کن" maxLength={500} /></div></div>
          <DialogFooter><Button onClick={() => void submitAdjustment()} disabled={saving}>{saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ثبت در دفترکل</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditLedgerPanel;
