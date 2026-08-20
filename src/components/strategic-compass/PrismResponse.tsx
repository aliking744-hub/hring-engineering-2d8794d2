import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Eye, 
  Brain, 
  CheckCircle2,
  Target,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Intent {
  id: string;
  title: string;
  description: string;
  strategic_weight: number;
}

interface Scenario {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  has_ceo_answer: boolean | null;
  is_active: boolean;
  intent_id: string | null;
  created_at: string;
}

interface Response {
  id: string;
  scenario_id: string;
  user_id: string;
  answer: string;
}

interface IntentAssignment {
  intent_id: string;
  user_id: string;
}

interface PrismResponseProps {
  canEdit?: boolean;
}

const PrismResponse = ({ canEdit = true }: PrismResponseProps) => {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [myResponses, setMyResponses] = useState<Response[]>([]);
  const [myAssignments, setMyAssignments] = useState<IntentAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});
  const [expandedIntents, setExpandedIntents] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      const [intentsRes, scenariosRes, responsesRes, assignmentsRes] = await Promise.all([
        supabase.from('strategic_intents').select('*').eq('status', 'active'),
        supabase.from('scenarios').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('scenario_responses').select('*').eq('user_id', user.id),
        supabase.from('intent_assignments').select('*').eq('user_id', user.id)
      ]);

      if (intentsRes.data) setIntents(intentsRes.data);
      if (scenariosRes.data) setScenarios(scenariosRes.data);
      if (responsesRes.data) setMyResponses(responsesRes.data);
      if (assignmentsRes.data) setMyAssignments(assignmentsRes.data);
      
      // Auto-expand first intent
      if (assignmentsRes.data && assignmentsRes.data.length > 0) {
        setExpandedIntents({ [assignmentsRes.data[0].intent_id]: true });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (scenarioId: string, answer: string) => {
    if (!user) return;

    setSubmitting(scenarioId);
    try {
      // Check if already answered
      const existingResponse = myResponses.find(r => r.scenario_id === scenarioId);
      
      if (existingResponse) {
        // Update existing response
        const { error } = await supabase
          .from('scenario_responses')
          .update({ answer })
          .eq('id', existingResponse.id);

        if (error) throw error;
      } else {
        // Insert new response
        const { error } = await supabase
          .from('scenario_responses')
          .insert({
            scenario_id: scenarioId,
            user_id: user.id,
            answer
          });

        if (error) throw error;
      }

      toast({
        title: "پاسخ ثبت شد",
        description: "پاسخ شما با موفقیت ذخیره شد",
      });

      // Clear pending answer
      setPendingAnswers(prev => {
        const copy = { ...prev };
        delete copy[scenarioId];
        return copy;
      });

      fetchData();
    } catch (err) {
      console.error('Error submitting answer:', err);
      toast({
        title: "خطا",
        description: "مشکلی در ثبت پاسخ رخ داد",
        variant: "destructive",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const toggleIntentExpand = (intentId: string) => {
    setExpandedIntents(prev => ({
      ...prev,
      [intentId]: !prev[intentId]
    }));
  };

  const getMyAssignedIntentIds = () => {
    return myAssignments.map(a => a.intent_id);
  };

  const getIntentScenarios = (intentId: string) => {
    return scenarios.filter(s => s.intent_id === intentId && s.is_active && s.has_ceo_answer);
  };

  const getMyResponse = (scenarioId: string) => {
    return myResponses.find(r => r.scenario_id === scenarioId);
  };

  const isAnswered = (scenarioId: string) => {
    return !!getMyResponse(scenarioId);
  };

  const getIntentProgress = (intentId: string) => {
    const intentScenarios = getIntentScenarios(intentId);
    const answered = intentScenarios.filter(s => isAnswered(s.id)).length;
    return {
      answered,
      total: intentScenarios.length,
      percentage: intentScenarios.length > 0 ? Math.round((answered / intentScenarios.length) * 100) : 0
    };
  };

  // Filter intents to only show assigned ones with scenarios
  const assignedIntentIds = getMyAssignedIntentIds();
  const assignedIntentsWithScenarios = intents
    .filter(intent => assignedIntentIds.includes(intent.id))
    .map(intent => ({
      intent,
      scenarios: getIntentScenarios(intent.id),
      progress: getIntentProgress(intent.id)
    }))
    .filter(group => group.scenarios.length > 0);

  const totalPending = assignedIntentsWithScenarios.reduce((sum, group) => {
    return sum + (group.progress.total - group.progress.answered);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Brain className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (assignedIntentsWithScenarios.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Eye className="w-6 h-6 text-primary" />
            منشور ذهنی (Mental Prism)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            پاسخ به سوالات تست قضاوت موقعیتی
          </p>
        </div>

        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            سوالی برای پاسخ‌دهی وجود ندارد
          </h3>
          <p className="text-muted-foreground">
            در حال حاضر سوالی برای دستورات استراتژیک شما تعریف نشده است.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Eye className="w-6 h-6 text-primary" />
            منشور ذهنی (Mental Prism)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            پاسخ به سوالات تست قضاوت موقعیتی
          </p>
        </div>
        
        {totalPending > 0 && (
          <div className="glass-card px-4 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-foreground">
              {totalPending} سوال در انتظار پاسخ
            </span>
          </div>
        )}
      </div>

      {/* Intent Groups */}
      <div className="space-y-4">
        {assignedIntentsWithScenarios.map(({ intent, scenarios: intentScenarios, progress }) => (
          <Collapsible
            key={intent.id}
            open={expandedIntents[intent.id]}
            onOpenChange={() => toggleIntentExpand(intent.id)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden"
            >
              <CollapsibleTrigger asChild>
                <div className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{intent.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {progress.answered} از {progress.total} سوال پاسخ داده شده
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Progress Bar */}
                      <div className="w-24 h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            progress.percentage === 100 ? 'bg-green-500' : 'bg-primary'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      
                      {progress.percentage === 100 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        expandedIntents[intent.id] ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="border-t border-border p-4 space-y-4">
                  {intentScenarios.map((scenario, idx) => {
                    const myResponse = getMyResponse(scenario.id);
                    const answered = !!myResponse;
                    const currentAnswer = pendingAnswers[scenario.id] || myResponse?.answer || "";
                    
                    return (
                      <motion.div
                        key={scenario.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-4 rounded-xl border transition-colors ${
                          answered 
                            ? 'bg-green-500/5 border-green-500/20' 
                            : 'bg-secondary/20 border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <p className="text-foreground font-medium flex-1">
                            {idx + 1}. {scenario.question}
                          </p>
                          {answered && (
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mr-2" />
                          )}
                        </div>
                        
                        <RadioGroup
                          value={currentAnswer}
                          onValueChange={(value) => {
                            if (canEdit) {
                              setPendingAnswers(prev => ({ ...prev, [scenario.id]: value }));
                            }
                          }}
                          className="space-y-2"
                          disabled={!canEdit}
                        >
                          {[
                            { key: 'a', label: 'الف', value: scenario.option_a },
                            { key: 'b', label: 'ب', value: scenario.option_b },
                            { key: 'c', label: 'ج', value: scenario.option_c },
                          ].map((option) => (
                            <div 
                              key={option.key}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                !canEdit ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                              } ${
                                currentAnswer === option.key 
                                  ? 'border-primary bg-primary/10' 
                                  : 'border-border hover:bg-secondary/50'
                              }`}
                            >
                              <RadioGroupItem value={option.key} id={`${scenario.id}_${option.key}`} disabled={!canEdit} />
                              <Label htmlFor={`${scenario.id}_${option.key}`} className={`flex-1 ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                                <span className="text-primary font-bold">{option.label})</span> {option.value}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        
                        {/* Submit Button */}
                        {canEdit && (pendingAnswers[scenario.id] || !answered) && currentAnswer && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <Button
                              onClick={() => handleSubmitAnswer(scenario.id, currentAnswer)}
                              disabled={submitting === scenario.id}
                              className="glow-button text-foreground"
                              size="sm"
                            >
                              {submitting === scenario.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                  در حال ثبت...
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4 ml-2" />
                                  {answered ? 'بروزرسانی پاسخ' : 'ثبت پاسخ'}
                                </>
                              )}
                            </Button>
                          </motion.div>
                        )}
                        {!canEdit && (
                          <div className="mt-4 text-center">
                            <span className="text-xs text-amber-400">حالت فقط مشاهده</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </motion.div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
};

export default PrismResponse;
