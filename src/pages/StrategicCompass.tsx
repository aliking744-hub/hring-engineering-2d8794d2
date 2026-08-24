import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Compass, 
  Target, 
  Users, 
  BarChart3, 
  Brain,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  Zap,
  Eye,
  FileText,
  Coins,
  UserCheck,
  Radar,
  Flame,
  Lightbulb,
  Sparkles,
  FlaskConical,
  Cog
} from "lucide-react";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DemoModeProvider, useDemoMode } from "@/contexts/DemoModeContext";

// Import compass components
import CommandDashboard from "@/components/strategic-compass/CommandDashboard";
import IntentModule from "@/components/strategic-compass/IntentModule";
import BehaviorModule from "@/components/strategic-compass/BehaviorModule";
import AnalysisEngine from "@/components/strategic-compass/AnalysisEngine";
import CEODashboard from "@/components/strategic-compass/CEODashboard";
import MentalPrism from "@/components/strategic-compass/MentalPrism";
import PrismResponse from "@/components/strategic-compass/PrismResponse";
import StrategicBetting from "@/components/strategic-compass/StrategicBetting";
import DecisionJournal from "@/components/strategic-compass/DecisionJournal";
import UserManagement from "@/components/strategic-compass/UserManagement";
import DreamManifestation from "@/components/strategic-compass/DreamManifestation";
import CompassAdminSettings from "@/components/strategic-compass/CompassAdminSettings";

type CompassRole = 'ceo' | 'deputy' | 'manager' | 'expert' | null;

interface UserPermissions {
  role: CompassRole;
  accessibleSections: string[];
  canEdit: boolean;
  diamonds: number;
}

