import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Settings, Users, FileText, Diamond, Database, Shield, Loader2, Lock, AlertTriangle, HeadphonesIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { toast } from 'sonner';
import SiteSettingsManager from '@/components/admin/SiteSettingsManager';
import UsersCreditsManager from '@/components/admin/UsersCreditsManager';
import BlogManager from '@/components/admin/BlogManager';
import ProductManager from '@/components/admin/ProductManager';
import CompanyManager from '@/components/admin/CompanyManager';
import CorporateUserManager from '@/components/admin/CorporateUserManager';
import FeatureFlagsManager from '@/components/admin/FeatureFlagsManager';
import TestimonialsManager from '@/components/admin/TestimonialsManager';
import CreditAnalytics from '@/components/admin/CreditAnalytics';
import AuditLogsViewer from '@/components/admin/AuditLogsViewer';
import KnowledgeBaseStatus from '@/components/admin/KnowledgeBaseStatus';
import LegalImporter from '@/components/admin/LegalImporter';
import ChatbotManager from '@/components/admin/ChatbotManager';

// Lockout settings
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'king744_auth_state';

interface AuthState {
  attempts: number;
  lockoutUntil: number | null;
}

const getAuthState = (): AuthState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parsing errors
  }
  return { attempts: 0, lockoutUntil: null };
};

const setAuthState = (state: AuthState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const clearAuthState = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const King744 = () => {
  const navigate = useNavigate();
  const { signIn, session, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [activeTab, setActiveTab] = useState('settings');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authState, setAuthStateLocal] = useState<AuthState>(getAuthState());
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Check and update lockout timer
  useEffect(() => {
    const checkLockout = () => {
      const state = getAuthState();
      if (state.lockoutUntil) {
        const remaining = state.lockoutUntil - Date.now();
        if (remaining <= 0) {
          clearAuthState();
          setAuthStateLocal({ attempts: 0, lockoutUntil: null });
          setRemainingTime(0);
        } else {
          setRemainingTime(remaining);
        }
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLockedOut = authState.lockoutUntil && authState.lockoutUntil > Date.now();
  const remainingAttempts = MAX_ATTEMPTS - authState.attempts;

  const formatRemainingTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast.error('حساب قفل شده است. لطفاً صبر کنید.');
      return;
    }

    setLoginLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        const newAttempts = authState.attempts + 1;
        let newLockoutUntil = null;

        if (newAttempts >= MAX_ATTEMPTS) {
          newLockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          toast.error(`تعداد تلاش‌ها به حداکثر رسید. حساب برای ۱۵ دقیقه قفل شد.`);
        } else {
          toast.error(`خطا در ورود. ${MAX_ATTEMPTS - newAttempts} تلاش باقی‌مانده.`);
        }

        const newState = { attempts: newAttempts, lockoutUntil: newLockoutUntil };
        setAuthState(newState);
        setAuthStateLocal(newState);
        return;
      }

      // Authentication is complete. Authorization is resolved only from
      // server-side platform roles via useSuperAdmin; the browser never grants
      // admin access based on an email address.
      clearAuthState();
      setAuthStateLocal({ attempts: 0, lockoutUntil: null });
      toast.success('ورود انجام شد؛ سطح دسترسی در حال بررسی است');
    } catch {
      toast.error('خطا در ورود');
    } finally {
      setLoginLoading(false);
    }
  };

  if (authLoading || superAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // The server-issued super_admin role is the only authorization boundary.
  if (!session || !isSuperAdmin) {
    return (
      <>
        <Helmet>
          <title>System Access | HRing</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        
        <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="w-full max-w-md glass-card border-border/50">
              <CardHeader className="text-center space-y-4">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${isLockedOut ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                  {isLockedOut ? (
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  ) : (
                    <Lock className="w-8 h-8 text-primary" />
                  )}
                </div>
                <CardTitle className={`text-2xl ${isLockedOut ? 'text-destructive' : 'gradient-text-primary'}`}>
                  {isLockedOut ? 'حساب قفل شده' : 'دسترسی سیستم'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLockedOut 
                    ? `زمان باقی‌مانده: ${formatRemainingTime(remainingTime)}`
                    : 'فقط مدیر سیستم می‌تواند وارد شود'
                  }
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">ایمیل</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      required
                      className="text-left"
                      dir="ltr"
                      disabled={isLockedOut}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">رمز عبور</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="text-left"
                      dir="ltr"
                      disabled={isLockedOut}
                    />
                  </div>

                  {!isLockedOut && authState.attempts > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-500">
                        {remainingAttempts} تلاش باقی‌مانده
                      </span>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full glow-button"
                    disabled={loginLoading || isLockedOut}
                  >
                    {loginLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    ) : isLockedOut ? (
                      <AlertTriangle className="w-4 h-4 ml-2" />
                    ) : (
                      <Shield className="w-4 h-4 ml-2" />
                    )}
                    {isLockedOut ? 'حساب قفل شده' : 'ورود به سیستم'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>CMS Admin | HRing</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-background" dir="rtl">
        <header className="sticky top-0 z-50 glass-card border-b border-border/50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold gradient-text-primary">مدیریت سیستم</h1>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-mono">/king744</span>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-[1920px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="overflow-x-auto pb-2">
              <TabsList className="inline-flex min-w-max glass-card h-auto p-2 gap-1">
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">تنظیمات سایت</span>
                  <span className="sm:hidden">تنظیمات</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="users" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">کاربران و اعتبار</span>
                  <span className="sm:hidden">کاربران</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="companies" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">شرکت‌ها</span>
                  <span className="sm:hidden">شرکت</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="corporate-users" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">کاربران شرکتی</span>
                  <span className="sm:hidden">شرکتی</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="content" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">محتوا</span>
                  <span className="sm:hidden">محتوا</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="legal" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">پایگاه حقوقی</span>
                  <span className="sm:hidden">حقوقی</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="features" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Diamond className="w-4 h-4" />
                  <span className="hidden sm:inline">قابلیت‌ها</span>
                  <span className="sm:hidden">قابلیت</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Diamond className="w-4 h-4" />
                  <span className="hidden sm:inline">آمار اعتبار</span>
                  <span className="sm:hidden">آمار</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="logs" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">لاگ‌ها</span>
                  <span className="sm:hidden">لاگ</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="chatbot" 
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <HeadphonesIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">چت‌بات</span>
                  <span className="sm:hidden">چت</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="settings" className="space-y-6">
              <SiteSettingsManager />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <UsersCreditsManager />
            </TabsContent>

            <TabsContent value="companies" className="space-y-6">
              <CompanyManager />
            </TabsContent>

            <TabsContent value="corporate-users" className="space-y-6">
              <CorporateUserManager />
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <div className="grid gap-6">
                <BlogManager />
                <ProductManager />
                <TestimonialsManager />
              </div>
            </TabsContent>

            <TabsContent value="legal" className="space-y-6">
              <div className="grid gap-6">
                <KnowledgeBaseStatus />
                <LegalImporter />
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <FeatureFlagsManager />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <CreditAnalytics />
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              <AuditLogsViewer />
            </TabsContent>

            <TabsContent value="chatbot" className="space-y-6">
              <ChatbotManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
};

export default King744;
