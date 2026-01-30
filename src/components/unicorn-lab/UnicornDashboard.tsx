import { useState } from "react";
import { motion } from "framer-motion";
import { 
  RotateCcw, 
  Download, 
  Share2,
  Building2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartupProfile, AnalysisResult } from "@/pages/UnicornLab";
import UScoreGauge from "./UScoreGauge";
import CrisisSimulator from "./CrisisSimulator";
import AnalyticalCards from "./AnalyticalCards";
import VerdictSection from "./VerdictSection";

interface UnicornDashboardProps {
  profile: StartupProfile;
  result: AnalysisResult;
  onReset: () => void;
}

const UnicornDashboard = ({ profile, result, onReset }: UnicornDashboardProps) => {
  const [isCritical, setIsCritical] = useState(false);

  return (
    <div 
      className={`min-h-screen transition-all duration-500 ${
        isCritical ? 'ring-4 ring-red-500/50 ring-inset' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-lg">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                {profile.companyName}
              </h1>
              <p className="text-slate-500 text-sm">
                تحلیل جامع پتانسیل یونیکورن
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Share2 className="w-4 h-4 ml-2" />
              اشتراک‌گذاری
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4 ml-2" />
              دانلود PDF
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onReset}
              className="text-slate-600 hover:text-slate-800"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              ارزیابی جدید
            </Button>
          </div>
        </motion.div>

        {/* Critical Warning */}
        {isCritical && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">هشدار بحرانی</p>
              <p className="text-sm text-red-600">
                براساس شبیه‌سازی، عمر مالی شرکت به صفر رسیده است. بازنگری فوری لازم است.
              </p>
            </div>
          </motion.div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* U-Score - Full Width on Mobile, 1/3 on Desktop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <UScoreGauge score={result.uScore} />
          </motion.div>

          {/* Crisis Simulator - 2/3 on Desktop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <CrisisSimulator 
              baseRunway={result.financialHealth.runway}
              burnRate={profile.burnRate}
              onCritical={setIsCritical}
            />
          </motion.div>
        </div>

        {/* Analytical Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <AnalyticalCards result={result} />
        </motion.div>

        {/* Verdict Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <VerdictSection 
            verdict={result.verdict}
            companyName={profile.companyName}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default UnicornDashboard;
