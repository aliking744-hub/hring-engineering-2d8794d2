import { useState } from "react";
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
  HelpCircle,
  ArrowLeft,
  Check,
  User,
  Zap,
} from "lucide-react";
import AuroraBackground from "@/components/AuroraBackground";
import Navbar from "@/components/Navbar";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import PricingSection from "@/components/landing/PricingSection";
import { DIAMOND_COSTS } from "@/hooks/useCredits";

const FAQ = () => {
  const { siteName, getSetting } = useSiteSettings();
  const canonicalBase = getSetting("seo_canonical_base_url", "https://hring.ir").replace(/\/+$/, "");
  const faqUrl = canonicalBase + "/faq";
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "plans";
  const [activeTab, setActiveTab] = useState(initialTab);

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
      permissions: ["مدیریت دعوت‌نامه‌ها", "گزارش‌های سازمانی"],
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
          a: `هر قابلیت هزینه الماس مشخصی دارد. برای مثال، آگهی‌نویس ${DIAMOND_COSTS.SMART_AD_TEXT} الماس و پروفایل شغلی ${DIAMOND_COSTS.JOB_PROFILE} الماس مصرف می‌کند. اعتبار هر بسته دقیقاً ۷۲۰ ساعت است.`,
        },
        {
          q: "اگر اعتبارم تمام شود چه اتفاقی می‌افتد؟",
          a: "برای ادامه استفاده باید بسته جدید بخرید یا پلن خود را ارتقا دهید.",
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
          a: "کاربران می‌توانند دموی داشبورد منابع انسانی را بدون مصرف الماس مشاهده کنند.",
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
        <link rel="canonical" href={faqUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={faqUrl} />
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
            <TabsContent value="plans">
              <PricingSection />
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
                      { name: "آگهی‌نویس هوشمند", cost: DIAMOND_COSTS.SMART_AD_TEXT, category: "text_generation" },
                      { name: "دستیار مصاحبه", cost: DIAMOND_COSTS.INTERVIEW_KIT, category: "text_generation" },
                      { name: "مهندسی مشاغل", cost: DIAMOND_COSTS.JOB_PROFILE, category: "text_generation" },
                      { name: "معمار موفقیت ۹۰ روزه", cost: DIAMOND_COSTS.ONBOARDING_PLAN, category: "text_generation" },
                      { name: "تولید تصویر آگهی", cost: DIAMOND_COSTS.SMART_AD_IMAGE, category: "image_generation" },
                      { name: "داشبورد HR", cost: DIAMOND_COSTS.HR_DASHBOARD, category: "analytics" },
                      { name: "مرکز تحلیل", cost: DIAMOND_COSTS.ANALYTICS_HUB, category: "analytics" },
                      { name: "هدهانتینگ هوشمند", cost: DIAMOND_COSTS.HEADHUNTING, category: "deep_search" },
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
