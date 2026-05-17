import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Crown,
  Users,
  Briefcase,
  CreditCard,
  Shield,
  HelpCircle,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  Building2,
  User,
  Zap,
} from "lucide-react";
import AuroraBackground from "@/components/AuroraBackground";
import Navbar from "@/components/Navbar";
import { useSiteName } from "@/hooks/useSiteSettings";

const FAQ = () => {
  const siteName = useSiteName();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "plans";
  const [activeTab, setActiveTab] = useState(initialTab);

  const individualPlans = [
    {
      name: "رایگان",
      tier: "individual_free",
      price: "۰",
      credits: "۵۰",
      creditsNote: "یکبار",
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "محاسبه هزینه استخدام", included: true },
        { name: "هدهانتینگ هوشمند", included: false },
        { name: "آنبوردینگ", included: false },
        { name: "قطب‌نمای استراتژیک", included: false },
        { name: "داشبورد HR", included: false },
        { name: "ذخیره ابری", included: false },
      ],
      color: "border-muted",
    },
    {
      name: "کارشناس",
      tier: "individual_expert",
      price: "۲۹۰,۰۰۰",
      credits: "۶۰۰",
      creditsNote: "ماهانه",
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "محاسبه هزینه استخدام", included: true },
        { name: "هدهانتینگ هوشمند", included: false },
        { name: "آنبوردینگ", included: false },
        { name: "قطب‌نمای استراتژیک", included: false },
        { name: "داشبورد HR", included: false },
        { name: "ذخیره ابری", included: false },
      ],
      color: "border-blue-500/50",
    },
    {
      name: "حرفه‌ای",
      tier: "individual_pro",
      price: "۴۹۰,۰۰۰",
      credits: "۶۰۰",
      creditsNote: "ماهانه",
      popular: true,
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "محاسبه هزینه استخدام", included: true },
        { name: "هدهانتینگ هوشمند", included: true },
        { name: "آنبوردینگ", included: false },
        { name: "قطب‌نمای استراتژیک", included: false },
        { name: "داشبورد HR", included: true },
        { name: "ذخیره ابری", included: false },
      ],
      color: "border-primary",
    },
    {
      name: "پلاس",
      tier: "individual_plus",
      price: "۹۹۰,۰۰۰",
      credits: "۲,۵۰۰",
      creditsNote: "ماهانه",
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "محاسبه هزینه استخدام", included: true },
        { name: "هدهانتینگ هوشمند", included: true },
        { name: "آنبوردینگ", included: "demo" },
        { name: "قطب‌نمای استراتژیک", included: "demo" },
        { name: "داشبورد HR", included: true },
        { name: "ذخیره ابری", included: true },
      ],
      color: "border-amber-500/50",
    },
  ];

  const corporatePlans = [
    {
      name: "کارشناس شرکتی",
      tier: "corporate_expert",
      price: "۱,۴۹۰,۰۰۰",
      credits: "۵۰۰",
      creditsNote: "ماهانه",
      seats: "۵ کاربر",
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "هدهانتینگ هوشمند", included: true },
        { name: "آنبوردینگ", included: true },
        { name: "قطب‌نمای استراتژیک", included: false },
        { name: "داشبورد HR کامل", included: false },
        { name: "مدیریت تیم", included: true },
      ],
      color: "border-blue-500/50",
    },
    {
      name: "پشتیبان تصمیم",
      tier: "corporate_decision_support",
      price: "۲,۹۹۰,۰۰۰",
      credits: "۲,۰۰۰",
      creditsNote: "ماهانه",
      seats: "۱۰ کاربر",
      popular: true,
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "هدهانتینگ هوشمند", included: true },
        { name: "آنبوردینگ", included: true },
        { name: "قطب‌نمای استراتژیک", included: true },
        { name: "داشبورد HR کامل", included: false },
        { name: "مدیریت تیم", included: true },
      ],
      color: "border-primary",
    },
    {
      name: "تصمیم‌ساز",
      tier: "corporate_decision_making",
      price: "۵,۹۹۰,۰۰۰",
      credits: "۵,۰۰۰",
      creditsNote: "ماهانه",
      seats: "۵۰ کاربر",
      features: [
        { name: "ماژول‌های هوش مصنوعی", included: true },
        { name: "هدهانتینگ هوشمند", included: true },
        { name: "آنبوردینگ", included: true },
        { name: "قطب‌نمای استراتژیک", included: true },
        { name: "داشبورد HR کامل", included: true },
        { name: "مدیریت تیم", included: true },
      ],
      color: "border-amber-500/50",
    },
  ];

  const roles = [
    {
      name: "مدیرعامل",
      key: "ceo",
      description: "مدیریت کامل شرکت، کاربران، تنظیمات و دسترسی به همه امکانات",
      permissions: ["مدیریت کاربران", "تنظیمات شرکت", "دسترسی کامل", "گزارشات مدیریتی"],
      icon: Crown,
      color: "text-amber-500",
    },
    {
      name: "معاون",
      key: "deputy",
      description: "مدیریت دعوت‌نامه‌ها و دسترسی به اکثر امکانات پیشرفته",
      permissions: ["مدیریت دعوت‌نامه‌ها", "قطب‌نمای استراتژیک", "گزارشات"],
      icon: Users,
      color: "text-blue-500",
    },
    {
      name: "مدیر",
      key: "manager",
      description: "دسترسی به گزارشات، ابزارهای تحلیلی و مدیریت عملیاتی",
      permissions: ["گزارشات", "ابزارهای تحلیلی", "داشبورد HR"],
      icon: Briefcase,
      color: "text-green-500",
    },
    {
      name: "کارشناس",
      key: "employee",
      description: "دسترسی پایه به ابزارهای روزمره و ماژول‌های استاندارد",
      permissions: ["ماژول‌های پایه", "ابزارهای روزمره"],
      icon: User,
      color: "text-muted-foreground",
    },
  ];

  const faqs = [
    {
      category: "پلن‌ها و قیمت‌گذاری",
      questions: [
        {
          q: "تفاوت پلن‌های فردی و شرکتی چیست؟",
          a: "پلن‌های فردی برای استفاده شخصی طراحی شده‌اند و فقط یک کاربر می‌تواند از آن‌ها استفاده کند. پلن‌های شرکتی امکان اضافه کردن اعضای تیم، مدیریت نقش‌ها و دسترسی‌ها، و اعتبار مشترک را فراهم می‌کنند.",
        },
        {
          q: "آیا می‌توانم پلن خود را ارتقا دهم؟",
          a: "بله! در هر زمان می‌توانید از صفحه ارتقا (/upgrade) پلن خود را به سطح بالاتر ارتقا دهید. اعتبار باقی‌مانده به پلن جدید منتقل می‌شود.",
        },
        {
          q: "اعتبار چگونه محاسبه می‌شود؟",
          a: "هر ابزار هوش مصنوعی هزینه اعتبار مشخصی دارد. برای مثال، آگهی‌نویس ۵ اعتبار و تحلیل استراتژیک ۴۰ اعتبار مصرف می‌کند. اعتبار ماهانه تجدید می‌شود.",
        },
        {
          q: "اگر اعتبارم تمام شود چه اتفاقی می‌افتد؟",
          a: "می‌توانید اعتبار اضافی خریداری کنید یا منتظر تجدید ماهانه بمانید. همچنین می‌توانید پلن خود را ارتقا دهید.",
        },
      ],
    },
    {
      category: "دسترسی‌ها و نقش‌ها",
      questions: [
        {
          q: "نقش‌های شرکتی چگونه کار می‌کنند؟",
          a: "در پلن‌های شرکتی، مدیرعامل می‌تواند اعضا را با نقش‌های مختلف (معاون، مدیر، کارشناس) اضافه کند. هر نقش دسترسی‌های متفاوتی به ابزارها دارد.",
        },
        {
          q: "حالت دمو چیست؟",
          a: "کاربران پلن پلاس می‌توانند قطب‌نمای استراتژیک و آنبوردینگ را در حالت دمو مشاهده کنند، اما قادر به ذخیره یا ویرایش اطلاعات نیستند.",
        },
        {
          q: "آیا می‌توانم نقش کاربران را تغییر دهم؟",
          a: "بله، مدیرعامل شرکت می‌تواند از صفحه اعضای تیم نقش هر کاربر را تغییر دهد.",
        },
      ],
    },
    {
      category: "امنیت و حریم خصوصی",
      questions: [
        {
          q: "اطلاعات من کجا ذخیره می‌شود؟",
          a: "تمام اطلاعات شما در سرورهای امن ذخیره می‌شود و با رمزنگاری پیشرفته محافظت می‌گردد.",
        },
        {
          q: "آیا داده‌های من با دیگران به اشتراک گذاشته می‌شود؟",
          a: "خیر، داده‌های شما کاملاً خصوصی است و فقط شما و اعضای تیم‌تان (در پلن شرکتی) به آن دسترسی دارید.",
        },
      ],
    },
  ];

  return (
    <>
      <Helmet>
        <title>سوالات متداول | {siteName}</title>
        <meta name="description" content={`راهنمای کامل پلن‌ها، قیمت‌گذاری و دسترسی‌های ${siteName}. پاسخ به سوالات متداول درباره اشتراک‌ها و امکانات.`} />
        <link rel="canonical" href="https://hring-app.lovable.app/faq" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hring-app.lovable.app/faq" />
        <meta property="og:title" content={`سوالات متداول | ${siteName}`} />
        <meta property="og:description" content={`راهنمای پلن‌ها، نقش‌ها و امکانات ${siteName} در یک نگاه.`} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.flatMap(cat => cat.questions.map(q => ({
              '@type': 'Question',
              name: q.q,
              acceptedAnswer: { '@type': 'Answer', text: q.a },
            }))),
          })}
        </script>
      </Helmet>

      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <Navbar />

        <main className="relative z-10 container mx-auto px-4 py-24">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4" variant="secondary">
              <HelpCircle className="w-4 h-4 ml-2" />
              راهنما و سوالات متداول
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              همه چیز درباره{" "}
              <span className="gradient-text-primary">{siteName}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              پاسخ سوالات متداول، مقایسه پلن‌ها و راهنمای دسترسی‌ها
            </p>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="plans" className="gap-2">
                <CreditCard className="w-4 h-4" />
                پلن‌ها
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-2">
                <Users className="w-4 h-4" />
                نقش‌ها
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-2">
                <Zap className="w-4 h-4" />
                فیچرها
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-2">
                <HelpCircle className="w-4 h-4" />
                سوالات
              </TabsTrigger>
            </TabsList>

            {/* Plans Tab */}
            <TabsContent value="plans" className="space-y-8">
              {/* Individual Plans */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">پلن‌های فردی</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {individualPlans.map((plan, index) => (
                    <motion.div
                      key={plan.tier}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className={`h-full relative ${plan.color} ${plan.popular ? "ring-2 ring-primary" : ""}`}>
                        {plan.popular && (
                          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Sparkles className="w-3 h-3 ml-1" />
                            محبوب
                          </Badge>
                        )}
                        <CardHeader className="text-center pb-2">
                          <CardTitle>{plan.name}</CardTitle>
                          <div className="mt-2">
                            <span className="text-3xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground text-sm mr-1">تومان</span>
                          </div>
                          <Badge variant="secondary" className="mt-2">
                            {plan.credits} اعتبار ({plan.creditsNote})
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {plan.features.map((feature) => (
                              <li key={feature.name} className="flex items-center gap-2 text-sm">
                                {feature.included === true ? (
                                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                                ) : feature.included === "demo" ? (
                                  <Badge variant="outline" className="text-xs">دمو</Badge>
                                ) : (
                                  <X className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                                <span className={feature.included ? "" : "text-muted-foreground"}>
                                  {feature.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Corporate Plans */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Building2 className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">پلن‌های شرکتی</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {corporatePlans.map((plan, index) => (
                    <motion.div
                      key={plan.tier}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className={`h-full relative ${plan.color} ${plan.popular ? "ring-2 ring-primary" : ""}`}>
                        {plan.popular && (
                          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Sparkles className="w-3 h-3 ml-1" />
                            محبوب
                          </Badge>
                        )}
                        <CardHeader className="text-center pb-2">
                          <CardTitle>{plan.name}</CardTitle>
                          <CardDescription>{plan.seats}</CardDescription>
                          <div className="mt-2">
                            <span className="text-3xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground text-sm mr-1">تومان</span>
                          </div>
                          <Badge variant="secondary" className="mt-2">
                            {plan.credits} اعتبار ({plan.creditsNote})
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {plan.features.map((feature) => (
                              <li key={feature.name} className="flex items-center gap-2 text-sm">
                                {feature.included ? (
                                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                                <span className={feature.included ? "" : "text-muted-foreground"}>
                                  {feature.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="text-center pt-4">
                <Button asChild size="lg">
                  <Link to="/upgrade">
                    <Crown className="w-5 h-5 ml-2" />
                    مشاهده صفحه ارتقا
                  </Link>
                </Button>
              </div>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles">
              <div className="grid md:grid-cols-2 gap-6">
                {roles.map((role, index) => (
                  <motion.div
                    key={role.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl bg-secondary ${role.color}`}>
                            <role.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle>{role.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">{role.key}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">{role.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary">
                              <Check className="w-3 h-3 ml-1" />
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features">
              <Card>
                <CardHeader>
                  <CardTitle>هزینه اعتبار فیچرها</CardTitle>
                  <CardDescription>
                    هر ابزار هوش مصنوعی هزینه اعتبار مشخصی دارد
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { name: "آگهی‌نویس هوشمند", cost: 5, category: "text_generation" },
                      { name: "دستیار مصاحبه", cost: 5, category: "text_generation" },
                      { name: "مهندسی مشاغل", cost: 5, category: "text_generation" },
                      { name: "معمار موفقیت ۹۰ روزه", cost: 5, category: "text_generation" },
                      { name: "تولید تصویر آگهی", cost: 20, category: "image_generation" },
                      { name: "داشبورد HR", cost: 20, category: "analytics" },
                      { name: "مرکز تحلیل", cost: 20, category: "analytics" },
                      { name: "هدهانتینگ هوشمند", cost: 30, category: "deep_search" },
                      { name: "قطب‌نمای استراتژیک", cost: 40, category: "complex_analysis" },
                      { name: "محاسبه هزینه استخدام", cost: 0, category: "free_tools" },
                    ].map((feature) => (
                      <div
                        key={feature.name}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <span>{feature.name}</span>
                        <Badge variant={feature.cost === 0 ? "secondary" : "default"}>
                          {feature.cost === 0 ? "رایگان" : `${feature.cost} اعتبار`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FAQ Tab */}
            <TabsContent value="faq" className="space-y-6">
              {faqs.map((category) => (
                <Card key={category.category}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((item, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                          <AccordionTrigger className="text-right">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <p className="text-muted-foreground mb-4">
              سوال دیگری دارید؟ با پشتیبانی ما در ارتباط باشید.
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="outline">
                <Link to="/dashboard">
                  <ArrowLeft className="w-4 h-4 ml-2" />
                  بازگشت به داشبورد
                </Link>
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default FAQ;
