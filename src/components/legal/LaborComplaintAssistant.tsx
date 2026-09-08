import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Upload, 
  ArrowLeft,
  ArrowRight,
  Loader2,
  Download,
  Scale,
  Info,
  FileCheck,
  XCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useCredits } from "@/hooks/useCredits";

// Claim types
const CLAIM_TYPES = [
  { 
    id: "wrongful_termination", 
    label: "اخراج غیرقانونی", 
    description: "فسخ قرارداد کار بدون رعایت مقررات قانون کار",
    icon: XCircle
  },
  { 
    id: "unpaid_salary", 
    label: "معوقات مزدی", 
    description: "عدم پرداخت حقوق، اضافه‌کاری یا مزایای قانونی",
    icon: FileText
  },
  { 
    id: "insurance_claim", 
    label: "حق بیمه", 
    description: "عدم پرداخت یا پرداخت ناقص حق بیمه تامین اجتماعی",
    icon: Scale
  },
  { 
    id: "severance_pay", 
    label: "سنوات و پایان کار", 
    description: "مطالبه حق سنوات و مزایای پایان خدمت",
    icon: FileCheck
  }
];

interface EvidenceItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  hasIt: boolean;
  file?: File;
}

interface AnalysisResult {
  winProbability: number;
  riskLevel: "high" | "medium" | "low";
  missingEvidence: string[];
  strongPoints: string[];
  weakPoints: string[];
  recommendation: string;
  complaintText?: string;
  relevantArticles: string[];
  sources: Array<{
    referenceNumber: number;
    title: string;
    url: string;
    publishedAt?: string;
  }>;
  probabilityDisclaimer?: string;
}

