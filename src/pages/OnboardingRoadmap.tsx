import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Award, Calendar, CheckCircle2, Circle, ClipboardList, History, Loader2, Plus, Printer, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { apiRequest } from "@/lib/api";

type TaskStatus = "todo" | "in_progress" | "completed" | "blocked";
type PlanStatus = "active" | "completed" | "failed";
type ViewMode = "active" | "history";
type RecipientTitle = "mr" | "ms";

interface OnboardingTask {
  id: string; parent_task_id: string | null; title: string; details: string | null;
  assignee_label: string | null; due_on: string | null; status: TaskStatus; sort_order: number;
}
interface OnboardingPlan {
  id: string; employee_name: string | null; employee_email: string | null; starts_on: string | null;
  job_title: string; mentor_role: string | null; status: PlanStatus; score: number | null;
  completed_at: string | null; certificate_number: string | null;
  certificate_recipient_title: RecipientTitle | null; certificate_issued_at: string | null;
  tasks: OnboardingTask[];
}
interface CertificateResponse {
  certificate_number: string; recipient_title: RecipientTitle; recipient_name: string;
  job_title: string; score: number; completed_at: string; issued_at: string; statement: string;
}

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(value))
  : "ثبت نشده";
const leafTasks = (tasks: OnboardingTask[]) => {
  const parentIds = new Set(tasks.filter((task) => task.parent_task_id).map((task) => task.parent_task_id));
  return tasks.filter((task) => !parentIds.has(task.id));
};
const progressOf = (tasks: OnboardingTask[]) => tasks.length
  ? Math.round(tasks.filter((task) => task.status === "completed").length * 100 / tasks.length)
  : 0;

