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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { useAdmin } from "@/hooks/useAdmin";
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
      { id: "strategic-compass", label: "قطب‌نمای استراتژی", desc: "سنجش هوشمند شکاف ذهنی و هم‌سویی مدیرعامل با ارشد مدیران", icon: Compass, path: "/strategic-compass" },
      { id: "legal-advisor", label: "مشاور حقوقی", desc: "دستیار هوشمند حقوقی برای مسائل منابع انسانی", icon: Scale, path: "/legal-advisor" },
      { id: "macro-analytics", label: "گزارش‌های کلان", desc: "شاخص‌های کلیدی سطح هلدینگ (مثل نرخ خروج کل، eNPS)", icon: TrendingUp, path: "#", comingSoon: true },
    ],
  },
];

const Dashboard = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openTiers, setOpenTiers] = useState<string[]>(["smart-workspace"]);
  const [activeTier, setActiveTier] = useState("smart-workspace");
  const { signOut, user } = useAuth();
  const { context, loading: contextLoading } = useUserContext();
  const { isAdmin } = useAdmin();
  const { credits } = useCredits();
  const navigate = useNavigate();
  const { getSetting } = useSiteSettings();
  const siteName = useSiteName();
  const showUpgradeCta = useSectionVisible('dashboard_upgrade_cta');
  const isVisibleSetting = (id: string) => getSetting(`section_visible_${id}`, 'true') !== 'false';
  const visibleTiers = TIERS
    .filter(t => isVisibleSetting(`dash_tier_${t.id}`))
    .map(t => ({ ...t, modules: t.modules.filter(m => isVisibleSetting(`dash_mod_${m.id}`)) }))
    .filter(t => t.modules.length > 0);

  const creditLabel = getSetting('dashboard_credit_label', 'اعتبار شرکت');
  const logoutText = getSetting('dashboard_logout_btn', 'خروج');
  const searchPlaceholder = getSetting('dashboard_search_placeholder', 'جستجو...');

  const getMaxCredits = () => {
    const tier = context?.subscriptionTier || context?.companyTier;
    switch (tier) {
      case 'individual_free': return 50;
      case 'individual_pro': return 600;
      case 'individual_plus': return 2500;
      case 'corporate_expert': return 500;
      case 'corporate_decision_support': return 2000;
      case 'corporate_decision_making': return 5000;
      default: return 50;
    }
  };

  const maxCredits = getMaxCredits();
  const creditPercentage = maxCredits > 0 ? Math.min((credits / maxCredits) * 100, 100) : 0;

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const toggleTier = (tierId: string) => {
    setOpenTiers(prev => 
      prev.includes(tierId) ? prev.filter(t => t !== tierId) : [...prev, tierId]
    );
    setActiveTier(tierId);
  };

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentTier = visibleTiers.find(t => t.id === activeTier) || visibleTiers[0] || TIERS[0];

  // Sidebar content (shared between mobile and desktop)
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="mb-3">
        <Link to="/" className="text-2xl font-bold gradient-text-primary" onClick={onNavigate}>
          {siteName}
        </Link>
      </div>

      {/* User Profile & Credit */}
      <div className="mb-4 px-3 py-3 rounded-xl bg-secondary/50 border border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {context?.fullName || context?.email || 'کاربر'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{context?.title || ''}</p>
          </div>
        </div>
        {/* Company Credit */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{creditLabel}</span>
          <Link to="/payment-history" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={onNavigate}>
            <History className="w-3 h-3" />
            تاریخچه
          </Link>
        </div>
        <div className="text-xl font-bold text-primary mb-2">
          {credits.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {maxCredits.toLocaleString()}</span>
        </div>
        <Progress value={creditPercentage} className="h-1.5" />
      </div>

      {/* 4-Tier Accordion Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {visibleTiers.map((tier) => {
          const isOpen = openTiers.includes(tier.id);
          const isActive = activeTier === tier.id;
          return (
            <div key={tier.id}>
              <button
                onClick={() => toggleTier(tier.id)}
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
        <link rel="canonical" href="https://hring-app.lovable.app/dashboard" />
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
            <header className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="text-xl font-bold text-foreground">{currentTier.label}</h1>
                <p className="text-xs text-muted-foreground">{currentTier.labelEn}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative hidden sm:block">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={searchPlaceholder} className="pr-9 w-48 bg-secondary/50 border-border" />
                </div>
                <NotificationsDropdown />
              </div>
            </header>

            {/* Module Cards for Active Tier */}
            <DashboardModuleCards tier={currentTier} />
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
