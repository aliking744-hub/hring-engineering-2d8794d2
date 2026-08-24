import { motion } from "framer-motion";
import { AlertTriangle, Settings2, Radar, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyProfile } from "@/pages/StrategicRadar";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy components for better performance
const OverallScore = lazy(() => import("./sections/OverallScore"));
const MarketPosition = lazy(() => import("./sections/MarketPosition"));
const GlobalTrends = lazy(() => import("./sections/GlobalTrends"));
const TechnologyEdge = lazy(() => import("./sections/TechnologyEdge"));
const CompetitorAnatomy = lazy(() => import("./sections/CompetitorAnatomy"));
const CompetitorComparison = lazy(() => import("./sections/CompetitorComparison"));
const StrategicRecommendations = lazy(() => import("./sections/StrategicRecommendations"));
const DailyMonitor = lazy(() => import("./sections/DailyMonitor"));
const ValueChainMap = lazy(() => import("./sections/ValueChainMap"));
const FundingTracker = lazy(() => import("./sections/FundingTracker"));
const TechStackComparison = lazy(() => import("./sections/TechStackComparison"));
const MarketAlerts = lazy(() => import("./sections/MarketAlerts"));

const DataSources = lazy(() => import("./sections/DataSources"));

const SectionLoader = () => (
  <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800/50">
    <Skeleton className="h-6 w-32 mb-4 bg-slate-700" />
    <Skeleton className="h-48 w-full bg-slate-800" />
  </div>
);

interface RadarDashboardProps {
  profile: CompanyProfile;
  onEditProfile: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const RadarDashboard = ({ profile, onEditProfile, onSave, isSaving }: RadarDashboardProps) => {
  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center cursor-pointer hover:border-cyan-400/50 transition-colors">
              <Radar className="w-6 h-6 text-cyan-400" />
            </div>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              اتاق جنگ استراتژیک
              <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full font-mono">
                برآورد
              </span>
            </h1>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              تحلیل سناریویی {profile.name} • {profile.sector}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSave && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="border-emerald-700 text-emerald-300 hover:text-white hover:bg-emerald-800"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              ذخیره
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onEditProfile}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <Settings2 className="w-4 h-4 ml-2" />
            ویرایش پروفایل
          </Button>
        </div>
      </motion.header>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="leading-6">
          خروجی‌هایی که منبع مستقیم ندارند برآورد سناریویی‌اند؛ پیش از تصمیم مدیریتی، داده و منبع هر بخش را بررسی کنید.
        </p>
      </div>

      {/* Bento Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {/* Section 0: Overall Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
        >
          <Suspense fallback={<SectionLoader />}>
            <OverallScore profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section A: Market Position */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Suspense fallback={<SectionLoader />}>
            <MarketPosition profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section B: Global Trends */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Suspense fallback={<SectionLoader />}>
            <GlobalTrends profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section C: Technology Edge */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Suspense fallback={<SectionLoader />}>
            <TechnologyEdge profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section D: Competitor Anatomy */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Suspense fallback={<SectionLoader />}>
            <CompetitorAnatomy profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section D2: Data Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
        >
          <Suspense fallback={<SectionLoader />}>
            <DataSources profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section E: Competitor Comparison & SWOT */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Suspense fallback={<SectionLoader />}>
            <CompetitorComparison profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section F: Funding Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 xl:col-span-3"
        >
          <Suspense fallback={<SectionLoader />}>
            <FundingTracker profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section G: Value Chain Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 xl:col-span-3"
        >
          <Suspense fallback={<SectionLoader />}>
            <ValueChainMap profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section H: Tech Stack Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="lg:col-span-2 xl:col-span-3"
        >
          <Suspense fallback={<SectionLoader />}>
            <TechStackComparison profile={profile} />
          </Suspense>
        </motion.div>


        {/* Section J: Market Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="lg:col-span-2 xl:col-span-3"
        >
          <Suspense fallback={<SectionLoader />}>
            <MarketAlerts profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section K: Daily Monitor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2 xl:col-span-3"
        >
          <Suspense fallback={<SectionLoader />}>
            <DailyMonitor profile={profile} />
          </Suspense>
        </motion.div>

        {/* Section L: Strategic Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="lg:col-span-2 xl:col-span-3"
        >
          <Suspense fallback={<SectionLoader />}>
            <StrategicRecommendations profile={profile} />
          </Suspense>
        </motion.div>
      </div>
    </div>
  );
};

export default RadarDashboard;
