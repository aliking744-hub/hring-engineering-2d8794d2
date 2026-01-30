import { motion } from "framer-motion";
import { 
  Gavel, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { AnalysisResult } from "@/pages/UnicornLab";

interface VerdictSectionProps {
  verdict: AnalysisResult['verdict'];
  companyName: string;
}

const VerdictSection = ({ verdict, companyName }: VerdictSectionProps) => {
  const getStatusConfig = () => {
    switch (verdict.status) {
      case 'unicorn':
        return {
          icon: Sparkles,
          title: 'پتانسیل یونیکورن',
          color: 'from-emerald-500 to-teal-500',
          bgColor: 'glass-card',
          borderColor: 'border-emerald-500/30',
          textColor: 'text-emerald-400',
          badge: 'تایید شده'
        };
      case 'approved':
        return {
          icon: CheckCircle2,
          title: 'تایید سرمایه‌گذاری',
          color: 'from-primary to-accent',
          bgColor: 'glass-card',
          borderColor: 'border-primary/30',
          textColor: 'text-primary',
          badge: 'تایید شده'
        };
      case 'conditional':
        return {
          icon: AlertCircle,
          title: 'تایید مشروط',
          color: 'from-amber-500 to-orange-500',
          bgColor: 'glass-card',
          borderColor: 'border-amber-500/30',
          textColor: 'text-amber-400',
          badge: 'نیازمند بازنگری'
        };
      case 'rejected':
      default:
        return {
          icon: XCircle,
          title: 'رد درخواست',
          color: 'from-red-500 to-rose-500',
          bgColor: 'glass-card',
          borderColor: 'border-destructive/30',
          textColor: 'text-destructive',
          badge: 'رد شده'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${config.bgColor} ${config.borderColor} rounded-2xl p-6`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}>
            <Gavel className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">حکم نهایی</h3>
            <p className="text-sm text-muted-foreground">The Verdict</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${config.color} text-white`}>
          <Icon className="w-5 h-5" />
          <span className="font-semibold">{config.badge}</span>
        </div>
      </div>

      {/* Summary */}
      <div className={`p-5 bg-secondary/30 rounded-xl border ${config.borderColor} mb-6`}>
        <p className={`text-lg leading-relaxed ${config.textColor}`}>
          {verdict.summary}
        </p>
      </div>

      {/* Recommendations */}
      {verdict.recommendations.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-3">پیشنهادات:</h4>
          <div className="space-y-2">
            {verdict.recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-foreground">{rec}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VerdictSection;
