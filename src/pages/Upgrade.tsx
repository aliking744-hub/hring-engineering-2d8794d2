import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, Zap, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserContext } from '@/hooks/useUserContext';
import { ApiError, apiRequest } from '@/lib/api';
import Navbar from '@/components/Navbar';
import AuroraBackground from '@/components/AuroraBackground';

interface BillingPlan {
  plan_type: string;
  display_name: string;
  scope: 'individual' | 'corporate';
  price_toman: number;
  monthly_credits: number;
  is_active: boolean;
}

interface PlanPresentation {
  period: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
}

interface Plan extends PlanPresentation {
  id: string;
  name: string;
  scope: BillingPlan['scope'];
  price: number;
  monthlyCredits: number;
}

interface PaymentInitResponse {
  success: boolean;
  payment_url: string;
}

interface PaymentVerifyResponse {
  success: boolean;
  ref_id: string | null;
}

const PLAN_PRESENTATIONS: Record<string, PlanPresentation> = {
  individual_free: {
    period: 'بدون انقضا',
    description: 'فقط برای مشاهده قابلیت‌ها و تست دموی داشبورد',
    features: [
      'مشاهده همه قابلیت‌ها',
      'تست دموی داشبورد منابع انسانی',
      'بدون الماس قابل مصرف',
    ],
    icon: <Zap className="h-6 w-6" />,
  },
  individual_pro: {
    period: '۳۰ روز (۷۲۰ ساعت)',
    description: 'برای استفاده محدود و واقعی یک کارشناس',
    features: [
      '۲٬۰۰۰ الماس',
      'دسترسی به قابلیت‌های فعال تولیدی',
      'انقضای دقیق پس از ۷۲۰ ساعت',
      'بدون تمدید خودکار',
    ],
    icon: <Sparkles className="h-6 w-6" />,
    popular: true,
  },
  individual_plus: {
    period: '۳۰ روز (۷۲۰ ساعت)',
    description: 'برای کارشناس با حجم استفاده بیشتر',
    features: [
      '۶٬۰۰۰ الماس',
      'دسترسی به قابلیت‌های فعال تولیدی',
      'ذخیره‌سازی خروجی‌ها',
      'انقضای دقیق پس از ۷۲۰ ساعت',
      'بدون تمدید خودکار',
    ],
    icon: <Crown className="h-6 w-6" />,
  },
  corporate_expert: {
    period: 'تماس با پشتیبانی',
    description: 'تا ۵ کاربر',
    features: [
      'تا ۵ عضو تیم',
      'تمام ماژول‌ها + هدهانتینگ',
      'ایجاد برنامه آنبوردینگ',
      'ذخیره‌سازی ابری',
    ],
    icon: <Building2 className="h-6 w-6" />,
  },
  corporate_decision_support: {
    period: 'تماس با پشتیبانی',
    description: 'تا ۱۰ کاربر',
    features: [
      'تا ۱۰ عضو تیم',
      'گزارش‌های مدیریتی سازمانی',
      'داشبورد HR پیشرفته',
      'تحلیل رفتار تیم',
      'پشتیبانی اختصاصی',
    ],
    icon: <Crown className="h-6 w-6" />,
    popular: true,
  },
  corporate_decision_making: {
    period: 'تماس با پشتیبانی',
    description: 'تا ۵۰ کاربر',
    features: [
      'تا ۵۰ عضو تیم',
      'تمام ویژگی‌های بدون محدودیت',
      'منشور ذهنی CEO',
      'شرط‌بندی استراتژیک',
      'داشبورد تحلیلی کامل',
      'مشاور اختصاصی',
    ],
    icon: <Sparkles className="h-6 w-6" />,
  },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('fa-IR').format(price);
};

const errorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

const paymentErrorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.status === 503) {
    return 'درگاه پرداخت هنوز توسط مدیر سیستم فعال نشده است';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'این پلن فقط برای مدیرعامل یا معاون شرکت قابل انتخاب است';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'پلن انتخابی در حال حاضر قابل خرید نیست';
  }
  return errorMessage(error, 'شروع پرداخت انجام نشد');
};

export default function Upgrade() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { context, loading: contextLoading, refetch: refetchContext } = useUserContext();
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const status = searchParams.get('Status');
  const authority = searchParams.get('Authority');

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const plans = await apiRequest<BillingPlan[]>(
          '/billing/plans',
          undefined,
          { auth: false, retryAuth: false },
        );
        if (active) setBillingPlans(plans);
      } catch (error) {
        console.error('Billing plan load failed:', error);
        toast({
          title: 'خطا در دریافت پلن‌ها',
          description: errorMessage(error, 'پلن‌های فعال دریافت نشدند'),
          variant: 'destructive',
        });
      } finally {
        if (active) setPlansLoading(false);
      }
    };
    void loadPlans();
    return () => {
      active = false;
    };
  }, [toast]);

  const verifyPayment = useCallback(async (paymentAuthority: string, paymentStatus: string) => {
    if (paymentStatus !== 'OK') {
      toast({
        title: 'پرداخت ناموفق',
        description: 'پرداخت شما انجام نشد یا لغو شد',
        variant: 'destructive',
      });
      navigate('/upgrade', { replace: true });
      return;
    }

    setProcessing(true);
    try {
      const response = await apiRequest<PaymentVerifyResponse>('/billing/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ authority: paymentAuthority }),
      });
      if (!response.success) throw new Error('تأیید پرداخت انجام نشد');
      await refetchContext();
      window.dispatchEvent(new Event('hring:credits-changed'));
      toast({
        title: 'پرداخت موفق',
        description: response.ref_id ? `کد پیگیری: ${response.ref_id}` : 'پرداخت با موفقیت ثبت شد',
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Verify error:', error);
      toast({
        title: 'خطا در تأیید پرداخت',
        description: errorMessage(error, 'تأیید پرداخت انجام نشد'),
        variant: 'destructive',
      });
      navigate('/upgrade', { replace: true });
    } finally {
      setProcessing(false);
    }
  }, [navigate, refetchContext, toast]);

  useEffect(() => {
    if (status && authority) void verifyPayment(authority, status);
  }, [authority, status, verifyPayment]);

  const handleUpgrade = async (planId: string) => {
    if (planId === 'individual_free') {
      toast({ title: 'شما در حال حاضر پلن رایگان دارید' });
      return;
    }

    if (context?.subscriptionTier === planId || context?.companyTier === planId) {
      toast({ title: 'شما در حال حاضر این پلن را دارید' });
      return;
    }

    setSelectedPlan(planId);
    setProcessing(true);

    try {
      if (!user) {
        navigate('/auth');
        return;
      }

      const response = await apiRequest<PaymentInitResponse>('/billing/payments/init', {
        method: 'POST',
        body: JSON.stringify({ plan_type: planId }),
      });

      if (response.success && response.payment_url) {
        window.location.href = response.payment_url;
      } else {
        throw new Error('درگاه پرداخت آدرس معتبری برنگرداند');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'خطا در شروع پرداخت',
        description: paymentErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const plans = useMemo<Plan[]>(() => billingPlans.flatMap((plan) => {
    const presentation = PLAN_PRESENTATIONS[plan.plan_type];
    if (!presentation) return [];
    const creditLabel = plan.scope === 'corporate'
      ? `${formatPrice(plan.monthly_credits)} الماس ماهانه تیمی`
      : plan.price_toman === 0
        ? `${formatPrice(plan.monthly_credits)} الماس (یکبار)`
        : `${formatPrice(plan.monthly_credits)} الماس ماهانه`;
    return [{
      ...presentation,
      id: plan.plan_type,
      name: plan.display_name,
      scope: plan.scope,
      price: plan.price_toman,
      monthlyCredits: plan.monthly_credits,
      features: [creditLabel, ...presentation.features],
    }];
  }), [billingPlans]);

  const currentTier = context?.companyTier || context?.subscriptionTier;
  const isCorporate = context?.userType === 'corporate';
  const individualPlans = plans.filter((plan) => plan.scope === 'individual');
  const corporatePlans = plans.filter((plan) => plan.scope === 'corporate');
  const plansToShow = isCorporate ? corporatePlans : individualPlans;
  const currentTierName = plans.find((plan) => plan.id === currentTier)?.name || currentTier;

  if (processing && authority) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-lg">در حال تأیید پرداخت...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ارتقای پلن | HRing</title>
        <meta name="description" content="ارتقای پلن اشتراک HRing" />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        <AuroraBackground />
        <div className="relative z-10">
          <Navbar />
          
          <div className="container mx-auto px-4 py-12">
            <div className="mb-6 flex justify-start">
              <Button variant="outline" className="gap-2" onClick={() => navigate('/dashboard')}>
                <ArrowRight className="h-4 w-4" />
                بازگشت به داشبورد
              </Button>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl font-bold mb-4">ارتقای پلن</h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                پلن مناسب خود را انتخاب کنید و از تمام امکانات HRing بهره‌مند شوید
              </p>
              {currentTier && (
                <Badge variant="outline" className="mt-4">
                  پلن فعلی: {currentTierName}
                </Badge>
              )}
            </motion.div>

            {plansLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {!plansLoading && plansToShow.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                پلن فعالی برای این نوع حساب تعریف نشده است.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {plansToShow.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={`relative h-full flex flex-col ${
                      plan.popular 
                        ? 'border-primary shadow-lg shadow-primary/20' 
                        : 'border-border'
                    } ${currentTier === plan.id ? 'ring-2 ring-green-500' : ''}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          محبوب‌ترین
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-4">
                      <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10 text-primary w-fit">
                        {plan.icon}
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col">
                      <div className="text-center mb-6">
                        {plan.price === 0 ? (
                          <span className="text-3xl font-bold">رایگان</span>
                        ) : (
                          <>
                            <span className="text-3xl font-bold">
                              {formatPrice(plan.price)}
                            </span>
                            <span className="text-muted-foreground text-sm mr-1">
                              تومان / {plan.period}
                            </span>
                          </>
                        )}
                      </div>

                      <ul className="space-y-3 flex-1 mb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full"
                        variant={currentTier === plan.id ? 'outline' : plan.popular ? 'default' : 'secondary'}
                        disabled={processing || contextLoading || currentTier === plan.id || plan.price === 0}
                        onClick={() => handleUpgrade(plan.id)}
                      >
                        {processing && selectedPlan === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        ) : currentTier === plan.id ? (
                          'پلن فعلی'
                        ) : plan.price === 0 ? (
                          'پلن فعلی'
                        ) : (
                          <>
                            ارتقا
                            <ArrowRight className="h-4 w-4 mr-2" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {!plansLoading && !isCorporate && corporatePlans.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-16 text-center"
              >
                <h2 className="text-2xl font-bold mb-4">پلن‌های شرکتی</h2>
                <p className="text-muted-foreground mb-8">
                  برای تیم‌ها و سازمان‌ها با امکانات پیشرفته‌تر
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  {corporatePlans.map((plan, index) => (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <Card className={`${plan.popular ? 'border-primary' : ''}`}>
                        <CardHeader className="text-center">
                          <div className="mx-auto mb-2 p-2 rounded-full bg-primary/10 text-primary w-fit">
                            {plan.icon}
                          </div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <div className="text-2xl font-bold">
                            {formatPrice(plan.price)}
                            <span className="text-sm text-muted-foreground mr-1">
                              تومان / ۳۰ روز
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate('/auth?type=company')}
                          >
                            تماس با پشتیبانی: ۰۹۳۲۱۱۱۱۱۲۰
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
