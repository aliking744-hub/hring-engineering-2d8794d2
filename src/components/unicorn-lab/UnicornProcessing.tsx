import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Calculator,
  Brain,
  Cpu,
  Flag,
  Zap,
  Check,
  Loader2
} from "lucide-react";
import { StartupProfile, AnalysisResult } from "@/pages/UnicornLab";

interface UnicornProcessingProps {
  profile: StartupProfile;
  onComplete: (result: AnalysisResult) => void;
}

interface Engine {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  description: string;
}

const engines: Engine[] = [
  {
    id: 'financial',
    title: 'سلامت مالی و ریاضیات',
    subtitle: 'Business Health & Math',
    icon: Calculator,
    color: 'from-emerald-500 to-teal-500',
    description: 'بررسی حاشیه سود، مقیاس‌پذیری، نسبت CAC/LTV'
  },
  {
    id: 'founder',
    title: 'تاب‌آوری بنیان‌گذار',
    subtitle: 'Founder Resilience',
    icon: Brain,
    color: 'from-violet-500 to-purple-500',
    description: 'پروفایل روانشناختی براساس سوابق و تاریخچه'
  },
  {
    id: 'futurism',
    title: 'آینده‌نگری و ریسک AI',
    subtitle: 'Futurism & AI Risk',
    icon: Cpu,
    color: 'from-blue-500 to-cyan-500',
    description: 'آیا فناوری قدیمی است یا آینده‌نگر؟'
  },
  {
    id: 'national',
    title: 'همسویی ملی',
    subtitle: 'National Alignment',
    icon: Flag,
    color: 'from-orange-500 to-amber-500',
    description: 'حاکمیت داده و پتانسیل صادرات'
  },
  {
    id: 'stress',
    title: 'شبیه‌سازی تست استرس',
    subtitle: 'Stress Test Simulation',
    icon: Zap,
    color: 'from-red-500 to-rose-500',
    description: 'مقاومت در برابر شوک‌های بازار'
  }
];

const UnicornProcessing = ({ profile, onComplete }: UnicornProcessingProps) => {
  const [currentEngine, setCurrentEngine] = useState(0);
  const [completedEngines, setCompletedEngines] = useState<string[]>([]);

  useEffect(() => {
    const processEngines = async () => {
      for (let i = 0; i < engines.length; i++) {
        setCurrentEngine(i);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
        
        setCompletedEngines(prev => [...prev, engines[i].id]);
      }

      // Generate mock result after all engines complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResult: AnalysisResult = generateMockResult(profile);
      onComplete(mockResult);
    };

    processEngines();
  }, [profile, onComplete]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-xl">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          در حال تحلیل {profile.companyName}
        </h1>
        <p className="text-slate-500">
          لطفاً صبر کنید. موتورهای تحلیل در حال ارزیابی هستند...
        </p>
      </motion.div>

      {/* Engines Progress */}
      <div className="space-y-4">
        {engines.map((engine, index) => {
          const Icon = engine.icon;
          const isCompleted = completedEngines.includes(engine.id);
          const isCurrent = currentEngine === index && !isCompleted;
          
          return (
            <motion.div
              key={engine.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                scale: isCurrent ? 1.02 : 1
              }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                isCompleted 
                  ? 'bg-emerald-50 border-emerald-200'
                  : isCurrent
                    ? 'bg-white border-blue-300 shadow-lg'
                    : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${engine.color} flex items-center justify-center shadow-md ${
                  isCurrent ? 'animate-pulse' : ''
                }`}>
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">{engine.title}</h3>
                      <p className="text-xs text-slate-500">{engine.subtitle}</p>
                    </div>
                    {isCompleted && (
                      <span className="text-sm text-emerald-600 font-medium">تکمیل شد</span>
                    )}
                    {isCurrent && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">در حال پردازش...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{engine.description}</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              {isCurrent && (
                <motion.div 
                  className="mt-3 h-1 bg-slate-200 rounded-full overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'linear' }}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* All Complete Message */}
      {completedEngines.length === engines.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center"
        >
          <Check className="w-12 h-12 mx-auto text-emerald-600 mb-3" />
          <p className="font-bold text-emerald-800">تحلیل کامل شد!</p>
          <p className="text-sm text-emerald-600">در حال آماده‌سازی داشبورد...</p>
        </motion.div>
      )}
    </div>
  );
};

// Mock data generator - In production, this would come from AI backend
function generateMockResult(profile: StartupProfile): AnalysisResult {
  const baseScore = Math.min(95, Math.max(30, 
    50 + 
    (profile.monthlyActiveUsers > 100000 ? 15 : profile.monthlyActiveUsers > 10000 ? 10 : 5) +
    (profile.currentValuation > 10000 ? 10 : 5) +
    (profile.foundersBio?.length > 200 ? 10 : 5) +
    Math.random() * 15
  ));

  const burnRate = profile.burnRate * 1000000; // Convert to actual amount
  const runway = Math.round(profile.currentValuation / (profile.burnRate || 1));

  return {
    uScore: Math.round(baseScore),
    financialHealth: {
      grossMargin: Math.round(35 + Math.random() * 30),
      burnRate: burnRate,
      runway: Math.min(36, Math.max(3, runway)),
      healthGrade: baseScore >= 80 ? 'A' : baseScore >= 60 ? 'B' : baseScore >= 40 ? 'C' : 'D'
    },
    founderGrit: {
      resilience: Math.round(60 + Math.random() * 30),
      experience: Math.round(50 + Math.random() * 40),
      adaptability: Math.round(55 + Math.random() * 35),
      networkStrength: Math.round(45 + Math.random() * 40),
      overallScore: Math.round(55 + Math.random() * 30)
    },
    techViability: {
      score: Math.round(50 + Math.random() * 40),
      aiProof: Math.random() > 0.4,
      riskLevel: Math.random() > 0.6 ? 'low' : Math.random() > 0.3 ? 'medium' : 'high',
      insights: [
        'زیرساخت فنی مبتنی بر cloud computing',
        'استفاده از API‌های استاندارد صنعت',
        'نیاز به بهبود امنیت سایبری'
      ]
    },
    nationalUtility: {
      dataSovereignty: Math.random() > 0.3,
      exportReady: Math.random() > 0.5,
      localImpact: Math.round(40 + Math.random() * 50),
      jobCreation: Math.round(20 + Math.random() * 180)
    },
    verdict: {
      status: baseScore >= 90 ? 'unicorn' : baseScore >= 70 ? 'approved' : baseScore >= 50 ? 'conditional' : 'rejected',
      summary: baseScore >= 70 
        ? `شرکت ${profile.companyName} دارای زیرساخت فنی قوی و پتانسیل رشد بالا است. با وجود چالش‌های مالی جزئی، ارزیابی کلی مثبت است.`
        : `شرکت ${profile.companyName} دارای زیرساخت فنی قابل قبول است اما تاب‌آوری مالی در برابر شوک‌های بازار را ندارد. پیشنهاد: تایید مشروط با نظارت مستمر.`,
      recommendations: [
        'تنوع‌بخشی به منابع درآمدی',
        'کاهش وابستگی به خدمات خارجی',
        'تقویت تیم فنی و امنیت سایبری',
        'گسترش بازار هدف به کشورهای منطقه'
      ]
    }
  };
}

export default UnicornProcessing;
