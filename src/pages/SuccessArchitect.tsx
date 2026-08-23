import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits, CREDIT_COSTS } from "@/hooks/useCredits";
import { ArrowRight, Route, Loader2, Sparkles, Download, Copy, Mail, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const seniorityLevels = [
  { value: "junior", label: "جونیور (۰-۲ سال)" },
  { value: "mid", label: "میانی (۲-۵ سال)" },
  { value: "senior", label: "ارشد (۵+ سال)" },
  { value: "lead", label: "سرپرست/مدیر" },
];

const expectations = [
  { value: "quick_delivery", label: "تحویل سریع و کارایی" },
  { value: "learning", label: "یادگیری و رشد" },
  { value: "leadership", label: "رهبری و مدیریت" },
  { value: "innovation", label: "نوآوری و خلاقیت" },
];

const SuccessArchitect = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [expectation, setExpectation] = useState("");
  const [mentorRole, setMentorRole] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { credits, hasEnoughCredits } = useCredits();

  const handleGenerate = async () => {
    if (!jobTitle || !seniority || !expectation) {
      toast({
        title: "خطا",
        description: "لطفاً تمام فیلدهای ضروری را پر کنید",
        variant: "destructive",
      });
      return;
    }

    // Check credits
    if (!hasEnoughCredits('ONBOARDING_PLAN')) {
      toast({
        title: "اعتبار ناکافی",
        description: `برای این عملیات ${CREDIT_COSTS.ONBOARDING_PLAN} جم نیاز دارید. اعتبار فعلی: ${credits}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedPlan("");
    setWelcomeEmail("");

    try {
      const { data, error } = await supabase.functions.invoke("generate-onboarding-plan", {
        body: {
          jobTitle,
          seniority,
          expectation,
          mentorRole,
        },
      });

      if (error) {
        console.error("Error:", error);
        const apiError = error as { context?: { status?: number } };
        const status = apiError.context?.status;
        
        if (status === 429) {
          toast({
            title: "محدودیت درخواست",
            description: "لطفاً کمی صبر کنید و دوباره تلاش کنید",
            variant: "destructive",
          });
        } else if (status === 402) {
          toast({
            title: "اعتبار ناکافی",
            description: "اعتبار هوش مصنوعی کافی نیست",
            variant: "destructive",
          });
        } else {
          toast({
            title: "خطا",
            description: "مشکلی در تولید نقشه راه پیش آمد",
            variant: "destructive",
          });
        }
        return;
      }

      if (data?.plan) {
        setGeneratedPlan(data.plan);
      }
      if (data?.welcomeEmail) {
        setWelcomeEmail(data.welcomeEmail);
      }

      toast({
        title: "موفق",
        description: "نقشه راه ۹۰ روزه با موفقیت تولید شد",
      });

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "خطا",
        description: "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "کپی شد",
        description: `${type} در کلیپ‌بورد کپی شد`,
      });
    } catch (err) {
      toast({
        title: "خطا",
        description: "کپی کردن با مشکل مواجه شد",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-12 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link to="/dashboard" className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              <ArrowRight className="w-5 h-5" />
              <span>بازگشت به داشبورد</span>
            </Link>
            <img src={logo} alt="لوگو" className="w-12 h-12" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">
              <Route className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">معمار موفقیت ۹۰ روزه</h1>
              <p className="text-primary-foreground/80 mt-1">
                طراحی نقشه راه جامع برای آنبوردینگ نیروی جدید
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              اطلاعات موقعیت شغلی
            </CardTitle>
            <CardDescription>
              جزئیات شغل را وارد کنید تا نقشه راه ۹۰ روزه تولید شود
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">عنوان شغل *</Label>
                <Input
                  id="jobTitle"
                  placeholder="مثال: مدیر محصول، برنامه‌نویس فرانت‌اند"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>سطح ارشدیت *</Label>
                <Select value={seniority} onValueChange={setSeniority}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seniorityLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>انتظار اصلی *</Label>
                <Select value={expectation} onValueChange={setExpectation}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    {expectations.map((exp) => (
                      <SelectItem key={exp.value} value={exp.value}>
                        {exp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mentorRole">نقش منتور/همراه (اختیاری)</Label>
                <Input
                  id="mentorRole"
                  placeholder="مثال: برنامه‌نویس ارشد، مدیر تیم"
                  value={mentorRole}
                  onChange={(e) => setMentorRole(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-12 text-lg gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  در حال تولید...
                </>
              ) : (
                <>
                  <Route className="w-5 h-5" />
                  تولید نقشه راه ۹۰ روزه
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result Section */}
        {generatedPlan && (
          <div ref={resultRef} className="mt-8 space-y-6">
            {/* 90-Day Plan */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Route className="w-5 h-5 text-primary" />
                    نقشه راه ۹۰ روزه
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(generatedPlan, "نقشه راه")}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    کپی
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert text-right">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {generatedPlan}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Welcome Email */}
            {welcomeEmail && (
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-green-600" />
                      ایمیل خوش‌آمدگویی
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(welcomeEmail, "ایمیل")}
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      کپی
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-right bg-muted/50 p-4 rounded-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {welcomeEmail}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuccessArchitect;
