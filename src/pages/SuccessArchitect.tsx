import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiRequest } from "@/lib/api";
import { ArrowRight, Route, Loader2, Sparkles, Copy, Mail, History, Award, CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.png";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  id: string;
  job_title: string;
  plan: string;
  welcomeEmail: string;
  progress: { completedTaskIndexes?: number[]; totalTasks?: number };
  status: "active" | "completed" | "failed";
  score: number | null;
  completed_at: string | null;
  created_at: string;
}

const SuccessArchitect = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [expectation, setExpectation] = useState("");
  const [mentorRole, setMentorRole] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [activePlan, setActivePlan] = useState<OnboardingPlanResponse | null>(null);
  const [history, setHistory] = useState<OnboardingPlanResponse[]>([]);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("plan");
  const [isLoading, setIsLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const { toast } = useToast();

  const tasks = useMemo(
    () => generatedPlan.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, "")),
    [generatedPlan],
  );

  const fetchHistory = async () => {
    try {
      setHistory(await apiRequest<OnboardingPlanResponse[]>("/development/onboarding-plans"));
    } catch (error) {
      console.error("Onboarding history failed:", error);
    }
  };

  useEffect(() => { void fetchHistory(); }, []);

  const handleGenerate = async () => {
    if (!jobTitle || !seniority || !expectation) {
      toast({
        title: "خطا",
        description: "لطفاً تمام فیلدهای ضروری را پر کنید",
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
            job_title: jobTitle,
            seniority,
            expectation,
            mentor_role: mentorRole || null,
          }),
        },
      );

      setGeneratedPlan(data.plan);
      setWelcomeEmail(data.welcomeEmail);
      setActivePlan(data);
      setCompletedTasks(data.progress.completedTaskIndexes || []);
      setHistory((current) => [data, ...current.filter((item) => item.id !== data.id)]);
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

  const saveProgress = async (nextCompleted: number[], finalize = false) => {
    if (!activePlan || tasks.length === 0) return;
    try {
      const updated = await apiRequest<OnboardingPlanResponse>(
        `/development/onboarding-plans/${activePlan.id}/progress`,
        {
          method: "PUT",
          body: JSON.stringify({
            completed_task_indexes: nextCompleted,
            total_tasks: tasks.length,
            finalize,
          }),
        },
      );
      setActivePlan(updated);
      setCompletedTasks(updated.progress.completedTaskIndexes || []);
      setHistory((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (finalize) {
        toast(updated.status === "completed"
          ? { title: "برنامه با موفقیت تکمیل شد", description: `امتیاز نهایی: ${updated.score} از ۱۰۰` }
          : { title: "برنامه تکمیل نشد", description: `امتیاز ${updated.score} کمتر از حد نصاب ۵۰ است`, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "ذخیره پیشرفت ناموفق بود", description: error instanceof Error ? error.message : "خطای ناشناخته", variant: "destructive" });
    }
  };

  const openHistoryPlan = (plan: OnboardingPlanResponse) => {
    setActivePlan(plan);
    setGeneratedPlan(plan.plan);
    setWelcomeEmail(plan.welcomeEmail);
    setCompletedTasks(plan.progress.completedTaskIndexes || []);
    setActiveTab("plan");
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="plan" className="gap-2"><Route className="w-4 h-4" />نقشه راه ۹۰ روزه</TabsTrigger>
            <TabsTrigger value="history" className="gap-2" onClick={fetchHistory}><History className="w-4 h-4" />تاریخچه</TabsTrigger>
          </TabsList>
          <TabsContent value="plan">
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

            {tasks.length > 0 && activePlan && (
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" />اقدام‌های برنامه</CardTitle>
                  <CardDescription>هر اقدام را پس از انجام علامت بزنید؛ پیشرفت در حساب شما ذخیره می‌شود.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tasks.map((task, index) => (
                    <label key={`${index}-${task}`} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                      <Checkbox
                        checked={completedTasks.includes(index)}
                        disabled={activePlan.status !== "active"}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...completedTasks, index].sort((a, b) => a - b)
                            : completedTasks.filter((item) => item !== index);
                          void saveProgress(next);
                        }}
                      />
                      <span className="text-sm leading-7">{task}</span>
                    </label>
                  ))}
                  {activePlan.status === "active" && (
                    <Button className="w-full" onClick={() => saveProgress(completedTasks, true)}>پایان برنامه و محاسبه امتیاز</Button>
                  )}
                  {activePlan.status === "failed" && <p className="text-destructive text-sm">امتیاز {activePlan.score} کمتر از حد نصاب ۵۰ است؛ گواهی صادر نمی‌شود.</p>}
                  {activePlan.status === "completed" && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center">
                      <Award className="w-10 h-10 text-green-500 mx-auto mb-2" />
                      <h3 className="font-bold">گواهی پایان نقشه راه ۹۰ روزه</h3>
                      <p className="text-sm mt-1">{activePlan.job_title} — امتیاز {activePlan.score} از ۱۰۰</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
          </TabsContent>
          <TabsContent value="history">
            <div className="space-y-3">
              {history.length === 0 ? <p className="text-muted-foreground text-center py-12">هنوز برنامه‌ای ثبت نشده است.</p> : history.map((item) => (
                <Card key={item.id} className="cursor-pointer hover:border-primary/50" onClick={() => openHistoryPlan(item)}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div><p className="font-semibold">{item.job_title}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("fa-IR")}</p></div>
                    <div className="text-left text-sm">{item.status === "completed" ? `گواهی — امتیاز ${item.score}` : item.status === "failed" ? `ناموفق — امتیاز ${item.score}` : "در حال اجرا"}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuccessArchitect;
