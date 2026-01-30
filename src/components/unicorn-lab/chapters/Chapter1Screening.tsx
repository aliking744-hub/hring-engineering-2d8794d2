import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Upload, 
  Globe, 
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnicornAnalysis } from "../UnicornLabLayout";
import ManualInputForm from "./chapter1/ManualInputForm";
import AutoDiscovery from "./chapter1/AutoDiscovery";
import AnalysisDetail from "./chapter1/AnalysisDetail";

interface Chapter1ScreeningProps {
  analyses: UnicornAnalysis[];
  onRefresh: () => void;
  loading: boolean;
}

const Chapter1Screening = ({ analyses, onRefresh, loading }: Chapter1ScreeningProps) => {
  const [inputMode, setInputMode] = useState<'list' | 'manual' | 'auto'>('list');
  const [selectedAnalysis, setSelectedAnalysis] = useState<UnicornAnalysis | null>(null);

  const getStatusBadge = (analysis: UnicornAnalysis) => {
    if (analysis.chapter_1_approved) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">تأیید و ارسال به فصل ۲</Badge>;
    }
    if (analysis.status === 'completed') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">منتظر بررسی</Badge>;
    }
    if (analysis.status === 'processing') {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">در حال تحلیل</Badge>;
    }
    return <Badge className="bg-secondary text-muted-foreground">جدید</Badge>;
  };

  if (selectedAnalysis) {
    return (
      <AnalysisDetail 
        analysis={selectedAnalysis}
        onBack={() => setSelectedAnalysis(null)}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Chapter Info Banner */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
              <Search className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-1">غربالگری ژنومیک</h2>
              <p className="text-muted-foreground text-sm mb-3">
                در این مرحله استارتاپ‌ها با ۵ موتور تحلیل (سلامت مالی، تاب‌آوری بنیان‌گذار، آینده‌نگری، همسویی ملی، تست استرس) ارزیابی می‌شوند.
                شرکت‌های تأیید شده به فصل ۲ منتقل خواهند شد.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                  {analyses.length} شرکت در صف
                </Badge>
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                  {analyses.filter(a => a.chapter_1_approved).length} تأیید شده
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input Mode Tabs */}
      {inputMode === 'list' ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => setInputMode('manual')}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
            >
              <Plus className="w-4 h-4 ml-2" />
              ورودی دستی
            </Button>
            <Button 
              variant="outline"
              onClick={() => setInputMode('auto')}
            >
              <Globe className="w-4 h-4 ml-2" />
              کشف خودکار از وب
            </Button>
          </div>

          {/* Companies List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : analyses.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">هنوز شرکتی ثبت نشده</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  برای شروع، یک شرکت جدید اضافه کنید یا از کشف خودکار استفاده کنید.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {analyses.map((analysis) => (
                <motion.div
                  key={analysis.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }}
                  className="cursor-pointer"
                  onClick={() => setSelectedAnalysis(analysis)}
                >
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-foreground truncate">
                              {analysis.company_name}
                            </h3>
                            {getStatusBadge(analysis)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {analysis.company_url || 'بدون وب‌سایت'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {analysis.u_score && (
                              <span className="flex items-center gap-1">
                                <span className={`font-bold ${
                                  analysis.u_score >= 80 ? 'text-emerald-400' :
                                  analysis.u_score >= 60 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  U-Score: {analysis.u_score}
                                </span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(analysis.created_at).toLocaleDateString('fa-IR')}
                            </span>
                          </div>
                        </div>
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : inputMode === 'manual' ? (
        <ManualInputForm 
          onBack={() => setInputMode('list')}
          onSuccess={() => {
            setInputMode('list');
            onRefresh();
          }}
        />
      ) : (
        <AutoDiscovery 
          onBack={() => setInputMode('list')}
          onSuccess={() => {
            setInputMode('list');
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

export default Chapter1Screening;
