import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dna, 
  FlaskConical, 
  Eye,
  ChevronRight,
  Building2
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Chapter1Screening from "./chapters/Chapter1Screening";
import Chapter2Mutation from "./chapters/Chapter2Mutation";
import Chapter3Monitoring from "./chapters/Chapter3Monitoring";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UnicornAnalysis {
  id: string;
  company_name: string;
  company_url: string | null;
  linkedin_url: string | null;
  founders_bio: string | null;
  current_valuation: number | null;
  monthly_active_users: number | null;
  burn_rate: number | null;
  u_score: number | null;
  chapter: string;
  chapter_1_approved: boolean;
  chapter_1_approved_at: string | null;
  chapter_2_stable: boolean;
  chapter_2_stable_at: string | null;
  analysis_result: any;
  shadow_cabinet: any;
  regulatory_shield: any;
  milestone_funding: any;
  api_connections: any;
  pivot_history: any;
  health_alerts: any;
  status: string | null;
  created_at: string;
  updated_at: string;
}

const chapters = [
  { 
    id: 'screening', 
    tabId: 'chapter_1',
    title: 'فصل ۱: غربالگری ژنومیک',
    subtitle: 'Genomic Screening',
    icon: Dna,
    description: 'شناسایی و ارزیابی استارتاپ‌ها با ۵ موتور تحلیل',
    color: 'from-emerald-500 to-teal-500'
  },
  { 
    id: 'mutation', 
    tabId: 'chapter_2',
    title: 'فصل ۲: آزمایشگاه جهش',
    subtitle: 'Mutation Laboratory',
    icon: FlaskConical,
    description: 'تعلیم و تربیت برای تبدیل به یونیکورن',
    color: 'from-violet-500 to-purple-500'
  },
  { 
    id: 'monitoring', 
    tabId: 'chapter_3',
    title: 'فصل ۳: مانیتورینگ عصبی',
    subtitle: 'Neural Monitoring & Kill Switch',
    icon: Eye,
    description: 'نظارت و اصلاح مداوم برای حفظ وضعیت',
    color: 'from-amber-500 to-orange-500'
  },
];

const UnicornLabLayout = () => {
  const [activeChapter, setActiveChapter] = useState('screening');
  const [analyses, setAnalyses] = useState<UnicornAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAnalyses();
    }
  }, [user]);

  const fetchAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('unicorn_analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (err) {
      console.error('Error fetching analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  const getChapterAnalyses = (chapter: string) => {
    return analyses.filter(a => a.chapter === chapter);
  };

  const getApprovedForChapter2 = () => {
    return analyses.filter(a => a.chapter_1_approved);
  };

  const getStableForChapter3 = () => {
    return analyses.filter(a => a.chapter_2_stable);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-full text-primary text-sm font-medium mb-4">
          <Building2 className="w-4 h-4" />
          آزمایشگاه یونیکورن
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          سامانه شناسایی و پرورش یونیکورن
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          پلتفرم جامع برای غربالگری، تعلیم و نظارت بر استارتاپ‌های مستعد تبدیل به یونیکورن
        </p>
      </motion.div>

      {/* Chapter Tabs */}
      <Tabs value={activeChapter} onValueChange={setActiveChapter} className="w-full">
        <TabsList className="grid grid-cols-3 mb-8 h-auto p-1 bg-secondary/50">
          {chapters.map((chapter) => {
            const Icon = chapter.icon;
            const isActive = activeChapter === chapter.id;
            
            return (
              <TabsTrigger
                key={chapter.id}
                value={chapter.id}
                className={`flex flex-col items-center gap-2 py-4 px-3 data-[state=active]:bg-background rounded-lg transition-all ${
                  isActive ? 'shadow-md' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${chapter.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-center">
                  <p className={`font-semibold text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {chapter.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {chapter.subtitle}
                  </p>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="screening" className="mt-0">
            <motion.div
              key="chapter1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Chapter1Screening 
                analyses={getChapterAnalyses('screening')}
                onRefresh={fetchAnalyses}
                loading={loading}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="chapter_2" className="mt-0">
            <motion.div
              key="chapter2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Chapter2Mutation 
                analyses={getApprovedForChapter2()}
                onRefresh={fetchAnalyses}
                loading={loading}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="chapter_3" className="mt-0">
            <motion.div
              key="chapter3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Chapter3Monitoring 
                analyses={getStableForChapter3()}
                onRefresh={fetchAnalyses}
                loading={loading}
              />
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};

export default UnicornLabLayout;
