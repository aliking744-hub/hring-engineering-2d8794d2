import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Building2, ChevronLeft, FileCode2, Package, PlugZap, ShieldCheck, UsersRound } from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserContext } from '@/hooks/useUserContext';
import { useSiteName } from '@/hooks/useSiteSettings';

const Admin = () => {
  const { context, loading } = useUserContext();
  const siteName = useSiteName();

  if (loading) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  const roles = context?.platformRoles || [];
  const hasLegacyAdmin = context?.appRoles.includes('admin') || false;
  const canOpenPlatform = roles.some((role) => ['super_admin', 'platform_admin', 'support_admin'].includes(role)) || hasLegacyAdmin;
  const canOpenProduct = roles.some((role) => ['super_admin', 'content_admin'].includes(role));
  const canOpenIntegrations = roles.some((role) => ['super_admin', 'platform_admin', 'support_admin'].includes(role)) || hasLegacyAdmin;
  const canOpenPrompts = roles.some((role) => ['super_admin', 'platform_admin', 'content_admin'].includes(role)) || hasLegacyAdmin;
  const canOpenCompany = Boolean(context?.companyId);

  const panels = [
    canOpenPlatform && {
      title: 'Platform Control Center',
      description: 'شرکت‌ها، کل کاربران، پلن‌ها، سقف قرارداد، نقش‌های سراسری و Audit Log.',
      icon: ShieldCheck,
      href: '/admin/platform',
      badge: 'Platform',
    },
    canOpenIntegrations && {
      title: 'اتصال سرویس‌ها و APIها',
      description: 'ثبت امن API Key و تست سلامت سرویس‌های AI، مدل لوکال، پرداخت، پیامک، ایمیل و وب‌هوک.',
      icon: PlugZap,
      href: '/admin/integrations',
      badge: 'Secrets & APIs',
    },
    canOpenPrompts && {
      title: 'مدیریت هوش قابلیت‌ها',
      description: 'مشاهده و تغییر هوش و مدل هر بخش HRing، همراه با نسخه‌بندی، تست و بازگشت متن دستورها.',
      icon: FileCode2,
      href: '/admin/prompts',
      badge: 'AI Routing',
    },
    canOpenProduct && {
      title: 'Product & Content Admin',
      description: 'ظاهر، متن‌ها، visibility، SEO و تنظیمات عمومی محصول. Secret و API Key در این بخش ذخیره نمی‌شود.',
      icon: Package,
      href: '/admin/product',
      badge: 'Product',
    },
    canOpenCompany && {
      title: 'Company Admin',
      description: 'کاربران، نقش‌ها، دعوت‌نامه‌ها، سطح دسترسی و تنظیمات همان شرکت.',
      icon: UsersRound,
      href: '/company-members',
      badge: 'Tenant',
    },
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    icon: typeof ShieldCheck;
    href: string;
    badge: string;
  }>;

  if (!panels.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">پنل مدیریتی برای این حساب فعال نیست</h1>
            <Button asChild className="mt-5"><Link to="/dashboard">بازگشت به داشبورد</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>مرکز مدیریت | {siteName}</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8 flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild><Link to="/dashboard"><ChevronLeft className="h-5 w-5" /></Link></Button>
            <div>
              <h1 className="text-3xl font-bold">مرکز مدیریت HRing</h1>
              <p className="mt-1 text-sm text-muted-foreground">بخش‌های مدیریتی مستقل با مرز دسترسی روشن.</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {panels.map((panel) => (
              <Card key={panel.href} className="flex h-full flex-col">
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl bg-primary/10 p-3"><panel.icon className="h-6 w-6 text-primary" /></div>
                    <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{panel.badge}</span>
                  </div>
                  <CardTitle>{panel.title}</CardTitle>
                  <CardDescription className="leading-6">{panel.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild className="w-full"><Link to={panel.href}>ورود به پنل</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {canOpenCompany && (
            <Card className="mt-6">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-primary" /><div><div className="font-medium">تنظیمات شرکت</div><div className="text-sm text-muted-foreground">پروفایل شرکت، دامنه، credit pool و ماتریس دسترسی نقش‌ها.</div></div></div>
                <Button asChild variant="outline"><Link to="/company-settings">تنظیمات شرکت</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default Admin;
