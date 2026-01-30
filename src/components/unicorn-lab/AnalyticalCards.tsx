import { useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Shield, 
  Cpu, 
  Globe,
  ChevronLeft,
  Flame,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnalysisResult } from "@/pages/UnicornLab";
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer 
} from "recharts";

interface AnalyticalCardsProps {
  result: AnalysisResult;
}

const AnalyticalCards = ({ result }: AnalyticalCardsProps) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const cards = [
    {
      id: 'financial',
      title: 'سلامت مالی',
      subtitle: 'Financial Health',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'glass-card',
      borderColor: 'border-emerald-500/30',
      grade: result.financialHealth.healthGrade,
      quickStats: [
        { label: 'حاشیه سود ناخالص', value: `${result.financialHealth.grossMargin}%` },
        { label: 'نرخ سوختن', value: `${(result.financialHealth.burnRate / 1000000).toFixed(1)}M` },
      ]
    },
    {
      id: 'founder',
      title: 'استقامت بنیان‌گذار',
      subtitle: 'Founder Grit',
      icon: Shield,
      color: 'from-violet-500 to-purple-500',
      bgColor: 'glass-card',
      borderColor: 'border-accent/30',
      score: result.founderGrit.overallScore,
      quickStats: [
        { label: 'تاب‌آوری', value: `${result.founderGrit.resilience}%` },
        { label: 'تجربه', value: `${result.founderGrit.experience}%` },
      ]
    },
    {
      id: 'tech',
      title: 'بقای فناوری',
      subtitle: 'Tech Viability',
      icon: Cpu,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'glass-card',
      borderColor: 'border-primary/30',
      badge: result.techViability.aiProof ? 'AI-Proof' : 'High Risk',
      badgeColor: result.techViability.aiProof ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
      quickStats: [
        { label: 'امتیاز فنی', value: `${result.techViability.score}%` },
        { label: 'سطح ریسک', value: result.techViability.riskLevel === 'low' ? 'پایین' : result.techViability.riskLevel === 'medium' ? 'متوسط' : 'بالا' },
      ]
    },
    {
      id: 'national',
      title: 'سودمندی ملی',
      subtitle: 'National Utility',
      icon: Globe,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'glass-card',
      borderColor: 'border-amber-500/30',
      checkmarks: [
        { label: 'حاکمیت داده', checked: result.nationalUtility.dataSovereignty },
        { label: 'آماده صادرات', checked: result.nationalUtility.exportReady },
      ],
      quickStats: [
        { label: 'تاثیر محلی', value: `${result.nationalUtility.localImpact}%` },
        { label: 'اشتغال‌زایی', value: `${result.nationalUtility.jobCreation}` },
      ]
    }
  ];

  const radarData = [
    { subject: 'تاب‌آوری', A: result.founderGrit.resilience },
    { subject: 'تجربه', A: result.founderGrit.experience },
    { subject: 'انطباق‌پذیری', A: result.founderGrit.adaptability },
    { subject: 'شبکه ارتباطی', A: result.founderGrit.networkStrength },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className={`${card.bgColor} ${card.borderColor} rounded-2xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-shadow`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {card.grade && (
                  <div className={`text-2xl font-bold ${
                    card.grade === 'A' ? 'text-emerald-400' :
                    card.grade === 'B' ? 'text-primary' :
                    card.grade === 'C' ? 'text-amber-400' :
                    'text-destructive'
                  }`}>
                    {card.grade}
                  </div>
                )}
                {card.score !== undefined && (
                  <div className="text-2xl font-bold text-accent">
                    {card.score}%
                  </div>
                )}
                {card.badge && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${card.badgeColor}`}>
                    {card.badge}
                  </span>
                )}
              </div>

              <h4 className="font-bold text-foreground mb-1">{card.title}</h4>
              <p className="text-xs text-muted-foreground mb-4">{card.subtitle}</p>

              {/* Quick Stats */}
              <div className="space-y-2 mb-4">
                {card.quickStats.map((stat, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className="font-semibold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Checkmarks for National Utility */}
              {card.checkmarks && (
                <div className="space-y-2 mb-4">
                  {card.checkmarks.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        item.checked ? 'bg-emerald-500' : 'bg-secondary'
                      }`}>
                        {item.checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={item.checked ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                onClick={() => setActiveModal(card.id)}
              >
                جزئیات بیشتر
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Financial Details Modal */}
      <Dialog open={activeModal === 'financial'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              تحلیل سلامت مالی
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 mb-1">حاشیه سود ناخالص</p>
                <p className="text-2xl font-bold text-slate-800">{result.financialHealth.grossMargin}%</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 mb-1">نرخ سوختن ماهانه</p>
                <p className="text-2xl font-bold text-slate-800">{(result.financialHealth.burnRate / 1000000).toFixed(1)}M</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 mb-1">عمر مالی</p>
                <p className="text-2xl font-bold text-slate-800">{result.financialHealth.runway} ماه</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 mb-1">درجه سلامت</p>
                <p className={`text-2xl font-bold ${
                  result.financialHealth.healthGrade === 'A' ? 'text-emerald-600' :
                  result.financialHealth.healthGrade === 'B' ? 'text-blue-600' :
                  'text-amber-600'
                }`}>{result.financialHealth.healthGrade}</p>
              </div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-amber-800">هشدار</span>
              </div>
              <p className="text-sm text-amber-700">
                نرخ سوختن بالا نسبت به درآمد فعلی. توصیه: کاهش هزینه‌های عملیاتی یا افزایش درآمد.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Founder Grit Modal */}
      <Dialog open={activeModal === 'founder'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-600" />
              تحلیل استقامت بنیان‌گذار
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <Radar
                    name="امتیاز"
                    dataKey="A"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-violet-50 rounded-xl text-center">
                <p className="text-xs text-violet-600 mb-1">تاب‌آوری</p>
                <p className="text-xl font-bold text-violet-800">{result.founderGrit.resilience}%</p>
              </div>
              <div className="p-3 bg-violet-50 rounded-xl text-center">
                <p className="text-xs text-violet-600 mb-1">تجربه</p>
                <p className="text-xl font-bold text-violet-800">{result.founderGrit.experience}%</p>
              </div>
              <div className="p-3 bg-violet-50 rounded-xl text-center">
                <p className="text-xs text-violet-600 mb-1">انطباق‌پذیری</p>
                <p className="text-xl font-bold text-violet-800">{result.founderGrit.adaptability}%</p>
              </div>
              <div className="p-3 bg-violet-50 rounded-xl text-center">
                <p className="text-xs text-violet-600 mb-1">شبکه ارتباطی</p>
                <p className="text-xl font-bold text-violet-800">{result.founderGrit.networkStrength}%</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tech Viability Modal */}
      <Dialog open={activeModal === 'tech'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              تحلیل بقای فناوری
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={`p-4 rounded-xl ${
              result.techViability.aiProof 
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{result.techViability.aiProof ? 'مقاوم در برابر AI' : 'در معرض خطر AI'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  result.techViability.aiProof 
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-red-200 text-red-800'
                }`}>
                  {result.techViability.aiProof ? 'AI-Proof' : 'At Risk'}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {result.techViability.aiProof 
                  ? 'فناوری این شرکت در برابر جایگزینی توسط هوش مصنوعی مقاوم است.'
                  : 'فناوری این شرکت ممکن است توسط راهکارهای AI جایگزین شود.'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-800">بینش‌های کلیدی:</p>
              {result.techViability.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-700">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* National Utility Modal */}
      <Dialog open={activeModal === 'national'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-600" />
              تحلیل سودمندی ملی
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl ${
                result.nationalUtility.dataSovereignty 
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    result.nationalUtility.dataSovereignty ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}>
                    {result.nationalUtility.dataSovereignty && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800">حاکمیت داده</span>
                </div>
                <p className="text-xs text-slate-500">
                  {result.nationalUtility.dataSovereignty 
                    ? 'داده‌ها در سرورهای داخلی ذخیره می‌شوند'
                    : 'وابستگی به سرورهای خارجی'}
                </p>
              </div>
              <div className={`p-4 rounded-xl ${
                result.nationalUtility.exportReady 
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    result.nationalUtility.exportReady ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}>
                    {result.nationalUtility.exportReady && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800">آماده صادرات</span>
                </div>
                <p className="text-xs text-slate-500">
                  {result.nationalUtility.exportReady 
                    ? 'قابلیت ارائه در بازارهای بین‌المللی'
                    : 'نیاز به بومی‌سازی برای صادرات'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-50 rounded-xl">
                <p className="text-sm text-orange-600 mb-1">تاثیر محلی</p>
                <p className="text-2xl font-bold text-orange-800">{result.nationalUtility.localImpact}%</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl">
                <p className="text-sm text-orange-600 mb-1">اشتغال‌زایی</p>
                <p className="text-2xl font-bold text-orange-800">{result.nationalUtility.jobCreation} نفر</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnalyticalCards;
