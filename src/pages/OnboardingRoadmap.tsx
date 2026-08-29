import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Circle,
  ClipboardList,
  Clock,
  Loader2,
  Plus,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";

type TaskStatus = "todo" | "in_progress" | "completed" | "blocked";

interface OnboardingTaskEvent {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

interface OnboardingTask {
  id: string;
  title: string;
  details: string | null;
  assignee_label: string | null;
  due_on: string | null;
  status: TaskStatus;
  sort_order: number;
  completed_at: string | null;
  events: OnboardingTaskEvent[];
}

interface OnboardingPlan {
  id: string;
  employee_name: string | null;
  employee_email: string | null;
  starts_on: string | null;
  job_title: string;
  seniority: string;
  expectation: string;
  mentor_role: string | null;
  plan: string;
  welcomeEmail: string;
  created_at: string;
  tasks: OnboardingTask[];
}

const statusLabel: Record<TaskStatus, string> = {
  todo: "انجام‌نشده",
  in_progress: "در حال انجام",
  completed: "تکمیل‌شده",
  blocked: "مسدود",
};

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "بدون موعد";

const OnboardingRoadmap = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<OnboardingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueOn, setNewTaskDueOn] = useState("");

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<OnboardingPlan[]>("/development/onboarding-plans");
      setPlans(response);
      setSelectedPlanId((current) =>
        current && response.some((plan) => plan.id === current) ? current : response[0]?.id ?? null,
      );
    } catch (error) {
      console.error("Onboarding workflow load failed:", error);
      toast({ title: "خطا", description: "دریافت برنامه‌های آنبوردینگ انجام نشد", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const completedCount = selectedPlan?.tasks.filter((task) => task.status === "completed").length ?? 0;
  const overallProgress = useMemo(() => {
    if (!selectedPlan?.tasks.length) return 0;
    return Math.round((completedCount / selectedPlan.tasks.length) * 100);
  }, [completedCount, selectedPlan?.tasks.length]);

  const updateTaskStatus = async (task: OnboardingTask) => {
    if (!selectedPlan) return;
    const nextStatus: TaskStatus = task.status === "completed" ? "todo" : "completed";
    setBusyTaskId(task.id);
    try {
      await apiRequest(
        "/development/onboarding-plans/" + selectedPlan.id + "/tasks/" + task.id,
        { method: "PATCH", body: JSON.stringify({ status: nextStatus }) },
      );
      await loadPlans();
      toast({
        title: nextStatus === "completed" ? "تسک تکمیل شد" : "تسک دوباره باز شد",
        description: "رخداد این تغییر در تاریخچه ثبت شد.",
      });
    } catch (error) {
      toast({ title: "خطا", description: error instanceof Error ? error.message : "به‌روزرسانی تسک انجام نشد", variant: "destructive" });
    } finally {
      setBusyTaskId(null);
    }
  };

  const addTask = async () => {
    if (!selectedPlan || !newTaskTitle.trim()) {
      toast({ title: "عنوان تسک لازم است", variant: "destructive" });
      return;
    }
    setCreatingTask(true);
    try {
      await apiRequest(
        "/development/onboarding-plans/" + selectedPlan.id + "/tasks",
        {
          method: "POST",
          body: JSON.stringify({
            title: newTaskTitle.trim(),
            assignee_label: newTaskAssignee.trim() || null,
            due_on: newTaskDueOn || null,
            sort_order: selectedPlan.tasks.length + 1,
          }),
        },
      );
      setNewTaskTitle("");
      setNewTaskAssignee("");
      setNewTaskDueOn("");
      await loadPlans();
      toast({ title: "تسک جدید به برنامه اضافه شد" });
    } catch (error) {
      toast({ title: "خطا", description: error instanceof Error ? error.message : "ساخت تسک انجام نشد", variant: "destructive" });
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      <div className="relative z-10 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" className="gap-2 border-border bg-secondary/50">
                <ArrowRight className="h-5 w-5" />
                بازگشت به داشبورد
              </Button>
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                  <UserRound className="h-6 w-6 text-primary" />
                  نقشه راه ۹۰ روزه
                </h1>
                <Badge variant="secondary">گردش‌کار واقعی</Badge>
              </div>
              <p className="text-muted-foreground">تسک، مسئول، موعد و تاریخچهٔ پیشرفت هر برنامه در همین صفحه ثبت می‌شود.</p>
            </div>
          </div>
          <Link to="/success-architect"><Button className="gap-2"><Plus className="h-4 w-4" /> ساخت برنامه جدید</Button></Link>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !selectedPlan ? (
          <div className="glass-card mx-auto max-w-2xl p-10 text-center">
            <ClipboardList className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="text-xl font-bold">هنوز برنامهٔ آنبوردینگی وجود ندارد</h2>
            <p className="mt-2 text-muted-foreground">ابتدا برای یک کارمند برنامهٔ ۹۰ روزه بسازید؛ سپس تسک‌ها و پیگیری واقعی اینجا ظاهر می‌شوند.</p>
            <Link to="/success-architect" className="mt-5 inline-block"><Button>ساخت برنامه ۹۰ روزه</Button></Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {plans.map((plan) => (
                <Button
                  type="button"
                  key={plan.id}
                  variant={plan.id === selectedPlan.id ? "default" : "outline"}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className="shrink-0"
                >
                  {plan.employee_name || "کارمند نام‌گذاری‌نشده"} · {plan.job_title}
                </Button>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-6 p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{selectedPlan.employee_name || "کارمند نام‌گذاری‌نشده"} · {selectedPlan.job_title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">شروع: {formatDate(selectedPlan.starts_on)} · منتور: {selectedPlan.mentor_role || "مدیر مستقیم"}</p>
                </div>
                <Badge variant={overallProgress === 100 ? "default" : "secondary"}>{completedCount.toLocaleString("fa-IR")} از {selectedPlan.tasks.length.toLocaleString("fa-IR")} تسک</Badge>
              </div>
              <div className="mb-2 flex justify-between text-sm"><span>پیشرفت کلی</span><span className="font-bold text-primary">{overallProgress.toLocaleString("fa-IR")}٪</span></div>
              <Progress value={overallProgress} className="h-3" />
            </motion.div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selectedPlan.tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      aria-label={task.status === "completed" ? "باز کردن تسک" : "تکمیل تسک"}
                      onClick={() => void updateTaskStatus(task)}
                      disabled={busyTaskId === task.id}
                      className="mt-0.5 shrink-0 text-primary disabled:opacity-50"
                    >
                      {busyTaskId === task.id ? <Loader2 className="h-5 w-5 animate-spin" /> : task.status === "completed" ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className={task.status === "completed" ? "font-semibold text-muted-foreground line-through" : "font-semibold text-foreground"}>{task.title}</h3>
                      {task.details && <p className="mt-2 text-sm text-muted-foreground">{task.details}</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{statusLabel[task.status]}</Badge>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(task.due_on)}</span>
                    <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{task.assignee_label || "بدون مسئول"}</span>
                  </div>
                  {task.events[0] && <div className="mt-4 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground"><Clock className="ml-1 inline h-3.5 w-3.5" />{task.events[0].summary}</div>}
                </motion.div>
              ))}
            </div>

            <div className="glass-card mt-6 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Plus className="h-5 w-5 text-primary" /> افزودن تسک عملیاتی</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2"><Label>عنوان تسک *</Label><Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="مثال: جلسهٔ بازخورد هفتهٔ دوم" /></div>
                <div className="space-y-1"><Label>مسئول</Label><Input value={newTaskAssignee} onChange={(event) => setNewTaskAssignee(event.target.value)} placeholder="مدیر منابع انسانی" /></div>
                <div className="space-y-1"><Label>موعد</Label><Input type="date" value={newTaskDueOn} onChange={(event) => setNewTaskDueOn(event.target.value)} /></div>
              </div>
              <Button type="button" className="mt-4" onClick={() => void addTask()} disabled={creatingTask}>{creatingTask ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}افزودن تسک</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingRoadmap;
