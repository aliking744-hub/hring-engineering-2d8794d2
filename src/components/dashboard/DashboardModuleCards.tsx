import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Module {
  id: string;
  label: string;
  desc: string;
  icon: any;
  path: string;
  comingSoon?: boolean;
}

interface Tier {
  id: string;
  label: string;
  labelEn: string;
  icon: any;
  modules: Module[];
}

const DashboardModuleCards = ({ tier }: { tier: Tier }) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {tier.modules.map((mod, index) => (
        <motion.div
          key={mod.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => !mod.comingSoon && navigate(mod.path)}
          className={`group relative glass-card p-6 rounded-2xl transition-all duration-300 ${
            mod.comingSoon
              ? "opacity-50 grayscale cursor-not-allowed"
              : "cursor-pointer hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5"
          }`}
        >
          {/* Coming Soon Badge */}
          {mod.comingSoon && (
            <Badge className="absolute top-4 left-4 bg-muted text-muted-foreground border-border">
              <Lock className="w-3 h-3 ml-1" />
              به زودی
            </Badge>
          )}

          {/* Icon */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
            mod.comingSoon 
              ? "bg-muted" 
              : "bg-primary/10 group-hover:bg-primary/20 transition-colors"
          }`}>
            <mod.icon className={`w-7 h-7 ${mod.comingSoon ? "text-muted-foreground" : "text-primary"}`} />
          </div>

          {/* Text */}
          <h3 className="text-lg font-bold text-foreground mb-2">{mod.label}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{mod.desc}</p>

          {/* Arrow */}
          {!mod.comingSoon && (
            <div className="mt-4 flex items-center gap-1 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <span>ورود</span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default DashboardModuleCards;
