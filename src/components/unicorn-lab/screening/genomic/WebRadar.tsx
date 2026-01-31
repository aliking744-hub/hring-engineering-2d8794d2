import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  Globe,
  Search,
  Loader2,
  Building2,
  TrendingUp,
  Plus,
  Sparkles,
  ExternalLink,
  Radar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WebRadarProps {
  onBack: () => void;
  onAddCompany: (company: any) => void;
}

interface DiscoveredCompany {
  id: string;
  name: string;
  url: string;
  description: string;
  industry: string;
  growthSignals: string[];
  fundingStage?: string;
  source: string;
}

const WebRadar = ({ onBack, onAddCompany }: WebRadarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [discoveredCompanies, setDiscoveredCompanies] = useState<DiscoveredCompany[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: "خطا", description: "لطفاً صنعت یا کلیدواژه وارد کنید", variant: "destructive" });
      return;
    }

    setSearching(true);
    setDiscoveredCompanies([]);

    try {
      // Call Firecrawl search edge function
      const { data, error } = await supabase.functions.invoke('unicorn-web-radar', {
        body: { query: searchQuery, country: 'ir' }
      });

      if (error) throw error;

      if (data?.companies) {
        setDiscoveredCompanies(data.companies);
        toast({
          title: "جستجو کامل شد",
          description: `${data.companies.length} شرکت شناسایی شد`
        });
      } else {
        toast({
          title: "نتیجه‌ای یافت نشد",
          description: "با کلیدواژه دیگر امتحان کنید"
        });
      }
    } catch (err: any) {
      console.error('Search error:', err);
      toast({
        title: "خطا در جستجو",
        description: err.message || "لطفاً دوباره تلاش کنید",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const handleAddCompany = async (company: DiscoveredCompany) => {
    if (!user) {
      toast({ title: "خطا", description: "لطفاً ابتدا وارد شوید", variant: "destructive" });
      return;
    }

    setAddingId(company.id);

    try {
      const { error } = await supabase.from('unicorn_analyses').insert({
        user_id: user.id,
        company_name: company.name,
        company_url: company.url,
        founders_bio: company.description,
        chapter: 'chapter_1',
        status: 'pending'
      });

      if (error) throw error;

      toast({
        title: "اضافه شد",
        description: `${company.name} به صف تحلیل اضافه شد`
      });

      // Remove from list
      setDiscoveredCompanies(prev => prev.filter(c => c.id !== company.id));
      onAddCompany(company);
    } catch (err: any) {
      toast({
        title: "خطا",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">رادار وب</h2>
          <p className="text-sm text-muted-foreground">کشف خودکار استارتاپ‌های در حال رشد</p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">کشف هوشمند</h3>
              <p className="text-sm text-muted-foreground">
                این سیستم با استفاده از هوش مصنوعی، منابع خبری، شبکه‌های اجتماعی و پایگاه‌های داده سرمایه‌گذاری را بررسی کرده 
                و استارتاپ‌های با رشد سریع را شناسایی می‌کند.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="صنعت یا حوزه مورد نظر را وارد کنید... (مثال: فین‌تک، هلث‌تک، ادتک)"
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

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {['فین‌تک', 'هلث‌تک', 'ادتک', 'لجستیک', 'اگری‌تک', 'پراپ‌تک'].map(tag => (
              <Button
                key={tag}
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(tag); }}
                className="text-xs"
              >
                {tag}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searching && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <Radar className="w-16 h-16 text-primary animate-pulse" />
            <motion.div
              className="absolute inset-0 border-2 border-primary rounded-full"
              animate={{ scale: [1, 2, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-muted-foreground mt-4">در حال اسکن وب...</p>
        </div>
      )}

      {!searching && discoveredCompanies.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-foreground">
              شرکت‌های کشف شده ({discoveredCompanies.length})
            </h3>
          </div>

          <div className="grid gap-4">
            {discoveredCompanies.map((company, index) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-primary-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-foreground">{company.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {company.industry}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {company.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {company.growthSignals.map((signal, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              <Sparkles className="w-3 h-3 ml-1" />
                              {signal}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{company.source}</span>
                          {company.url && (
                            <>
                              <span>•</span>
                              <a 
                                href={company.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-primary"
                              >
                                <ExternalLink className="w-3 h-3" />
                                وب‌سایت
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleAddCompany(company)}
                        disabled={addingId === company.id}
                      >
                        {addingId === company.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 ml-1" />
                            افزودن
                          </>
                        )}
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
        <div className="text-center py-12">
          <Globe className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">آماده کشف</h3>
          <p className="text-muted-foreground text-sm">
            یک صنعت یا حوزه وارد کنید و جستجو را شروع کنید
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default WebRadar;
