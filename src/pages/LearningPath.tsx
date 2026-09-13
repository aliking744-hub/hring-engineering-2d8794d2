import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  GraduationCap, Loader2, Download, CheckCircle2, BookOpen,
  Users, Calendar, AlertCircle, ArrowRight, Lightbulb, Wrench,
  History, Trash2, Mail, ChevronDown, ChevronUp, UserCircle, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiRequest } from "@/lib/api";
import AuroraBackground from "@/components/AuroraBackground";
import { useSiteName } from "@/hooks/useSiteSettings";
import { useCredits } from "@/hooks/useCredits";
import { exportElementToPdf } from "@/lib/exportPdf";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { waitForPrintableAssets } from "@/lib/printDocument";

/* ─── Types ─────────────────────────────────────────────── */
interface HardSoftSkill { skill: string; reason: string; }
interface RoadmapMonth { month: string; focus: string; actionItems: string[]; }
interface LearningPathResult {
  skillGapAnalysis: string;
  hardSkills: HardSoftSkill[];
  softSkills: HardSoftSkill[];
  roadmap: RoadmapMonth[];
  trainingNote?: string;
}
interface SavedRecord {
  id: string;
  employee_name: string;
  employee_email: string | null;
  job_title: string;
  industry: string;
  seniority_level: string;
  education_level: string;
  field_of_study: string | null;
  experience_years: number;
  training_months: number | null;
  result: LearningPathResult;
  last_emailed_at: string | null;
  created_at: string;
}

/* ─── Constants ─────────────────────────────────────────── */
const SENIORITY_LEVELS = [
  { value: "Junior", label: "Junior – جونیور" },
  { value: "Mid-Level", label: "Mid-Level – میانه" },
  { value: "Senior", label: "Senior – ارشد" },
  { value: "Lead", label: "Lead – سرپرست" },
  { value: "Manager", label: "Manager – مدیر" },
];
const EDUCATION_LEVELS = [
  { value: "ZirDiplom", label: "زیر دیپلم" },
  { value: "Diploma", label: "دیپلم" },
  { value: "Bachelor", label: "لیسانس" },
  { value: "Master", label: "فوق لیسانس" },
  { value: "PhD", label: "دکترا" },
];

