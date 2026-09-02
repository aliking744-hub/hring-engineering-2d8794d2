import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calculator, Users, Clock, Gift, Building2, Briefcase, TrendingUp, Printer, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuroraBackground from '@/components/AuroraBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import logo from '@/assets/logo.png';
import { apiRequest } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// Format number with Persian separators
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('fa-IR').format(Math.round(num));
};

// Input component with Rial formatting
const RialInput = ({ 
  value, 
  onChange, 
  label, 
  placeholder = "۰",
  disabled = false
}: { 
  value: number; 
  onChange: (val: number) => void; 
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Remove all non-digit characters (including Persian digits formatting)
    const cleaned = rawValue.replace(/[^\d۰-۹]/g, '');
    // Convert Persian digits to English
    const englishDigits = cleaned.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    const numValue = parseInt(englishDigits) || 0;
    onChange(numValue);
  };

  // Display formatted value
  const displayValue = value ? formatNumber(value) : '';

  return (
    <div className="space-y-2">
      <Label className={`text-sm ${disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>{label}</Label>
      <div className="relative">
        <Input
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`text-left bg-secondary/50 border-border pl-16 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          dir="ltr"
          inputMode="numeric"
          disabled={disabled}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ریال
        </span>
      </div>
    </div>
  );
};

const NumberInput = ({ 
  value, 
  onChange, 
  label,
  suffix = ""
}: { 
  value: number; 
  onChange: (val: number) => void; 
  label: string;
  suffix?: string;
}) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="text-left bg-secondary/50 border-border pl-16"
          dir="ltr"
        />
        {suffix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

interface StatutoryRates {
  year: number;
  housing_allowance_rial: number;
  grocery_allowance_rial: number;
}

interface EmployeeCostResult {
  statutoryYear: number;
  effectiveBase: number;
  insurableGross: number;
  totalGross: number;
  overtimePay: number;
  variablePay: number;
  monthlyOccasionalBenefits: number;
  employerInsurance: number;
  employerIncomeTax: number;
  incomeTax: number;
  severanceAccrual: number;
  eidiAccrual: number;
  leaveRedemption: number;
  totalStatutory: number;
  totalWelfare: number;
  totalHiddenHR: number;
  totalMonthlyCost: number;
  netSalary: number;
  multiplier: number;
  isNetContract: boolean;
}

export default function CostCalculator() {
  const navigate = useNavigate();
  
  // Section 1: Contract
  const [isNetContract, setIsNetContract] = useState(false);
  const [baseSalary, setBaseSalary] = useState(0);
  const [jobAbsorption, setJobAbsorption] = useState(0);
  const [responsibilityAllowance, setResponsibilityAllowance] = useState(0);
  const [jobSuperlative, setJobSuperlative] = useState(0);
  const [statutoryYear, setStatutoryYear] = useState(1405);
  const [housingAllowance, setHousingAllowance] = useState(30000000);
  const [groceryAllowance, setGroceryAllowance] = useState(22000000);
  const [childrenAllowance, setChildrenAllowance] = useState(0);
  const [otherBenefits, setOtherBenefits] = useState(0);

  // Section 2: Variable Pay
  const [overtimeBaseHours, setOvertimeBaseHours] = useState(176);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [monthlyPerformance, setMonthlyPerformance] = useState(0);
  const [monthlyBonus, setMonthlyBonus] = useState(0);

  // Section 3: Annual & Welfare
  const [supplementaryInsurance, setSupplementaryInsurance] = useState(0);
  const [annualOccasionalBenefits, setAnnualOccasionalBenefits] = useState(0);

  // Section 4: Hidden HR Costs
  const [recruitmentCost, setRecruitmentCost] = useState(0);
  const [trainingCost, setTrainingCost] = useState(0);
  const [miscCost, setMiscCost] = useState(0);

  const [calculations, setCalculations] = useState<EmployeeCostResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rates = await apiRequest<StatutoryRates>('/costing/statutory-rates/current');
        setStatutoryYear(rates.year);
        setHousingAllowance(rates.housing_allowance_rial);
        setGroceryAllowance(rates.grocery_allowance_rial);
      } catch {
        toast({
          title: 'نرخ‌های قانونی دریافت نشد',
          description: 'مقادیر مصوب پیش‌فرض ۱۴۰۵ نمایش داده می‌شوند.',
          variant: 'destructive',
        });
      }
    })();
  }, []);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const result = await apiRequest<Record<string, any>>('/costing/calculate', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          is_net_contract: isNetContract,
          base_salary: baseSalary,
          job_absorption: jobAbsorption,
          responsibility_allowance: responsibilityAllowance,
          job_superlative: jobSuperlative,
          children_allowance: childrenAllowance,
          other_benefits: otherBenefits,
          overtime_base_hours: overtimeBaseHours,
          overtime_hours: overtimeHours,
          monthly_performance: monthlyPerformance,
          monthly_bonus: monthlyBonus,
          supplementary_insurance: supplementaryInsurance,
          annual_occasional_benefits: annualOccasionalBenefits,
          recruitment_cost: recruitmentCost,
          training_cost: trainingCost,
          misc_cost: miscCost,
        }),
      });
      setCalculations({
        statutoryYear: result.statutory_year,
        effectiveBase: result.effective_base,
        insurableGross: result.insurable_gross,
        totalGross: result.total_gross,
        overtimePay: result.overtime_pay,
        variablePay: result.variable_pay,
        monthlyOccasionalBenefits: result.monthly_occasional_benefits,
        employerInsurance: result.employer_insurance,
        employerIncomeTax: result.employer_income_tax,
        incomeTax: result.income_tax,
        severanceAccrual: result.severance_accrual,
        eidiAccrual: result.eidi_accrual,
        leaveRedemption: result.leave_redemption,
        totalStatutory: result.total_statutory,
        totalWelfare: result.total_welfare,
        totalHiddenHR: result.total_hidden_hr,
        totalMonthlyCost: result.total_monthly_cost,
        netSalary: result.net_salary,
        multiplier: result.multiplier,
        isNetContract: result.is_net_contract,
      });
      window.dispatchEvent(new Event('hring:credits-changed'));
    } catch (error) {
      window.dispatchEvent(new Event('hring:credits-changed'));
      toast({
        title: 'محاسبه انجام نشد',
        description: error instanceof Error ? error.message : 'اعتبار یا ورودی‌ها را بررسی کنید.',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      <div className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto print:p-2 print:max-w-full">
        {/* Print Logo - only visible when printing */}
        <div className="hidden print:flex print:justify-center print:mb-6">
          <img src={logo} alt="Logo" className="h-16" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2 print:hidden">
              <ArrowRight className="h-5 w-5" />
              بازگشت به داشبورد
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent print:text-foreground print:bg-none">
                محاسبه بهای تمام شده نیروی انسانی
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                محاسبه دقیق هزینه واقعی ماهانه کارمند بر اساس استانداردهای ایرانی
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            disabled={!calculations}
            className="print:hidden gap-2"
          >
            <Printer className="w-4 h-4" />
            پرینت
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Sections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Contract */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    بخش ۱: قرارداد (مبنای محاسبه)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contract Mode Switch */}
                  <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium">نوع قرارداد</p>
                      <p className="text-sm text-muted-foreground">
                        {isNetContract ? 'قرارداد خالص - سیستم مبلغ ناخالص را محاسبه می‌کند' : 'قرارداد ناخالص'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={!isNetContract ? 'text-primary font-medium' : 'text-muted-foreground'}>ناخالص</span>
                      <Switch checked={isNetContract} onCheckedChange={setIsNetContract} />
                      <span className={isNetContract ? 'text-primary font-medium' : 'text-muted-foreground'}>خالص</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RialInput 
                      label={isNetContract ? "حقوق خالص ماهانه" : "پایه حقوق"} 
                      value={baseSalary} 
                      onChange={setBaseSalary} 
                    />
                    <RialInput label="حق جذب" value={jobAbsorption} onChange={setJobAbsorption} disabled={isNetContract} />
                    <RialInput label="حق مسئولیت" value={responsibilityAllowance} onChange={setResponsibilityAllowance} disabled={isNetContract} />
                    <RialInput label="فوق‌العاده شغل" value={jobSuperlative} onChange={setJobSuperlative} disabled={isNetContract} />
                    <RialInput label={`حق مسکن مصوب ${statutoryYear}`} value={housingAllowance} onChange={setHousingAllowance} disabled />
                    <RialInput label={`بن خواروبار مصوب ${statutoryYear}`} value={groceryAllowance} onChange={setGroceryAllowance} disabled />
                    <RialInput label="حق اولاد" value={childrenAllowance} onChange={setChildrenAllowance} disabled={isNetContract} />
                    <RialInput label="سایر مزایا" value={otherBenefits} onChange={setOtherBenefits} disabled={isNetContract} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Section 2: Variable Pay */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-accent" />
                    </div>
                    بخش ۲: پرداخت‌های متغیر و اضافه‌کار
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberInput label="ساعات مبنای اضافه‌کار" value={overtimeBaseHours} onChange={setOvertimeBaseHours} suffix="ساعت" />
                    <NumberInput label="ساعات اضافه‌کار" value={overtimeHours} onChange={setOvertimeHours} suffix="ساعت" />
                    <RialInput label="کارانه ماهانه" value={monthlyPerformance} onChange={setMonthlyPerformance} />
                    <RialInput label="پاداش ماهانه" value={monthlyBonus} onChange={setMonthlyBonus} />
                  </div>
                  
                  {overtimeHours > 0 && calculations && (
                    <div className="p-3 bg-accent/10 rounded-lg text-sm">
                      <p className="text-muted-foreground">
                        محاسبه اضافه‌کار: (پایه + جذب + مسئولیت + فوق‌العاده) ÷ {overtimeBaseHours} × ۱.۴ × {overtimeHours} = 
                        <span className="font-bold text-foreground mr-2">{formatNumber(calculations.overtimePay)} ریال</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Section 3: Annual & Welfare */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-green-500" />
                    </div>
                    بخش ۳: مزایای سالانه و رفاهی
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RialInput label="بیمه تکمیلی (سهم کارفرما - ماهانه)" value={supplementaryInsurance} onChange={setSupplementaryInsurance} />
                    <RialInput label="مزایای موردی سالانه (مصوب هیئت‌مدیره)" value={annualOccasionalBenefits} onChange={setAnnualOccasionalBenefits} />
                  </div>
                  
                  {annualOccasionalBenefits > 0 && calculations && (
                    <div className="p-3 bg-green-500/10 rounded-lg text-sm">
                      <p className="text-muted-foreground">
                        سهم ماهانه مزایای موردی: {formatNumber(annualOccasionalBenefits)} ÷ ۱۲ = 
                        <span className="font-bold text-foreground mr-2">{formatNumber(calculations.monthlyOccasionalBenefits)} ریال</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Section 4: Hidden HR Costs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="glass-card border-border bg-gradient-to-br from-destructive/5 to-transparent">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-destructive" />
                    </div>
                    بخش ۴: هزینه‌های پنهان منابع انسانی
                    <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-full">ویژه</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    این هزینه‌ها معمولاً در محاسبات حقوق نادیده گرفته می‌شوند اما بخش مهمی از هزینه واقعی نیرو هستند.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <RialInput label="هزینه جذب و جایگزینی (ماهانه)" value={recruitmentCost} onChange={setRecruitmentCost} />
                    <RialInput label="هزینه آموزش و آنبوردینگ (ماهانه)" value={trainingCost} onChange={setTrainingCost} />
                    <RialInput label="هزینه‌های متفرقه و مصرفی" value={miscCost} onChange={setMiscCost} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <Button
              type="button"
              size="lg"
              onClick={handleCalculate}
              disabled={isCalculating || baseSalary <= 0}
              className="w-full gap-2 print:hidden"
            >
              {isCalculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
              محاسبه نهایی (۵ اعتبار)
            </Button>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="sticky top-6"
            >
              {calculations ? (
                <>
              {/* Main Result */}
              <Card className="glass-card border-destructive/30 bg-gradient-to-br from-destructive/10 to-transparent mb-6">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-2">هزینه واقعی ماهانه شرکت</p>
                    <p className="text-4xl md:text-5xl font-bold text-destructive mb-2">
                      {formatNumber(calculations.totalMonthlyCost)}
                    </p>
                    <p className="text-lg text-muted-foreground">ریال</p>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <p className="text-lg">
                        <span className="font-bold text-primary">{calculations.multiplier.toFixed(2)}x</span>
                        <span className="text-muted-foreground mr-2">برابر حقوق خالص</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calculator className="w-5 h-5 text-primary" />
                    جزئیات محاسبات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Gross Salary */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">حقوق ناخالص ماهانه</p>
                    <p className="text-xl font-bold">{formatNumber(calculations.totalGross)} ریال</p>
                  </div>

                  <Separator />

                  {/* Variable Pay */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">پرداخت‌های متغیر</p>
                    <p className="text-xl font-bold">{formatNumber(calculations.variablePay)} ریال</p>
                  </div>

                  <Separator />

                  {/* Statutory Costs */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">هزینه‌های قانونی کارفرما</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>بیمه کارفرما ({calculations.isNetContract ? '۳۰٪' : '۲۳٪'})</span>
                        <span className="font-medium">{formatNumber(calculations.employerInsurance)}</span>
                      </div>
                      {calculations.isNetContract && calculations.employerIncomeTax > 0 && (
                        <div className="flex justify-between text-amber-500">
                          <span>مالیات حقوق (پلکانی {calculations.statutoryYear})</span>
                          <span className="font-medium">{formatNumber(calculations.employerIncomeTax)}</span>
                        </div>
                      )}
                      {!calculations.isNetContract && calculations.incomeTax > 0 && (
                        <div className="flex justify-between text-muted-foreground/70">
                          <span>مالیات حقوق (سهم کارمند)</span>
                          <span className="font-medium">{formatNumber(calculations.incomeTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>ذخیره سنوات (پایه÷۱۲)</span>
                        <span className="font-medium">{formatNumber(calculations.severanceAccrual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ذخیره عیدی (پایه×۲÷۱۲)</span>
                        <span className="font-medium">{formatNumber(calculations.eidiAccrual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ذخیره مرخصی (پایه÷۳۰×۲.۵)</span>
                        <span className="font-medium">{formatNumber(calculations.leaveRedemption)}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t border-border">
                        <span>جمع هزینه‌های قانونی</span>
                        <span className="text-primary">{formatNumber(calculations.totalStatutory)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Welfare */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">هزینه‌های رفاهی</p>
                    <p className="text-xl font-bold">{formatNumber(calculations.totalWelfare)} ریال</p>
                  </div>

                  <Separator />

                  {/* Hidden HR */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">هزینه‌های پنهان HR</p>
                    <p className="text-xl font-bold text-destructive">{formatNumber(calculations.totalHiddenHR)} ریال</p>
                  </div>

                  <Separator />

                  {/* Comparison */}
                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-muted-foreground">حقوق خالص کارمند</span>
                      <span className="font-bold text-green-500">{formatNumber(calculations.netSalary)} ریال</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">هزینه واقعی شرکت</span>
                      <span className="font-bold text-destructive">{formatNumber(calculations.totalMonthlyCost)} ریال</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
                </>
              ) : (
                <Card className="glass-card border-border">
                  <CardContent className="py-12 text-center">
                    <Calculator className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">نتیجه هنوز محاسبه نشده است</p>
                    <p className="text-sm text-muted-foreground mt-2">پس از تکمیل ورودی‌ها، دکمه محاسبه را بزنید.</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
