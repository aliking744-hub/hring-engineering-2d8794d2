import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, Search, Home, Menu, X, 
  Loader2, Crown, History, User, Shield, Settings,
  Building2, ChevronDown, Lock,
  // Tier 1 - Smart Workspace
  Briefcase, Mic, Megaphone,
  // Tier 2 - HR & Operations
  UserPlus, Users, Network, GraduationCap,
  // Tier 3 - Command Center
  BarChart3, Calculator, Crosshair,
  // Tier 4 - Vision Deck
  Compass, Scale, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useCompany } from "@/hooks/useCompany";
import { useCredits } from "@/hooks/useCredits";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useSiteSettings, useSiteName } from "@/hooks/useSiteSettings";
import { useSectionVisible } from "@/hooks/useSectionVisible";
import DashboardModuleCards from "@/components/dashboard/DashboardModuleCards";

// 4-Tier sidebar structure
const TIERS = [
  {
    id: "smart-workspace",
    label: "میزکار هوشمند",
    labelEn: "Smart Workspace",
    icon: Briefcase,
    modules: [
      { id: "job-engineering", label: "مهندسی مشاغل", desc: "تولید هوشمند شناسنامه شغلی و پروفایل موقعیت", icon: Briefcase, path: "/job-description" },
      { id: "interview-assistant", label: "دستیار مصاحبه", desc: "تولید راهنما، سؤالات تخصصی و کلیدهای ارزیابی", icon: Mic, path: "/interview-assistant" },
      { id: "smart-ad-writer", label: "آگهی‌نویس هوشمند", desc: "نوشتن آگهی‌های جذاب برای LinkedIn و سایت‌های کار", icon: Megaphone, path: "/smart-ad-generator" },
      { id: "smart-workspace-success-architect", label: "معمار موفقیت ۹۰ روزه", desc: "تحلیل هوشمند نقاط قوت و ضعف و مسیر رشد فردی", icon: TrendingUp, path: "/success-architect" },
    ],
  },
  {
    id: "hr-operations",
    label: "سرمایه انسانی و عملیات",
    labelEn: "Human Resources & Operations",
    icon: Users,
    modules: [
      { id: "success-architect", label: "برنامه موفقیت ۹۰ روزه", desc: "نقشه راه آنبوردینگ ۳۰-۶۰-۹۰ روزه", icon: UserPlus, path: "/onboarding" },
      { id: "learning-path", label: "طراح مسیر یادگیری", desc: "نیازسنجی و تولید برنامه آموزشی هوشمند", icon: GraduationCap, path: "/learning-path" },
      { id: "profiles", label: "پروفایل‌ها", desc: "لیست پرسنل و پرونده دیجیتال", icon: Users, path: "/profile" },
      { id: "org-design", label: "طراحی سازمان", desc: "ساختار و چارت سازمانی", icon: Network, path: "/modules", comingSoon: true },
    ],
  },
  {
    id: "command-center",
    label: "پنل راهبری",
    labelEn: "Command Center",
    icon: BarChart3,
    modules: [
      { id: "hr-dashboard", label: "داشبورد منابع انسانی", desc: "نمای گرافیکی ۳۶۰ درجه‌ای از اطلاعات پرسنل و ساختار", icon: BarChart3, path: "/hr-dashboard" },
      { id: "costing", label: "بهای تمام شده", desc: "مدیریت بودجه و محاسبه هزینه‌های جذب", icon: Calculator, path: "/cost-calculator" },
      { id: "headhunting", label: "شکار مدیران", desc: "ماژول اختصاصی جذب پوزیشن‌های حساس C-Level", icon: Crosshair, path: "/smart-headhunting" },
      { id: "performance-eval", label: "ارزیابی عملکرد", desc: "سنجش و ارزیابی عملکرد کارکنان و مدیران", icon: TrendingUp, path: "#", comingSoon: true },
    ],
  },
  {
    id: "vision-deck",
    label: "اتاق فرماندهی",
    labelEn: "Vision Deck",
    icon: Compass,
    modules: [
      { id: "legal-advisor", label: "مشاور حقوقی", desc: "دستیار هوشمند حقوقی برای مسائل منابع انسانی", icon: Scale, path: "/legal-advisor" },
      { id: "macro-analytics", label: "گزارش‌های کلان", desc: "شاخص‌های کلیدی سطح هلدینگ (مثل نرخ خروج کل، eNPS)", icon: TrendingUp, path: "#", comingSoon: true },
    ],
  },
];

