import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight,
  Upload,
  Globe,
  Plus,
  Building2,
  Loader2,
  Search,
  Filter,
  Clock,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DataMiningSection from "./DataMiningSection";
import DigitalInterrogation from "./DigitalInterrogation";
import ExcelUploader from "./ExcelUploader";
import WebRadar from "./WebRadar";
import AnalysisWizard from "./AnalysisWizard";
import CompanyCard from "./CompanyCard";

interface GenomicScreeningMainProps {
  onBack: () => void;
}

export interface StartupEntry {
  id: string;
  company_name: string;
  company_url: string | null;
  linkedin_url: string | null;
  founders_bio: string | null;
  current_valuation: number | null;
  monthly_active_users: number | null;
  burn_rate: number | null;
  u_score: number | null;
  status: string | null;
  chapter: string;
  chapter_1_approved: boolean;
  analysis_result: any;
  created_at: string;
}

type ViewMode = 'list' | 'excel' | 'web-radar' | 'analysis';

const GenomicScreeningMain = ({ onBack }: GenomicScreeningMainProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [companies, setCompanies] = useState<StartupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<StartupEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'analyzed' | 'approved'>('pending');
  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchCompanies();
  }, [user]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unicorn_analyses')
        .select('*')
        .eq('chapter', 'chapter_1')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    if (activeTab === 'pending') return !c.analysis_result;
    if (activeTab === 'analyzed') return c.analysis_result && !c.chapter_1_approved;
    if (activeTab === 'approved') return c.chapter_1_approved;
    return true;
  });

  const getStatusCounts = () => ({
    pending: companies.filter(c => !c.analysis_result).length,
    analyzed: companies.filter(c => c.analysis_result && !c.chapter_1_approved).length,
    approved: companies.filter(c => c.chapter_1_approved).length,
  });

  const counts = getStatusCounts();

  // Analysis Wizard View
  if (viewMode === 'analysis' && selectedCompany) {
    return (
      <AnalysisWizard 
        company={selectedCompany}
        onBack={() => {
          setViewMode('list');
          setSelectedCompany(null);
        }}
        onComplete={() => {
          fetchCompanies();
          setViewMode('list');
          setSelectedCompany(null);
        }}
      />
    );
  }

  // Excel Upload View
  if (viewMode === 'excel') {
    return (
      <ExcelUploader 
        onBack={() => setViewMode('list')}
        onSuccess={() => {
          fetchCompanies();
          setViewMode('list');
        }}
      />
    );
  }

  // Web Radar View
  if (viewMode === 'web-radar') {
    return (
      <WebRadar 
        onBack={() => setViewMode('list')}
        onAddCompany={(company) => {
          fetchCompanies();
          setViewMode('list');
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">غربالگری ژنومیک</h2>
            <p className="text-sm text-muted-foreground">شناسایی و ارزیابی با ۵ موتور تحلیل</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewMode('web-radar')}>
            <Globe className="w-4 h-4 ml-2" />
            رادار وب
          </Button>
          <Button variant="outline" onClick={() => setViewMode('excel')}>
            <Upload className="w-4 h-4 ml-2" />
            آپلود Excel
          </Button>
        </div>
      </div>

      {/* Data Sources Banner */}
      <DataMiningSection />

      {/* Company Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-3 h-auto p-1 bg-secondary/50">
          <TabsTrigger value="pending" className="py-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>در انتظار تحلیل</span>
              <Badge variant="secondary" className="mr-2">{counts.pending}</Badge>
            </div>
          </TabsTrigger>
          <TabsTrigger value="analyzed" className="py-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>تحلیل شده</span>
              <Badge variant="secondary" className="mr-2">{counts.analyzed}</Badge>
            </div>
          </TabsTrigger>
          <TabsTrigger value="approved" className="py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>تأیید شده</span>
              <Badge variant="secondary" className="mr-2">{counts.approved}</Badge>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {activeTab === 'pending' && 'هنوز شرکتی در انتظار تحلیل نیست'}
                  {activeTab === 'analyzed' && 'هنوز شرکتی تحلیل نشده'}
                  {activeTab === 'approved' && 'هنوز شرکتی تأیید نشده'}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  از رادار وب یا آپلود Excel برای افزودن شرکت استفاده کنید
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setViewMode('excel')}>
                    <Upload className="w-4 h-4 ml-2" />
                    آپلود لیست
                  </Button>
                  <Button onClick={() => setViewMode('web-radar')}>
                    <Globe className="w-4 h-4 ml-2" />
                    کشف از وب
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence>
                {filteredCompanies.map((company, index) => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <CompanyCard 
                      company={company}
                      onStartAnalysis={() => {
                        setSelectedCompany(company);
                        setViewMode('analysis');
                      }}
                      onViewDetails={() => {
                        setSelectedCompany(company);
                        setViewMode('analysis');
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default GenomicScreeningMain;