const LaborComplaintAssistant = () => {
  const { credits, getCost } = useCredits();
  const [step, setStep] = useState(1);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);

  // Step 1: Select claim type and fetch required evidence
  const handleClaimSelect = async (claimId: string) => {
    setSelectedClaim(claimId);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('labor-complaint-assistant', {
        body: {
          action: 'get_required_evidence',
          claimType: claimId
        }
      });

      if (error) throw error;

      const evidenceList: EvidenceItem[] = data.requiredEvidence.map((item: any, index: number) => ({
        id: `evidence_${index}`,
        label: item.name,
        description: item.description,
        required: item.required,
        hasIt: false,
        file: undefined
      }));

      setEvidenceItems(evidenceList);
      setStep(2);
    } catch (error) {
      console.error('Error fetching required evidence:', error);
      toast.error("خطا در دریافت اطلاعات. لطفا مجددا تلاش کنید.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle evidence checkbox change
  const handleEvidenceChange = (id: string, checked: boolean) => {
    setEvidenceItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, hasIt: checked } : item
      )
    );
  };

  // Handle file upload for evidence
  const handleFileUpload = (id: string, file: File) => {
    setEvidenceItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, file, hasIt: true } : item
      )
    );
  };

  // Handle additional file upload
  const handleAdditionalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  // Step 2 -> Step 3: Analyze and generate complaint
  const handleAnalyze = async () => {
    setIsLoading(true);

    try {
      // Convert files to base64
      const evidenceData = await Promise.all(
        evidenceItems.map(async (item) => {
          let fileData = null;
          if (item.file) {
            const buffer = await item.file.arrayBuffer();
            fileData = {
              name: item.file.name,
              type: item.file.type,
              base64: btoa(
                new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              )
            };
          }
          return {
            id: item.id,
            label: item.label,
            hasIt: item.hasIt,
            file: fileData
          };
        })
      );

      const additionalFilesData = await Promise.all(
        additionalFiles.map(async (file) => {
          const buffer = await file.arrayBuffer();
          return {
            name: file.name,
            type: file.type,
            base64: btoa(
              new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            )
          };
        })
      );

      const { data, error } = await supabase.functions.invoke('labor-complaint-assistant', {
        body: {
          action: 'analyze_and_draft',
          claimType: selectedClaim,
          evidence: evidenceData,
          additionalFiles: additionalFilesData
        }
      });

      if (error) throw error;

      setAnalysisResult(data);
      setStep(3);
    } catch (error) {
      console.error('Error analyzing case:', error);
      toast.error("خطا در تحلیل پرونده. لطفا مجددا تلاش کنید.");
    } finally {
      setIsLoading(false);
    }
  };

  // Reset and start over
  const handleReset = () => {
    setStep(1);
    setSelectedClaim(null);
    setEvidenceItems([]);
    setAnalysisResult(null);
    setAdditionalFiles([]);
  };

  // Export complaint to PDF
  const exportToPDF = () => {
    if (!analysisResult?.complaintText) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      doc.addFont('/fonts/BNAZANIN.TTF', 'BNazanin', 'normal');
      doc.setFont('BNazanin');

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // Header
      doc.setFontSize(18);
      doc.setTextColor(33, 37, 41);
      const title = "دادخواست کار";
      const titleWidth = doc.getTextWidth(title);
      doc.text(title, pageWidth - margin - titleWidth, 25);

      // Date
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      const dateText = `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - margin - dateWidth, 35);

      // Separator
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 40, pageWidth - margin, 40);

      // Content
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);

      const lines = analysisResult.complaintText.split('\n');
      let yPosition = 50;
      const lineHeight = 7;

      for (const line of lines) {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

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

      const fileName = `دادخواست_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast.success("فایل PDF با موفقیت دانلود شد");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("خطا در ایجاد فایل PDF");
    }
  };

  // Get risk color based on probability
  const getRiskColor = (probability: number) => {
    if (probability >= 70) return "text-green-500";
    if (probability >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (probability: number) => {
    if (probability >= 70) return "bg-green-500";
    if (probability >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* Disclaimer */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-500">توجه مهم</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          این ابزار صرفا جهت راهنمایی اولیه است و جایگزین مشاوره حقوقی تخصصی نمی‌باشد. 
          نتایج تخمینی بوده و تضمینی برای رای دادگاه نیست.
        </AlertDescription>
      </Alert>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold transition-colors text-sm sm:text-base ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-8 sm:w-16 h-1 mx-1 sm:mx-2 transition-colors ${
                  step > s ? "bg-primary" : "bg-secondary"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">
        <span className={step >= 1 ? "text-primary" : ""}>انتخاب</span>
        <span className={step >= 2 ? "text-primary" : ""}>مدارک</span>
        <span className={step >= 3 ? "text-primary" : ""}>نتیجه</span>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Claim Selection */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  موضوع شکایت خود را انتخاب کنید
                </CardTitle>
                <CardDescription>
                  انتخاب کنید که می‌خواهید در چه موردی از کارفرما شکایت کنید
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedClaim || ""}
                  onValueChange={(value) => handleClaimSelect(value)}
                  className="grid gap-4"
                  disabled={isLoading}
                >
                  {CLAIM_TYPES.map((claim) => (
                    <div key={claim.id} className="relative">
                      <RadioGroupItem
                        value={claim.id}
                        id={claim.id}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={claim.id}
                        className="flex items-center gap-4 p-4 rounded-lg border-2 border-border bg-card cursor-pointer transition-all hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/5"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <claim.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{claim.label}</p>
                          <p className="text-sm text-muted-foreground">{claim.description}</p>
                        </div>
                        {isLoading && selectedClaim === claim.id && (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Evidence Audit */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  بررسی مدارک مورد نیاز
                </CardTitle>
                <CardDescription>
                  بر اساس قانون کار، برای اثبات ادعای شما این مدارک لازم است. 
                  مشخص کنید کدام مدارک را در اختیار دارید.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {evidenceItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      item.hasIt
                        ? "border-green-500/50 bg-green-500/5"
                        : item.required
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={item.hasIt}
                        onCheckedChange={(checked) =>
                          handleEvidenceChange(item.id, checked as boolean)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={item.id}
                          className="font-medium text-foreground cursor-pointer"
                        >
                          {item.label}
                          {item.required && (
                            <span className="text-red-500 mr-1">*</span>
                          )}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>

                        {/* File upload */}
                        <div className="mt-3">
                          <label
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-sm"
                          >
                            <Upload className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {item.file ? item.file.name : "بارگذاری فایل (اختیاری)"}
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileUpload(item.id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                {/* Additional files */}
                <div>
                  <Label className="text-foreground font-medium">
                    سایر مدارک (اختیاری)
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    هر مدرک دیگری که فکر می‌کنید به پرونده شما کمک می‌کند
                  </p>
                  <label className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-muted-foreground">
                      کلیک کنید یا فایل را بکشید
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG (حداکثر 10MB)
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleAdditionalFileUpload}
                    />
                  </label>
                  {additionalFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {additionalFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg"
                        >
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mr-auto h-6 w-6 p-0"
                            onClick={() =>
                              setAdditionalFiles((prev) =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                          >
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={isLoading}
                  >
                    <ArrowRight className="w-4 h-4 ml-2" />
                    بازگشت
                  </Button>
                  <Button onClick={handleAnalyze} disabled={isLoading || credits < getCost('LABOR_COMPLAINT')}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        در حال تحلیل...
                      </>
                    ) : (
                      <>
                        تحلیل پرونده ({getCost('LABOR_COMPLAINT')} جم)
                        <ArrowLeft className="w-4 h-4 mr-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Results */}
        {step === 3 && analysisResult && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            {/* Win Probability Meter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  احتمال موفقیت پرونده
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">درصد موفقیت تخمینی</span>
                    <span className={`text-3xl font-bold ${getRiskColor(analysisResult.winProbability)}`}>
                      {analysisResult.winProbability}%
                    </span>
                  </div>
                  <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${analysisResult.winProbability}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`absolute inset-y-0 right-0 rounded-full ${getProgressColor(analysisResult.winProbability)}`}
                    />
                  </div>

                  {/* Risk Level Badge */}
                  <div className="flex items-center justify-center">
                    {analysisResult.winProbability >= 70 ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">شانس بالا - پیشنهاد: طرح دادخواست</span>
                      </div>
                    ) : analysisResult.winProbability >= 40 ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 text-yellow-500">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold">شانس متوسط - نیاز به تقویت مدارک</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-500">
                        <XCircle className="w-5 h-5" />
                        <span className="font-semibold">شانس پایین - پیشنهاد: مذاکره با کارفرما</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strong Points */}
              <Card className="border-green-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="w-5 h-5" />
                    نقاط قوت پرونده
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.strongPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                    {analysisResult.strongPoints.length === 0 && (
                      <li className="text-muted-foreground text-sm">
                        نقطه قوت مشخصی شناسایی نشد
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              {/* Weak Points */}
              <Card className="border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-500">
                    <XCircle className="w-5 h-5" />
                    نقاط ضعف و مدارک ناقص
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.weakPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                    {analysisResult.missingEvidence.map((evidence, index) => (
                      <li key={`missing-${index}`} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <span>مدرک ناقص: {evidence}</span>
                      </li>
                    ))}
                    {analysisResult.weakPoints.length === 0 && analysisResult.missingEvidence.length === 0 && (
                      <li className="text-muted-foreground text-sm">
                        ضعف اساسی شناسایی نشد
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Relevant Articles */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  مواد قانونی مرتبط
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.relevantArticles.map((article, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {article}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {analysisResult.sources?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">منابع رسمی</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysisResult.sources.map((source) => (
                    <a
                      key={`${source.referenceNumber}-${source.url}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      [{source.referenceNumber}] {source.title}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysisResult.probabilityDisclaimer && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{analysisResult.probabilityDisclaimer}</AlertDescription>
              </Alert>
            )}

            {/* Recommendation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">توصیه کارشناس</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">
                  {analysisResult.recommendation}
                </p>
              </CardContent>
            </Card>

            {/* Generated Complaint */}
            {analysisResult.complaintText && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    متن دادخواست پیشنهادی
                  </CardTitle>
                  <CardDescription>
                    این متن برای ثبت در سامانه جامع روابط کار تنظیم شده است
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80 rounded-lg border border-border p-4 bg-secondary/30">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                      {analysisResult.complaintText}
                    </pre>
                  </ScrollArea>
                  <Button className="w-full mt-4 gap-2" onClick={exportToPDF}>
                    <Download className="w-4 h-4" />
                    دانلود دادخواست (PDF)
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                شروع پرونده جدید
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LaborComplaintAssistant;
