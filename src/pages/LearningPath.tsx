import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  GraduationCap, Loader2, Download, CheckCircle2, BookOpen,
  Users, Calendar, AlertCircle, ArrowRight, Lightbulb, Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AuroraBackground from "@/components/AuroraBackground";
import { useSiteName } from "@/hooks/useSiteSettings";

interface HardSoftSkill {
  skill: string;
  reason: string;
}

interface RoadmapMonth {
  month: string;
  focus: string;
  actionItems: string[];
}

interface LearningPathResult {
  skillGapAnalysis: string;
  hardSkills: HardSoftSkill[];
  softSkills: HardSoftSkill[];
  roadmap: RoadmapMonth[];
}

const INDUSTRIES = [
  "فناوری اطلاعات",
  "مالی و بانکداری",
  "بهداشت و درمان",
  "تولید و صنعت",
  "بازاریابی و تبلیغات",
  "آموزش",
  "خرده‌فروشی",
  "نفت و انرژی",
  "حمل‌ونقل",
  "ساختمان و مسکن",
  "سایر",
];

const SENIORITY_LEVELS = [
  { value: "Junior", label: "Junior – جونیور" },
  { value: "Mid-Level", label: "Mid-Level – میانه" },
  { value: "Senior", label: "Senior – ارشد" },
  { value: "Lead", label: "Lead – سرپرست" },
  { value: "Manager", label: "Manager – مدیر" },
];

const EDUCATION_LEVELS = [
  { value: "Diploma", label: "دیپلم" },
  { value: "Bachelor", label: "لیسانس" },
  { value: "Master", label: "فوق لیسانس" },
  { value: "PhD", label: "دکترا" },
];

