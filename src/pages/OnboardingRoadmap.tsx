import { motion } from "framer-motion";
import { ArrowRight, UserPlus, CheckCircle, Circle, Clock, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const roadmapPhases = [
  {
    phase: "هفته ۱-۲",
    title: "آشنایی و استقرار",
    progress: 0,
    tasks: [
      { text: "معرفی به تیم و همکاران", done: false },
      { text: "تنظیم ابزارها و دسترسی‌ها", done: false },
      { text: "مطالعه مستندات شرکت", done: false },
      { text: "آشنایی با فرآیندها", done: false },
    ],
  },
  {
    phase: "هفته ۳-۴",
    title: "یادگیری و آموزش",
    progress: 0,
    tasks: [
      { text: "شرکت در جلسات آموزشی", done: false },
      { text: "همکاری در پروژه‌های کوچک", done: false },
      { text: "دریافت بازخورد اولیه", done: false },
      { text: "تکمیل دوره‌های آنلاین", done: false },
    ],
  },
  {
    phase: "ماه ۲",
    title: "مشارکت فعال",
    progress: 0,
    tasks: [
      { text: "شروع کار مستقل", done: false },
      { text: "مشارکت در جلسات تیم", done: false },
      { text: "ارائه ایده‌های بهبود", done: false },
      { text: "جلسه بازخورد ماهانه", done: false },
    ],
  },
  {
    phase: "ماه ۳",
    title: "استقلال کامل",
    progress: 0,
    tasks: [
      { text: "مدیریت پروژه مستقل", done: false },
      { text: "منتورینگ اعضای جدید", done: false },
      { text: "ارزیابی دوره آزمایشی", done: false },
      { text: "تعیین اهداف بلندمدت", done: false },
    ],
  },
];

const OnboardingRoadmap = () => {
  const overallProgress = Math.round(
    roadmapPhases.reduce((acc, phase) => acc + phase.progress, 0) / roadmapPhases.length
  );

  return (
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="icon" className="border-border bg-secondary/50">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-primary" />
                  قالب نقشه راه ۹۰ روزه
                </h1>
                <Badge variant="secondary">نمونه ساختار</Badge>
              </div>
              <p className="text-muted-foreground">تا زمان انتخاب کارمند، هیچ پیشرفتی به‌عنوان داده واقعی ثبت نمی‌شود.</p>
            </div>
          </div>
        </motion.div>

        {/* Overall Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">پیشرفت کلی</h2>
            <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <p className="mt-3 text-sm text-muted-foreground">
            این صفحه چارچوب پیشنهادی را نمایش می‌دهد و هنوز به پرونده یک کارمند متصل نشده است.
          </p>
        </motion.div>

        {/* Roadmap Phases */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roadmapPhases.map((phase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{phase.phase}</span>
              </div>
              
              <h3 className="text-lg font-semibold text-foreground mb-3">{phase.title}</h3>
              
              <div className="flex items-center gap-2 mb-4">
                <Progress value={phase.progress} className="h-2 flex-1" />
                <span className="text-sm text-muted-foreground">{phase.progress}%</span>
              </div>

              <div className="space-y-2">
                {phase.tasks.map((task, taskIndex) => (
                  <div 
                    key={taskIndex}
                    className="flex items-center gap-2 text-sm"
                  >
                    {task.done ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={task.done ? "text-muted-foreground line-through" : "text-foreground"}>
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Timeline View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6 mt-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            جلسات آینده
          </h2>
          <div className="rounded-lg bg-secondary/30 p-5 text-center">
            <p className="font-medium text-foreground">جلسه‌ای برای کارمند انتخاب‌شده ثبت نشده است.</p>
            <p className="mt-1 text-sm text-muted-foreground">ابتدا یک برنامه ۹۰ روزه متناسب با نقش شغلی بسازید.</p>
            <Link to="/success-architect" className="mt-4 inline-block">
              <Button>ساخت برنامه ۹۰ روزه</Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingRoadmap;
