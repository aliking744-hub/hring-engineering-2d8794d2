import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, User, Building2, Users, CheckCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_NAMES, CompanyRole } from "@/types/multiTenant";
import { useSiteSettings, useLogos, useSiteName } from "@/hooks/useSiteSettings";
import defaultLogo from "@/assets/logo.png";

type AccountType = 'person' | 'company';

interface InviteInfo {
  id: string;
  invite_code: string;
  role: CompanyRole;
  company_id: string;
  company_name: string;
  is_valid: boolean;
  error?: string;
}

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  
  const [accountType, setAccountType] = useState<AccountType>(inviteCode ? 'company' : 'person');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteCode);
  const { toast } = useToast();
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const { getSetting } = useSiteSettings();
  const logos = useLogos();
  const siteName = useSiteName();
  
  // Use dynamic logo or fallback to default
  const authLogo = logos.auth || logos.main || defaultLogo;

  // Dynamic texts - use siteName for defaults
  const authTitle = getSetting('auth_title', `ورود به ${siteName}`);
  const authSubtitle = getSetting('auth_subtitle', 'به پلتفرم مدیریت منابع انسانی خوش آمدید');
  const authGoogleBtn = getSetting('auth_google_btn', 'ورود با گوگل');
  const authLoginTab = getSetting('auth_login_tab', 'ورود');
  const authSignupTab = getSetting('auth_signup_tab', 'ثبت‌نام');

  // Fetch invite info on mount
  useEffect(() => {
    const fetchInviteInfo = async () => {
      if (!inviteCode) return;
      
      setInviteLoading(true);
      try {
        const { data: invite, error } = await supabase.functions.invoke(
          "validate-invite-code",
          { body: { inviteCode } },
        );

        if (error || !invite) {
          setInviteInfo({
            id: '',
            invite_code: inviteCode,
            role: 'employee',
            company_id: '',
            company_name: '',
            is_valid: false,
            error: 'کد دعوت نامعتبر است'
          });
          return;
        }

        setInviteInfo({
          id: invite.id || '',
          invite_code: inviteCode,
          role: invite.role || 'employee',
          company_id: invite.company_id || '',
          company_name: invite.company_name || '',
          is_valid: !!invite.is_valid,
          error: invite.error,
        });

        if (invite.is_valid) {
          // Force signup mode for invite
          setIsLogin(false);
          setAccountType('company');
        }
      } catch (err) {
        console.error('Error fetching invite:', err);
        setInviteInfo({
          id: '',
          invite_code: inviteCode,
          role: 'employee',
          company_id: '',
          company_name: '',
          is_valid: false,
          error: 'خطا در بررسی کد دعوت'
        });
      } finally {
        setInviteLoading(false);
      }
    };

    fetchInviteInfo();
  }, [inviteCode]);

  // Handle joining company after authentication
  const joinCompanyWithInvite = async (userId: string) => {
    if (!inviteInfo?.is_valid) return;

    try {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', inviteInfo.company_id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        toast({
          title: "عضو موجود",
          description: "شما قبلاً عضو این شرکت هستید",
        });
        return;
      }

      // Add user to company
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: inviteInfo.company_id,
          user_id: userId,
          role: inviteInfo.role,
          can_invite: false,
          is_active: true
        });

      if (memberError) throw memberError;

      // Update invite used count
      await supabase
        .from('company_invites')
        .update({ used_count: (await supabase.from('company_invites').select('used_count').eq('id', inviteInfo.id).single()).data?.used_count + 1 || 1 })
        .eq('id', inviteInfo.id);

      // Update user profile to corporate
      await supabase
        .from('profiles')
        .update({ user_type: 'corporate' })
        .eq('id', userId);

      toast({
        title: "عضویت موفق",
        description: `شما به ${inviteInfo.company_name} پیوستید`,
      });
    } catch (err) {
      console.error('Error joining company:', err);
      toast({
        title: "خطا در عضویت",
        description: "مشکلی در پیوستن به شرکت پیش آمد",
        variant: "destructive",
      });
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    const handleUserJoin = async () => {
      if (user && inviteInfo?.is_valid) {
        await joinCompanyWithInvite(user.id);
        navigate('/dashboard', { replace: true });
      } else if (user && !inviteCode) {
        navigate('/dashboard', { replace: true });
      }
    };

    handleUserJoin();
  }, [user, inviteInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error, user: signedInUser } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            toast({
              title: "تایید ایمیل",
              description: "لطفاً ابتدا ایمیل خود را از طریق لینک ارسال شده تایید کنید",
              variant: "destructive",
            });
          } else if (error.message.includes('Invalid login credentials')) {
            toast({
              title: "خطا در ورود",
              description: "ایمیل یا رمز عبور اشتباه است",
              variant: "destructive",
            });
          } else {
            toast({
              title: "خطا",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Handle invite join for existing user
          if (inviteInfo?.is_valid && signedInUser) {
            await joinCompanyWithInvite(signedInUser.id);
          }
          
          toast({
            title: "ورود موفق",
            description: inviteInfo?.is_valid 
              ? `به ${inviteInfo.company_name} خوش آمدید`
              : accountType === 'person' 
                ? `به داشبورد ${siteName} خوش آمدید` 
                : "به پنل شرکت خوش آمدید",
          });
          navigate('/dashboard');
        }
      } else {
        // Sign up with metadata
        const { error: signUpError, user: signedUpUser } = await signUp(email, password);
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            toast({
              title: "حساب موجود است",
              description: "این ایمیل قبلاً ثبت‌نام شده. لطفاً وارد شوید",
              variant: "destructive",
            });
          } else {
            toast({
              title: "خطا در ثبت‌نام",
              description: signUpError.message,
              variant: "destructive",
            });
          }
        } else {
          // Update profile with name if provided
          if (fullName && signedUpUser) {
            await supabase
              .from('profiles')
              .update({ full_name: fullName })
              .eq('id', signedUpUser.id);
          }

          // Handle invite join for new user
          if (inviteInfo?.is_valid && signedUpUser) {
            await joinCompanyWithInvite(signedUpUser.id);
            toast({
              title: "ثبت‌نام موفق",
              description: `به ${inviteInfo.company_name} خوش آمدید`,
            });
            navigate('/dashboard');
          } else {
            toast({
              title: "ثبت‌نام موفق",
              description: `به ${siteName} خوش آمدید`,
            });
            navigate('/dashboard');
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "خطا",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // Store invite code in localStorage for after OAuth redirect
      if (inviteCode) {
        localStorage.setItem('pending_invite_code', inviteCode);
      }
      
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: "خطا در ورود با گوگل",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "خطا",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Invite Banner Component
  const InviteBanner = () => {
    if (!inviteCode) return null;

    if (inviteLoading) {
      return (
        <div className="mb-6 p-4 bg-secondary/50 rounded-xl flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary ml-2" />
          <span className="text-muted-foreground">در حال بررسی کد دعوت...</span>
        </div>
      );
    }

    if (!inviteInfo?.is_valid) {
      return (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
          <p className="text-destructive text-center font-medium">
            {inviteInfo?.error || 'کد دعوت نامعتبر است'}
          </p>
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-foreground">{inviteInfo.company_name}</p>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              دعوت به عنوان <Badge variant="secondary" className="mr-1">{ROLE_NAMES[inviteInfo.role]}</Badge>
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  // Form for individuals (with Google, signup option)
  const renderPersonForm = () => (
    <>
      {/* Invite Banner */}
      <InviteBanner />

      {/* Google Sign In */}
      <Button 
        type="button" 
        variant="outline" 
        className="w-full mb-4 gap-2 bg-secondary/50 border-border hover:bg-secondary"
        onClick={handleGoogleSignIn}
        disabled={isLoading || (!!inviteCode && !inviteInfo?.is_valid)}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {authGoogleBtn}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">یا</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name - only for signup with invite */}
        {!isLogin && inviteInfo?.is_valid && (
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="نام و نام خانوادگی"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pr-10 bg-secondary/50 border-border focus:border-primary"
              disabled={isLoading}
            />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="email"
            placeholder="ایمیل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pr-10 bg-secondary/50 border-border focus:border-primary"
            required
            disabled={isLoading || (!!inviteCode && !inviteInfo?.is_valid)}
          />
        </div>

        <div className="relative">
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="رمز عبور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10 pl-10 bg-secondary/50 border-border focus:border-primary"
            required
            disabled={isLoading || (!!inviteCode && !inviteInfo?.is_valid)}
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <Button 
          type="submit" 
          className="w-full glow-button text-foreground font-semibold py-6 gap-2"
          disabled={isLoading || (!!inviteCode && !inviteInfo?.is_valid)}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {inviteInfo?.is_valid 
                ? (isLogin ? "ورود و پیوستن به شرکت" : "ثبت‌نام و پیوستن به شرکت")
                : (isLogin ? "ورود" : "ثبت‌نام")}
              <ArrowLeft className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      {!isLogin && !inviteInfo?.is_valid && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          پس از ثبت‌نام، لینک تایید به ایمیل شما ارسال می‌شود
        </p>
      )}

      {/* Toggle */}
      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">
          {isLogin ? "حساب کاربری ندارید؟" : "قبلاً ثبت‌نام کرده‌اید؟"}
        </span>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-primary hover:underline mr-2 font-medium"
          disabled={isLoading}
        >
          {isLogin ? "ثبت‌نام کنید" : "وارد شوید"}
        </button>
      </div>
    </>
  );

  // Form for companies (login only, no Google, no signup)
  const renderCompanyForm = () => (
    <>
      {/* Info notice */}
      <div className="mb-6 p-4 bg-secondary/50 border border-border rounded-xl">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">
              ورود با اطلاعات دریافت شده از ادمین شرکت
            </p>
          </div>
        </div>
      </div>

      {/* Form - Login only */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="email"
            placeholder="ایمیل شرکتی"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pr-10 bg-secondary/50 border-border focus:border-primary"
            required
            disabled={isLoading}
          />
        </div>

        <div className="relative">
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="رمز عبور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10 pl-10 bg-secondary/50 border-border focus:border-primary"
            required
            disabled={isLoading}
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <Button 
          type="submit" 
          className="w-full glow-button text-foreground font-semibold py-6 gap-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              ورود به پنل شرکتی
              <ArrowLeft className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-4">
        برای دریافت دسترسی، با ادمین شرکت خود تماس بگیرید
      </p>
    </>
  );

  return (
    <>
      <Helmet>
        <title>
          {inviteInfo?.is_valid 
            ? `پیوستن به ${inviteInfo.company_name} | HRing`
            : (isLogin ? "ورود به حساب" : "ثبت‌نام") + " | HRing"}
        </title>
        <meta 
          name="description" 
          content={isLogin 
            ? "ورود به پنل مدیریت منابع انسانی HRing. به ابزارهای هوشمند استخدام و مدیریت تیم دسترسی پیدا کنید."
            : "ایجاد حساب کاربری در HRing. همین حالا شروع کنید و از امکانات هوش مصنوعی برای استخدام بهره‌مند شوید."
          } 
        />
      </Helmet>
      <div className="relative min-h-screen flex items-center justify-center p-4" dir="rtl">
        <AuroraBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4">
              <img src={authLogo} alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-3xl font-bold gradient-text-primary">hring</span>
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">
              {inviteInfo?.is_valid 
                ? `پیوستن به ${inviteInfo.company_name}`
                : (isLogin ? "ورود به حساب" : "ایجاد حساب کاربری")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {inviteInfo?.is_valid 
                ? "برای پیوستن به شرکت، ثبت‌نام یا وارد شوید"
                : (isLogin 
                    ? "خوش آمدید! لطفاً وارد شوید" 
                    : "همین حالا شروع کنید")}
            </p>
          </div>

          {/* Account Type Tabs - hide when invite is present */}
          {!inviteCode ? (
            <Tabs 
              value={accountType} 
              onValueChange={(v) => setAccountType(v as AccountType)}
              className="mb-6"
            >
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
                <TabsTrigger 
                  value="person" 
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <User className="w-4 h-4" />
                  اشخاص
                </TabsTrigger>
                <TabsTrigger 
                  value="company"
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Building2 className="w-4 h-4" />
                  شرکت‌ها
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="person" className="mt-6">
                {renderPersonForm()}
              </TabsContent>
              
              <TabsContent value="company" className="mt-6">
                {renderCompanyForm()}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="mt-6">
              {renderPersonForm()}
            </div>
          )}

          {/* Back Link */}
          <div className="mt-8 text-center">
            <Link 
              to="/" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
            >
              بازگشت به خانه
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );
};

export default Auth;
