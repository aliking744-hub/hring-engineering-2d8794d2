import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Zap, TrendingDown, DollarSign, Users, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from "recharts";

interface CrisisSimulatorProps {
  baseRunway: number; // in months
  burnRate: number; // monthly burn in millions
  onCritical: (isCritical: boolean) => void;
}

const CrisisSimulator = ({ baseRunway, burnRate, onCritical }: CrisisSimulatorProps) => {
  const [exchangeShock, setExchangeShock] = useState(0);
  const [churnRate, setChurnRate] = useState(0);
  const [costIncrease, setCostIncrease] = useState(0);

  // Calculate adjusted runway based on stress factors
  const stressedRunway = useMemo(() => {
    // Exchange shock increases costs (imports, subscriptions, etc.)
    const exchangeImpact = 1 + (exchangeShock / 100) * 0.4; // 40% of costs are forex-sensitive
    
    // Churn reduces revenue
    const revenueMultiplier = 1 - (churnRate / 100);
    
    // Direct cost increase
    const costMultiplier = 1 + (costIncrease / 100);
    
    // Adjusted burn rate
    const adjustedBurn = burnRate * exchangeImpact * costMultiplier / revenueMultiplier;
    
    // Original cash = baseRunway * burnRate
    const cash = baseRunway * burnRate;
    
    return Math.max(0, Math.round(cash / adjustedBurn));
  }, [baseRunway, burnRate, exchangeShock, churnRate, costIncrease]);

  // Generate chart data for 24 months
  const chartData = useMemo(() => {
    const data = [];
    const originalCash = baseRunway * burnRate;
    
    for (let month = 0; month <= 24; month++) {
      // Base scenario
      const baseRemaining = Math.max(0, originalCash - (burnRate * month));
      
      // Stressed scenario
      const exchangeImpact = 1 + (exchangeShock / 100) * 0.4;
      const revenueMultiplier = 1 - (churnRate / 100);
      const costMultiplier = 1 + (costIncrease / 100);
      const stressedBurn = burnRate * exchangeImpact * costMultiplier / revenueMultiplier;
      const stressedRemaining = Math.max(0, originalCash - (stressedBurn * month));
      
      data.push({
        month: `ماه ${month}`,
        monthNum: month,
        base: Math.round(baseRemaining / 1000000), // Convert to millions
        stressed: Math.round(stressedRemaining / 1000000),
      });
    }
    
    return data;
  }, [baseRunway, burnRate, exchangeShock, churnRate, costIncrease]);

  useEffect(() => {
    onCritical(stressedRunway <= 0);
  }, [stressedRunway, onCritical]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-slate-800 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'base' ? 'سناریو پایه' : 'سناریو بحران'}: {entry.value} میلیون تومان
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">شبیه‌ساز بحران</h3>
          <p className="text-sm text-slate-500">Crisis Simulator</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Exchange Rate Shock */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">شوک نرخ ارز</span>
            </div>
            <span className="text-sm font-bold text-blue-600">+{exchangeShock}%</span>
          </div>
          <Slider
            value={[exchangeShock]}
            onValueChange={(v) => setExchangeShock(v[0])}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-slate-400">افزایش هزینه‌های ارزی</p>
        </div>

        {/* User Churn */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-slate-700">نرخ ریزش کاربر</span>
            </div>
            <span className="text-sm font-bold text-purple-600">{churnRate}%</span>
          </div>
          <Slider
            value={[churnRate]}
            onValueChange={(v) => setChurnRate(v[0])}
            max={50}
            step={2}
            className="w-full"
          />
          <p className="text-xs text-slate-400">کاهش درآمد ماهانه</p>
        </div>

        {/* Cost Increase */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-slate-700">افزایش هزینه عملیاتی</span>
            </div>
            <span className="text-sm font-bold text-red-600">+{costIncrease}%</span>
          </div>
          <Slider
            value={[costIncrease]}
            onValueChange={(v) => setCostIncrease(v[0])}
            max={50}
            step={2}
            className="w-full"
          />
          <p className="text-xs text-slate-400">هزینه‌های جاری</p>
        </div>
      </div>

      {/* Runway Indicator */}
      <div className={`p-4 rounded-xl mb-6 ${
        stressedRunway <= 0 
          ? 'bg-red-50 border-2 border-red-300' 
          : stressedRunway <= 6 
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-emerald-50 border border-emerald-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {stressedRunway <= 0 && <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />}
            <div>
              <p className="text-sm text-slate-600">عمر مالی تحت بحران</p>
              <p className="text-xs text-slate-400">Stressed Runway</p>
            </div>
          </div>
          <div className="text-left">
            <motion.p
              key={stressedRunway}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-3xl font-bold ${
                stressedRunway <= 0 
                  ? 'text-red-600' 
                  : stressedRunway <= 6 
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}
            >
              {stressedRunway}
            </motion.p>
            <p className="text-sm text-slate-500">ماه</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(value, index) => index % 4 === 0 ? value : ''}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(value) => `${value}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
            <Area
              type="monotone"
              dataKey="base"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              strokeWidth={2}
              name="base"
            />
            <Line
              type="monotone"
              dataKey="stressed"
              stroke="#ef4444"
              strokeWidth={3}
              dot={false}
              name="stressed"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-slate-600">سناریو پایه</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-slate-600">سناریو بحران</span>
        </div>
      </div>
    </div>
  );
};

export default CrisisSimulator;
