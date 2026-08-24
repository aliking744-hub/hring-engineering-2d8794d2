import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Diamond, Crown, Zap, Building2, Users, Briefcase, Loader2, type LucideIcon } from "lucide-react";
import { useSectionVisible } from "@/hooks/useSectionVisible";
import { useAuth } from "@/hooks/useAuth";
import { DIAMOND_COSTS } from "@/hooks/useCredits";
import { apiRequest } from "@/lib/api";

interface BillingPlan {
  plan_type: string;
  display_name: string;
  scope: "individual" | "corporate";
  price_toman: number;
  monthly_credits: number;
  is_active: boolean;
}

interface PlanPresentation {
  icon: LucideIcon;
  features: string[];
  hidden: string[];
  popular: boolean;
  seats?: number;
}

interface DisplayPlan extends PlanPresentation {
  name: string;
  price: string;
  priceValue: number;
  period: string;
  credits: number;
  creditsNote: string;
  tier: string;
}

const PLAN_PRESENTATIONS: Record<string, PlanPresentation> = {
  individual_free: {
    icon: Diamond,
    features: [
      "ماژول‌های پایه",
      "ماشین‌حساب هزینه",
      "بدون ذخیره‌سازی ابری",
    ],
    hidden: ["هدهانتینگ هوشمند", "آنبوردینگ", "قطب‌نمای استراتژیک"],
    popular: false,
  },
  individual_pro: {
    icon: Zap,
    features: [
      "تمام ماژول‌ها",
      "هدهانتینگ هوشمند",
      "بدون ذخیره‌سازی ابری",
    ],
    hidden: ["آنبوردینگ", "قطب‌نمای استراتژیک"],
    popular: false,
  },
  individual_plus: {
    icon: Crown,
    features: [
      "تمام ماژول‌ها",
      "هدهانتینگ هوشمند",
      "دمو قطب‌نمای استراتژیک",
      "دمو آنبوردینگ",
      "ذخیره‌سازی ابری کامل",
    ],
    hidden: [],
    popular: true,
  },
  corporate_expert: {
    icon: Building2,
    features: [
      "دسترسی کامل ماژول‌ها",
      "آنبوردینگ کامل",
      "Credit Pool مشترک",
    ],
    hidden: [],
    popular: false,
    seats: 5,
  },
  corporate_decision_support: {
    icon: Users,
    features: [
      "تمام امکانات اکسپرت",
      "قطب‌نمای استراتژیک (محدود)",
      "داشبورد تحلیلی",
    ],
    hidden: [],
    popular: false,
    seats: 10,
  },
  corporate_decision_making: {
    icon: Briefcase,
    features: [
      "تمام امکانات",
      "قطب‌نمای استراتژیک کامل",
      "داشبورد مدیریتی پیشرفته",
      "پشتیبانی اختصاصی",
    ],
    hidden: [],
    popular: false,
    seats: 50,
  },
};

const formatPrice = (price: number) => new Intl.NumberFormat("fa-IR").format(price);

const toDisplayPlan = (plan: BillingPlan): DisplayPlan | null => {
  const presentation = PLAN_PRESENTATIONS[plan.plan_type];
  if (!presentation || !plan.is_active) return null;
  return {
    ...presentation,
    name: plan.display_name,
    price: plan.price_toman === 0 ? "رایگان" : formatPrice(plan.price_toman),
    priceValue: plan.price_toman,
    period: plan.price_toman === 0 ? "" : " تومان / ماهانه",
    credits: plan.monthly_credits,
    creditsNote: plan.price_toman === 0 ? "یکبار مصرف" : "ماهانه",
    tier: plan.plan_type,
  };
};