/* ─── Component ─────────────────────────────────────────── */
export default function LearningPath() {
  const { toast } = useToast();
  const siteName = useSiteName();
  const { credits, getCost } = useCredits();
  const printRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [form, setForm] = useState({
    employeeName: "",
    employeeEmail: "",
    jobTitle: "",
    industry: "",
    seniorityLevel: "",
    educationLevel: "",
    fieldOfStudy: "",
    experienceYears: "",
    trainingMonths: "",
  });

  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [result, setResult] = useState<LearningPathResult | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("generate");

  const isFormValid =
    form.jobTitle.trim() &&
    form.industry &&
    form.seniorityLevel &&
    form.educationLevel &&
    form.experienceYears;

  /* ── Fetch history ─────────────────────────────────────── */
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await apiRequest<SavedRecord[]>("/development/learning-paths"));
    } catch (error) {
      console.error("Learning-path history failed:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { void fetchHistory(); }, []);

  /* ── Generate ──────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!isFormValid) {
      toast({ title: "لطفاً فیلدهای ضروری را پر کنید", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setSavedRecordId(null);

    try {
      const requestKey = idempotencyKeyRef.current || crypto.randomUUID();
      idempotencyKeyRef.current = requestKey;
      const data = await apiRequest<SavedRecord>(
        "/development/learning-paths/generate",
        {
          method: "POST",
          headers: { "X-Idempotency-Key": requestKey },
          body: JSON.stringify({
            employee_name: form.employeeName.trim() || null,
            employee_email: form.employeeEmail || null,
            job_title: form.jobTitle,
            industry: form.industry,
            seniority_level: form.seniorityLevel,
            education_level: form.educationLevel,
            field_of_study: form.fieldOfStudy || null,
            experience_years: Number(form.experienceYears),
            training_months: form.trainingMonths ? Number(form.trainingMonths) : null,
          }),
        },
      );

      if (!data?.result || !Array.isArray(data.result.roadmap) || !Array.isArray(data.result.hardSkills) || !Array.isArray(data.result.softSkills)) {
        throw new Error("پاسخ مسیر یادگیری ناقص است؛ اعتبار شما کسر نشده یا در صورت کسر خودکار بازگردانده می‌شود.");
      }
      setResult(data.result);
      setSavedRecordId(data.id);
      idempotencyKeyRef.current = null;
      setHistory((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      window.dispatchEvent(new Event("hring:credits-changed"));
      const nameLabel = form.employeeName.trim() ? `برای ${form.employeeName}` : "";
      toast({ title: "نقشه راه ذخیره شد ✓", description: nameLabel });
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.status < 500 || e.status === 502)) {
        idempotencyKeyRef.current = null;
      }
      console.error("Learning-path generation failed:", e);
      const msg = e instanceof ApiError && e.status === 402
        ? "الماس کافی برای تولید مسیر یادگیری ندارید"
        : e instanceof ApiError && e.status === 502
          ? "سرویس هوش مصنوعی هنوز متصل یا در دسترس نیست"
          : e instanceof Error
            ? e.message
            : "خطا در ارتباط با سرور";
      toast({ title: "خطا", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ── Send Email ────────────────────────────────────────── */
  const handleSendEmail = async (record?: SavedRecord) => {
    const savedRecord = record || history.find((item) => item.id === savedRecordId);
    const targetEmail = savedRecord?.employee_email;
    const targetRecordId = record ? record.id : savedRecordId;

    if (!targetEmail) {
      toast({ title: "ایمیل کارمند وارد نشده", description: "لطفاً ایمیل کارمند را وارد کنید", variant: "destructive" });
      return;
    }
    if (!targetRecordId) {
      toast({ title: "ابتدا نقشه راه را تولید و ذخیره کنید", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      await apiRequest(`/development/learning-paths/${targetRecordId}/email`, {
        method: "POST",
      });
      toast({ title: "ایمیل ارسال شد ✓", description: `نقشه راه به ${targetEmail} ارسال شد` });
    } catch (e: unknown) {
      const description = e instanceof ApiError && e.status === 503
        ? "سرویس ایمیل روی سرور تنظیم نشده است. مدیر سامانه باید Resend و فرستندهٔ تأییدشده را فعال کند."
        : e instanceof Error
          ? e.message
          : "خطای ناشناخته";
      toast({ title: "خطا در ارسال ایمیل", description, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  /* ── Delete record ─────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/development/learning-paths/${id}`, { method: "DELETE" });
      setHistory((h) => h.filter((r) => r.id !== id));
      if (savedRecordId === id) {
        setSavedRecordId(null);
        setResult(null);
      }
      toast({ title: "رکورد حذف شد" });
    } catch (error) {
      toast({
        title: "حذف رکورد ناموفق بود",
        description: error instanceof Error ? error.message : "خطای ناشناخته",
        variant: "destructive",
      });
    }
  };

  const handlePrint = async () => {
    await waitForPrintableAssets(printRef.current || document);
    window.print();
  };
  const handleDownload = async () => {
    if (!printRef.current) return;
    await exportElementToPdf(printRef.current, {
      filename: "HRing-learning-path.pdf",
    });
  };

  /* ── Render ────────────────────────────────────────────── */
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
          #learning-path-result {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 2rem;
          }
          #learning-path-result * {
            color: black !important;
            background: white !important;
            border-color: #e2e8f0 !important;
            box-shadow: none !important;
          }
          #learning-path-result .space-y-5 > * {
            page-break-inside: avoid;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <WorkspaceHeader title="طراح مسیر یادگیری" subtitle="نیازسنجی و تولید برنامه آموزشی هوشمند با هوش مصنوعی" icon={<GraduationCap className="h-6 w-6" />} />
        <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 no-print">
              <TabsTrigger value="generate" className="gap-2">
                <GraduationCap className="w-4 h-4" /> تولید نقشه راه
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2" onClick={fetchHistory}>
                <History className="w-4 h-4" />
                تاریخچه
                {history.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{history.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ─── TAB: Generate ─────────────────────────────────── */}
            <TabsContent value="generate">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* RIGHT (in RTL = visual right = grid col first rendered): Output */}
                <div className="lg:col-span-3 order-2 lg:order-1">
                  {loading && <LoadingSkeleton />}

                  {!loading && !result && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center">
                      <div className="text-center space-y-3 py-20">
                        <GraduationCap className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                        <p className="text-muted-foreground text-sm">مشخصات کارمند و شغل را وارد کنید تا نقشه راه آموزشی تولید شود</p>
                      </div>
                    </motion.div>
                  )}

                  {!loading && result && (
                    <motion.div id="learning-path-result" ref={printRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

                      {/* Action buttons */}
                      <div className="flex items-center justify-between no-print">
                        <div className="flex items-center gap-2">
                          {savedRecordId && (
                            <Badge variant="outline" className="gap-1 text-xs border-green-500/40 text-green-400">
                              <CheckCircle2 className="w-3 h-3" /> ذخیره شد
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {form.employeeEmail && (
                            <Button variant="outline" size="sm" onClick={() => handleSendEmail()} disabled={sendingEmail} className="gap-2">
                              {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              ارسال به ایمیل
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => void handleDownload()} className="gap-2">
                            <Download className="w-4 h-4" /> دانلود PDF
                          </Button>
                        </div>
                      </div>

                      <ResultView result={result} employeeName={form.employeeName} jobTitle={form.jobTitle} />
                    </motion.div>
                  )}
                </div>

                {/* LEFT (in RTL = visual left = form): Form */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 order-1 lg:order-2">
                  <Card className="glass-card border-border/50 no-print">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 justify-end">
                        اطلاعات کارمند و شغل
                        <UserCircle className="w-4 h-4 text-primary" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                      {/* ── Employee Info section ── */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                        <p className="text-xs font-semibold text-primary text-right">مشخصات کارمند</p>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">
                            نام و نام خانوادگی
                            <span className="text-muted-foreground text-xs mr-1">(اختیاری)</span>
                          </Label>
                          <Input
                            placeholder="مثال: علی محمدی"
                            value={form.employeeName}
                            onChange={(e) => setForm((p) => ({ ...p, employeeName: e.target.value }))}
                            className="bg-background/50 border-border/60 text-right"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">
                            ایمیل کارمند
                            <span className="text-muted-foreground text-xs mr-1">(برای ارسال نقشه راه)</span>
                          </Label>
                          <Input
                            type="email"
                            placeholder="example@company.com"
                            value={form.employeeEmail}
                            onChange={(e) => setForm((p) => ({ ...p, employeeEmail: e.target.value }))}
                            className="bg-background/50 border-border/60"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* ── Job Info section ── */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground text-right">مشخصات شغلی</p>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">عنوان شغلی <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="مثال: Senior Frontend Developer"
                            value={form.jobTitle}
                            onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
                            className="bg-secondary/40 border-border/60"
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">صنعت <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="مثال: فناوری اطلاعات، بانکداری..."
                            value={form.industry}
                            onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                            className="bg-secondary/40 border-border/60 text-right"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">سطح ارشدیت <span className="text-destructive">*</span></Label>
                          <Select value={form.seniorityLevel} onValueChange={(v) => setForm((p) => ({ ...p, seniorityLevel: v }))}>
                            <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue placeholder="انتخاب سطح..." /></SelectTrigger>
                            <SelectContent>{SENIORITY_LEVELS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">سطح تحصیلات <span className="text-destructive">*</span></Label>
                          <Select value={form.educationLevel} onValueChange={(v) => setForm((p) => ({ ...p, educationLevel: v }))}>
                            <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue placeholder="انتخاب تحصیلات..." /></SelectTrigger>
                            <SelectContent>{EDUCATION_LEVELS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">رشته تحصیلی</Label>
                          <Input
                            placeholder="مثال: مهندسی نرم‌افزار، مدیریت..."
                            value={form.fieldOfStudy}
                            onChange={(e) => setForm((p) => ({ ...p, fieldOfStudy: e.target.value }))}
                            className="bg-secondary/40 border-border/60 text-right"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">سابقه کاری مرتبط (سال) <span className="text-destructive">*</span></Label>
                          <Input type="number" min={0} max={40} placeholder="مثال: 3"
                            value={form.experienceYears}
                            onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))}
                            className="bg-secondary/40 border-border/60" dir="ltr" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm text-right block">مدت زمان آموزش تا پایان سال (ماه)</Label>
                          <p className="text-xs text-muted-foreground text-right">چقدر وقت واقعی برای آموزش دارید؟</p>
                          <Input type="number" min={1} max={12} placeholder="مثال: 4"
                            value={form.trainingMonths}
                            onChange={(e) => setForm((p) => ({ ...p, trainingMonths: e.target.value }))}
                            className="bg-secondary/40 border-border/60" dir="ltr" />
                        </div>
                      </div>

                      <Button onClick={handleSubmit} disabled={loading || !isFormValid || credits < getCost('LEARNING_PATH')} className="w-full mt-2" size="lg">
                        {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />در حال تولید نقشه راه...</> :
                          <><GraduationCap className="w-4 h-4 ml-2" />تولید نقشه راه آموزشی ({getCost('LEARNING_PATH')} الماس)</>}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

              </div>
            </TabsContent>

            {/* ─── TAB: History ──────────────────────────────────── */}
            <TabsContent value="history">
              <div className="max-w-4xl mx-auto space-y-4">
                {historyLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                  </div>
                )}

                {!historyLoading && history.length === 0 && (
                  <div className="text-center py-20 space-y-3">
                    <History className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground">هنوز نقشه راهی ذخیره نشده است</p>
                  </div>
                )}

                {!historyLoading && history.map((rec) => (
                  <Card key={rec.id} className="glass-card border-border/50">
                    <CardContent className="p-4">
                      {/* Record header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                            <UserCircle className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{rec.employee_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{rec.job_title} · {rec.industry}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {new Date(rec.created_at).toLocaleDateString("fa-IR")}
                          </span>
                          {rec.employee_email && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                              onClick={() => handleSendEmail(rec)} title="ارسال ایمیل">
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => setExpandedRecord(expandedRecord === rec.id ? null : rec.id)}>
                            {expandedRecord === rec.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(rec.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <Badge variant="secondary" className="text-xs">{rec.seniority_level}</Badge>
                        <Badge variant="secondary" className="text-xs">{rec.education_level}</Badge>
                        <Badge variant="secondary" className="text-xs">{rec.experience_years} سال سابقه</Badge>
                        {rec.training_months && <Badge variant="secondary" className="text-xs">{rec.training_months} ماه آموزش</Badge>}
                        {rec.employee_email && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary/70">
                            <Mail className="w-2.5 h-2.5 ml-1" />{rec.employee_email}
                          </Badge>
                        )}
                      </div>

                      {/* Expanded roadmap */}
                      <AnimatePresence>
                        {expandedRecord === rec.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className="mt-4 pt-4 border-t border-border/40">
                              <ResultView result={rec.result} employeeName={rec.employee_name} jobTitle={rec.job_title} compact />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

/* ─── ResultView ────────────────────────────────────────── */
function ResultView({ result, employeeName, jobTitle, compact = false }: {
  result: LearningPathResult; employeeName: string; jobTitle: string; compact?: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Employee badge */}
      <div className="flex items-center gap-2">
        <UserCircle className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{employeeName} · {jobTitle}</span>
      </div>

      {/* Training note */}
      {result.trainingNote && (
        <Card className="glass-card border-primary/40 bg-primary/5">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">{result.trainingNote}</p>
          </CardContent>
        </Card>
      )}

      {/* 1. Skill Gap */}
      <Card className="glass-card border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            <AlertCircle className="w-4 h-4" /> تحلیل شکاف مهارتی
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-7">{result.skillGapAnalysis}</p>
        </CardContent>
      </Card>

      {/* 2+3. Skills side by side if not compact */}
      <div className={compact ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        {/* Hard Skills */}
        <Card className="glass-card border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <Wrench className="w-4 h-4" /> مهارت‌های سخت
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.hardSkills.map((hs, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-sm font-semibold text-foreground">{hs.skill}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-6 pr-5">{hs.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Soft Skills */}
        <Card className="glass-card border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-400">
              <Users className="w-4 h-4" /> مهارت‌های نرم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.softSkills.map((ss, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-sm font-semibold text-foreground">{ss.skill}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-6 pr-5">{ss.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Roadmap */}
      <Card className="glass-card border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-green-400">
            <Calendar className="w-4 h-4" /> نقشه راه اجرایی – اولویت‌بندی واقع‌بینانه
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">در بازه زمانی موجود، این دوره‌ها را به ترتیب اولویت طی کنید</p>
        </CardHeader>
        <CardContent>
          <div className="relative pr-2">
            <div className="absolute right-[26px] top-6 bottom-6 w-0.5 bg-green-500/20" />
            <div className="space-y-6">
              {result.roadmap.map((item, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center z-10">
                    <span className="text-sm font-bold text-green-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 pb-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-green-300 bg-green-500/10 px-2.5 py-1 rounded-md border border-green-500/20">
                        {item.month}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{item.focus}</span>
                    </div>
                    <ul className="space-y-2">
                      {item.actionItems.map((action, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground leading-6">
                          <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-1 text-green-400" />
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
    </div>
  );
}

/* ─── LoadingSkeleton ───────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">هوش مصنوعی در حال تحلیل...</span>
      </div>
      {[140, 180, 160, 220].map((h, i) => (
        <Skeleton key={i} className="w-full rounded-xl" style={{ height: h }} />
      ))}
    </div>
  );
}