const Dashboard = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { context, loading: contextLoading } = useUserContext();
  const { isAdmin } = useAdmin();
  const { company } = useCompany();
  const { credits } = useCredits();
  const navigate = useNavigate();
  const location = useLocation();
  const { getSetting } = useSiteSettings();
  const siteName = useSiteName();
  const canonicalBase = getSetting('seo_canonical_base_url', 'https://hring.ir').replace(/\/+$/, '');
  const dashboardUrl = canonicalBase + '/dashboard';
  const showUpgradeCta = useSectionVisible('dashboard_upgrade_cta');
  const isVisibleSetting = (id: string) => getSetting(`section_visible_${id}`, 'true') !== 'false';
  const visibleTiers = TIERS
    .filter(t => isVisibleSetting(`dash_tier_${t.id}`))
    .map(t => ({ ...t, modules: t.modules.filter(m => isVisibleSetting(`dash_mod_${m.id}`)) }))
    .filter(t => t.modules.length > 0);

  const creditLabel = getSetting('dashboard_credit_label', context?.userType === 'corporate' ? 'اعتبار شرکت' : 'اعتبار موجود');
  const logoutText = getSetting('dashboard_logout_btn', 'خروج');
  const searchPlaceholder = getSetting('dashboard_search_placeholder', 'جستجو...');

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const showDashboardHome = () => {
    navigate('/dashboard');
  };

  const selectTier = (tierId: string) => {
    navigate(location.hash === `#${tierId}` ? '/dashboard' : `/dashboard#${tierId}`);
  };

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const requestedTierId = location.hash.replace(/^#/, '');
  const currentTier = visibleTiers.find(t => t.id === requestedTierId) || null;
  const isCorporateAccount = context?.userType === 'corporate';
  const personalName =
    context?.fullName?.trim() ||
    context?.email?.split('@')[0] ||
    user?.email?.split('@')[0] ||
    'کاربر';
  const accountName = isCorporateAccount && company?.name ? company.name : personalName;
  const accountSubtitle = isCorporateAccount
    ? [personalName, context?.title].filter(Boolean).join(' • ')
    : context?.title || context?.email || '';
  const welcomeSubject = isCorporateAccount && company?.name
    ? `شرکت ${company.name}`
    : personalName;

  // Sidebar content (shared between mobile and desktop)
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="mb-3">
        <Link to="/" className="text-2xl font-bold gradient-text-primary" onClick={onNavigate}>
          {siteName}
        </Link>
      </div>

      {/* Account identity and credit also act as the dashboard-home control. */}
      <div className="mb-4 rounded-xl border border-border/50 bg-secondary/50 p-3">
        <button
          type="button"
          onClick={() => {
            showDashboardHome();
            onNavigate?.();
          }}
          className="w-full rounded-lg p-1 text-right transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="بازگشت به خانه داشبورد"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              {isCorporateAccount ? (
                <Building2 className="h-5 w-5 text-primary" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{accountName}</p>
              <p className="truncate text-xs text-muted-foreground">{accountSubtitle}</p>
            </div>
            <Home className="h-4 w-4 shrink-0 text-primary" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-xs text-muted-foreground">{creditLabel}</span>
            <span className="text-xl font-bold text-primary">{credits.toLocaleString()}</span>
          </div>
        </button>
        <Link
          to="/payment-history"
          className="mt-2 flex items-center justify-center gap-1 border-t border-border/40 pt-2 text-xs text-primary hover:underline"
          onClick={onNavigate}
        >
          <History className="h-3 w-3" />
          تاریخچه تراکنش‌ها
        </Link>
      </div>

      {/* 4-Tier Accordion Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {visibleTiers.map((tier) => {
          const isOpen = currentTier?.id === tier.id;
          const isActive = currentTier?.id === tier.id;
          return (
            <div key={tier.id}>
              <button
                onClick={() => selectTier(tier.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-right ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <tier.icon className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0 text-right">
                  <span className="font-medium text-sm block">{tier.label}</span>
                  <span className="text-[10px] opacity-60 block">{tier.labelEn}</span>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pr-4 py-1 space-y-0.5">
                      {tier.modules.map((mod) => (
                        <button
                          key={mod.id}
                          onClick={() => {
                            if (!mod.comingSoon) {
                              navigate(mod.path);
                              onNavigate?.();
                            }
                          }}
                          disabled={mod.comingSoon}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-right text-xs transition-colors ${
                            mod.comingSoon
                              ? "text-muted-foreground/50 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          }`}
                        >
                          <mod.icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1">{mod.label}</span>
                          {mod.comingSoon && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 opacity-60">
                              <Lock className="w-2.5 h-2.5 ml-0.5" />
                              به زودی
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto pt-3 space-y-1 border-t border-border/30">
        {/* Settings */}
        {context?.userType === 'corporate' && context.companyRole === 'ceo' && (
          <Link
            to="/company-settings"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-sm"
          >
            <Settings className="w-4 h-4" />
            <span>تنظیمات سیستم</span>
          </Link>
        )}

        {/* Admin */}
        {isAdmin && (
          <Link
            to="/admin"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-sm"
          >
            <Shield className="w-4 h-4" />
            <span>پنل ادمین</span>
          </Link>
        )}

        {/* Upgrade */}
        {showUpgradeCta && (
          <Link 
            to="/upgrade"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-l from-primary/20 to-primary/10 text-primary border border-primary/30 hover:from-primary/30 hover:to-primary/20 transition-all text-sm"
          >
            <Crown className="w-4 h-4" />
            <span className="font-medium">ارتقای پلن</span>
          </Link>
        )}

        {/* Logout */}
        <button 
          onClick={() => { handleLogout(); onNavigate?.(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>{logoutText}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <Helmet>
        <title>داشبورد | {siteName} - پنل مدیریت منابع انسانی</title>
        <meta name="description" content={`پنل کاربری ${siteName} برای مدیریت منابع انسانی، استخدام، آنبوردینگ، تحلیل پرسنل و دسترسی به ابزارهای هوش مصنوعی.`} />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={dashboardUrl} />
      </Helmet>
      <div className="relative min-h-screen flex" dir="rtl">
        <AuroraBackground />
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden fixed top-4 right-4 z-50 w-12 h-12 glass-card flex items-center justify-center rounded-xl"
        >
          <Menu className="w-6 h-6 text-foreground" />
        </button>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              />
              <motion.aside
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="lg:hidden fixed top-0 right-0 bottom-0 w-72 glass-card z-50 p-4 flex flex-col overflow-y-auto"
              >
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
                <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        
        {/* Desktop Sidebar */}
        <motion.aside
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-64 glass-card m-4 p-4 hidden lg:flex flex-col"
        >
          <SidebarContent />
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:pr-0 pt-20 lg:pt-4 min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card h-full p-4 sm:p-6 overflow-auto max-w-[1920px] mx-auto"
          >
            {/* Header */}
            <header className="mb-6 flex items-center justify-between gap-3">
              {currentTier ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={showDashboardHome}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="بازگشت به خانه داشبورد"
                    title="بازگشت به خانه داشبورد"
                  >
                    <Home className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">{currentTier.label}</h1>
                    <p className="text-xs text-muted-foreground">{currentTier.labelEn}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="text-xl font-bold text-foreground">خانه داشبورد</h1>
                  <p className="text-xs text-muted-foreground">{siteName}</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                {currentTier && (
                  <div className="relative hidden sm:block">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={searchPlaceholder} className="w-48 border-border bg-secondary/50 pr-9" />
                  </div>
                )}
                <NotificationsDropdown />
              </div>
            </header>

            {currentTier ? (
              <DashboardModuleCards tier={currentTier} />
            ) : (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-[60vh] items-center justify-center px-4 py-12 text-center"
              >
                <div className="max-w-2xl">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 shadow-lg shadow-primary/10">
                    {isCorporateAccount ? (
                      <Building2 className="h-10 w-10 text-primary" />
                    ) : (
                      <User className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <p className="mb-3 text-sm font-medium text-primary">خانه مدیریتی شما</p>
                  <h2 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
                    {welcomeSubject}، خوش آمدید
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
                    برای شروع، یکی از بخش‌های منوی سمت راست را انتخاب کنید.
                  </p>
                </div>
              </motion.section>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
