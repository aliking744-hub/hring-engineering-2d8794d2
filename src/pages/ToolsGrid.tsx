import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Megaphone, Users, UserPlus, Lock, Gem } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const tools = [
  {
    icon: Briefcase,
    title: "شرح شغل",
    description: "تولید شرح شغل حرفه‌ای با هوش مصنوعی",
    path: "/job-description",
    color: "from-blue-500 to-cyan-500",
    featureKey: "job_profile",
  },
  {
    icon: Megaphone,
    title: "آگهی استخدام",
    description: "ایجاد آگهی جذاب برای پلتفرم‌های مختلف",
    path: "/smart-ad-generator",
    color: "from-purple-500 to-pink-500",
    featureKey: "smart_ad",
  },
  {
    icon: Users,
    title: "دستیار مصاحبه",
    description: "راهنمای مصاحبه و سوالات تخصصی",
    path: "/interview-assistant",
    color: "from-orange-500 to-red-500",
    featureKey: "interview_kit",
  },
  {
    icon: UserPlus,
    title: "آنبوردینگ ۹۰ روزه",
    description: "برنامه جامع پذیرش نیروی جدید",
    path: "/onboarding",
    color: "from-green-500 to-emerald-500",
    featureKey: "onboarding_plan",
  },
];

const ToolsGrid = () => {
  const navigate = useNavigate();
  const { checkAccess, getCreditCost } = useFeaturePermissions();

  return (
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-12"
        >
          <Link to="/dashboard">
            <Button variant="outline" size="icon" className="border-border bg-secondary/50">
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">داشبورد مدیریتی</h1>
            <p className="text-muted-foreground">ابزارهای هوشمند منابع انسانی</p>
          </div>
        </motion.div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {tools.map((tool, index) => {
            const access = checkAccess(tool.featureKey);
            const creditCost = getCreditCost(tool.featureKey);
            const isLocked = !access.hasAccess;

            return (
              <TooltipProvider key={tool.title}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.1 }}
                      onClick={() => !isLocked && navigate(tool.path)}
                      className={`glass-card p-8 cursor-pointer group transition-all duration-300 relative ${
                        isLocked 
                          ? 'opacity-60 cursor-not-allowed' 
                          : 'hover:scale-[1.02]'
                      }`}
                    >
                      {/* Lock overlay for locked tools */}
                      {isLocked && (
                        <div className="absolute top-4 left-4 z-10">
                          <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      )}

                      {/* Credit cost badge */}
                      {creditCost > 0 && !isLocked && (
                        <div className="absolute top-4 left-4 z-10">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Gem className="w-3 h-3" />
                            {creditCost}
                          </Badge>
                        </div>
                      )}

                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-6 ${
                        isLocked ? '' : 'group-hover:scale-110'
                      } transition-transform`}>
                        <tool.icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{tool.title}</h3>
                      <p className="text-muted-foreground">{tool.description}</p>
                    </motion.div>
                  </TooltipTrigger>
                  {isLocked && (
                    <TooltipContent>
                      <p>{access.reason || 'این قابلیت در پلن شما موجود نیست'}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ToolsGrid;
