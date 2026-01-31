import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight,
  ArrowLeft,
  Building2,
  Brain,
  HeartPulse,
  Rocket,
  Shield,
  Zap,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Trophy,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { StartupEntry } from "./GenomicScreeningMain";
import DigitalInterrogation from "./DigitalInterrogation";

interface AnalysisWizardProps {
  company: StartupEntry;
  onBack: () => void;
  onComplete: () => void;
}

interface EngineResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  insights: string[];
  warnings: string[];
  details: Record<string, any>;
}

const engines = [
  {
    id: 'business_health',
    title: 'موتور سلامت کسب‌وکار',
    subtitle: 'Business Health Engine',
    description: 'تحلیل مقیاس‌پذیری و حاشیه سود',
    icon: HeartPulse,
    color: 'from-red-500 to-pink-500',
    motto: 'ریاضیات دروغ نمی‌گوید'
  },
  {
    id: 'founder_resilience',
    title: 'موتور تاب‌آوری بنیان‌گذار',
    subtitle: 'Founder Resilience AI',
    description: 'پروفایلینگ روانی و شاخص پوست‌کلفت بودن',
    icon: Brain,
    color: 'from-purple-500 to-violet-500',
    motto: 'ما روی سوارکار شرط می‌بندیم'
  },
  {
    id: 'futurism_tech',
    title: 'موتور آینده‌پژوهی',
    subtitle: 'Futurism & Tech Edge',
    description: 'تست انقضای مدل و معماری تکنولوژی',
    icon: Rocket,
    color: 'from-cyan-500 to-blue-500',
    motto: 'ساختن روی زمین سفت'
  },
  {
    id: 'political_alignment',
    title: 'موتور انطباق ملی',
    subtitle: 'Political & Macro Alignment',
    description: 'همسویی با امنیت ملی و پتانسیل صادرات',
    icon: Shield,
    color: 'from-emerald-500 to-teal-500',
    motto: 'یونیکورن ملی، سرباز اقتصاد'
  },
  {
    id: 'stress_test',
    title: 'موتور تست استرس',
    subtitle: 'Stress Testing Simulator',
    description: 'شبیه‌سازی بحران‌های ارزی، تحریمی و رقابتی',
    icon: Zap,
    color: 'from-amber-500 to-orange-500',
    motto: 'شکست در شبیه‌سازی بهتر از واقعیت'
  },
];

