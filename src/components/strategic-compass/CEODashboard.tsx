import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Users,
  Target,
  Eye,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Languages,
  FlaskConical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { DEMO_INTENTS, DEMO_BEHAVIORS, DEMO_SCENARIOS, DEMO_SCENARIO_RESPONSES, DEMO_COMPASS_USERS } from "@/data/demoData";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Legend
} from "recharts";

interface Intent {
  id: string;
  title: string;
  strategic_weight: number;
  status: string;
}

interface Behavior {
  id: string;
  deputy_id: string;
  intent_id: string;
  alignment_score: number | null;
  result_score: number | null;
  created_at: string;
}

interface Scenario {
  id: string;
  ceo_answer: string | null;
  intent_id: string | null;
  created_at: string;
}

interface ScenarioResponse {
  id: string;
  scenario_id: string;
  user_id: string;
  answer: string;
  created_at: string;
}

interface CompassUser {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  title: string | null;
}

const CEODashboard = () => {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [responses, setResponses] = useState<ScenarioResponse[]>([]);
  const [compassUsers, setCompassUsers] = useState<CompassUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI Analysis States
  const [smartWarningAnalysis, setSmartWarningAnalysis] = useState<string>("");
  const [translationRiskAnalysis, setTranslationRiskAnalysis] = useState<string>("");
  const [isAnalyzingWarning, setIsAnalyzingWarning] = useState(false);
  const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);

  const { isDemoMode } = useDemoMode();

  useEffect(() => {
    fetchData();
  }, [isDemoMode]);

  const fetchData = async () => {
    setIsLoading(true);
    
    if (isDemoMode) {
      setIntents(DEMO_INTENTS as Intent[]);
      setBehaviors(DEMO_BEHAVIORS as Behavior[]);
      setScenarios(DEMO_SCENARIOS as Scenario[]);
      setResponses(DEMO_SCENARIO_RESPONSES as ScenarioResponse[]);
      setCompassUsers(DEMO_COMPASS_USERS as CompassUser[]);
      setIsLoading(false);
      return;
    }

    try {
      const [intentsRes, behaviorsRes, scenariosRes, responsesRes, usersRes] = await Promise.all([
        supabase.from('strategic_intents').select('*').eq('status', 'active'),
        supabase.from('behaviors').select('*').order('created_at', { ascending: false }),
        supabase.from('scenarios_with_answers').select('*').eq('is_active', true),
        supabase.from('scenario_responses').select('*'),
        supabase.from('compass_user_roles').select('*').neq('role', 'ceo')
      ]);

      if (intentsRes.data) setIntents(intentsRes.data);
      if (behaviorsRes.data) setBehaviors(behaviorsRes.data);
      if (scenariosRes.data) setScenarios(scenariosRes.data);
      if (responsesRes.data) setResponses(responsesRes.data);
      if (usersRes.data) setCompassUsers(usersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // AI Analysis Functions
  const analyzeSmartWarning = async () => {
    setIsAnalyzingWarning(true);
    try {
      const stats = calculateStats();
      const userComparison = calculateUserComparison();
      const alignmentByIntent = calculateAlignmentByIntent();
      
      const lowPerformers = userComparison.filter(u => u.alignment < 60);
      const criticalIntents = alignmentByIntent.filter(i => i.alignment < 50);
      
      const prompt = `به عنوان یک تحلیلگر سازمانی، بر اساس داده‌های زیر از سیستم منشور ذهنی سازمان، هشدارهای هوشمند ارائه بده:

وضعیت کلی:
- همسویی کل سازمان: ${stats.overallAlignment}%
- تعداد پاسخ‌ها: ${stats.totalResponses}
- کاربران فعال: ${stats.uniqueRespondents} از ${stats.totalUsers}

کاربران با همسویی پایین:
${lowPerformers.map(u => `- ${u.name}: ${u.alignment}%`).join('\n') || 'هیچ‌کدام'}

دستورات استراتژیک بحرانی:
${criticalIntents.map(i => `- ${i.fullName}: ${i.alignment}%`).join('\n') || 'هیچ‌کدام'}

لطفاً:
1. مهم‌ترین هشدارها را فهرست کن
2. علل احتمالی را تحلیل کن
3. اقدامات پیشنهادی فوری ارائه بده

پاسخ را به صورت خلاصه و کاربردی بنویس.`;

      const response = await supabase.functions.invoke('generate-mental-prism', {
        body: { prompt }
      });

      if (response.error) throw response.error;
      setSmartWarningAnalysis(response.data.analysis || response.data.text || "تحلیل انجام شد.");
      toast.success("تحلیل هشدار هوشمند انجام شد");
    } catch (error: any) {
      console.error('Error analyzing:', error);
      toast.error("خطا در تحلیل: " + (error.message || "لطفاً دوباره تلاش کنید"));
    } finally {
      setIsAnalyzingWarning(false);
    }
  };

  const analyzeTranslationRisk = async () => {
    setIsAnalyzingRisk(true);
    try {
      const alignmentByIntent = calculateAlignmentByIntent();
      const userComparison = calculateUserComparison();
      
      const prompt = `به عنوان متخصص استراتژی سازمانی، ریسک‌های "ترجمه استراتژی" را تحلیل کن.

ترجمه استراتژی یعنی چگونه نیت‌های مدیرعامل توسط معاونین و مدیران درک و اجرا می‌شود.

داده‌های همسویی بر اساس دستورات استراتژیک:
${alignmentByIntent.map(i => `- ${i.fullName}: ${i.alignment}% همسویی (${i.responses} پاسخ)`).join('\n') || 'داده‌ای موجود نیست'}

همسویی کاربران:
${userComparison.map(u => `- ${u.name} (${u.role === 'deputy' ? 'معاون' : 'مدیرکل'}): ${u.alignment}%`).join('\n') || 'داده‌ای موجود نیست'}

لطفاً:
1. ریسک‌های ترجمه استراتژی را شناسایی کن
2. کدام دستورات بیشترین سوءتفاهم را دارند؟
3. تفاوت درک بین معاونین و مدیران را تحلیل کن
4. پیشنهادات عملی برای کاهش ریسک ترجمه ارائه بده

پاسخ را مختصر و کاربردی بنویس.`;

      const response = await supabase.functions.invoke('generate-mental-prism', {
        body: { prompt }
      });

      if (response.error) throw response.error;
      setTranslationRiskAnalysis(response.data.analysis || response.data.text || "تحلیل انجام شد.");
      toast.success("تحلیل ریسک ترجمه انجام شد");
    } catch (error: any) {
      console.error('Error analyzing:', error);
      toast.error("خطا در تحلیل: " + (error.message || "لطفاً دوباره تلاش کنید"));
    } finally {
      setIsAnalyzingRisk(false);
    }
  };

  // Calculate overall statistics
  const calculateStats = () => {
    const totalScenarios = scenarios.filter(s => s.ceo_answer).length;
    const totalResponses = responses.length;
    const uniqueRespondents = new Set(responses.map(r => r.user_id)).size;
    
    let alignedResponses = 0;
    responses.forEach(response => {
      const scenario = scenarios.find(s => s.id === response.scenario_id);
      if (scenario && scenario.ceo_answer === response.answer) {
        alignedResponses++;
      }
    });
    
    const overallAlignment = totalResponses > 0 ? Math.round((alignedResponses / totalResponses) * 100) : 0;
    
    return {
      totalScenarios,
      totalResponses,
      uniqueRespondents,
      totalUsers: compassUsers.length,
      overallAlignment,
      alignedResponses
    };
  };

  // Alignment by Intent
  const calculateAlignmentByIntent = () => {
    return intents.map(intent => {
      const intentScenarios = scenarios.filter(s => s.intent_id === intent.id && s.ceo_answer);
      const scenarioIds = intentScenarios.map(s => s.id);
      const intentResponses = responses.filter(r => scenarioIds.includes(r.scenario_id));
      
      let aligned = 0;
      intentResponses.forEach(response => {
        const scenario = scenarios.find(s => s.id === response.scenario_id);
        if (scenario && scenario.ceo_answer === response.answer) {
          aligned++;
        }
      });
      
      const percentage = intentResponses.length > 0 ? Math.round((aligned / intentResponses.length) * 100) : 0;
      
      return {
        name: intent.title.length > 15 ? intent.title.substring(0, 15) + '...' : intent.title,
        fullName: intent.title,
        alignment: percentage,
        responses: intentResponses.length,
        weight: intent.strategic_weight
      };
    }).filter(i => i.responses > 0);
  };

  // User alignment comparison
  const calculateUserComparison = () => {
    return compassUsers.map(user => {
      const userResponses = responses.filter(r => r.user_id === user.user_id);
      let aligned = 0;
      
      userResponses.forEach(response => {
        const scenario = scenarios.find(s => s.id === response.scenario_id);
        if (scenario && scenario.ceo_answer === response.answer) {
          aligned++;
        }
      });
      
      const percentage = userResponses.length > 0 ? Math.round((aligned / userResponses.length) * 100) : 0;
      
      return {
        name: user.title || user.full_name || (user.role === 'deputy' ? 'معاون' : 'مدیرکل'),
        role: user.role,
        alignment: percentage,
        responses: userResponses.length,
        fill: user.role === 'deputy' ? 'hsl(var(--primary))' : 'hsl(var(--accent))'
      };
    }).filter(u => u.responses > 0).sort((a, b) => b.alignment - a.alignment);
  };

  // Response trend over time (mock monthly data)
  const calculateResponseTrend = () => {
    const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'];
    const stats = calculateStats();
    
    // Generate realistic trend data
    const baseAlignment = stats.overallAlignment || 60;
    return months.map((month, idx) => ({
      month,
      alignment: Math.max(40, Math.min(100, baseAlignment - 20 + (idx * 5) + Math.floor(Math.random() * 10))),
      responses: Math.max(5, Math.floor(stats.totalResponses / 6) + Math.floor(Math.random() * 10))
    }));
  };

  // Role distribution pie chart
  const calculateRoleDistribution = () => {
    const deputies = compassUsers.filter(u => u.role === 'deputy').length;
    const managers = compassUsers.filter(u => u.role === 'manager').length;
    
    return [
      { name: 'معاونین', value: deputies, fill: '#3b82f6' },
      { name: 'مدیران کل', value: managers, fill: '#8b5cf6' }
    ].filter(r => r.value > 0);
  };

  // Response rate by user
  const calculateResponseRate = () => {
    const scenariosWithCeoAnswer = scenarios.filter(s => s.ceo_answer).length;
    
    return compassUsers.map(user => {
      const userResponses = responses.filter(r => r.user_id === user.user_id);
      const respondedScenarios = new Set(userResponses.map(r => r.scenario_id)).size;
      const rate = scenariosWithCeoAnswer > 0 ? Math.round((respondedScenarios / scenariosWithCeoAnswer) * 100) : 0;
      
      return {
        name: user.title || user.full_name || (user.role === 'deputy' ? 'معاون' : 'مدیرکل'),
        rate,
        fill: rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444'
      };
    }).sort((a, b) => b.rate - a.rate);
  };

  const stats = calculateStats();
  const alignmentByIntent = calculateAlignmentByIntent();
  const userComparison = calculateUserComparison();
  const responseTrend = calculateResponseTrend();
  const roleDistribution = calculateRoleDistribution();
  const responseRates = calculateResponseRate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          داشبورد مدیرعامل
        </h2>
        <p className="text-muted-foreground mt-2">تحلیل جامع همسویی سازمان با نیت‌های استراتژیک</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { title: 'دستورات فعال', value: intents.length, icon: Target, color: 'text-blue-500' },
          { title: 'سوالات منشور', value: stats.totalScenarios, icon: Eye, color: 'text-purple-500' },
          { title: 'پاسخ‌های ثبت شده', value: stats.totalResponses, icon: CheckCircle2, color: 'text-green-500' },
          { title: 'کاربران فعال', value: `${stats.uniqueRespondents}/${stats.totalUsers}`, icon: Users, color: 'text-orange-500' },
          { title: 'همسویی کل', value: `${stats.overallAlignment}%`, icon: Brain, color: stats.overallAlignment >= 70 ? 'text-green-500' : 'text-yellow-500' },
          { title: 'پاسخ‌های همسو', value: stats.alignedResponses, icon: Zap, color: 'text-cyan-500' },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-card p-4 text-center"
          >
            <kpi.icon className={`w-6 h-6 mx-auto mb-2 ${kpi.color}`} />
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.title}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alignment Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            روند همسویی سازمان
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={responseTrend}>
                <defs>
                  <linearGradient id="colorAlignment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === 'alignment' ? 'همسویی' : 'پاسخ‌ها'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="alignment" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorAlignment)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Alignment by Intent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            همسویی بر اساس دستورات استراتژیک
          </h3>
          {alignmentByIntent.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={alignmentByIntent} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'همسویی']}
                  />
                  <Bar dataKey="alignment" radius={[0, 4, 4, 0]}>
                    {alignmentByIntent.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={entry.alignment >= 80 ? '#22c55e' : entry.alignment >= 60 ? '#f59e0b' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground">
              داده‌ای برای نمایش وجود ندارد
            </div>
          )}
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 lg:col-span-2"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            مقایسه همسویی کاربران
          </h3>
          {userComparison.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={userComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name === 'alignment' ? 'همسویی' : name
                    ]}
                  />
                  <Bar dataKey="alignment" radius={[4, 4, 0, 0]}>
                    {userComparison.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={entry.alignment >= 80 ? '#22c55e' : entry.alignment >= 60 ? '#f59e0b' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              داده‌ای برای نمایش وجود ندارد
            </div>
          )}
        </motion.div>

        {/* Role Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            توزیع نقش‌ها
          </h3>
          {roleDistribution.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {roleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              کاربری تعریف نشده
            </div>
          )}
        </motion.div>
      </div>

      {/* Response Rate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          نرخ پاسخ‌دهی کاربران
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          درصد سوالات منشور ذهنی که هر کاربر به آن پاسخ داده است
        </p>
        {responseRates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responseRates.map((user, idx) => (
              <motion.div
                key={user.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-xl bg-secondary/30 border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground font-medium">{user.name}</span>
                  <span className="text-lg font-bold" style={{ color: user.fill }}>{user.rate}%</span>
                </div>
                <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-500"
                    style={{ width: `${user.rate}%`, backgroundColor: user.fill }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>هنوز پاسخی ثبت نشده است</p>
          </div>
        )}
      </motion.div>

      {/* Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          تحلیل هوشمند
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Overall Status */}
          <div className={`p-4 rounded-xl border ${
            stats.overallAlignment >= 70 
              ? 'bg-green-500/10 border-green-500/30' 
              : stats.overallAlignment >= 50 
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {stats.overallAlignment >= 70 ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${stats.overallAlignment >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
              )}
              <span className="font-medium text-foreground">وضعیت کلی</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {stats.overallAlignment >= 70 
                ? 'همسویی سازمان در سطح مطلوب است. تیم به خوبی با نیت‌های استراتژیک هماهنگ است.'
                : stats.overallAlignment >= 50 
                  ? 'همسویی سازمان نیاز به بهبود دارد. پیشنهاد می‌شود جلسات هم‌اندیشی برگزار شود.'
                  : 'همسویی سازمان در وضعیت بحرانی است. اقدام فوری برای شفاف‌سازی استراتژی لازم است.'
              }
            </p>
          </div>

          {/* Participation */}
          <div className={`p-4 rounded-xl border ${
            stats.uniqueRespondents >= stats.totalUsers * 0.8 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">مشارکت</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {stats.uniqueRespondents >= stats.totalUsers * 0.8 
                ? `${stats.uniqueRespondents} نفر از ${stats.totalUsers} کاربر در منشور ذهنی شرکت کرده‌اند.`
                : `فقط ${stats.uniqueRespondents} نفر از ${stats.totalUsers} کاربر پاسخ داده‌اند. پیگیری لازم است.`
              }
            </p>
          </div>

          {/* Best Performers */}
          {userComparison.length > 0 && (
            <div className="p-4 rounded-xl border bg-primary/10 border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">بهترین عملکرد</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {userComparison[0]?.name || 'نامشخص'} با {userComparison[0]?.alignment || 0}% همسویی بالاترین عملکرد را دارد.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* AI Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Warning System */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              سیستم هشدار هوشمند
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeSmartWarning}
              disabled={isAnalyzingWarning}
              className="flex items-center gap-2"
            >
              {isAnalyzingWarning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              تحلیل جدید
            </Button>
          </div>
          
          <div className="min-h-[200px] p-4 rounded-xl bg-secondary/20 border border-border">
            {smartWarningAnalysis ? (
              <div className="prose prose-sm prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                {smartWarningAnalysis}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                <ShieldAlert className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">برای دریافت هشدارهای هوشمند، روی دکمه "تحلیل جدید" کلیک کنید</p>
                <p className="text-xs mt-1 text-muted-foreground/70">این تحلیل با هوش مصنوعی انجام می‌شود</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Translation Risk Warning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Languages className="w-5 h-5 text-purple-500" />
              هشدار ریسک ترجمه
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeTranslationRisk}
              disabled={isAnalyzingRisk}
              className="flex items-center gap-2"
            >
              {isAnalyzingRisk ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              تحلیل جدید
            </Button>
          </div>
          
          <div className="min-h-[200px] p-4 rounded-xl bg-secondary/20 border border-border">
            {translationRiskAnalysis ? (
              <div className="prose prose-sm prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                {translationRiskAnalysis}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                <Languages className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">برای تحلیل ریسک ترجمه استراتژی، روی دکمه "تحلیل جدید" کلیک کنید</p>
                <p className="text-xs mt-1 text-muted-foreground/70">این تحلیل با هوش مصنوعی انجام می‌شود</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CEODashboard;
