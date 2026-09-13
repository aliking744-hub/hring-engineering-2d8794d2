import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiRequest } from "@/lib/api";
import { ArrowRight, Route, Loader2, Sparkles, Copy, Mail, Download } from "lucide-react";
import logo from "@/assets/logo.png";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCredits } from "@/hooks/useCredits";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { exportElementToPdf } from "@/lib/exportPdf";

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

interface OnboardingPlanResponse {
  plan: string;
  welcomeEmail: string;
}

const SuccessArchitect = () => {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [expectation, setExpectation] = useState("");
  const [mentorRole, setMentorRole] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { credits, getCost } = useCredits();

  const handleGenerate = async () => {
    if (!employeeName.trim() || !jobTitle || !seniority || !expectation) {
      toast({
        title: "خطا",
        description: "نام کارمند و تمام فیلدهای ضروری را پر کنید",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedPlan("");
    setWelcomeEmail("");

    try {
      const requestKey = idempotencyKeyRef.current || crypto.randomUUID();
      idempotencyKeyRef.current = requestKey;
      const data = await apiRequest<OnboardingPlanResponse>(
        "/development/onboarding-plans/generate",
        {
          method: "POST",
          headers: { "X-Idempotency-Key": requestKey },
          body: JSON.stringify({
            employee_name: employeeName.trim(),
            employee_email: employeeEmail.trim() || null,
            starts_on: /^\d{4}-\d{2}-\d{2}$/.test(startsOn) ? startsOn : null,
            starts_on_display: startsOn.trim() || null,
            company_name: companyName.trim() || null,
            job_title: jobTitle,
            seniority,
            expectation,
            mentor_role: mentorRole || null,
          }),
        },
      );

      setGeneratedPlan(data.plan);
      setWelcomeEmail(data.welcomeEmail);
      idempotencyKeyRef.current = null;
      window.dispatchEvent(new Event("hring:credits-changed"));

      toast({
        title: "موفق",
        description: "نقشه راه ۹۰ روزه با موفقیت تولید و ذخیره شد",
      });

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error:", err);
      if (err instanceof ApiError && (err.status < 500 || err.status === 502)) {
        idempotencyKeyRef.current = null;
      }
      if (err instanceof ApiError && err.status === 402) {
        toast({
          title: "اعتبار ناکافی",
          description: "برای تولید این برنامه اعتبار کافی ندارید",
          variant: "destructive",
        });
      } else if (err instanceof ApiError && err.status === 502) {
        toast({
          title: "سرویس هوش مصنوعی آماده نیست",
          description: "اتصال ارائه‌دهنده هوش مصنوعی را بررسی کنید و دوباره تلاش کنید",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطا",
          description: "مشکلی در تولید نقشه راه پیش آمد. دوباره تلاش کنید.",
          variant: "destructive",
        });
      }
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

  const handleDownload = async () => {
    if (!resultRef.current) return;
    await exportElementToPdf(resultRef.current, {
      filename: `HRing-onboarding-${employeeName || "report"}.pdf`,
    });
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <WorkspaceHeader title="معمار موفقیت ۹۰ روزه" subtitle="طراحی نقشه راه جامع برای آنبوردینگ نیروی جدید" icon={<Route className="h-6 w-6" />} />

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
                <Label htmlFor="employeeName">نام کارمند *</Label>
                <Input
                  id="employeeName"
                  placeholder="مثال: سارا احمدی"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsOn">تاریخ شروع (شمسی یا میلادی)</Label>
                <Input id="startsOn" placeholder="مثال: ۱۴۰۵/۰۶/۱۵" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">نام سازمان</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="مثال: HRing" />
              </div>
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
                <Label htmlFor="employeeEmail">ایمیل کارمند (اختیاری)</Label>
                <Input
                  id="employeeEmail"
                  type="email"
                  dir="ltr"
                  placeholder="employee@company.com"
                  value={employeeEmail}
                  onChange={(e) => setEmployeeEmail(e.target.value)}
                />
              </div>
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
              disabled={isLoading || credits < getCost('ONBOARDING_PLAN')}
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
                  تولید نقشه راه ۹۰ روزه و ایمیل خوش‌آمدگویی ({getCost('ONBOARDING_PLAN')} جم)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result Section */}
        {generatedPlan && (
          <div ref={resultRef} className="mt-8 space-y-6">
            <div className="flex justify-end no-print">
              <Button variant="outline" onClick={() => void handleDownload()} className="gap-2">
                <Download className="h-4 w-4" /> دانلود PDF
              </Button>
            </div>
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
                <CardDescription>تسک‌های قابل پیگیری برنامه در «نقشه راه ۹۰ روزه» در دسترس‌اند.</CardDescription>
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