const PricingSection = () => {
  const showIndividual = useSectionVisible('pricing_individual');
  const showCorporate = useSectionVisible('pricing_corporate');
  const { user } = useAuth();
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const plans = await apiRequest<BillingPlan[]>(
          "/billing/plans",
          undefined,
          { auth: false, retryAuth: false },
        );
        if (active) setBillingPlans(plans);
      } catch (error) {
        console.error("Landing billing plan load failed:", error);
        if (active) setPlansError(true);
      } finally {
        if (active) setPlansLoading(false);
      }
    };
    void loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const { individualPlans, corporatePlans } = useMemo(() => {
    const visiblePlans = billingPlans.flatMap((plan) => {
      const displayed = toDisplayPlan(plan);
      return displayed ? [displayed] : [];
    });
    return {
      individualPlans: visiblePlans.filter((plan) => plan.tier.startsWith("individual_")),
      corporatePlans: visiblePlans.filter((plan) => plan.tier.startsWith("corporate_")),
    };
  }, [billingPlans]);
  const planTarget = user ? "/upgrade" : "/auth";

  return (
    <section id="pricing" className="py-20 px-4" dir="rtl">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading">
            <span className="gradient-text-primary">پلن‌ها</span> و قیمت‌گذاری
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            پلن مناسب خود را انتخاب کنید و از قدرت هوش مصنوعی در منابع انسانی بهره‌مند شوید
          </p>
        </motion.div>

        {plansLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>در حال دریافت پلن‌های فعال...</span>
          </div>
        )}

        {plansError && (
          <Card className="mx-auto mb-12 max-w-xl border-destructive/30 bg-card/60 text-center">
            <CardContent className="p-6">
              <p className="mb-4 text-muted-foreground">قیمت‌های به‌روز در حال حاضر قابل دریافت نیستند.</p>
              <Link to={planTarget}>
                <Button variant="outline">مشاهده صفحه پلن‌ها</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Individual Plans */}
        {!plansLoading && !plansError && showIndividual && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <h3 className="text-xl font-semibold mb-6 text-center text-muted-foreground">
            پلن‌های فردی
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {individualPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className={`relative h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 ${plan.popular ? 'ring-2 ring-primary shadow-lg shadow-primary/20' : ''}`}>
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      محبوب‌ترین
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <plan.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-2 text-sm">
                      <Diamond className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">{plan.credits.toLocaleString('fa-IR')}</span>
                      <span className="text-muted-foreground">الماس {plan.creditsNote}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.hidden.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">شامل نمی‌شود:</p>
                        <ul className="space-y-1">
                          {plan.hidden.map((item) => (
                            <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground/70">
                              <span className="w-4 h-4 flex items-center justify-center">✕</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Link to={planTarget} className="block pt-2">
                      <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                        {plan.priceValue === 0 ? "شروع رایگان" : "انتخاب پلن"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
        )}

        {/* Corporate Plans */}
        {!plansLoading && !plansError && showCorporate && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className="text-xl font-semibold mb-6 text-center text-muted-foreground">
            پلن‌های سازمانی
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {corporatePlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              >
                <Card className="relative h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300">
                  <CardHeader className="text-center pb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <plan.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2 text-sm">
                      <Badge variant="secondary" className="text-xs">
                        تا {plan.seats} کاربر
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Diamond className="w-4 h-4 text-amber-500" />
                        <span className="font-medium">{plan.credits.toLocaleString('fa-IR')}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to={planTarget} className="block pt-2">
                      <Button className="w-full" variant="outline">
                        درخواست مشاوره
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
        )}

        {/* Diamond Economy Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Diamond className="w-8 h-8 text-amber-500" />
                <h4 className="text-lg font-semibold">اقتصاد الماس</h4>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                هر اقدام هوش مصنوعی بر اساس پیچیدگی، تعداد مشخصی الماس مصرف می‌کند:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <div className="text-2xl font-bold text-primary">{DIAMOND_COSTS.JOB_PROFILE.toLocaleString("fa-IR")}</div>
                  <div className="text-xs text-muted-foreground">تولید متن</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <div className="text-2xl font-bold text-primary">{DIAMOND_COSTS.ONBOARDING_PLAN.toLocaleString("fa-IR")}</div>
                  <div className="text-xs text-muted-foreground">برنامه آنبوردینگ</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <div className="text-2xl font-bold text-primary">{DIAMOND_COSTS.SMART_AD_IMAGE.toLocaleString("fa-IR")}</div>
                  <div className="text-xs text-muted-foreground">تولید تصویر</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/50">
                  <div className="text-2xl font-bold text-primary">{DIAMOND_COSTS.HEADHUNTING.toLocaleString("fa-IR")}</div>
                  <div className="text-xs text-muted-foreground">هدهانتینگ هوشمند</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
