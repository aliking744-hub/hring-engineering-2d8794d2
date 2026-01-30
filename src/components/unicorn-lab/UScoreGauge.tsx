import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";

interface UScoreGaugeProps {
  score: number;
}

const UScoreGauge = ({ score }: UScoreGaugeProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 500);
    return () => clearTimeout(timer);
  }, [score]);

  const getScoreColor = () => {
    if (score >= 90) return { 
      main: '#10b981', 
      bg: 'glass-card',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      label: 'یونیکورن بالقوه',
      icon: Sparkles
    };
    if (score >= 50) return { 
      main: '#f59e0b', 
      bg: 'glass-card',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      label: 'نیازمند توسعه',
      icon: TrendingUp
    };
    return { 
      main: '#ef4444', 
      bg: 'glass-card',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: 'رد شده',
      icon: AlertCircle
    };
  };

  const config = getScoreColor();
  const Icon = config.icon;

  // SVG Arc calculation
  const radius = 85;
  const circumference = radius * Math.PI; // Half circle
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className={`${config.bg} ${config.border} rounded-2xl p-6`}>
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">امتیاز یونیکورن</h3>
        <p className="text-sm text-muted-foreground">U-Score</p>
      </div>

      {/* Gauge */}
      <div className="relative flex justify-center">
        <svg viewBox="0 0 200 120" className="w-full max-w-[250px]">
          {/* Background Arc */}
          <path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="16"
            strokeLinecap="round"
          />
          
          {/* Colored Arc */}
          <motion.path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke={config.main}
            strokeWidth="16"
            strokeLinecap="round"
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />

          {/* Score Text */}
          <text
            x="100"
            y="85"
            textAnchor="middle"
            className="text-5xl font-bold"
            fill={config.main}
          >
            <motion.tspan
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {animatedScore}
            </motion.tspan>
          </text>

          {/* Min/Max Labels */}
          <text x="15" y="115" textAnchor="start" className="text-xs" fill="hsl(var(--muted-foreground))">0</text>
          <text x="185" y="115" textAnchor="end" className="text-xs" fill="hsl(var(--muted-foreground))">100</text>
        </svg>
      </div>

      {/* Status Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className={`mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-full ${config.text} bg-secondary/50`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-semibold">{config.label}</span>
      </motion.div>

      {/* Score Ranges Legend */}
      <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-red-500/10 rounded-lg">
          <div className="font-bold text-red-400">&lt; 50</div>
          <div className="text-red-400/70">رد</div>
        </div>
        <div className="text-center p-2 bg-amber-500/10 rounded-lg">
          <div className="font-bold text-amber-400">50-89</div>
          <div className="text-amber-400/70">مشروط</div>
        </div>
        <div className="text-center p-2 bg-emerald-500/10 rounded-lg">
          <div className="font-bold text-emerald-400">90+</div>
          <div className="text-emerald-400/70">یونیکورن</div>
        </div>
      </div>
    </div>
  );
};

export default UScoreGauge;
