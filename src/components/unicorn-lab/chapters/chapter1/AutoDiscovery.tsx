import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  Globe,
  Search,
  Loader2,
  Building2,
  TrendingUp,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AutoDiscoveryProps {
  onBack: () => void;
  onSuccess: () => void;
}

// Demo discovered companies
const demoDiscoveredCompanies = [
  {
    id: '1',
    name: 'تالیا موبایل',
    url: 'https://talia.ir',
    industry: 'فین‌تک',
    growthRate: 340,
    fundingStage: 'Series B',
    description: 'پلتفرم پرداخت موبایلی با رشد سریع'
  },
  {
    id: '2',
    name: 'دیجی‌هلث',
    url: 'https://digihealth.ir',
    industry: 'هلث‌تک',
    growthRate: 280,
    fundingStage: 'Series A',
    description: 'پلتفرم نوبت‌دهی و مشاوره آنلاین پزشکی'
  },
  {
    id: '3',
    name: 'لرنوس',
    url: 'https://learnos.ir',
    industry: 'ادتک',
    growthRate: 220,
    fundingStage: 'Seed',
    description: 'سامانه آموزش آنلاین هوشمند با AI'
  },
];

const AutoDiscovery = ({ onBack, onSuccess }: AutoDiscoveryProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [discoveredCompanies, setDiscoveredCompanies] = useState<typeof demoDiscoveredCompanies>([]);

  const handleSearch = async () => {
    setSearching(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setDiscoveredCompanies(demoDiscoveredCompanies);
    setSearching(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle>کشف خودکار از وب</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                شناسایی استارتاپ‌های در حال رشد سریع از منابع آنلاین
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search Input */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="صنعت یا حوزه مورد نظر را وارد کنید... (مثال: فین‌تک، هلث‌تک)"
                className="pr-10 bg-secondary/50"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 ml-2" />
                  جستجو
                </>
              )}
            </Button>
          </div>

          {/* Info Banner */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-300 font-medium">کشف هوشمند</p>
              <p className="text-xs text-blue-400/80 mt-1">
                این سیستم با بررسی منابع خبری، شبکه‌های اجتماعی و پایگاه‌های داده سرمایه‌گذاری، 
                استارتاپ‌های با رشد سریع را شناسایی می‌کند.
              </p>
            </div>
          </div>

          {/* Results */}
          {discoveredCompanies.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                شرکت‌های کشف شده ({discoveredCompanies.length})
              </h3>
              
              <div className="grid gap-3">
                {discoveredCompanies.map((company) => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-foreground">{company.name}</h4>
                              <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                                +{company.growthRate}% رشد
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{company.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>{company.industry}</span>
                              <span>•</span>
                              <span>{company.fundingStage}</span>
                            </div>
                          </div>
                          <Button size="sm">
                            افزودن به صف
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!searching && discoveredCompanies.length === 0 && (
            <div className="py-12 text-center">
              <Globe className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">آماده کشف</h3>
              <p className="text-muted-foreground text-sm">
                یک صنعت یا حوزه وارد کنید و جستجو را شروع کنید.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="ghost" onClick={onBack}>
              بازگشت
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AutoDiscovery;
