import { motion } from "framer-motion";
import { 
  Database,
  Globe,
  Building,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const dataSources = [
  {
    id: 'vcs',
    title: 'معادن VC',
    description: 'استخراج از لیست شتاب‌دهنده‌ها و سرمایه‌گذاران',
    icon: Building,
    count: '۱۲ منبع',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'web',
    title: 'رادار وب',
    description: 'کشف خودکار استارتاپ‌های در حال رشد',
    icon: Globe,
    count: 'Real-time',
    color: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'organic',
    title: 'شاخص رشد ارگانیک',
    description: 'تحلیل رشد بدون تبلیغات',
    icon: TrendingUp,
    count: '۷ معیار',
    color: 'from-amber-500 to-orange-500'
  },
];

const DataMiningSection = () => {
  return (
    <Card className="bg-gradient-to-br from-secondary/50 to-secondary/30 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">منابع داده و کشف</h3>
          <Badge variant="outline" className="mr-auto text-xs">
            <Sparkles className="w-3 h-3 ml-1" />
            هوشمند
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {dataSources.map((source, index) => {
            const Icon = source.icon;
            return (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 bg-background/50 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${source.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {source.count}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground text-sm">{source.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataMiningSection;
