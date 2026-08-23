import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useCredits, CREDIT_COSTS, DIAMOND_COSTS } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2, Download, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, MessageSquare, Brain, Users, Briefcase, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

interface InterviewQuestion {
  id: string;
  section: string;
  sectionIcon: "technical" | "behavioral" | "intelligence" | "cultural";
  question: string;
  goodSigns: string[];
  redFlags: string[];
}

const seniorityLevels = [
  { value: "junior", label: "کارشناس (Junior)" },
  { value: "senior", label: "کارشناس ارشد (Senior)" },
  { value: "lead", label: "سرپرست (Lead)" },
  { value: "manager", label: "مدیر (Manager)" },
];

const focusAreas = [
  { value: "general", label: "عمومی" },
  { value: "technical", label: "تخصصی و فنی" },
  { value: "leadership", label: "رهبری و مدیریت" },
  { value: "cultural", label: "تناسب فرهنگی" },
];

const InterviewAssistant = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [openAnswerKeys, setOpenAnswerKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { credits, hasEnoughCredits } = useCredits();
  const resultRef = useRef<HTMLDivElement>(null);

  const getSectionIcon = (icon: string) => {
    switch (icon) {
      case "technical":
        return <Briefcase className="w-5 h-5" />;
      case "behavioral":
        return <Users className="w-5 h-5" />;
      case "intelligence":
        return <Brain className="w-5 h-5" />;
      case "cultural":
        return <MessageSquare className="w-5 h-5" />;
      default:
        return <Briefcase className="w-5 h-5" />;
    }
  };

  const handleGenerate = async () => {
    if (!jobTitle || !seniorityLevel) {
      toast({
        title: "خطا",
        description: "لطفاً عنوان شغل و سطح ارشدیت را وارد کنید.",
        variant: "destructive",
      });
      return;
    }

    // Check credits
    if (!hasEnoughCredits('INTERVIEW_KIT')) {
      toast({
        title: "اعتبار ناکافی",
        description: `برای این عملیات ${CREDIT_COSTS.INTERVIEW_KIT} جم نیاز دارید. اعتبار فعلی: ${credits}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setQuestions([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-interview-kit", {
        body: {
          jobTitle,
          industry,
          seniorityLevel,
          focusArea: focusArea || "general",
        },
      });

      if (error) throw error;

      if (data?.questions) {
        setQuestions(data.questions);
        toast({
          title: "موفق",
          description: "راهنمای مصاحبه با موفقیت تولید شد.",
        });
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (error: unknown) {
      console.error("Error generating interview kit:", error);
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "خطا در تولید راهنمای مصاحبه",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAnswerKey = (id: string) => {
    setOpenAnswerKeys((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDownloadPDF = () => {
    const today = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
    const seniorityLabel = seniorityLevels.find(l => l.value === seniorityLevel)?.label ?? seniorityLevel;
    const focusLabel = focusAreas.find(f => f.value === focusArea)?.label ?? '';

    const sectionsHtml = Object.entries(groupedQuestions).map(([section, sectionQs]) => {
      const questionsHtml = sectionQs.map((q, idx) => {
        const goodSignsHtml = q.goodSigns.map(s => `<li>✓ ${s}</li>`).join('');
        const redFlagsHtml = q.redFlags.map(f => `<li>⚠ ${f}</li>`).join('');
        return `
          <div class="question-card">
            <div class="question-header">
              <span class="question-num">${idx + 1}</span>
              <p class="question-text">${q.question}</p>
            </div>
            <div class="answer-key">
              <div class="good-signs">
                <div class="signs-title">✅ نشانه‌های مثبت</div>
                <ul>${goodSignsHtml}</ul>
              </div>
              <div class="red-flags">
                <div class="flags-title">⚠️ هشدارها (Red Flags)</div>
                <ul>${redFlagsHtml}</ul>
              </div>
            </div>
          </div>`;
      }).join('');
      return `<div class="section"><div class="section-title">${section}</div>${questionsHtml}</div>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>راهنمای مصاحبه - ${jobTitle}</title>
  <style>
    @font-face { font-family: 'BNazanin'; src: url('${window.location.origin}/fonts/BNAZANIN.TTF') format('truetype'); }
    @font-face { font-family: 'IRANSans'; src: url('${window.location.origin}/fonts/IRANSansBold-Edit.ttf') format('truetype'); font-weight: bold; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'BNazanin', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #1a1a2e;
      font-size: 11pt;
      line-height: 1.8;
    }
    @page { size: A4 portrait; margin: 12mm 14mm 12mm 14mm; }

    /* HEADER */
    .pdf-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 16px 20px;
      border-radius: 8px;
      color: white;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-header-title {
      font-family: 'IRANSans', 'BNazanin', Tahoma, sans-serif;
      font-size: 17pt;
      font-weight: bold;
      color: #fff;
      margin-bottom: 4px;
    }
    .pdf-header-sub { font-size: 9.5pt; color: #bfdbfe; }

    /* META */
    .pdf-meta {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 7px 14px;
      margin-bottom: 18px;
      font-size: 9.5pt;
      color: #1e40af;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* SECTION */
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title {
      font-family: 'IRANSans', 'BNazanin', Tahoma, sans-serif;
      font-size: 13pt;
      font-weight: bold;
      color: #1e40af;
      background: linear-gradient(90deg, #dbeafe 0%, transparent 100%);
      padding: 6px 10px;
      border-right: 4px solid #2563eb;
      border-radius: 0 4px 4px 0;
      margin-bottom: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* QUESTION CARD */
    .question-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .question-num {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      font-weight: bold;
      font-size: 11pt;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .question-text {
      font-size: 11pt;
      font-weight: bold;
      color: #1e293b;
      padding-top: 3px;
    }

    /* ANSWER KEY */
    .answer-key {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .good-signs, .red-flags {
      padding: 10px 14px;
      font-size: 9.5pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .good-signs { background: #f0fdf4; border-left: 1px solid #e2e8f0; }
    .red-flags { background: #fff1f2; }
    .signs-title {
      font-weight: bold;
      color: #16a34a;
      margin-bottom: 6px;
      font-size: 10pt;
    }
    .flags-title {
      font-weight: bold;
      color: #dc2626;
      margin-bottom: 6px;
      font-size: 10pt;
    }
    ul { padding-right: 0; list-style: none; }
    li { margin-bottom: 4px; color: #374151; padding-right: 4px; }

    /* FOOTER */
    .pdf-footer {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      border-top: 1px solid #dbeafe;
      padding: 5px 20px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94a3b8;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="pdf-header">
    <div>
      <div class="pdf-header-title">راهنمای مصاحبه: ${jobTitle}</div>
      <div class="pdf-header-sub">${seniorityLabel}${industry ? ' | ' + industry : ''}${focusLabel ? ' | ' + focusLabel : ''} | ${today}</div>
    </div>
  </div>
  <div class="pdf-meta">📋 این سند شامل سوالات مصاحبه و کلید ارزیابی کامل برای مصاحبه‌گر می‌باشد</div>
  ${sectionsHtml}
  <div class="pdf-footer">
    <span>hring.io — دستیار مصاحبه</span>
    <span>${today}</span>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 600); };
  </script>
</body>
</html>`);

    printWindow.document.close();
    toast({ title: "موفق", description: "راهنمای مصاحبه آماده چاپ شد." });
  };

  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.section]) {
      acc[q.section] = [];
    }
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, InterviewQuestion[]>);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Print Footer */}
      <div className="hidden print:block fixed bottom-4 left-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src={logo} alt="لوگو" className="w-6 h-6" />
          <span>تولید شده توسط سیستم مدیریت منابع انسانی</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground py-12 px-4 print:hidden">
        <div className="container max-w-4xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-6 transition-colors">
            <ArrowRight className="w-4 h-4" />
            بازگشت به داشبورد
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <img src={logo} alt="لوگو" className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">دستیار مصاحبه</h1>
              <p className="text-primary-foreground/80">تولید راهنمای جامع مصاحبه با کلید ارزیابی</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Input Form */}
        <Card className="shadow-lg border-0 mb-8 print:hidden">
          <CardHeader>
            <CardTitle>اطلاعات موقعیت شغلی</CardTitle>
            <CardDescription>جزئیات شغل را وارد کنید تا سوالات مصاحبه تولید شود</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">عنوان شغل *</Label>
                <Input
                  id="jobTitle"
                  placeholder="مثال: مدیر مالی، برنامه‌نویس فرانت‌اند"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">صنعت</Label>
                <Input
                  id="industry"
                  placeholder="مثال: بانکداری، فناوری اطلاعات"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seniorityLevel">سطح ارشدیت *</Label>
                <Select value={seniorityLevel} onValueChange={setSeniorityLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seniorityLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="focusArea">تمرکز مصاحبه</Label>
                <Select value={focusArea} onValueChange={setFocusArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    {focusAreas.map((area) => (
                      <SelectItem key={area.value} value={area.value}>
                        {area.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-12 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  در حال تولید سوالات...
                </>
              ) : (
                "تولید راهنمای مصاحبه"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {questions.length > 0 && (
          <div ref={resultRef} className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between print:hidden">
              <h2 className="text-2xl font-bold text-foreground">راهنمای مصاحبه</h2>
              <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                دانلود PDF
              </Button>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-8 text-center border-b pb-4">
              <h1 className="text-2xl font-bold">راهنمای مصاحبه</h1>
              <p className="text-muted-foreground">
                {jobTitle} | {seniorityLevels.find((l) => l.value === seniorityLevel)?.label}
                {industry && ` | ${industry}`}
              </p>
            </div>

            {/* Questions by Section */}
            {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
              <div key={section} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                  {getSectionIcon(sectionQuestions[0]?.sectionIcon)}
                  <span>{section}</span>
                </div>

                {sectionQuestions.map((q, index) => (
                  <Card key={q.id} className="shadow-md border-0 overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {index + 1}
                        </span>
                        <p className="text-lg leading-relaxed pt-1">{q.question}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Collapsible open={openAnswerKeys[q.id]} onOpenChange={() => toggleAnswerKey(q.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground print:hidden">
                            {openAnswerKeys[q.id] ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                پنهان کردن کلید ارزیابی
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                نمایش کلید ارزیابی
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="print:block">
                          <div className="mt-4 space-y-3">
                            {/* Good Signs */}
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold mb-2">
                                <CheckCircle2 className="w-5 h-5" />
                                نشانه‌های مثبت
                              </div>
                              <ul className="space-y-1 text-sm">
                                {q.goodSigns.map((sign, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                                    <span>{sign}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Red Flags */}
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold mb-2">
                                <AlertTriangle className="w-5 h-5" />
                                هشدارها (Red Flags)
                              </div>
                              <ul className="space-y-1 text-sm">
                                {q.redFlags.map((flag, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-red-600 dark:text-red-400 mt-1">•</span>
                                    <span>{flag}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewAssistant;
