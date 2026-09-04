import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Upload, FileText, AlertTriangle, CheckCircle2, 
  XCircle, Loader2, ChevronRight, Scale, Target, 
  FileQuestion, Sparkles, Download, RefreshCw, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useCredits } from "@/hooks/useCredits";

interface Claim {
  claim_type: string;
  description: string;
  amount_claimed?: string;
}

interface RelevantLaw {
  claim_type: string;
  article_number: string | null;
  category: string;
  content: string;
  similarity: number;
}

interface EvidenceAnalysis {
  claim_type: string;
  required_evidence: string[];
  provided_evidence: string[];
  missing_evidence: string[];
  legal_basis: string;
}

interface FollowUpQuestion {
  question: string;
  reason: string;
  related_article: string;
}

interface Verdict {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'fight' | 'settle' | 'needs_more_info';
  reasoning: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  defenseBill?: string;
  settlementAdvice?: string;
}

interface AnalysisResult {
  claims: Claim[];
  relevantLaws: RelevantLaw[];
  gapAnalysis: {
    evidenceAnalysis: EvidenceAnalysis[];
    followUpQuestions: FollowUpQuestion[];
    canProceed: boolean;
  };
  verdict: Verdict;
}

type AnalysisPhase = 'upload' | 'analyzing' | 'gap_analysis' | 'verdict';