const StrategicCompassContent = () => {
  const { isDemoMode, setIsDemoMode } = useDemoMode();
  const [compassRole, setCompassRole] = useState<CompassRole>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isCEO = compassRole === 'ceo';
  const isDeputy = compassRole === 'deputy';
  const isManager = compassRole === 'manager';
  const isExpert = compassRole === 'expert';

  // Map section IDs to tab configurations
  const sectionToTabMap: Record<string, { id: string; label: string; icon: any; isGolden?: boolean }> = {
    'intent': { id: "intent", label: "ماژول فرمان", icon: Zap },
    'behavior': { id: "behavior", label: "ماژول رفتار", icon: Activity },
    'betting': { id: "betting", label: "بازی استراتژیک", icon: Coins },
    'erdtree': { id: "dream", label: "تجلی رویا", icon: Sparkles, isGolden: true },
    'analysis': { id: "analysis", label: "موتور تحلیل", icon: Brain },
    'dream': { id: "dream", label: "تجلی رویا", icon: Sparkles, isGolden: true },
    'prism': { id: "mental-prism", label: "منشور ذهنی", icon: Eye },
    'journal': { id: "journal", label: "ژورنال تصمیم", icon: FileText },
  };

  const getTabs = () => {
    const baseTabs: { id: string; label: string; icon: any; isGolden?: boolean; isAdmin?: boolean }[] = [];
    
    // Add admin settings tab if user is admin
    if (isAdmin) {
      baseTabs.push({ id: "admin-settings", label: "تنظیمات", icon: Cog, isAdmin: true });
    }
    
    if (isCEO) {
      // CEO has full access - ترتیب از راست به چپ
      baseTabs.push(
        { id: "dream", label: "تجلی رویا", icon: Sparkles, isGolden: true },
        { id: "betting", label: "بازی استراتژیک", icon: Coins },
        { id: "mental-prism", label: "منشور ذهنی", icon: Eye },
        { id: "ceo-dashboard", label: "داشبورد مدیرعامل", icon: BarChart3 },
        { id: "analysis", label: "موتور تحلیل", icon: Brain },
        { id: "intent", label: "ماژول فرمان", icon: Zap },
        { id: "command", label: "داشبورد فرمان", icon: Target },
      );
    } else if (isDeputy || isManager || isExpert) {
      // Filter tabs based on user's accessible sections
      const accessibleSections = userPermissions?.accessibleSections || [];
      
      // Define available tabs for non-CEO users
      const availableTabs = [
        { section: 'betting', tab: { id: "betting", label: "بازی استراتژیک", icon: Coins } },
        { section: 'journal', tab: { id: "journal", label: "ژورنال تصمیم", icon: FileText } },
        { section: 'prism', tab: { id: "mental-prism", label: "منشور ذهنی", icon: Eye } },
        { section: 'behavior', tab: { id: "behavior", label: "ماژول رفتار", icon: Activity } },
        { section: 'erdtree', tab: { id: "dream", label: "تجلی رویا", icon: Sparkles, isGolden: true } },
        { section: 'analysis', tab: { id: "analysis", label: "موتور تحلیل", icon: Brain } },
        { section: 'intent', tab: { id: "intent", label: "ماژول فرمان", icon: Zap } },
      ];
      
      // Only show tabs for accessible sections
      availableTabs.forEach(({ section, tab }) => {
        if (accessibleSections.includes(section)) {
          baseTabs.push(tab);
        }
      });
    }
    
    return baseTabs;
  };

  const tabs = getTabs();

  useEffect(() => {
    if (user) {
      checkCompassRole();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Set default active tab when tabs are loaded
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      // Set the last tab as default (rightmost in RTL)
      setActiveTab(tabs[tabs.length - 1].id);
    }
  }, [tabs.length, activeTab]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [isLoading, user, navigate]);

  const checkCompassRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('compass_user_roles')
        .select('role, accessible_sections, can_edit, diamonds')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking compass role:', error);
      }

      if (data) {
        setCompassRole(data.role as CompassRole);
        setUserPermissions({
          role: data.role as CompassRole,
          accessibleSections: data.accessible_sections || [],
          canEdit: data.can_edit ?? true,
          diamonds: data.diamonds ?? 100
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCompassRole(null);
    navigate('/dashboard');
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <AuroraBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 flex flex-col items-center gap-4"
        >
          <Compass className="w-16 h-16 text-primary animate-spin" />
          <p className="text-foreground">در حال بارگذاری...</p>
        </motion.div>
      </div>
    );
  }

  // Show no access message if user has no compass role
  if (!compassRole) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <AuroraBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 flex flex-col items-center gap-6 max-w-md text-center"
        >
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">دسترسی محدود</h2>
            <p className="text-muted-foreground">
              شما هنوز نقشی در قطب نمای استراتژی ندارید. لطفاً با مدیر سیستم تماس بگیرید.
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              className="border-border"
            >
              بازگشت به داشبورد
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }


  return (
    <>
      <Helmet>
        <title>قطب نمای استراتژی | رصدخانه استراتژیک</title>
        <meta 
          name="description" 
          content="سیستم رصدخانه استراتژیک برای همسوسازی تیم مدیریتی با نیت‌های استراتژیک سازمان" 
        />
      </Helmet>
      
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        
        <div className="relative z-10 container mx-auto px-4 py-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
          >
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="gap-2 border-border bg-secondary/50"
              >
                <ChevronLeft className="h-5 w-5" />
                بازگشت به داشبورد
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Compass className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">قطب نمای استراتژی</h1>
                  <p className="text-sm text-muted-foreground">
                    رصدخانه استراتژیک • 
                    {isCEO && " مدیرعامل"}
                    {isDeputy && " معاون"}
                    {isManager && " مدیرکل"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Demo Mode Toggle */}
              <div className="glass-card px-4 py-2 flex items-center gap-3">
                <FlaskConical className={`w-4 h-4 ${isDemoMode ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <Label htmlFor="demo-mode" className="text-sm text-foreground cursor-pointer">
                  داده‌های فرضی
                </Label>
                <Switch
                  id="demo-mode"
                  checked={isDemoMode}
                  onCheckedChange={setIsDemoMode}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              
              <div className="glass-card px-4 py-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{user?.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="border-border bg-secondary/50 text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 ml-2" />
                خروج
              </Button>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="glass-card w-max sm:w-full flex flex-nowrap sm:flex-wrap justify-start sm:justify-end gap-1 p-2 mb-6 h-auto min-w-max">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary ${
                        tab.isGolden 
                          ? 'border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.5)] animate-golden-pulse bg-gradient-to-r from-[#D4AF37]/10 to-[#B8860B]/10 text-[#D4AF37] data-[state=active]:border-[#D4AF37] data-[state=active]:bg-[#D4AF37]/20 data-[state=active]:text-[#D4AF37]' 
                          : tab.isAdmin
                            ? 'border border-red-500/30 bg-red-500/10 text-red-400 data-[state=active]:border-red-500 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300'
                            : ''
                      }`}
                    >
                      <tab.icon className={`w-4 h-4 ${tab.isGolden ? 'text-[#D4AF37]' : tab.isAdmin ? 'text-red-400' : ''}`} />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* CEO Tabs */}
              {isCEO && (
                <>
                  <TabsContent value="command">
                    <CommandDashboard />
                  </TabsContent>
                  <TabsContent value="intent">
                    <IntentModule />
                  </TabsContent>
                  <TabsContent value="analysis">
                    <AnalysisEngine />
                  </TabsContent>
                  <TabsContent value="ceo-dashboard">
                    <CEODashboard />
                  </TabsContent>
                  <TabsContent value="mental-prism">
                    <MentalPrism />
                  </TabsContent>
                  <TabsContent value="betting">
                    <StrategicBetting userRole={compassRole} />
                  </TabsContent>
                  <TabsContent value="dream">
                    <DreamManifestation />
                  </TabsContent>
                </>
              )}

              {/* Deputy/Manager/Expert Tabs - based on accessible sections */}
              {(isDeputy || isManager || isExpert) && (
                <>
                  {userPermissions?.accessibleSections.includes('behavior') && (
                    <TabsContent value="behavior">
                      <BehaviorModule canEdit={userPermissions?.canEdit} />
                    </TabsContent>
                  )}
                  {userPermissions?.accessibleSections.includes('prism') && (
                    <TabsContent value="mental-prism">
                      <PrismResponse canEdit={userPermissions?.canEdit} />
                    </TabsContent>
                  )}
                  {userPermissions?.accessibleSections.includes('journal') && (
                    <TabsContent value="journal">
                      <DecisionJournal canEdit={userPermissions?.canEdit} />
                    </TabsContent>
                  )}
                  {userPermissions?.accessibleSections.includes('betting') && (
                    <TabsContent value="betting">
                      <StrategicBetting userRole={compassRole} canEdit={userPermissions?.canEdit} />
                    </TabsContent>
                  )}
                  {userPermissions?.accessibleSections.includes('erdtree') && (
                    <TabsContent value="dream">
                      <DreamManifestation />
                    </TabsContent>
                  )}
                  {userPermissions?.accessibleSections.includes('analysis') && (
                    <TabsContent value="analysis">
                      <AnalysisEngine />
                    </TabsContent>
                  )}
                  {userPermissions?.accessibleSections.includes('intent') && (
                    <TabsContent value="intent">
                      <IntentModule canEdit={userPermissions?.canEdit} />
                    </TabsContent>
                  )}
                </>
              )}

              {/* Admin Settings Tab */}
              {isAdmin && (
                <TabsContent value="admin-settings">
                  <CompassAdminSettings />
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        </div>
      </div>
    </>
  );
};

const StrategicCompass = () => {
  return (
    <DemoModeProvider>
      <StrategicCompassContent />
    </DemoModeProvider>
  );
};

export default StrategicCompass;
