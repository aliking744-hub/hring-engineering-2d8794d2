import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  Building2,
  Play,
  CheckCircle2,
  Send,
  Loader2,
  AlertTriangle,
  Calculator,
  Brain,
  Cpu,
  Flag,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UnicornAnalysis } from "../../UnicornLabLayout";
import UScoreGauge from "../../UScoreGauge";

interface AnalysisDetailProps {
  analysis: UnicornAnalysis;
  onBack: () => void;
  onRefresh: () => void;
}

const engines = [
  { id: 'financial', title: 'سلامت مالی', icon: Calculator, color: 'from-emerald-500 to-teal-500' },
  { id: 'founder', title: 'تاب‌آوری بنیان‌گذار', icon: Brain, color: 'from-violet-500 to-purple-500' },
  { id: 'futurism', title: 'آینده‌نگری', icon: Cpu, color: 'from-blue-500 to-cyan-500' },
  { id: 'national', title: 'همسویی ملی', icon: Flag, color: 'from-orange-500 to-amber-500' },
  { id: 'stress', title: 'تست استرس', icon: Zap, color: 'from-red-500 to-rose-500' },
];

const AnalysisDetail = ({ analysis, onBack, onRefresh }: AnalysisDetailProps) => {
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const { toast } = useToast();

  const handleRunAnalysis = async () => {
    setRunning(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-unicorn', {
        body: { 
          profile: {
            companyName: analysis.company_name,
            companyUrl: analysis.company_url,
            linkedinUrl: analysis.linkedin_url,
            foundersBio: analysis.founders_bio,
            currentValuation: analysis.current_valuation || 0,
            monthlyActiveUsers: analysis.monthly_active_users || 0,
            burnRate: analysis.burn_rate || 0,
          }
        }
      });

      if (error) throw error;

      // Update the analysis with results
      const { error: updateError } = await supabase
        .from('unicorn_analyses')
        .update({
          analysis_result: data.result,
          u_score: data.result?.uScore,
          status: 'completed'
        })
        .eq('id', analysis.id);

      if (updateError) throw updateError;

      toast({
        title: "تحلیل کامل شد",
        description: `امتیاز U-Score: ${data.result?.uScore}`,
      });

      onRefresh();
    } catch (err: any) {
      console.error('Analysis error:', err);
      toast({
        title: "خطا",
        description: err.message || "خطا در اجرای تحلیل",
        variant: "destructive"
      });
    } finally {
      setRunning(false);
    }
  };

  const handleApproveAndSend = async () => {
    setApproving(true);
    
    try {
      const { error } = await supabase
        .from('unicorn_analyses')
        .update({
          chapter: 'chapter_2',
          chapter_1_approved: true,
          chapter_1_approved_at: new Date().toISOString()
        })
        .eq('id', analysis.id);

      if (error) throw error;

      toast({
        title: "تأیید شد",
        description: "شرکت به فصل ۲ (آزمایشگاه جهش) منتقل شد",
      });

      onBack();
      onRefresh();
    } catch (err: any) {
      console.error('Approve error:', err);
      toast({
        title: "خطا",
        description: err.message || "خطا در تأیید",
        variant: "destructive"
      });
    } finally {
      setApproving(false);
    }
  };

  const result = analysis.analysis_result as any;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{analysis.company_name}</h2>
          <p className="text-sm text-muted-foreground">{analysis.company_url || 'بدون وب‌سایت'}</p>
        </div>
        {analysis.chapter_1_approved ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
            <CheckCircle2 className="w-4 h-4 ml-1" />
            تأیید شده
          </Badge>
        ) : (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleRunAnalysis}
              disabled={running}
            >
              {running ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 ml-2" />
              )}
              اجرای تحلیل
            </Button>
            {analysis.status === 'completed' && (
              <Button 
                onClick={handleApproveAndSend}
                disabled={approving}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-2" />
                )}
                تأیید و ارسال به فصل ۲
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {!result ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">تحلیل انجام نشده</h3>
            <p className="text-muted-foreground text-sm mb-4">
              برای ارزیابی این شرکت، دکمه "اجرای تحلیل" را بزنید.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* U-Score */}
          <div className="lg:col-span-1">
            <UScoreGauge score={result.uScore || 0} />
          </div>

          {/* Engine Results */}
          <div className="lg:col-span-2 space-y-4">
            {engines.map((engine) => {
              const Icon = engine.icon;
              let score = 0;
              
              if (engine.id === 'financial') score = result.financialHealth?.grossMargin || 0;
              if (engine.id === 'founder') score = result.founderGrit?.overallScore || 0;
              if (engine.id === 'futurism') score = result.techViability?.score || 0;
              if (engine.id === 'national') score = result.nationalUtility?.localImpact || 0;
              if (engine.id === 'stress') score = Math.min(100, (result.financialHealth?.runway || 0) * 3);

              return (
                <Card key={engine.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${engine.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">{engine.title}</span>
                          <span className={`text-sm font-bold ${
                            score >= 70 ? 'text-emerald-400' :
                            score >= 50 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {Math.round(score)}%
                          </span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Verdict */}
      {result?.verdict && (
        <Card className={`border-2 ${
          result.verdict.status === 'unicorn' ? 'border-amber-500/50 bg-amber-500/5' :
          result.verdict.status === 'approved' ? 'border-emerald-500/50 bg-emerald-500/5' :
          result.verdict.status === 'conditional' ? 'border-blue-500/50 bg-blue-500/5' :
          'border-red-500/50 bg-red-500/5'
        }`}>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-2">حکم نهایی</h3>
            <p className="text-muted-foreground mb-4">{result.verdict.summary}</p>
            {result.verdict.recommendations?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">توصیه‌ها:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {result.verdict.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default AnalysisDetail;