const DefenseBuilder = () => {
  const { getCost } = useCredits();
  const asyncUpgradePending = true;
  const [phase, setPhase] = useState<AnalysisPhase>('upload');
  const [complaint, setComplaint] = useState<{ file: File; content: string } | null>(null);
  const [evidence, setEvidence] = useState<{ file: File; name: string; type: string; content?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  
  const complaintInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const handleComplaintUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.type.includes('image')) {
      toast.error("فقط فایل‌های PDF و تصویر پشتیبانی می‌شوند");
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setComplaint({
        file,
        content: event.target?.result as string
      });
    };
    reader.readAsDataURL(file);
    
    if (complaintInputRef.current) complaintInputRef.current.value = "";
  };

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newEvidence: typeof evidence = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        toast.error(`${file.name}: فقط PDF و تصویر پشتیبانی می‌شود`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        newEvidence.push({
          file,
          name: file.name,
          type: file.type.includes('pdf') ? 'pdf' : 'image',
          content: event.target?.result as string
        });
        
        if (newEvidence.length === files.length) {
          setEvidence(prev => [...prev, ...newEvidence]);
        }
      };
      reader.readAsDataURL(file);
    }
    
    if (evidenceInputRef.current) evidenceInputRef.current.value = "";
  };

  const removeEvidence = (index: number) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (!complaint) {
      toast.error("لطفاً دادخواست را آپلود کنید");
      return;
    }

    setIsLoading(true);
    setPhase('analyzing');

    try {
      const { data, error } = await supabase.functions.invoke("defense-builder", {
        body: {
          complaint: complaint.content,
          evidence: evidence.map(e => ({
            name: e.name,
            type: e.type,
            content: e.content
          })),
          additionalInfo
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'تحلیل ناموفق بود');
      }

      setAnalysisResult(data);
      
      // Determine which phase to show based on results
      if (!data.gapAnalysis.canProceed && data.gapAnalysis.followUpQuestions.length > 0) {
        setPhase('gap_analysis');
      } else {
        setPhase('verdict');
      }

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error("خطا در تحلیل پرونده");
      setPhase('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const proceedToVerdict = () => {
    setPhase('verdict');
  };

  const resetAnalysis = () => {
    setPhase('upload');
    setComplaint(null);
    setEvidence([]);
    setAnalysisResult(null);
    setAdditionalInfo("");
  };

  const exportToPDF = (content: string, title: string) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Add Persian font
      doc.addFont('/fonts/BNAZANIN.TTF', 'BNazanin', 'normal');
      doc.setFont('BNazanin');
      
      // Page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(33, 37, 41);
      const titleText = title;
      const titleWidth = doc.getTextWidth(titleText);
      doc.text(titleText, pageWidth - margin - titleWidth, 25);
      
      // Date
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      const dateText = `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - margin - dateWidth, 35);
      
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 40, pageWidth - margin, 40);
      
      // Content
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      
      // Split content into lines (RTL compatible)
      const lines = content.split('\n');
      let yPosition = 50;
      const lineHeight = 7;
      
      for (const line of lines) {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Wrap long lines
        const wrappedLines = doc.splitTextToSize(line, contentWidth);
        for (const wrappedLine of wrappedLines) {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          const lineWidth = doc.getTextWidth(wrappedLine);
          doc.text(wrappedLine, pageWidth - margin - lineWidth, yPosition);
          yPosition += lineHeight;
        }
      }
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const footerText = `صفحه ${i} از ${pageCount}`;
        const footerWidth = doc.getTextWidth(footerText);
        doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);
      }
      
      // Save
      const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success("فایل PDF با موفقیت دانلود شد");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("خطا در ایجاد فایل PDF");
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'bg-green-500';
    if (score < 50) return 'bg-yellow-500';
    if (score < 70) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRiskLabel = (level: string) => {
    const labels: Record<string, string> = {
      low: 'ریسک پایین',
      medium: 'ریسک متوسط',
      high: 'ریسک بالا',
      critical: 'ریسک بحرانی'
    };
    return labels[level] || level;
  };

  const getRecommendationInfo = (rec: string) => {
    const info: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      fight: { 
        label: 'دفاع کنید', 
        icon: <Shield className="w-5 h-5" />, 
        color: 'text-green-500' 
      },
      settle: { 
        label: 'سازش کنید', 
        icon: <Scale className="w-5 h-5" />, 
        color: 'text-orange-500' 
      },
      needs_more_info: { 
        label: 'مدارک بیشتر لازم است', 
        icon: <FileQuestion className="w-5 h-5" />, 
        color: 'text-yellow-500' 
      }
    };
    return info[rec] || info.needs_more_info;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      labor_law: "قانون کار",
      social_security: "تامین اجتماعی",
      court_rulings: "آرای دیوان",
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      {/* Phase Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${phase === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          <span>۱. آپلود</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${phase === 'analyzing' ? 'bg-primary text-primary-foreground' : phase === 'gap_analysis' || phase === 'verdict' ? 'bg-green-500/20 text-green-500' : 'bg-secondary text-muted-foreground'}`}>
          <span>۲. تحلیل</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${phase === 'gap_analysis' ? 'bg-primary text-primary-foreground' : phase === 'verdict' ? 'bg-green-500/20 text-green-500' : 'bg-secondary text-muted-foreground'}`}>
          <span>۳. بررسی مدارک</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${phase === 'verdict' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          <span>۴. نتیجه</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Upload Phase */}
        {phase === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Complaint Upload */}
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-primary" />
                  دادخواست کارگر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={complaintInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={handleComplaintUpload}
                />
                
                {complaint ? (
                  <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="font-medium">{complaint.file.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setComplaint(null)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => complaintInputRef.current?.click()}
                    className="cursor-pointer p-8 border-2 border-dashed border-muted rounded-lg hover:border-primary/50 transition-colors text-center"
                  >
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      فایل دادخواست را اینجا بکشید یا کلیک کنید
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PDF یا تصویر</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evidence Upload */}
            <Card className="border-dashed border-2 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  مدارک شما (قرارداد، حضور و غیاب، فیش حقوقی و...)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={evidenceInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  className="hidden"
                  onChange={handleEvidenceUpload}
                />
                
                <div className="space-y-3">
                  {evidence.length > 0 && (
                    <div className="space-y-2">
                      {evidence.map((e, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">{e.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {e.type === 'pdf' ? 'PDF' : 'تصویر'}
                            </Badge>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeEvidence(index)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div 
                    onClick={() => evidenceInputRef.current?.click()}
                    className="cursor-pointer p-6 border-2 border-dashed border-muted rounded-lg hover:border-primary/50 transition-colors text-center"
                  >
                    <Plus className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      افزودن مدرک
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="w-5 h-5" />
                  توضیحات تکمیلی (اختیاری)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="هر توضیح اضافی درباره پرونده، سابقه کار، شرایط اخراج و غیره..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            {/* Start Button */}
            <Button 
              size="lg" 
              className="w-full gap-2"
              onClick={startAnalysis}
              disabled={!complaint || asyncUpgradePending}
            >
              <Sparkles className="w-5 h-5" />
              {asyncUpgradePending
                ? 'در حال بهسازی اجرای طولانی‌مدت'
                : `شروع تحلیل پرونده (${getCost('LEGAL_DEFENSE')} جم)`}
            </Button>
          </motion.div>
        )}

        {/* Analyzing Phase */}
        {phase === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="py-20 text-center"
          >
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary mb-6" />
            <h3 className="text-xl font-semibold mb-2">در حال تحلیل پرونده...</h3>
            <p className="text-muted-foreground">
              استخراج ادعاها، بررسی قوانین مرتبط و ارزیابی مدارک
            </p>
          </motion.div>
        )}

        {/* Gap Analysis Phase */}
        {phase === 'gap_analysis' && analysisResult && (
          <motion.div
            key="gap_analysis"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Claims Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ادعاهای کارگر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.claims.map((claim, i) => (
                    <div key={i} className="p-3 bg-secondary rounded-lg">
                      <div className="font-medium">{claim.claim_type}</div>
                      <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
                      {claim.amount_claimed && (
                        <Badge variant="outline" className="mt-2">
                          مبلغ: {claim.amount_claimed}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Relevant Laws */}
            {analysisResult.relevantLaws.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    مواد قانونی مرتبط
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {analysisResult.relevantLaws.map((law, i) => (
                        <div key={i} className="p-3 bg-secondary/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">
                              {law.article_number ? `ماده ${law.article_number}` : 'بدون شماره'}
                            </Badge>
                            <Badge variant="secondary">
                              {getCategoryLabel(law.category)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {law.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Missing Evidence Questions */}
            {analysisResult.gapAnalysis.followUpQuestions.length > 0 && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-600">
                    <FileQuestion className="w-5 h-5" />
                    مدارک ناقص - سوالات مهم
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysisResult.gapAnalysis.followUpQuestions.map((q, i) => (
                      <div key={i} className="p-4 bg-secondary rounded-lg border-r-4 border-yellow-500">
                        <p className="font-medium mb-2">{q.question}</p>
                        <p className="text-sm text-muted-foreground">{q.reason}</p>
                        {q.related_article && (
                          <Badge variant="outline" className="mt-2">
                            {q.related_article}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetAnalysis} className="flex-1 gap-2">
                <RefreshCw className="w-4 h-4" />
                شروع مجدد با مدارک جدید
              </Button>
              <Button onClick={proceedToVerdict} className="flex-1 gap-2">
                ادامه به ارزیابی نهایی
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Verdict Phase */}
        {phase === 'verdict' && analysisResult && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Case Strength Meter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  ارزیابی قدرت پرونده
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Risk Score Bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">احتمال باخت</span>
                    <span className="text-2xl font-bold">
                      {analysisResult.verdict.riskScore}%
                    </span>
                  </div>
                  <div className="h-4 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${analysisResult.verdict.riskScore}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${getRiskColor(analysisResult.verdict.riskScore)}`}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>دفاع قوی</span>
                    <span>باخت قطعی</span>
                  </div>
                </div>

                <Separator />

                {/* Recommendation */}
                <div className="text-center py-4">
                  {(() => {
                    const recInfo = getRecommendationInfo(analysisResult.verdict.recommendation);
                    return (
                      <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-secondary ${recInfo.color}`}>
                        {recInfo.icon}
                        <span className="text-lg font-bold">{recInfo.label}</span>
                      </div>
                    );
                  })()}
                  <p className="mt-4 text-muted-foreground">
                    {getRiskLabel(analysisResult.verdict.riskLevel)}
                  </p>
                </div>

                <Separator />

                {/* Reasoning */}
                <div className="p-4 bg-secondary rounded-lg">
                  <h4 className="font-semibold mb-2">تحلیل:</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {analysisResult.verdict.reasoning}
                  </p>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResult.verdict.keyStrengths.length > 0 && (
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                      <h4 className="font-semibold text-green-600 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        نقاط قوت
                      </h4>
                      <ul className="space-y-2">
                        {analysisResult.verdict.keyStrengths.map((s, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.verdict.keyWeaknesses.length > 0 && (
                    <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                      <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        نقاط ضعف
                      </h4>
                      <ul className="space-y-2">
                        {analysisResult.verdict.keyWeaknesses.map((w, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Defense Bill or Settlement Advice */}
            {analysisResult.verdict.recommendation === 'fight' && analysisResult.verdict.defenseBill && (
              <Card className="border-green-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <Shield className="w-5 h-5" />
                    لایحه دفاعیه پیشنهادی
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] p-4 bg-secondary rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {analysisResult.verdict.defenseBill}
                    </pre>
                  </ScrollArea>
                  <Button 
                    className="w-full mt-4 gap-2"
                    onClick={() => exportToPDF(analysisResult.verdict.defenseBill!, "لایحه دفاعیه")}
                  >
                    <Download className="w-4 h-4" />
                    دانلود لایحه (PDF)
                  </Button>
                </CardContent>
              </Card>
            )}

            {analysisResult.verdict.recommendation === 'settle' && analysisResult.verdict.settlementAdvice && (
              <Card className="border-orange-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <Scale className="w-5 h-5" />
                    توصیه سازش
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-secondary rounded-lg">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {analysisResult.verdict.settlementAdvice}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Button */}
            <Button variant="outline" onClick={resetAnalysis} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              تحلیل پرونده جدید
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DefenseBuilder;
