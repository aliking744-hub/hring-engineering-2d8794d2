import { FormEvent, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  Phone,
  User,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuroraBackground from '@/components/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLogos, useSiteName, useSiteSettings } from '@/hooks/useSiteSettings';
import { apiRequest } from '@/lib/api';
import { CompanyRole, ROLE_NAMES } from '@/types/multiTenant';
import defaultLogo from '@/assets/logo.png';

interface InviteInfo {
  invite_id: string | null;
  role: CompanyRole;
  company_id: string | null;
  company_name: string;
  is_valid: boolean;
  error?: string | null;
}

interface InviteValidationResponse {
  is_valid: boolean;
  invite_id: string | null;
  role: string | null;
  company_id: string | null;
  company_name: string | null;
  error: string | null;
}

interface JoinCompanyResponse {
  company_id: string;
  company_name: string;
  member_id: string;
  role: string;
  already_member: boolean;
}

type LoginMethod = 'email' | 'sms';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite')?.trim() || null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getSetting } = useSiteSettings();
  const logos = useLogos();
  const siteName = useSiteName();
  const {
    user,
    signIn,
    signUp,
    requestSmsLogin,
    verifySmsLogin,
  } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsChallengeId, setSmsChallengeId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteCode));
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const joinAttemptedRef = useRef(false);

  const authLogo = logos.auth || logos.main || defaultLogo;
  const authTitle = getSetting('auth_title', `ورود به ${siteName}`);
  const authSubtitle = getSetting(
    'auth_subtitle',
    'به پلتفرم مدیریت منابع انسانی خوش آمدید',
  );

  useEffect(() => {
    if (!inviteCode) {
      setInviteInfo(null);
      setInviteLoading(false);
      return;
    }

    let active = true;
    const validate = async () => {
      setInviteLoading(true);
      try {
        const response = await apiRequest<InviteValidationResponse>(
          '/company-invites/validate',
          {
            method: 'POST',
            body: JSON.stringify({ invite_code: inviteCode }),
          },
          { auth: false, retryAuth: false },
        );
        if (!active) return;
        setInviteInfo({
          invite_id: response.invite_id,
          role: (response.role || 'employee') as CompanyRole,
          company_id: response.company_id,
          company_name: response.company_name || '',
          is_valid: response.is_valid,
          error: response.error,
        });
        if (response.is_valid) setIsLogin(false);
      } catch (error) {
        if (!active) return;
        console.error('Invite validation failed:', error);
        setInviteInfo({
          invite_id: null,
          role: 'employee',
          company_id: null,
          company_name: '',
          is_valid: false,
          error: 'خطا در بررسی کد دعوت',
        });
      } finally {
        if (active) setInviteLoading(false);
      }
    };
    void validate();
    return () => {
      active = false;
    };
  }, [inviteCode]);

  const joinInvite = async () => {
    if (!inviteCode || !inviteInfo?.is_valid) return;
    const joined = await apiRequest<JoinCompanyResponse>(
      `/company-invites/${encodeURIComponent(inviteCode)}/join`,
      { method: 'POST' },
    );
    toast({
      title: joined.already_member ? 'عضویت موجود' : 'عضویت موفق',
      description: joined.already_member
        ? `شما قبلاً عضو ${joined.company_name} هستید`
        : `شما به ${joined.company_name} پیوستید`,
    });
  };

  useEffect(() => {
    if (!user) return;
    if (!inviteCode) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (!inviteInfo?.is_valid || joinAttemptedRef.current) return;

    joinAttemptedRef.current = true;
    void joinInvite()
      .catch((error) => {
        console.error('Joining company failed:', error);
        toast({
          title: 'خطا در عضویت',
          description: error instanceof Error ? error.message : 'عضویت در شرکت انجام نشد',
          variant: 'destructive',
        });
      })
      .finally(() => navigate('/dashboard', { replace: true }));
  }, [user, inviteCode, inviteInfo?.is_valid]);

  const finishAuthenticatedFlow = async () => {
    if (inviteInfo?.is_valid) await joinInvite();
    navigate('/dashboard');
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const result = isLogin
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName);

      if (result.error) {
        const message = result.error.message;
        toast({
          title: isLogin ? 'خطا در ورود' : 'خطا در ثبت‌نام',
          description:
            message.includes('Invalid email or password')
              ? 'ایمیل یا رمز عبور اشتباه است'
              : message.includes('already') || message.includes('registered')
                ? 'این ایمیل قبلاً ثبت شده است'
                : message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: isLogin ? 'ورود موفق' : 'ثبت‌نام موفق',
        description: inviteInfo?.is_valid
          ? `به ${inviteInfo.company_name} خوش آمدید`
          : `به ${siteName} خوش آمدید`,
      });
      await finishAuthenticatedFlow();
    } catch (error) {
      toast({
        title: 'خطا',
        description: error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requestCode = async () => {
    setIsLoading(true);
    try {
      const result = await requestSmsLogin(phone.trim());
      if (result.error || !result.challenge) {
        toast({
          title: 'ارسال کد ناموفق بود',
          description: result.error?.message || 'امکان ارسال کد وجود ندارد',
          variant: 'destructive',
        });
        return;
      }
      setSmsChallengeId(result.challenge.challenge_id);
      toast({
        title: 'کد ارسال شد',
        description: 'کد شش‌رقمی را وارد کنید',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!smsChallengeId) return;
    setIsLoading(true);
    try {
      const result = await verifySmsLogin(smsChallengeId, smsCode.trim());
      if (result.error) {
        toast({
          title: 'کد نامعتبر است',
          description: result.error.message,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'ورود موفق', description: `به ${siteName} خوش آمدید` });
      await finishAuthenticatedFlow();
    } finally {
      setIsLoading(false);
    }
  };

  const InviteBanner = () => {
    if (!inviteCode) return null;
    if (inviteLoading) {
      return (
        <div className="mb-5 flex items-center justify-center rounded-xl border border-border bg-secondary/30 p-4">
          <Loader2 className="ml-2 h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">در حال بررسی دعوت‌نامه...</span>
        </div>
      );
    }
    if (!inviteInfo?.is_valid) {
      return (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {inviteInfo?.error || 'کد دعوت نامعتبر است'}
        </div>
      );
    }
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <strong className="truncate">{inviteInfo.company_name}</strong>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            دعوت با نقش <Badge variant="secondary">{ROLE_NAMES[inviteInfo.role]}</Badge>
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>{authTitle}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative min-h-screen overflow-hidden bg-background" dir="rtl">
        <AuroraBackground />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl border border-border/60 bg-background/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
          >
            <div className="mb-6 text-center">
              <img src={authLogo} alt={siteName} className="mx-auto mb-4 h-14 w-auto object-contain" />
              <h1 className="text-2xl font-bold">{authTitle}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{authSubtitle}</p>
            </div>

            <InviteBanner />

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1">
              <Button
                type="button"
                variant={loginMethod === 'email' ? 'default' : 'ghost'}
                onClick={() => setLoginMethod('email')}
                className="gap-2"
              >
                <Mail className="h-4 w-4" /> ایمیل
              </Button>
              <Button
                type="button"
                variant={loginMethod === 'sms' ? 'default' : 'ghost'}
                onClick={() => {
                  setLoginMethod('sms');
                  setIsLogin(true);
                }}
                className="gap-2"
              >
                <MessageSquareText className="h-4 w-4" /> پیامک
              </Button>
            </div>

            {loginMethod === 'email' ? (
              <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(v) => setIsLogin(v === 'login')}>
                <TabsList className="mb-5 grid w-full grid-cols-2">
                  <TabsTrigger value="login">ورود</TabsTrigger>
                  <TabsTrigger value="signup">ثبت‌نام</TabsTrigger>
                </TabsList>
                <TabsContent value={isLogin ? 'login' : 'signup'} className="mt-0">
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="نام و نام خانوادگی"
                          className="pr-10"
                          maxLength={200}
                        />
                      </div>
                    )}
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ایمیل"
                        className="pr-10"
                        dir="ltr"
                        required
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="رمز عبور"
                        className="px-10"
                        minLength={isLogin ? 1 : 10}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isLoading || (Boolean(inviteCode) && !inviteInfo?.is_valid)}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      {isLogin ? 'ورود امن' : 'ساخت حساب'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={verifyCode} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="شماره موبایل"
                    className="pr-10"
                    dir="ltr"
                    disabled={Boolean(smsChallengeId)}
                    required
                  />
                </div>
                {smsChallengeId ? (
                  <>
                    <Input
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="کد ۶ رقمی"
                      inputMode="numeric"
                      dir="ltr"
                      className="text-center text-lg tracking-[0.35em]"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="submit" disabled={isLoading || smsCode.length !== 6}>
                        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        تایید و ورود
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSmsChallengeId(null);
                          setSmsCode('');
                        }}
                      >
                        تغییر شماره
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={requestCode}
                    disabled={isLoading || phone.trim().length < 10}
                  >
                    {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    دریافت کد ورود
                  </Button>
                )}
              </form>
            )}

            <div className="mt-6 border-t border-border/60 pt-5 text-center">
              <Button variant="ghost" asChild className="gap-2">
                <Link to="/">
                  بازگشت به سایت <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Auth;
