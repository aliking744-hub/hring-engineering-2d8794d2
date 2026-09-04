import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { Loader2, Download, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, MessageSquare, Brain, Users, Briefcase, Coins, History, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { ApiError, apiRequest } from "@/lib/api";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import logo from "@/assets/logo.png";

interface InterviewQuestion {
  id: string;
  section: string;
  sectionIcon: "technical" | "behavioral" | "intelligence" | "cultural";
  question: string;
  goodSigns: string[];
  redFlags: string[];
}

interface InterviewHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  payload: {
    input?: { jobTitle?: string; industry?: string; seniorityLevel?: string; focusArea?: string };
    questions?: InterviewQuestion[];
  };
}

const seniorityLevels = [
  { value: "junior", label: "کارشناس (Junior)" },
  { value: "senior", label: "کارشناس ارشد (Senior)" },
  { value: "lead", label: "سرپرست (Lead)" },
  { value: "manager", label: "مدیر (Manager)" },
];

const focusAreas = [
  { value: "technical", label: "تخصصی و فنی" },
  { value: "behavioral", label: "رفتاری و مهارت‌های نرم" },
  { value: "intelligence", label: "هوش و حل مسئله" },
  { value: "cultural", label: "تناسب فرهنگی" },
];

const InterviewAssistant = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [openAnswerKeys, setOpenAnswerKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { credits, hasEnoughCredits, getCost } = useCredits();
  const resultRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await apiRequest<InterviewHistoryItem[]>(
        "/workspace/outputs?featureKey=interview.kit&limit=20",
      );
      setHistory(rows);
    } catch (error) {
      console.warn("Interview history could not be loaded:", error);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const restoreHistory = (item: InterviewHistoryItem) => {
    const input = item.payload.input;
    setJobTitle(input?.jobTitle || item.title);
    setIndustry(input?.industry || "");
    setSeniorityLevel(input?.seniorityLevel || "");
    setFocusArea(input?.focusArea || "technical");
    setQuestions(Array.isArray(item.payload.questions) ? item.payload.questions : []);
  };

  const removeHistory = async (id: string) => {
    try {
      await apiRequest(`/workspace/outputs/${id}`, { method: "DELETE" });
      setHistory((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Interview history deletion failed:", error);
      toast({ title: "خطا", description: "حذف خروجی انجام نشد", variant: "destructive" });
    }
  };

  const downloadInterviewPDF = async () => {
    if (!resultRef.current) return;
    const root = resultRef.current;
    const controls = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-exclude]'));
    const answers = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-answer]'));
    const controlDisplays = controls.map((element) => element.style.display);
    const answerState = answers.map((element) => ({
      display: element.style.display,
      hidden: element.hasAttribute('hidden'),
    }));
    controls.forEach((element) => { element.style.display = 'none'; });
    answers.forEach((element) => {
      element.removeAttribute('hidden');
      element.style.display = 'block';
    });

    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      await pdf.html(root, {
        callback: (document) => document.save(`HRing-interview-kit-${jobTitle || 'report'}.pdf`),
        margin: [10, 10, 10, 10],
        autoPaging: 'text',
        html2canvas: { scale: 0.75, useCORS: true },
        width: 190,
        windowWidth: 900,
      });
    } finally {
      controls.forEach((element, index) => { element.style.display = controlDisplays[index]; });
      answers.forEach((element, index) => {
        element.style.display = answerState[index].display;
        if (answerState[index].hidden) element.setAttribute('hidden', '');
      });
    }
  };

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
        description: `برای این عملیات ${getCost('INTERVIEW_KIT')} جم نیاز دارید. اعتبار فعلی: ${credits}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setQuestions([]);

    try {
      const requestKey = idempotencyKeyRef.current || crypto.randomUUID();
      idempotencyKeyRef.current = requestKey;
      const data = await apiRequest<{ questions: InterviewQuestion[] }>("/interview/kits/generate", {
        method: "POST",
        headers: { "X-Idempotency-Key": requestKey },
        body: JSON.stringify({
          jobTitle,
          industry,
          seniorityLevel,
          focusArea: focusArea || "technical",
        }),
      });
      if (!Array.isArray(data?.questions) || data.questions.length !== 11) {
        throw new Error("راهنمای مصاحبه ناقص است؛ اعتبار شما کسر نشده یا در صورت کسر خودکار بازگردانده می‌شود.");
      }
      if (data.questions) {
        setQuestions(data.questions);
        idempotencyKeyRef.current = null;
        window.dispatchEvent(new Event("hring:credits-changed"));
        toast({
          title: "موفق",
          description: "راهنمای مصاحبه با موفقیت تولید شد.",
        });
        await loadHistory();
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) idempotencyKeyRef.current = null;
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


  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.section]) {
      acc[q.section] = [];
    }
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, InterviewQuestion[]>);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <WorkspaceHeader title="دستیار مصاحبه" subtitle="تولید راهنمای جامع مصاحبه با کلید ارزیابی" icon={<Briefcase className="h-6 w-6" />} />

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
              disabled={isLoading || !hasEnoughCredits('INTERVIEW_KIT')}
              className="w-full h-12 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  در حال تولید سوالات...
                </>
              ) : (
                `تولید راهنمای مصاحبه (${getCost('INTERVIEW_KIT')} جم)`
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {questions.length > 0 && (
          <div ref={resultRef} className="space-y-6">
            {/* Header */}
            <div data-pdf-exclude className="flex items-center justify-between print:hidden">
              <h2 className="text-2xl font-bold text-foreground">راهنمای مصاحبه</h2>
              <Button onClick={() => void downloadInterviewPDF()} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                دانلود PDF
              </Button>
            </div>

            {/* Branded report header (also rendered in PDF) */}
            <div className="mb-8 flex items-center justify-between border-b border-primary/30 pb-4">
              <div className="text-right">
                <h1 className="text-2xl font-bold">راهنمای مصاحبه</h1>
                <p className="text-muted-foreground">
                  {jobTitle} | {seniorityLevels.find((l) => l.value === seniorityLevel)?.label}
                  {industry && ` | ${industry}`}
                </p>
              </div>
              <img src={logo} alt="HRing" className="h-12 w-12 rounded-lg object-contain" />
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
                        <CollapsibleContent data-pdf-answer className="print:block">
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

        {history.length > 0 && (
          <Card className="mt-8 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" /> تاریخچه راهنماهای مصاحبه
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <button type="button" onClick={() => restoreHistory(item)} className="text-right hover:text-primary">
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("fa-IR")}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" aria-label="حذف خروجی" onClick={() => void removeHistory(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InterviewAssistant;