const OnboardingRoadmap = () => {
  const { toast } = useToast();
  const { credits, getCost } = useCredits();
  const [plans, setPlans] = useState<OnboardingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [completingPlan, setCompletingPlan] = useState(false);
  const [issuingCertificate, setIssuingCertificate] = useState(false);
  const [recipientTitle, setRecipientTitle] = useState<RecipientTitle>("mr");
  const [certificate, setCertificate] = useState<CertificateResponse | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueOn, setNewTaskDueOn] = useState("");
  const [newTaskParentId, setNewTaskParentId] = useState("root");

  const loadPlans = useCallback(async (preferredId?: string) => {
    setLoading(true);
    try {
      const response = await apiRequest<OnboardingPlan[]>("/development/onboarding-plans");
      setPlans(response);
      setSelectedPlanId((current) => {
        const wanted = preferredId || current;
        return wanted && response.some((plan) => plan.id === wanted) ? wanted : response[0]?.id ?? null;
      });
    } catch (error) {
      toast({ title: "خطا", description: error instanceof Error ? error.message : "دریافت نقشه‌ها انجام نشد", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);
  const visiblePlans = useMemo(() => plans.filter((plan) =>
    viewMode === "active" ? plan.status === "active" : plan.status !== "active"), [plans, viewMode]);
  const selectedPlan = visiblePlans.find((plan) => plan.id === selectedPlanId) ?? visiblePlans[0] ?? null;
  const roots = useMemo(() => selectedPlan?.tasks.filter((task) => !task.parent_task_id) ?? [], [selectedPlan]);
  const scoredTasks = selectedPlan ? leafTasks(selectedPlan.tasks) : [];
  const overallProgress = selectedPlan?.status === "active" ? progressOf(scoredTasks) : selectedPlan?.score ?? 0;

  useEffect(() => {
    if (!selectedPlan?.certificate_number || !selectedPlan.certificate_issued_at || !selectedPlan.completed_at) {
      setCertificate(null); return;
    }
    const selectedTitle = selectedPlan.certificate_recipient_title || "mr";
    const title = selectedTitle === "ms" ? "سرکار خانم" : "جناب آقای";
    const name = selectedPlan.employee_name || "کارمند گرامی";
    setRecipientTitle(selectedTitle);
    setCertificate({ certificate_number: selectedPlan.certificate_number, recipient_title: selectedTitle,
      recipient_name: name, job_title: selectedPlan.job_title, score: selectedPlan.score ?? 0,
      completed_at: selectedPlan.completed_at, issued_at: selectedPlan.certificate_issued_at,
      statement: `${title} ${name} دوره آزمایشی را با نمره ${selectedPlan.score ?? 0} از ۱۰۰ به پایان رسانده است.` });
  }, [selectedPlan]);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedPlanId(plans.find((plan) => mode === "active" ? plan.status === "active" : plan.status !== "active")?.id ?? null);
  };

  const updateTaskStatus = async (task: OnboardingTask) => {
    if (!selectedPlan || selectedPlan.status !== "active") return;
    setBusyTaskId(task.id);
    try {
      await apiRequest(`/development/onboarding-plans/${selectedPlan.id}/tasks/${task.id}`, {
        method: "PATCH", body: JSON.stringify({ status: task.status === "completed" ? "todo" : "completed" }),
      });
      await loadPlans(selectedPlan.id);
    } catch (error) {
      toast({ title: "خطا", description: error instanceof Error ? error.message : "به‌روزرسانی انجام نشد", variant: "destructive" });
    } finally { setBusyTaskId(null); }
  };

  const addTask = async () => {
    if (!selectedPlan || !newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      await apiRequest(`/development/onboarding-plans/${selectedPlan.id}/tasks`, {
        method: "POST", body: JSON.stringify({ title: newTaskTitle.trim(),
          parent_task_id: newTaskParentId === "root" ? null : newTaskParentId,
          assignee_label: newTaskAssignee.trim() || null, due_on: newTaskDueOn || null,
          sort_order: selectedPlan.tasks.length + 1 }),
      });
      setNewTaskTitle(""); setNewTaskAssignee(""); setNewTaskDueOn("");
      await loadPlans(selectedPlan.id);
      toast({ title: newTaskParentId === "root" ? "مرحله اضافه شد" : "زیرتسک اضافه شد" });
    } catch (error) {
      toast({ title: "خطا", description: error instanceof Error ? error.message : "ساخت تسک انجام نشد", variant: "destructive" });
    } finally { setCreatingTask(false); }
  };

  const completePlan = async () => {
    if (!selectedPlan) return;
    setCompletingPlan(true);
    try {
      const finalized = await apiRequest<OnboardingPlan>(`/development/onboarding-plans/${selectedPlan.id}/complete`, { method: "POST" });
      setViewMode("history"); await loadPlans(finalized.id);
      toast({ title: "دوره پایان یافت و به تاریخچه منتقل شد", description: `نمره نهایی: ${(finalized.score ?? 0).toLocaleString("fa-IR")} از ۱۰۰` });
    } catch (error) {
      toast({ title: "خطا", description: error instanceof Error ? error.message : "پایان دوره ثبت نشد", variant: "destructive" });
    } finally { setCompletingPlan(false); }
  };

  const issueCertificate = async () => {
    if (!selectedPlan) return;
    setIssuingCertificate(true);
    try {
      const result = await apiRequest<CertificateResponse>(`/development/onboarding-plans/${selectedPlan.id}/certificate`, {
        method: "POST", body: JSON.stringify({ recipient_title: recipientTitle }),
      });
      setCertificate(result); window.dispatchEvent(new Event("hring:credits-changed"));
      await loadPlans(selectedPlan.id);
      toast({ title: "گواهی صادر شد", description: "چاپ مجدد این گواهی رایگان است." });
    } catch (error) {
      toast({ title: "صدور گواهی انجام نشد", description: error instanceof Error ? error.message : "دوباره تلاش کنید", variant: "destructive" });
    } finally { setIssuingCertificate(false); }
  };

  return <div className="relative min-h-screen" dir="rtl">
    <style>{`@media print { body * { visibility: hidden !important; } #onboarding-certificate, #onboarding-certificate * { visibility: visible !important; } #onboarding-certificate { position: fixed; inset: 0; width: 100%; min-height: 100vh; background: white !important; color: #111 !important; padding: 18mm; } }`}</style>
    <AuroraBackground />
    <div className="relative z-10 container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><Link to="/dashboard"><Button variant="outline" className="gap-2"><ArrowRight className="h-5 w-5" />داشبورد</Button></Link><div><h1 className="flex items-center gap-2 text-2xl font-bold"><UserRound className="h-6 w-6 text-primary" />نقشه راه ۹۰ روزه</h1><p className="text-muted-foreground">زیرتسک‌ها، پیشرفت دوره، تاریخچه و گواهی پایان دوره</p></div></div>
        <Link to="/success-architect"><Button className="gap-2"><Plus className="h-4 w-4" />ساخت نقشه راه جدید</Button></Link>
      </div>
      <div className="mb-6 flex gap-2"><Button variant={viewMode === "active" ? "default" : "outline"} onClick={() => switchView("active")}>دوره‌های فعال</Button><Button variant={viewMode === "history" ? "default" : "outline"} onClick={() => switchView("history")} className="gap-2"><History className="h-4 w-4" />تاریخچه</Button></div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div> : !selectedPlan
        ? <div className="glass-card mx-auto max-w-2xl p-10 text-center"><ClipboardList className="mx-auto mb-4 h-12 w-12 text-primary" /><h2 className="text-xl font-bold">{viewMode === "active" ? "دوره فعالی وجود ندارد" : "تاریخچه خالی است"}</h2><Link to="/success-architect"><Button className="mt-5">ساخت اولین نقشه راه</Button></Link></div>
        : <>
          <div className="mb-6 flex gap-2 overflow-x-auto">{visiblePlans.map((plan) => <Button key={plan.id} variant={plan.id === selectedPlan.id ? "default" : "outline"} onClick={() => setSelectedPlanId(plan.id)}>{plan.employee_name || "بدون نام"} · {plan.job_title}</Button>)}</div>
          <div className="glass-card mb-6 p-6"><div className="mb-4 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{selectedPlan.employee_name || "کارمند نام‌گذاری‌نشده"} · {selectedPlan.job_title}</h2><p className="text-sm text-muted-foreground">شروع: {formatDate(selectedPlan.starts_on)} · منتور: {selectedPlan.mentor_role || "مدیر مستقیم"}</p></div><Badge>{selectedPlan.status === "active" ? `${scoredTasks.filter((task) => task.status === "completed").length.toLocaleString("fa-IR")} از ${scoredTasks.length.toLocaleString("fa-IR")} زیرتسک` : `نمره ${(selectedPlan.score ?? 0).toLocaleString("fa-IR")} از ۱۰۰`}</Badge></div><div className="mb-2 flex justify-between text-sm"><span>پیشرفت کل</span><strong className="text-primary">{overallProgress.toLocaleString("fa-IR")}٪</strong></div><Progress value={overallProgress} className="h-3" />{selectedPlan.status === "active" && <Button className="mt-5" variant="destructive" onClick={() => void completePlan()} disabled={completingPlan}>{completingPlan && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}پایان دوره با همین درصد</Button>}</div>
          {selectedPlan.status === "active" && <div className="grid gap-5 lg:grid-cols-3">{roots.map((root, index) => {
            const children = selectedPlan.tasks.filter((task) => task.parent_task_id === root.id);
            const rootProgress = children.length ? progressOf(children) : root.status === "completed" ? 100 : 0;
            return <motion.section key={root.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} className="glass-card p-5"><div className="mb-3 flex items-start gap-3">{children.length === 0 && <button onClick={() => void updateTaskStatus(root)}>{root.status === "completed" ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-primary" />}</button>}<div className="flex-1"><h3 className="font-bold">{root.title}</h3>{root.details && <p className="mt-1 text-sm text-muted-foreground">{root.details}</p>}</div></div><div className="mb-4"><div className="mb-1 flex justify-between text-xs"><span>پیشرفت مرحله</span><span>{rootProgress.toLocaleString("fa-IR")}٪</span></div><Progress value={rootProgress} /></div><div className="space-y-2">{children.map((child) => <button key={child.id} disabled={busyTaskId === child.id} onClick={() => void updateTaskStatus(child)} className="flex w-full items-start gap-2 rounded-lg border p-3 text-right hover:bg-muted/50 disabled:opacity-60">{busyTaskId === child.id ? <Loader2 className="mt-0.5 h-5 w-5 animate-spin" /> : child.status === "completed" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />}<span className={child.status === "completed" ? "text-muted-foreground line-through" : ""}>{child.title}</span></button>)}</div>{root.due_on && <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />موعد: {formatDate(root.due_on)}</p>}</motion.section>;
          })}</div>}
          {selectedPlan.status === "active" && <div className="glass-card mt-6 p-6"><h2 className="mb-4 text-lg font-semibold">افزودن مرحله یا زیرتسک</h2><div className="grid gap-3 md:grid-cols-4"><div className="space-y-1"><Label>نوع / مرحله مادر</Label><select value={newTaskParentId} onChange={(event) => setNewTaskParentId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3"><option value="root">مرحله جدید</option>{roots.map((root) => <option key={root.id} value={root.id}>زیرتسکِ {root.title}</option>)}</select></div><div className="space-y-1"><Label>عنوان *</Label><Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} /></div><div className="space-y-1"><Label>مسئول</Label><Input value={newTaskAssignee} onChange={(event) => setNewTaskAssignee(event.target.value)} /></div><div className="space-y-1"><Label>موعد</Label><Input type="date" value={newTaskDueOn} onChange={(event) => setNewTaskDueOn(event.target.value)} /></div></div><Button className="mt-4" onClick={() => void addTask()} disabled={creatingTask || !newTaskTitle.trim()}>{creatingTask ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}افزودن</Button></div>}
          {selectedPlan.status !== "active" && <div className="glass-card p-6"><div className="mb-5 flex items-center gap-3"><Award className="h-10 w-10 text-amber-500" /><div><h2 className="text-xl font-bold">گواهی پایان دوره آزمایشی</h2><p className="text-sm text-muted-foreground">نمره ثبت‌شده تغییر نمی‌کند و گواهی در تاریخچه باقی می‌ماند.</p></div></div>{!certificate ? <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label>عنوان خطاب</Label><select value={recipientTitle} onChange={(event) => setRecipientTitle(event.target.value as RecipientTitle)} className="h-10 rounded-md border bg-background px-3"><option value="mr">جناب آقای</option><option value="ms">سرکار خانم</option></select></div><Button onClick={() => void issueCertificate()} disabled={issuingCertificate || credits < getCost("ONBOARDING_CERTIFICATE")} className="gap-2">{issuingCertificate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}صدور گواهی ({getCost("ONBOARDING_CERTIFICATE")} جم)</Button></div> : <><div id="onboarding-certificate" className="mx-auto max-w-3xl rounded-2xl border-4 border-double border-amber-600/60 bg-background p-10 text-center"><Award className="mx-auto mb-4 h-16 w-16 text-amber-500" /><p className="text-sm tracking-widest text-muted-foreground">HRING · گواهی پایان دوره آزمایشی</p><h2 className="my-7 text-2xl font-black leading-loose">{certificate.statement}</h2><p>عنوان شغلی: {certificate.job_title}</p><p className="mt-2">تاریخ پایان: {formatDate(certificate.completed_at)}</p><div className="mt-8 flex justify-between border-t pt-4 text-xs"><span>شماره گواهی: {certificate.certificate_number}</span><span>تاریخ صدور: {formatDate(certificate.issued_at)}</span></div></div><Button className="mt-5 gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />چاپ گواهی</Button></>}</div>}
        </>}
    </div>
  </div>;
};

export default OnboardingRoadmap;
