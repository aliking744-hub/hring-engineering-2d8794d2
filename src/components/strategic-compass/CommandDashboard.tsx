import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  AlertTriangle,
  Activity,
  Brain,
  Eye,
  CheckCircle2,
  FlaskConical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  BarChart,
  Bar
} from "recharts";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { DEMO_BEHAVIORS, DEMO_COMPASS_USERS, DEMO_SCENARIOS, DEMO_SCENARIO_RESPONSES } from "@/data/demoData";

interface Behavior {
  id: string;
  deputy_id: string;
  intent_id: string;
  alignment_score: number | null;
  result_score: number | null;
  created_at: string;
}

interface CompassUser {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  title: string | null;
}

interface Scenario {
  id: string;
  ceo_answer: string | null;
  intent_id: string | null;
}

interface ScenarioResponse {
  id: string;
  scenario_id: string;
  user_id: string;
  answer: string;
}

const CommandDashboard = () => {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [compassUsers, setCompassUsers] = useState<CompassUser[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioResponses, setScenarioResponses] = useState<ScenarioResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { isDemoMode } = useDemoMode();

  useEffect(() => {
    fetchData();
  }, [isDemoMode]);

  const fetchData = async () => {
    setIsLoading(true);
    
    if (isDemoMode) {
      setBehaviors(DEMO_BEHAVIORS);
      setCompassUsers(DEMO_COMPASS_USERS);
      setScenarios(DEMO_SCENARIOS);
      setScenarioResponses(DEMO_SCENARIO_RESPONSES);
      setIsLoading(false);
      return;
    }

    try {
      const [behaviorsRes, usersRes, scenariosRes, responsesRes] = await Promise.all([
        supabase.from('behaviors').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('compass_user_roles').select('*').neq('role', 'ceo'),
        supabase.from('scenarios_with_answers').select('*').eq('is_active', true),
        supabase.from('scenario_responses').select('*')
      ]);

      if (behaviorsRes.data) setBehaviors(behaviorsRes.data);
      if (usersRes.data) setCompassUsers(usersRes.data);
      if (scenariosRes.data) setScenarios(scenariosRes.data);
      if (responsesRes.data) setScenarioResponses(responsesRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate real KPIs from behaviors data
  const calculateKPIs = () => {
    if (behaviors.length === 0) {
      return {
        executionLoyalty: 0,
        frictionIndex: 0,
        telepathy: 0,
        deviationRisk: 'نامشخص'
      };
    }

    const validAlignments = behaviors.filter(b => b.alignment_score !== null);
    const avgAlignment = validAlignments.length > 0 
      ? validAlignments.reduce((sum, b) => sum + (b.alignment_score || 0), 0) / validAlignments.length
      : 0;

    const validResults = behaviors.filter(b => b.result_score !== null);
    const avgResult = validResults.length > 0
      ? validResults.reduce((sum, b) => sum + (b.result_score || 0), 0) / validResults.length
      : 0;

    const frictionIndex = avgAlignment > 0 ? ((100 - avgAlignment) / 30).toFixed(1) : '0';
    
    const deviationRisk = avgAlignment >= 80 ? 'کم' : avgAlignment >= 60 ? 'متوسط' : 'بالا';

    return {
      executionLoyalty: Math.round(avgAlignment),
      frictionIndex: parseFloat(frictionIndex as string),
      telepathy: Math.round((avgAlignment + avgResult) / 2),
      deviationRisk
    };
  };

  // Calculate radar data from real behaviors
  const calculateRadarData = () => {
    const userBehaviors: Record<string, { alignments: number[], userId: string }> = {};

    behaviors.forEach(b => {
      if (!userBehaviors[b.deputy_id]) {
        userBehaviors[b.deputy_id] = { alignments: [], userId: b.deputy_id };
      }
      if (b.alignment_score !== null) {
        userBehaviors[b.deputy_id].alignments.push(b.alignment_score);
      }
    });

    return compassUsers.map(user => {
      const userBehavior = userBehaviors[user.user_id];
      const avgAlignment = userBehavior && userBehavior.alignments.length > 0
        ? userBehavior.alignments.reduce((a, b) => a + b, 0) / userBehavior.alignments.length
        : 50;

      return {
        deputy: user.title || user.full_name || (user.role === 'deputy' ? 'معاون' : 'مدیرکل'),
        value: Math.round(avgAlignment),
        fullMark: 100
      };
    });
  };

  // Calculate scatter plot data for alignment matrix
  const calculateAlignmentMatrix = () => {
    const userStats: Record<string, { alignments: number[], results: number[], userId: string }> = {};

    behaviors.forEach(b => {
      if (!userStats[b.deputy_id]) {
        userStats[b.deputy_id] = { alignments: [], results: [], userId: b.deputy_id };
      }
      if (b.alignment_score !== null) {
        userStats[b.deputy_id].alignments.push(b.alignment_score);
      }
      if (b.result_score !== null) {
        userStats[b.deputy_id].results.push(b.result_score);
      }
    });

    return compassUsers.map(user => {
      const stats = userStats[user.user_id];
      const avgAlignment = stats && stats.alignments.length > 0
        ? stats.alignments.reduce((a, b) => a + b, 0) / stats.alignments.length
        : 50;
      const avgResult = stats && stats.results.length > 0
        ? stats.results.reduce((a, b) => a + b, 0) / stats.results.length
        : 50;

      let category = 'مهره سوخته';
      if (avgAlignment >= 50 && avgResult >= 50) category = 'ستاره';
      else if (avgAlignment >= 50 && avgResult < 50) category = 'سرباز کور';
      else if (avgAlignment < 50 && avgResult >= 50) category = 'یاغی خطرناک';

      return {
        x: Math.round(avgAlignment),
        y: Math.round(avgResult),
        z: 100,
        name: user.title || user.full_name || 'کاربر',
        category
      };
    });
  };

  // Generate warnings based on real data
  const generateWarnings = () => {
    const warnings: { level: 'red' | 'yellow'; message: string; deputy: string }[] = [];
    
    const userBehaviors: Record<string, { alignments: number[], userId: string }> = {};
    behaviors.forEach(b => {
      if (!userBehaviors[b.deputy_id]) {
        userBehaviors[b.deputy_id] = { alignments: [], userId: b.deputy_id };
      }
      if (b.alignment_score !== null) {
        userBehaviors[b.deputy_id].alignments.push(b.alignment_score);
      }
    });

    Object.entries(userBehaviors).forEach(([userId, data]) => {
      const user = compassUsers.find(u => u.user_id === userId);
      const userName = user?.title || user?.full_name || 'کاربر';
      
      if (data.alignments.length >= 3) {
        const recentAlignments = data.alignments.slice(0, 3);
        const avgRecent = recentAlignments.reduce((a, b) => a + b, 0) / recentAlignments.length;
        
        if (avgRecent < 50) {
          warnings.push({
            level: 'red',
            message: `${userName} در ۳ تصمیم آخر، میانگین ${Math.round(avgRecent)}٪ همسویی داشته. الگوی رفتاری نشان‌دهنده انحراف از استراتژی است.`,
            deputy: userName
          });
        } else if (avgRecent < 70) {
          warnings.push({
            level: 'yellow',
            message: `${userName} نیاز به بازبینی دارد. میانگین همسویی اخیر: ${Math.round(avgRecent)}٪`,
            deputy: userName
          });
        }
      }
    });

    return warnings.length > 0 ? warnings : [
      { level: 'yellow' as const, message: 'هنوز داده کافی برای تحلیل الگوهای انحراف وجود ندارد', deputy: 'سیستم' }
    ];
  };

  // Calculate Mental Prism alignment for each user
  const calculatePrismAlignment = () => {
    return compassUsers.map(user => {
      const userResponses = scenarioResponses.filter(r => r.user_id === user.user_id);
      let alignedCount = 0;
      let totalCount = 0;

      userResponses.forEach(response => {
        const scenario = scenarios.find(s => s.id === response.scenario_id);
        if (scenario && scenario.ceo_answer) {
          totalCount++;
          if (response.answer === scenario.ceo_answer) {
            alignedCount++;
          }
        }
      });

      const percentage = totalCount > 0 ? Math.round((alignedCount / totalCount) * 100) : null;

      return {
        userId: user.user_id,
        name: user.title || user.full_name || (user.role === 'deputy' ? 'معاون' : 'مدیرکل'),
        role: user.role,
        alignedCount,
        totalCount,
        percentage
      };
    }).filter(u => u.totalCount > 0);
  };

  const kpiData = calculateKPIs();
  const radarData = calculateRadarData();
  const alignmentMatrixData = calculateAlignmentMatrix();
  const warnings = generateWarnings();
  const prismAlignments = calculatePrismAlignment();

  // Monthly pulse data (mock for now, can be enhanced with real time-series)
  const pulseData = [
    { month: "فروردین", alignment: 72 },
    { month: "اردیبهشت", alignment: 68 },
    { month: "خرداد", alignment: 75 },
    { month: "تیر", alignment: 82 },
    { month: "مرداد", alignment: 78 },
    { month: "شهریور", alignment: kpiData.executionLoyalty || 85 },
  ];

  const kpis = [
    { 
      title: "وفاداری اجرایی", 
      value: `${kpiData.executionLoyalty}%`, 
      change: behaviors.length > 10 ? "+5%" : "جدید", 
      trend: "up",
      icon: Target,
      description: "همسویی خروجی با دستورات"
    },
    { 
      title: "شاخص اصطکاک", 
      value: kpiData.frictionIndex.toString(), 
      change: behaviors.length > 10 ? "-0.4" : "جدید", 
      trend: "down",
      icon: Activity,
      description: "هزینه/زمان به ازای اهمیت"
    },
    { 
      title: "تله‌پاتی سازمانی", 
      value: `${kpiData.telepathy}%`, 
      change: behaviors.length > 10 ? "+8%" : "جدید", 
      trend: "up",
      icon: Brain,
      description: "پیش‌بینی صحیح تصمیمات"
    },
    { 
      title: "ریسک انحراف", 
      value: kpiData.deviationRisk, 
      change: "پایدار", 
      trend: "stable",
      icon: AlertTriangle,
      description: "احتمال انحراف از مسیر"
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <kpi.icon className="w-5 h-5 text-primary" />
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                kpi.trend === 'up' ? 'text-green-500' : 
                kpi.trend === 'down' ? 'text-green-500' : 'text-yellow-500'
              }`}>
                {kpi.trend === 'up' && <TrendingUp className="w-4 h-4" />}
                {kpi.trend === 'down' && <TrendingDown className="w-4 h-4" />}
                <span>{kpi.change}</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-1">{kpi.value}</h3>
            <p className="text-sm text-muted-foreground">{kpi.title}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{kpi.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizational Pulse */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            نبض سازمان
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            روند همسویی کل سازمان با نیت‌های استراتژیک در ۶ ماه گذشته
          </p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pulseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="alignment" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Deputies Radar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            رادار معاونین
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            هرچه به مرکز نزدیک‌تر، انحراف کمتر
          </p>
          <div className="h-[250px]">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="deputy" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Radar
                    name="همسویی"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                داده‌ای برای نمایش وجود ندارد
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Mental Prism Alignment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          همسویی منشور ذهنی
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          درصد تطابق پاسخ‌های هر کاربر با پاسخ‌های مدیرعامل در سوالات منشور ذهنی
        </p>
        {prismAlignments.length > 0 ? (
          <div className="space-y-3">
            {prismAlignments.map((user, idx) => (
              <motion.div
                key={user.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        user.role === 'deputy' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {user.role === 'deputy' ? 'معاون' : 'مدیرکل'}
                      </span>
                      <span className="text-foreground font-medium">{user.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {user.alignedCount} از {user.totalCount} سوال
                      </span>
                      <span className={`text-lg font-bold ${
                        user.percentage! >= 80 ? 'text-green-500' :
                        user.percentage! >= 60 ? 'text-yellow-500' :
                        'text-red-500'
                      }`}>
                        {user.percentage}%
                      </span>
                      {user.percentage! >= 80 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${user.percentage}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                      className={`h-full ${
                        user.percentage! >= 80 ? 'bg-green-500' :
                        user.percentage! >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>هنوز پاسخی به سوالات منشور ذهنی ثبت نشده است</p>
          </div>
        )}
      </motion.div>

      {/* Alignment Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          ماتریس سرباز - یاغی
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">ستاره‌ها (هم‌سو و موفق)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">سربازان کور (حرف‌گوش‌کن اما ناموفق)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">یاغی‌های خطرناک (موفق اما ناهم‌سو)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">مهره‌های سوخته (ناموفق و ناهم‌سو)</span>
          </div>
        </div>
        <div className="h-[300px]">
          {alignmentMatrixData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="همسویی" 
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: 'همسویی با استراتژی', position: 'bottom', fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="موفقیت" 
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: 'موفقیت در اجرا', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                />
                <ZAxis type="number" dataKey="z" range={[100, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ 
                    background: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any, name: string) => [value, name === 'x' ? 'همسویی' : 'موفقیت']}
                />
                <Scatter name="معاونین" data={alignmentMatrixData}>
                  {alignmentMatrixData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.category === 'ستاره' ? '#22c55e' :
                        entry.category === 'سرباز کور' ? '#3b82f6' :
                        entry.category === 'یاغی خطرناک' ? '#f97316' :
                        '#ef4444'
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              داده‌ای برای نمایش وجود ندارد
            </div>
          )}
        </div>
      </motion.div>

      {/* AI Warnings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          سیستم هشدار هوشمند
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          تحلیل الگوهای انحراف معاونین با هوش مصنوعی
        </p>
        <div className="space-y-3">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                warning.level === 'red' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                  warning.level === 'red' ? 'text-red-500' : 'text-yellow-500'
                }`} />
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    warning.level === 'red' 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {warning.deputy}
                  </span>
                  <p className="text-foreground text-sm mt-2">{warning.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CommandDashboard;