import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Calculator,
  Brain,
  Cpu,
  Flag,
  Zap,
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const processAnalysis = async () => {
      // Visual progress through engines
      for (let i = 0; i < engines.length; i++) {
        setCurrentEngine(i);
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        setCompletedEngines(prev => [...prev, engines[i].id]);
      }

      // Call the AI analysis endpoint
      try {
        const { data, error: fnError } = await supabase.functions.invoke('analyze-unicorn', {
          body: { profile }
        });

        if (fnError) throw fnError;
        if (data.error) throw new Error(data.error);

        if (data.success && data.result) {
          await new Promise(resolve => setTimeout(resolve, 500));
          onComplete(data.result);
        } else {
          throw new Error('نتیجه‌ای از تحلیل دریافت نشد');
        }
      } catch (err: any) {
        console.error('Analysis error:', err);
        setError(err.message || 'خطا در تحلیل');
        toast({
          title: "خطا در تحلیل",
          description: err.message || 'خطای ناشناخته',
          variant: "destructive"
        });
        
        // Fallback to mock data after error
        setTimeout(() => {
          const fallbackResult = generateFallbackResult(profile);
          onComplete(fallbackResult);
        }, 2000);
      }
    };

    processAnalysis();
  }, [profile, onComplete, toast]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
          <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          در حال تحلیل {profile.companyName}
        </h1>
        <p className="text-muted-foreground">
          {error ? 'در حال استفاده از داده‌های پیش‌فرض...' : 'لطفاً صبر کنید. موتورهای تحلیل در حال ارزیابی هستند...'}
        </p>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-4 glass-card flex items-center gap-3 border-amber-500/50"
        >
          <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-300">تحلیل AI در دسترس نیست</p>
            <p className="text-sm text-amber-400/80">{error} - در حال استفاده از تحلیل پیش‌فرض</p>
          </div>
        </motion.div>
      )}

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
              animate={{ opacity: 1, x: 0, scale: isCurrent ? 1.02 : 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                isCompleted 
                  ? 'glass-card border-emerald-500/50'
                  : isCurrent
                    ? 'glass-card border-primary/50 shadow-lg shadow-primary/20'
                    : 'bg-secondary/30 border-border opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${engine.color} flex items-center justify-center shadow-md ${isCurrent ? 'animate-pulse' : ''}`}>
                  {isCompleted ? <Check className="w-6 h-6 text-white" /> : <Icon className="w-6 h-6 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-foreground">{engine.title}</h3>
                      <p className="text-xs text-muted-foreground">{engine.subtitle}</p>
                    </div>
                    {isCompleted && <span className="text-sm text-emerald-400 font-medium">تکمیل شد</span>}
                    {isCurrent && (
                      <div className="flex items-center gap-2 text-primary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">در حال پردازش...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{engine.description}</p>
                </div>
              </div>
              
              {isCurrent && (
                <motion.div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <motion.div className="h-full bg-gradient-to-r from-primary to-accent" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.8, ease: 'linear' }} />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* All Complete Message */}
      {completedEngines.length === engines.length && !error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 glass-card border-emerald-500/50 text-center"
        >
          <Check className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
          <p className="font-bold text-emerald-300">تحلیل کامل شد!</p>
          <p className="text-sm text-emerald-400">در حال آماده‌سازی داشبورد...</p>
        </motion.div>
      )}
    </div>
  );
};

function generateFallbackResult(profile: StartupProfile): AnalysisResult {
  const baseScore = Math.min(95, Math.max(30, 
    50 + 
    (profile.monthlyActiveUsers > 100000 ? 15 : profile.monthlyActiveUsers > 10000 ? 10 : 5) +
    (profile.currentValuation > 10000 ? 10 : 5) +
    (profile.foundersBio && profile.foundersBio.length > 200 ? 10 : 5) +
    Math.random() * 15
  ));

  const burnRate = profile.burnRate * 1000000;
  const runway = Math.round(profile.currentValuation / (profile.burnRate || 1));

  return {
    uScore: Math.round(baseScore),
    financialHealth: {
      grossMargin: Math.round(35 + Math.random() * 30),
      burnRate: burnRate,
      runway: Math.min(36, Math.max(3, runway)),
      healthGrade: baseScore >= 80 ? 'A' : baseScore >= 60 ? 'B' : baseScore >= 40 ? 'C' : 'D' as 'A' | 'B' | 'C' | 'D' | 'F'
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
      riskLevel: (Math.random() > 0.6 ? 'low' : Math.random() > 0.3 ? 'medium' : 'high') as 'low' | 'medium' | 'high',
      insights: [
        'زیرساخت فنی نیاز به بررسی بیشتر دارد',
        'پتانسیل رشد در بازار داخلی وجود دارد',
        'نیاز به تقویت امنیت سایبری'
      ]
    },
    nationalUtility: {
      dataSovereignty: Math.random() > 0.3,
      exportReady: Math.random() > 0.5,
      localImpact: Math.round(40 + Math.random() * 50),
      jobCreation: Math.round(20 + Math.random() * 180)
    },
    verdict: {
      status: (baseScore >= 90 ? 'unicorn' : baseScore >= 70 ? 'approved' : baseScore >= 50 ? 'conditional' : 'rejected') as 'rejected' | 'conditional' | 'approved' | 'unicorn',
      summary: `شرکت ${profile.companyName} نیاز به بررسی بیشتر دارد. تحلیل اولیه انجام شده است.`,
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
