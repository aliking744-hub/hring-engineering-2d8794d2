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
          bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50',
          borderColor: 'border-emerald-200',
          textColor: 'text-emerald-800',
          badge: 'تایید شده'
        };
      case 'approved':
        return {
          icon: CheckCircle2,
          title: 'تایید سرمایه‌گذاری',
          color: 'from-blue-500 to-cyan-500',
          bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          badge: 'تایید شده'
        };
      case 'conditional':
        return {
          icon: AlertCircle,
          title: 'تایید مشروط',
          color: 'from-amber-500 to-orange-500',
          bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-800',
          badge: 'نیازمند بازنگری'
        };
      case 'rejected':
      default:
        return {
          icon: XCircle,
          title: 'رد درخواست',
          color: 'from-red-500 to-rose-500',
          bgColor: 'bg-gradient-to-br from-red-50 to-rose-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
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
      className={`${config.bgColor} border-2 ${config.borderColor} rounded-2xl p-6 shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}>
            <Gavel className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">حکم نهایی</h3>
            <p className="text-sm text-slate-500">The Verdict</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${config.color} text-white`}>
          <Icon className="w-5 h-5" />
          <span className="font-semibold">{config.badge}</span>
        </div>
      </div>

      {/* Summary */}
      <div className={`p-5 bg-white/60 rounded-xl border ${config.borderColor} mb-6`}>
        <p className={`text-lg leading-relaxed ${config.textColor}`}>
          {verdict.summary}
        </p>
      </div>

      {/* Recommendations */}
      {verdict.recommendations.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 mb-3">پیشنهادات:</h4>
          <div className="space-y-2">
            {verdict.recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center gap-3 p-3 bg-white/50 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-sm text-slate-700">{rec}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VerdictSection;