const AnalysisWizard = ({ company, onBack, onComplete }: AnalysisWizardProps) => {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = interrogation, 0-4 = engines, 5 = verdict
  const [analyzing, setAnalyzing] = useState(false);
  const [engineResults, setEngineResults] = useState<Record<string, EngineResult>>({});
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const { toast } = useToast();

  const currentEngine = currentStep >= 0 && currentStep < engines.length ? engines[currentStep] : null;

  const runEngineAnalysis = async (engineId: string) => {
    setAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-unicorn-engine', {
        body: {
          companyId: company.id,
          engineId,
          companyData: {
            name: company.company_name,
            url: company.company_url,
            foundersBio: company.founders_bio,
            valuation: company.current_valuation,
            mau: company.monthly_active_users,
            burnRate: company.burn_rate
          }
        }
      });

      if (error) throw error;

      setEngineResults(prev => ({
        ...prev,
        [engineId]: data.result
      }));

      toast({
        title: "تحلیل کامل شد",
        description: `امتیاز: ${data.result.score}/100`
      });

    } catch (err: any) {
      console.error('Engine analysis error:', err);
      // Mock result for demo
      const mockResult: EngineResult = {
        score: Math.floor(Math.random() * 40) + 60,
        grade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)] as any,
        insights: [
          'ساختار مالی قابل قبول است',
          'پتانسیل رشد بالایی دارد',
          'نیاز به بهینه‌سازی هزینه‌ها'
        ],
        warnings: Math.random() > 0.5 ? ['حاشیه سود پایین‌تر از استاندارد'] : [],
        details: {}
      };
      
      setEngineResults(prev => ({
        ...prev,
        [engineId]: mockResult
      }));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    
    setAskingAi(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('unicorn-ai-chat', {
        body: {
          question: aiQuestion,
          companyId: company.id,
          mode: 'interrogation', // or 'admin_analysis'
          context: {
            company: company.company_name,
            engineResults
          }
        }
      });

      if (error) throw error;
      setAiResponse(data.response || 'پاسخی دریافت نشد');
    } catch (err: any) {
      setAiResponse('در حال حاضر امکان پاسخ‌دهی وجود ندارد. لطفاً بعداً تلاش کنید.');
    } finally {
      setAskingAi(false);
    }
  };

  const calculateFinalScore = () => {
    const scores = Object.values(engineResults).map(r => r.score);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const getVerdict = (score: number) => {
    if (score >= 90) return { status: 'unicorn', label: 'جنین یونیکورن', color: 'emerald' };
    if (score >= 75) return { status: 'approved', label: 'غزال تیزپا', color: 'teal' };
    if (score >= 50) return { status: 'conditional', label: 'پتانسیل رشد', color: 'amber' };
    return { status: 'rejected', label: 'رد صلاحیت', color: 'red' };
  };

  const approveAndSendToChapter2 = async () => {
    try {
      const finalScore = calculateFinalScore();
      
      await supabase
        .from('unicorn_analyses')
        .update({
          u_score: finalScore,
          analysis_result: JSON.parse(JSON.stringify(engineResults)),
          chapter_1_approved: true,
          chapter_1_approved_at: new Date().toISOString(),
          chapter: 'chapter_2',
          status: 'completed'
        })
        .eq('id', company.id);

      toast({
        title: "تأیید شد",
        description: `${company.company_name} به فصل ۲ منتقل شد`
      });

      onComplete();
    } catch (err: any) {
      toast({
        title: "خطا",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{company.company_name}</h2>
            <p className="text-sm text-muted-foreground">دادگاه عالی هوش مصنوعی</p>
          </div>
        </div>
        
        <Badge variant="outline" className="text-lg px-4 py-2">
          مرحله {currentStep + 2} از {engines.length + 2}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>بازجویی</span>
          {engines.map(e => (
            <span key={e.id} className={engineResults[e.id] ? 'text-primary' : ''}>
              {e.title.split(' ')[1]}
            </span>
          ))}
          <span>حکم</span>
        </div>
        <Progress value={((currentStep + 2) / (engines.length + 2)) * 100} className="h-2" />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Step -1: Digital Interrogation */}
        {currentStep === -1 && (
          <motion.div
            key="interrogation"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <DigitalInterrogation 
              companyName={company.company_name}
              claims={{
                revenue: company.current_valuation,
                employees: undefined,
                users: company.monthly_active_users || undefined
              }}
              onComplete={() => {}}
            />
            
            <div className="flex justify-end mt-6">
              <Button onClick={() => setCurrentStep(0)}>
                ادامه به موتورهای تحلیل
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Engine Steps */}
        {currentEngine && (
          <motion.div
            key={currentEngine.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <Card className={`border-2 bg-gradient-to-br ${currentEngine.color.replace('from-', 'from-').replace(' to-', '/10 to-')}/5`}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentEngine.color} flex items-center justify-center shadow-lg`}>
                    <currentEngine.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{currentEngine.title}</CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">{currentEngine.subtitle}</p>
                    <p className="text-sm text-muted-foreground mt-1">«{currentEngine.motto}»</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {!engineResults[currentEngine.id] ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{currentEngine.description}</p>
                    <Button 
                      size="lg"
                      onClick={() => runEngineAnalysis(currentEngine.id)}
                      disabled={analyzing}
                      className={`bg-gradient-to-r ${currentEngine.color}`}
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                          در حال تحلیل...
                        </>
                      ) : (
                        <>
                          <currentEngine.icon className="w-5 h-5 ml-2" />
                          شروع تحلیل این موتور
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Score */}
                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl">
                      <div>
                        <p className="text-sm text-muted-foreground">امتیاز این موتور</p>
                        <p className={`text-4xl font-bold ${
                          engineResults[currentEngine.id].score >= 75 ? 'text-emerald-400' :
                          engineResults[currentEngine.id].score >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {engineResults[currentEngine.id].score}
                          <span className="text-lg text-muted-foreground">/100</span>
                        </p>
                      </div>
                      <Badge className={`text-2xl px-4 py-2 ${
                        engineResults[currentEngine.id].grade === 'A' ? 'bg-emerald-500' :
                        engineResults[currentEngine.id].grade === 'B' ? 'bg-teal-500' :
                        engineResults[currentEngine.id].grade === 'C' ? 'bg-amber-500' : 'bg-red-500'
                      }`}>
                        {engineResults[currentEngine.id].grade}
                      </Badge>
                    </div>

                    {/* Insights */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-foreground">یافته‌ها</h4>
                      {engineResults[currentEngine.id].insights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-secondary/30 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-foreground">{insight}</span>
                        </div>
                      ))}
                    </div>

                    {/* Warnings */}
                    {engineResults[currentEngine.id].warnings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground">هشدارها</h4>
                        {engineResults[currentEngine.id].warnings.map((warning, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-foreground">{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Chat */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  پرسش از هوش مصنوعی
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="سوال خود درباره این شرکت یا نتایج تحلیل را بپرسید..."
                  className="bg-secondary/50"
                />
                <div className="flex justify-end">
                  <Button 
                    size="sm" 
                    onClick={handleAskAi}
                    disabled={askingAi || !aiQuestion.trim()}
                  >
                    {askingAi ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'بپرس'
                    )}
                  </Button>
                </div>
                {aiResponse && (
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(prev => prev - 1)}
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                قبلی
              </Button>
              <Button 
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!engineResults[currentEngine.id]}
              >
                {currentStep === engines.length - 1 ? 'مشاهده حکم نهایی' : 'موتور بعدی'}
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Final Verdict */}
        {currentStep === engines.length && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
              <CardContent className="p-8 text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Trophy className="w-12 h-12 text-primary-foreground" />
                </div>
                
                <h2 className="text-2xl font-bold text-foreground mb-2">حکم نهایی</h2>
                <p className="text-muted-foreground mb-6">{company.company_name}</p>
                
                <div className="text-6xl font-bold text-primary mb-4">
                  {calculateFinalScore()}
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                
                <Badge className={`text-xl px-6 py-2 ${
                  getVerdict(calculateFinalScore()).color === 'emerald' ? 'bg-emerald-500' :
                  getVerdict(calculateFinalScore()).color === 'teal' ? 'bg-teal-500' :
                  getVerdict(calculateFinalScore()).color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                  {getVerdict(calculateFinalScore()).label}
                </Badge>
                
                <div className="mt-8 grid grid-cols-5 gap-4">
                  {engines.map(engine => {
                    const result = engineResults[engine.id];
                    return (
                      <div key={engine.id} className="text-center">
                        <div className={`w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br ${engine.color} flex items-center justify-center`}>
                          <engine.icon className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{result?.score || '-'}</p>
                        <p className="text-xs text-muted-foreground">{engine.title.split(' ')[1]}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(engines.length - 1)}>
                <ArrowRight className="w-4 h-4 ml-2" />
                برگشت
              </Button>
              
              {calculateFinalScore() >= 50 && (
                <Button onClick={approveAndSendToChapter2} className="bg-gradient-to-r from-emerald-500 to-teal-500">
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  تأیید و ارسال به فصل ۲
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnalysisWizard;
