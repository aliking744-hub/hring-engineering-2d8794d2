import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, Copy, KeyRound, Loader2, Phone, ShieldCheck } from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { MfaEnrollment, MfaStatus } from '@/hooks/useAuth';
import { useUserContext } from '@/hooks/useUserContext';
import { apiRequest } from '@/lib/api';

interface SmsChallenge {
  challenge_id: string;
  expires_at: string;
}


const AccountSecurity = () => {
  const { toast } = useToast();
  const { context } = useUserContext();
  const { beginMfaEnrollment, confirmMfaEnrollment } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneChallengeId, setPhoneChallengeId] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);

  const mandatory = Boolean(context?.platformRoles.length || context?.appRoles.includes('admin'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await apiRequest<MfaStatus>('/auth/mfa/status'));
    } catch (error) {
      toast({
        title: 'دریافت وضعیت امنیت حساب انجام نشد',
        description: error instanceof Error ? error.message : 'دوباره تلاش کن',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEnrollment = async () => {
    setBusy(true);
    const result = await beginMfaEnrollment();
    setBusy(false);
    if (result.error || !result.enrollment) {
      toast({
        title: 'ساخت کلید MFA انجام نشد',
        description: result.error?.message || 'دوباره تلاش کن',
        variant: 'destructive',
      });
      return;
    }
    setEnrollment(result.enrollment);
    setCode('');
  };

  const confirmEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await confirmMfaEnrollment(code.trim());
    setBusy(false);
    if (result.error) {
      toast({ title: 'کد صحیح نیست', description: result.error.message, variant: 'destructive' });
      return;
    }
    setRecoveryCodes(result.recoveryCodes);
    setEnrollment(null);
    setCode('');
    await load();
  };

  const disable = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest<void>('/auth/mfa', {
        method: 'DELETE',
        body: JSON.stringify({ current_password: password }),
      });
      setPassword('');
      toast({ title: 'ورود دومرحله‌ای غیرفعال شد' });
      await load();
    } catch (error) {
      toast({
        title: 'غیرفعال‌سازی انجام نشد',
        description: error instanceof Error ? error.message : 'دوباره تلاش کن',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: message });
  };

  const requestPhoneVerification = async () => {
    setPhoneBusy(true);
    try {
      const challenge = await apiRequest<SmsChallenge>('/auth/phone/request-verification', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setPhoneChallengeId(challenge.challenge_id);
      setPhoneCode('');
      toast({ title: 'کد تأیید ارسال شد', description: 'کد شش‌رقمی پیامک‌شده را وارد کن.' });
    } catch (error) {
      toast({
        title: 'ارسال کد انجام نشد',
        description: error instanceof Error ? error.message : 'دوباره تلاش کن',
        variant: 'destructive',
      });
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhone = async (event: FormEvent) => {
    event.preventDefault();
    if (!phoneChallengeId) return;
    setPhoneBusy(true);
    try {
      await apiRequest<void>('/auth/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ challenge_id: phoneChallengeId, code: phoneCode.trim() }),
      });
      setPhoneChallengeId(null);
      setPhoneCode('');
      toast({ title: 'شماره موبایل تأیید شد', description: 'از این پس می‌توانی با پیامک وارد شوی.' });
    } catch (error) {
      toast({
        title: 'کد تأیید نشد',
        description: error instanceof Error ? error.message : 'دوباره تلاش کن',
        variant: 'destructive',
      });
    } finally {
      setPhoneBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet><title>امنیت حساب | HRing</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-2xl px-4 py-10">
          <Button variant="ghost" asChild className="mb-5 gap-2">
            <Link to="/profile"><ChevronLeft className="h-4 w-4" />بازگشت به پروفایل</Link>
          </Button>

          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center justify-between gap-3">
                <ShieldCheck className="h-10 w-10 text-primary" />
                <Badge variant={status?.enabled ? 'default' : 'secondary'}>
                  {status?.enabled ? 'فعال' : 'غیرفعال'}
                </Badge>
              </div>
              <CardTitle>ورود دومرحله‌ای</CardTitle>
              <CardDescription className="leading-6">
                علاوه بر رمز عبور، ورود با کد یک‌بارمصرف Authenticator تأیید می‌شود.
                {mandatory && ' این کنترل برای حساب مدیریتی الزامی است.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {recoveryCodes.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="font-semibold">کدهای بازیابی را همین حالا ذخیره کن</div>
                  <div className="grid grid-cols-2 gap-2" dir="ltr">
                    {recoveryCodes.map((item) => <code key={item} className="rounded border bg-background p-2 text-center text-xs">{item}</code>)}
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={() => void copy(recoveryCodes.join('\n'), 'کدها کپی شدند')}>
                    <Copy className="h-4 w-4" />کپی همه
                  </Button>
                </div>
              )}

              {enrollment && (
                <form onSubmit={confirmEnrollment} className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <div className="mb-2 font-medium">ثبت کلید در Authenticator</div>
                    <p className="text-sm leading-6 text-muted-foreground">کلید را دستی در برنامه وارد کن، سپس کد ۶ رقمی را اینجا بنویس.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-3" dir="ltr">
                    <code className="min-w-0 flex-1 break-all text-sm">{enrollment.secret}</code>
                    <Button type="button" size="icon" variant="ghost" onClick={() => void copy(enrollment.secret, 'کلید کپی شد')}><Copy className="h-4 w-4" /></Button>
                  </div>
                  <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="کد ۶ رقمی" inputMode="numeric" dir="ltr" className="text-center tracking-[0.35em]" />
                  <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تأیید و فعال‌سازی</Button>
                </form>
              )}

              {!status?.enabled && !enrollment && (
                <Button className="w-full gap-2" onClick={() => void startEnrollment()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  فعال‌سازی MFA
                </Button>
              )}

              {status?.enabled && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div><div className="font-medium">حساب محافظت می‌شود</div><div className="mt-1 text-sm text-muted-foreground">{status.recovery_codes_remaining.toLocaleString('fa-IR')} کد بازیابی استفاده‌نشده باقی مانده است.</div></div>
                  </div>
                  {!mandatory && (
                    <form onSubmit={disable} className="space-y-3 rounded-xl border border-destructive/30 p-4">
                      <Label htmlFor="disable-mfa-password">برای غیرفعال‌سازی، رمز فعلی را وارد کن</Label>
                      <Input id="disable-mfa-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                      <Button type="submit" variant="destructive" disabled={busy || !password}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}غیرفعال‌سازی MFA</Button>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Phone className="h-10 w-10 text-primary" />
                <Badge variant="secondary">ورود با پیامک</Badge>
              </div>
              <CardTitle>اتصال شماره موبایل</CardTitle>
              <CardDescription className="leading-6">شمارهٔ تأییدشده فقط برای ورود با پیامک استفاده می‌شود. برای حفظ حریم خصوصی، شماره‌ای که به حسابی متصل نیست هیچ پیامکی دریافت نمی‌کند.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={verifyPhone} className="space-y-4">
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="شماره موبایل (مثلاً 09121234567)"
                  inputMode="tel"
                  dir="ltr"
                  disabled={Boolean(phoneChallengeId) || phoneBusy}
                  required
                />
                {phoneChallengeId ? (
                  <>
                    <Input
                      value={phoneCode}
                      onChange={(event) => setPhoneCode(event.target.value.replace(/\\D/g, '').slice(0, 6))}
                      placeholder="کد ۶ رقمی"
                      inputMode="numeric"
                      dir="ltr"
                      className="text-center text-lg tracking-[0.35em]"
                      autoComplete="one-time-code"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="submit" disabled={phoneBusy || phoneCode.length !== 6}>{phoneBusy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تأیید شماره</Button>
                      <Button type="button" variant="outline" disabled={phoneBusy} onClick={() => { setPhoneChallengeId(null); setPhoneCode(''); }}>تغییر شماره</Button>
                    </div>
                  </>
                ) : (
                  <Button type="button" className="w-full" onClick={() => void requestPhoneVerification()} disabled={phoneBusy || phone.trim().length < 10}>
                    {phoneBusy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ارسال کد تأیید
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default AccountSecurity;
