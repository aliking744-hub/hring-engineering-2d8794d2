import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Eye, 
  Brain, 
  Plus, 
  Send, 
  CheckCircle2,
  Users,
  Lightbulb,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Target,
  Edit2,
  Save,
  FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { DEMO_INTENTS, DEMO_SCENARIOS, DEMO_SCENARIO_RESPONSES, DEMO_COMPASS_USERS, DEMO_INTENT_ASSIGNMENTS } from "@/data/demoData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  tolerance_zone: number;
}

interface Scenario {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  category: string;
  ceo_answer: string | null;
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

interface CompassUser {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  title: string | null;
}

interface IntentAssignment {
  intent_id: string;
  user_id: string;
}

const MentalPrism = () => {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [compassUsers, setCompassUsers] = useState<CompassUser[]>([]);
  const [assignments, setAssignments] = useState<IntentAssignment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIntentId, setSelectedIntentId] = useState<string>("");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [ceoAnswers, setCeoAnswers] = useState<Record<number, string>>({});
  const [expandedIntents, setExpandedIntents] = useState<Record<string, boolean>>({});
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();

  useEffect(() => {
    fetchData();
  }, [isDemoMode]);

  const fetchData = async () => {
    setIsLoading(true);
    
    if (isDemoMode) {
      setIntents(DEMO_INTENTS as Intent[]);
      setScenarios(DEMO_SCENARIOS as Scenario[]);
      setResponses(DEMO_SCENARIO_RESPONSES as Response[]);
      setCompassUsers(DEMO_COMPASS_USERS as CompassUser[]);
      setAssignments(DEMO_INTENT_ASSIGNMENTS as IntentAssignment[]);
      setIsLoading(false);
      return;
    }

    try {
      const [intentsRes, scenariosRes, responsesRes, usersRes, assignmentsRes] = await Promise.all([
        supabase.from('strategic_intents').select('*').eq('status', 'active'),
        supabase.from('scenarios_with_answers').select('*').order('created_at', { ascending: false }),
        supabase.from('scenario_responses').select('*'),
        supabase.from('compass_user_roles').select('*').neq('role', 'ceo'),
        supabase.from('intent_assignments').select('*')
      ]);

      if (intentsRes.data) setIntents(intentsRes.data);
      if (scenariosRes.data) setScenarios(scenariosRes.data);
      if (responsesRes.data) setResponses(responsesRes.data);
      if (usersRes.data) setCompassUsers(usersRes.data);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedIntentId) {
      toast({
        title: "خطا",
        description: "لطفاً یک دستور استراتژیک انتخاب کنید",
        variant: "destructive",
      });
      return;
    }

    const selectedIntent = intents.find(i => i.id === selectedIntentId);
    if (!selectedIntent) return;

    setIsGenerating(true);
    setGeneratedQuestions([]);
    setCeoAnswers({});

    try {
      const response = await supabase.functions.invoke('generate-mental-prism', {
        body: {
          intentTitle: selectedIntent.title,
          intentDescription: selectedIntent.description,
          strategicWeight: selectedIntent.strategic_weight,
          toleranceZone: selectedIntent.tolerance_zone,
        }
      });

      if (response.error) throw response.error;

      const data = response.data;
      if (data.error) {
        toast({
          title: "خطا",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data.questions && data.questions.length > 0) {
        setGeneratedQuestions(data.questions);
        toast({
          title: "سوالات تولید شد",
          description: `${data.questions.length} سوال بر اساس دستور استراتژیک تولید شد`,
        });
      }
    } catch (err: any) {
      console.error('Error generating questions:', err);
      toast({
        title: "خطا",
        description: err.message || "مشکلی در تولید سوالات رخ داد",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveScenarios = async () => {
    if (!user || generatedQuestions.length === 0) return;

    // Check if CEO answered all questions
    const allAnswered = generatedQuestions.every((_, idx) => ceoAnswers[idx]);
    if (!allAnswered) {
      toast({
        title: "خطا",
        description: "لطفاً به همه سوالات پاسخ دهید",
        variant: "destructive",
      });
      return;
    }

    try {
      const scenariosToInsert = generatedQuestions.map((q, idx) => ({
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        category: 'ai_generated',
        ceo_answer: ceoAnswers[idx],
        ceo_id: user.id,
        intent_id: selectedIntentId,
        is_active: true,
      }));

      const { error } = await supabase
        .from('scenarios')
        .insert(scenariosToInsert);

      if (error) throw error;

      toast({
        title: "ذخیره شد",
        description: "سوالات ثبت شدند و برای معاونین ارسال شد",
      });

      setIsCreating(false);
      setGeneratedQuestions([]);
      setCeoAnswers({});
      setSelectedIntentId("");
      fetchData();
    } catch (err) {
      console.error('Error saving scenarios:', err);
      toast({
        title: "خطا",
        description: "مشکلی در ذخیره سوالات رخ داد",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCeoAnswer = async (scenarioId: string, newAnswer: string) => {
    try {
      const { error } = await supabase
        .from('scenarios')
        .update({ ceo_answer: newAnswer })
        .eq('id', scenarioId);

      if (error) throw error;

      toast({
        title: "بروزرسانی شد",
        description: "پاسخ شما ویرایش شد",
      });

      setEditingScenarioId(null);
      fetchData();
    } catch (err) {
      console.error('Error updating answer:', err);
      toast({
        title: "خطا",
        description: "مشکلی در ویرایش رخ داد",
        variant: "destructive",
      });
    }
  };

  const toggleIntentExpand = (intentId: string) => {
    setExpandedIntents(prev => ({
      ...prev,
      [intentId]: !prev[intentId]
    }));
  };

  const getAlignmentStats = (scenarioId: string, ceoAnswer: string | null) => {
    if (!ceoAnswer) return { aligned: 0, total: 0, percentage: 0 };
    
    const scenarioResponses = responses.filter(r => r.scenario_id === scenarioId);
    const aligned = scenarioResponses.filter(r => r.answer === ceoAnswer).length;
    const total = scenarioResponses.length;
    const percentage = total > 0 ? Math.round((aligned / total) * 100) : 0;
    
    return { aligned, total, percentage };
  };

  const getIntentScenarios = (intentId: string) => {
    return scenarios.filter(s => s.intent_id === intentId && s.is_active);
  };

  const getIntentOverallAlignment = (intentId: string) => {
    const intentScenarios = getIntentScenarios(intentId);
    if (intentScenarios.length === 0) return 0;

    const totalPercentage = intentScenarios.reduce((sum, s) => {
      const stats = getAlignmentStats(s.id, s.ceo_answer);
      return sum + stats.percentage;
    }, 0);

    return Math.round(totalPercentage / intentScenarios.length);
  };

  const getAssignedUsersForIntent = (intentId: string) => {
    const intentAssignments = assignments.filter(a => a.intent_id === intentId);
    return compassUsers.filter(u => intentAssignments.some(a => a.user_id === u.user_id));
  };

  // Group scenarios by intent
  const scenariosByIntent = intents.map(intent => ({
    intent,
    scenarios: getIntentScenarios(intent.id),
    overallAlignment: getIntentOverallAlignment(intent.id),
    assignedUsers: getAssignedUsersForIntent(intent.id)
  })).filter(group => group.scenarios.length > 0);

  // Scenarios without intent
  const orphanScenarios = scenarios.filter(s => !s.intent_id && s.is_active);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Brain className="w-8 h-8 text-primary animate-pulse" />
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
            تست قضاوت موقعیتی و تحلیل شکاف ادراکی
          </p>
        </div>
        {!isCreating && (
          <Button 
            onClick={() => setIsCreating(true)}
            className="glow-button text-foreground"
          >
            <Plus className="w-4 h-4 ml-2" />
            سناریوی جدید با AI
          </Button>
        )}
      </div>

      {/* Create Scenario with AI */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              تولید سناریو با هوش مصنوعی
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              یک دستور استراتژیک انتخاب کنید تا سوالات مرتبط به صورت خودکار تولید شوند.
            </p>

            <div className="space-y-6">
              {/* Intent Selection */}
              <div>
                <Label>انتخاب دستور استراتژیک</Label>
                <Select
                  value={selectedIntentId}
                  onValueChange={setSelectedIntentId}
                >
                  <SelectTrigger className="mt-2 bg-secondary/50 border-border">
                    <SelectValue placeholder="یک دستور انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    {intents.map(intent => (
                      <SelectItem key={intent.id} value={intent.id}>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          {intent.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              {!generatedQuestions.length && (
                <Button 
                  onClick={handleGenerateQuestions}
                  disabled={!selectedIntentId || isGenerating}
                  className="glow-button text-foreground"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      در حال تولید سوالات...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 ml-2" />
                      آماده‌سازی منشور ذهنی
                    </>
                  )}
                </Button>
              )}

              {/* Generated Questions */}
              {generatedQuestions.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    سوالات تولید شده - لطفاً پاسخ خود را انتخاب کنید
                  </h4>
                  
                  {generatedQuestions.map((q, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 rounded-xl bg-secondary/30 border border-border"
                    >
                      <p className="text-foreground mb-4 font-medium">
                        {idx + 1}. {q.question}
                      </p>
                      <RadioGroup
                        value={ceoAnswers[idx] || ""}
                        onValueChange={(value) => setCeoAnswers(prev => ({ ...prev, [idx]: value }))}
                        className="space-y-2"
                      >
                        <div className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          ceoAnswers[idx] === 'a' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'
                        }`}>
                          <RadioGroupItem value="a" id={`q${idx}_a`} />
                          <Label htmlFor={`q${idx}_a`} className="flex-1 cursor-pointer">
                            <span className="text-primary font-bold">الف)</span> {q.option_a}
                          </Label>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          ceoAnswers[idx] === 'b' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'
                        }`}>
                          <RadioGroupItem value="b" id={`q${idx}_b`} />
                          <Label htmlFor={`q${idx}_b`} className="flex-1 cursor-pointer">
                            <span className="text-primary font-bold">ب)</span> {q.option_b}
                          </Label>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          ceoAnswers[idx] === 'c' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'
                        }`}>
                          <RadioGroupItem value="c" id={`q${idx}_c`} />
                          <Label htmlFor={`q${idx}_c`} className="flex-1 cursor-pointer">
                            <span className="text-primary font-bold">ج)</span> {q.option_c}
                          </Label>
                        </div>
                      </RadioGroup>
                    </motion.div>
                  ))}

                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={handleSaveScenarios} className="glow-button text-foreground">
                      <Send className="w-4 h-4 ml-2" />
                      ذخیره و ارسال برای معاونین
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreating(false);
                        setGeneratedQuestions([]);
                        setCeoAnswers({});
                        setSelectedIntentId("");
                      }}
                      className="border-border"
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scenarios Grouped by Intent */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          سناریوها بر اساس دستورات استراتژیک
        </h3>

        {scenariosByIntent.map(({ intent, scenarios: intentScenarios, overallAlignment, assignedUsers }) => (
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
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{intent.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {intentScenarios.length} سوال • {assignedUsers.length} نفر اساین شده
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        overallAlignment >= 75 ? 'bg-green-500/20 text-green-500' :
                        overallAlignment >= 50 ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {overallAlignment}% همسویی
                      </div>
                      {expandedIntents[intent.id] ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-border p-4 space-y-4">
                  {/* Assigned Users */}
                  {assignedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-sm text-muted-foreground">افراد مسئول:</span>
                      {assignedUsers.map(u => (
                        <span 
                          key={u.id}
                          className="px-2 py-1 rounded-full text-xs bg-primary/20 text-primary"
                        >
                          {u.full_name || u.title || 'کاربر'}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Questions */}
                  {intentScenarios.map((scenario, idx) => {
                    const stats = getAlignmentStats(scenario.id, scenario.ceo_answer);
                    const isEditing = editingScenarioId === scenario.id;

                    return (
                      <div key={scenario.id} className="p-4 rounded-xl bg-secondary/20">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-foreground font-medium">
                            {idx + 1}. {scenario.question}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              stats.percentage >= 75 ? 'text-green-500' :
                              stats.percentage >= 50 ? 'text-yellow-500' :
                              'text-red-500'
                            }`}>
                              {stats.total > 0 ? `${stats.percentage}%` : 'بدون پاسخ'}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingScenarioId(scenario.id);
                                setEditingAnswer(scenario.ceo_answer || "");
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {['a', 'b', 'c'].map((opt) => {
                            const optionKey = `option_${opt}` as keyof Scenario;
                            const isCorrect = scenario.ceo_answer === opt;
                            const isEditingThis = isEditing && editingAnswer === opt;

                            return (
                              <div
                                key={opt}
                                onClick={() => isEditing && setEditingAnswer(opt)}
                                className={`p-3 rounded-lg border transition-colors ${
                                  isEditing ? 'cursor-pointer hover:bg-secondary/50' : ''
                                } ${
                                  isCorrect ? 'border-primary bg-primary/10' : 
                                  isEditingThis ? 'border-yellow-500 bg-yellow-500/10' :
                                  'border-border/50'
                                }`}
                              >
                                <span className="text-xs text-muted-foreground">
                                  {opt === 'a' ? 'الف' : opt === 'b' ? 'ب' : 'ج'})
                                </span>
                                <p className="text-sm text-foreground mt-1">
                                  {scenario[optionKey] as string}
                                </p>
                                {isCorrect && (
                                  <CheckCircle2 className="w-4 h-4 text-primary mt-2" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {isEditing && (
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateCeoAnswer(scenario.id, editingAnswer)}
                              className="glow-button"
                            >
                              <Save className="w-4 h-4 ml-1" />
                              ذخیره
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingScenarioId(null)}
                            >
                              انصراف
                            </Button>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-muted-foreground">
                          {stats.total} نفر پاسخ داده • {stats.aligned} نفر همسو
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </motion.div>
          </Collapsible>
        ))}

        {/* Orphan Scenarios (without intent) */}
        {orphanScenarios.length > 0 && (
          <div className="glass-card p-4">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              سایر سناریوها
            </h4>
            <div className="space-y-3">
              {orphanScenarios.map(scenario => {
                const stats = getAlignmentStats(scenario.id, scenario.ceo_answer);
                return (
                  <div key={scenario.id} className="p-3 rounded-lg bg-secondary/20">
                    <div className="flex items-center justify-between">
                      <p className="text-foreground text-sm">{scenario.question}</p>
                      <span className={`text-sm font-medium ${
                        stats.percentage >= 75 ? 'text-green-500' :
                        stats.percentage >= 50 ? 'text-yellow-500' :
                        'text-red-500'
                      }`}>
                        {stats.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {scenariosByIntent.length === 0 && orphanScenarios.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">هنوز سناریویی تعریف نشده</h3>
            <p className="text-muted-foreground text-sm mb-4">
              با کمک هوش مصنوعی، سوالات سنجش همسویی تولید کنید
            </p>
            <Button onClick={() => setIsCreating(true)} className="glow-button text-foreground">
              <Sparkles className="w-4 h-4 ml-2" />
              ایجاد سناریو با AI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentalPrism;