import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  Link2, 
  Linkedin, 
  FileText,
  Upload,
  Users,
  DollarSign,
  TrendingUp,
  Flame,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StartupProfile } from "@/pages/UnicornLab";

interface UnicornInputWizardProps {
  onSubmit: (data: StartupProfile) => void;
}

const UnicornInputWizard = ({ onSubmit }: UnicornInputWizardProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<StartupProfile>>({
    companyName: '',
    companyUrl: '',
    linkedinUrl: '',
    foundersBio: '',
    currentValuation: 0,
    monthlyActiveUsers: 0,
    burnRate: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = [
    { id: 1, title: 'هویت شرکت', subtitle: 'Identity', icon: Building2 },
    { id: 2, title: 'مستندات', subtitle: 'Evidence', icon: FileText },
    { id: 3, title: 'ادعاها', subtitle: 'Claims', icon: TrendingUp },
  ];

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!formData.companyName?.trim()) {
        newErrors.companyName = 'نام شرکت الزامی است';
      }
      if (!formData.companyUrl?.trim()) {
        newErrors.companyUrl = 'آدرس وب‌سایت الزامی است';
      }
    }

    if (stepNum === 3) {
      if (!formData.currentValuation || formData.currentValuation <= 0) {
        newErrors.currentValuation = 'ارزش‌گذاری الزامی است';
      }
      if (!formData.burnRate || formData.burnRate <= 0) {
        newErrors.burnRate = 'نرخ سوختن الزامی است';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 3) {
        setStep(step + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (validateStep(3)) {
      onSubmit(formData as StartupProfile);
    }
  };

  const updateField = (field: keyof StartupProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-full text-primary text-sm font-medium mb-4">
          <Building2 className="w-4 h-4" />
          آزمایشگاه یونیکورن
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          اتاق دریافت اطلاعات دیجیتال
        </h1>
        <p className="text-muted-foreground">
          اطلاعات شرکت خود را برای ارزیابی جامع وارد کنید
        </p>
      </motion.div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          
          return (
            <div key={s.id} className="flex items-center">
              <motion.div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors ${
                  isCompleted ? 'bg-primary text-primary-foreground' : 
                  isActive ? 'bg-primary/80 text-primary-foreground' : 
                  'bg-secondary text-muted-foreground'
                }`}
                animate={{ scale: isActive ? 1.1 : 1 }}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </motion.div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-1 mx-2 rounded-full transition-colors ${
                  step > s.id ? 'bg-primary' : 'bg-secondary'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-6 sm:p-8"
      >
        <AnimatePresence mode="wait">
          {/* Step 1: Identity */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">هویت شرکت</h2>
                  <p className="text-sm text-muted-foreground">Identity</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-foreground">نام شرکت *</Label>
                  <div className="relative mt-1">
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={formData.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      placeholder="مثال: تالیا موبایل"
                      className={`pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground ${errors.companyName ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.companyName && (
                    <p className="text-destructive text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.companyName}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-foreground">آدرس وب‌سایت *</Label>
                  <div className="relative mt-1">
                    <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={formData.companyUrl}
                      onChange={(e) => updateField('companyUrl', e.target.value)}
                      placeholder="https://example.com"
                      className={`pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground ${errors.companyUrl ? 'border-destructive' : ''}`}
                      dir="ltr"
                    />
                  </div>
                  {errors.companyUrl && (
                    <p className="text-destructive text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.companyUrl}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-foreground">لینکدین شرکت</Label>
                  <div className="relative mt-1">
                    <Linkedin className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={formData.linkedinUrl}
                      onChange={(e) => updateField('linkedinUrl', e.target.value)}
                      placeholder="https://linkedin.com/company/..."
                      className="pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-foreground">بیوگرافی بنیان‌گذاران</Label>
                  <Textarea
                    value={formData.foundersBio}
                    onChange={(e) => updateField('foundersBio', e.target.value)}
                    placeholder="سوابق، تجربیات و دستاوردهای بنیان‌گذاران را شرح دهید..."
                    className="mt-1 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground min-h-[100px]"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Evidence */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">بارگذاری مستندات</h2>
                  <p className="text-sm text-muted-foreground">Evidence Upload</p>
                </div>
              </div>

              <div className="grid gap-4">
                {/* Pitch Deck Upload */}
                <div className="border-2 border-dashed border-border rounded-xl p-6 hover:border-primary transition-colors cursor-pointer bg-secondary/30">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Pitch Deck (PDF)</p>
                      <p className="text-sm text-muted-foreground">فایل ارائه شرکت را بکشید و رها کنید</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2">
                      انتخاب فایل
                    </Button>
                  </div>
                </div>

                {/* Financials Upload */}
                <div className="border-2 border-dashed border-border rounded-xl p-6 hover:border-primary transition-colors cursor-pointer bg-secondary/30">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">صورت‌های مالی 3 سال اخیر (Excel)</p>
                      <p className="text-sm text-muted-foreground">ترازنامه، سود و زیان، جریان نقدی</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2">
                      انتخاب فایل
                    </Button>
                  </div>
                </div>

                {/* Employees List Upload */}
                <div className="border-2 border-dashed border-border rounded-xl p-6 hover:border-primary transition-colors cursor-pointer bg-secondary/30">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">لیست کارکنان کلیدی</p>
                      <p className="text-sm text-muted-foreground">نام، سمت و سوابق افراد کلیدی</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2">
                      انتخاب فایل
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                این مرحله اختیاری است. می‌توانید بدون بارگذاری فایل ادامه دهید.
              </p>
            </motion.div>
          )}

          {/* Step 3: Claims */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">ادعاهای شرکت</h2>
                  <p className="text-sm text-muted-foreground">Claims & Metrics</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-foreground">ارزش‌گذاری فعلی (میلیون تومان) *</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={formData.currentValuation || ''}
                      onChange={(e) => updateField('currentValuation', Number(e.target.value))}
                      placeholder="مثال: 50000"
                      className={`pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground ${errors.currentValuation ? 'border-destructive' : ''}`}
                      dir="ltr"
                    />
                  </div>
                  {errors.currentValuation && (
                    <p className="text-destructive text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.currentValuation}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-foreground">کاربران فعال ماهانه (MAU)</Label>
                  <div className="relative mt-1">
                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={formData.monthlyActiveUsers || ''}
                      onChange={(e) => updateField('monthlyActiveUsers', Number(e.target.value))}
                      placeholder="مثال: 500000"
                      className="pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-foreground">نرخ سوختن ماهانه (میلیون تومان) *</Label>
                  <div className="relative mt-1">
                    <Flame className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={formData.burnRate || ''}
                      onChange={(e) => updateField('burnRate', Number(e.target.value))}
                      placeholder="مثال: 500"
                      className={`pr-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground ${errors.burnRate ? 'border-destructive' : ''}`}
                      dir="ltr"
                    />
                  </div>
                  {errors.burnRate && (
                    <p className="text-destructive text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.burnRate}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    هزینه‌های ماهانه منهای درآمدها
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4 ml-2" />
            قبلی
          </Button>
          <span className="text-sm text-muted-foreground">
            مرحله {step} از 3
          </span>
          <Button
            onClick={handleNext}
            className="bg-primary hover:bg-primary/90"
          >
            {step === 3 ? 'شروع تحلیل' : 'بعدی'}
            <ChevronLeft className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default UnicornInputWizard;