export default function LearningPath() {
  const { toast } = useToast();
  const siteName = useSiteName();
  const printRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    jobTitle: "",
    industry: "",
    seniorityLevel: "",
    educationLevel: "",
    experienceYears: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LearningPathResult | null>(null);

  const isFormValid =
    form.jobTitle.trim() &&
    form.industry &&
    form.seniorityLevel &&
    form.educationLevel &&
    form.experienceYears;

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast({ title: "لطفاً تمام فیلدها را پر کنید", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-learning-path", {
        body: {
          jobTitle: form.jobTitle,
          industry: form.industry,
          seniorityLevel: form.seniorityLevel,
          educationLevel: form.educationLevel,
          experienceYears: Number(form.experienceYears),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResult(data as LearningPathResult);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطا در ارتباط با سرور";
      toast({ title: "خطا", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Helmet>
        <title>طراح مسیر یادگیری | {siteName}</title>
        <meta name="description" content="نیازسنجی و تولید برنامه آموزشی هوشمند با هوش مصنوعی" />
      </Helmet>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #learning-path-result, #learning-path-result * { visibility: visible !important; }
          #learning-path-result { position: fixed; top: 0; left: 0; width: 100%; background: white; color: black; padding: 2rem; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />

        <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">طراح مسیر یادگیری</h1>
              <p className="text-sm text-muted-foreground">نیازسنجی و تولید برنامه آموزشی هوشمند با هوش مصنوعی</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT: Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <Card className="glass-card border-border/50 no-print">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    مشخصات شغلی
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Job Title */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">عنوان شغلی</Label>
                    <Input
                      placeholder="مثال: Senior Frontend Developer"
                      value={form.jobTitle}
                      onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
                      className="bg-secondary/40 border-border/60"
                      dir="ltr"
                    />
                  </div>

                  {/* Industry */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">صنعت</Label>
                    <Select value={form.industry} onValueChange={(v) => setForm((p) => ({ ...p, industry: v }))}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="انتخاب صنعت..." />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seniority */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">سطح ارشدیت</Label>
                    <Select value={form.seniorityLevel} onValueChange={(v) => setForm((p) => ({ ...p, seniorityLevel: v }))}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="انتخاب سطح..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SENIORITY_LEVELS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Education */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">سطح تحصیلات</Label>
                    <Select value={form.educationLevel} onValueChange={(v) => setForm((p) => ({ ...p, educationLevel: v }))}>
                      <SelectTrigger className="bg-secondary/40 border-border/60">
                        <SelectValue placeholder="انتخاب تحصیلات..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EDUCATION_LEVELS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Experience */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">سابقه کاری (سال)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      placeholder="مثال: 3"
                      value={form.experienceYears}
                      onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))}
                      className="bg-secondary/40 border-border/60"
                      dir="ltr"
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !isFormValid}
                    className="w-full mt-2"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        در حال تولید نقشه راه...
                      </>
                    ) : (
                      <>
                        <GraduationCap className="w-4 h-4 ml-2" />
                        تولید نقشه راه آموزشی با هوش مصنوعی
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* RIGHT: Output */}
            <div className="lg:col-span-3">
              {loading && <LoadingSkeleton />}

              {!loading && !result && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex items-center justify-center"
                >
                  <div className="text-center space-y-3 py-20">
                    <GraduationCap className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">
                      مشخصات شغلی را وارد کنید تا نقشه راه آموزشی شما تولید شود
                    </p>
                  </div>
                </motion.div>
              )}

              {!loading && result && (
                <motion.div
                  id="learning-path-result"
                  ref={printRef}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Download button */}
                  <div className="flex justify-end no-print">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                      <Download className="w-4 h-4" />
                      دانلود PDF
                    </Button>
                  </div>

                  {/* 1. Skill Gap Analysis */}
                  <Card className="glass-card border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        تحلیل شکاف مهارتی
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground leading-relaxed">{result.skillGapAnalysis}</p>
                    </CardContent>
                  </Card>

                  {/* 2. Hard Skills */}
                  <Card className="glass-card border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                        <Wrench className="w-4 h-4" />
                        توسعه مهارت‌های سخت (Hard Skills)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2.5">
                        {result.hardSkills.map((hs, i) => (
                          <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                            <Badge className="shrink-0 mt-0.5 bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                              <BookOpen className="w-3 h-3 ml-1" />
                              {hs.skill}
                            </Badge>
                            <p className="text-xs text-muted-foreground leading-relaxed">{hs.reason}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 3. Soft Skills */}
                  <Card className="glass-card border-purple-500/30 bg-purple-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-400">
                        <Users className="w-4 h-4" />
                        توسعه مهارت‌های نرم (Soft Skills)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2.5">
                        {result.softSkills.map((ss, i) => (
                          <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                            <Badge className="shrink-0 mt-0.5 bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                              {ss.skill}
                            </Badge>
                            <p className="text-xs text-muted-foreground leading-relaxed">{ss.reason}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4. Roadmap Timeline */}
                  <Card className="glass-card border-green-500/30 bg-green-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-green-400">
                        <Calendar className="w-4 h-4" />
                        نقشه راه اجرایی
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute right-[22px] top-4 bottom-4 w-0.5 bg-green-500/20" />

                        <div className="space-y-6">
                          {result.roadmap.map((item, i) => (
                            <div key={i} className="flex gap-4 items-start">
                              {/* Circle */}
                              <div className="shrink-0 w-11 h-11 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center z-10">
                                <span className="text-xs font-bold text-green-400">{i + 1}</span>
                              </div>
                              {/* Content */}
                              <div className="flex-1 pb-2">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-xs font-semibold text-green-300 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20">
                                    {item.month}
                                  </span>
                                  <span className="text-sm font-medium text-foreground">{item.focus}</span>
                                </div>
                                <ul className="space-y-1">
                                  {item.actionItems.map((action, j) => (
                                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                      <ArrowRight className="w-3 h-3 shrink-0 mt-0.5 text-green-400" />
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">هوش مصنوعی در حال تحلیل و تولید نقشه راه است...</span>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
