import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Sparkles, Download, Loader2, History, Trash2 } from "lucide-react";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import DataPrivacyWarning from "@/components/DataPrivacyWarning";
import jsPDF from "jspdf";
import { ApiError, apiRequest } from "@/lib/api";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { Textarea } from "@/components/ui/textarea";
import logo from "@/assets/logo.png";
import { waitForPrintableAssets } from "@/lib/printDocument";

const seniorityLevels = [
  { value: "junior", label: "کارشناس (Junior)" },
  { value: "senior", label: "کارشناس ارشد (Senior)" },
  { value: "lead", label: "سرپرست (Lead)" },
  { value: "manager", label: "مدیر (Manager)" },
];

interface JobProfileHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  payload: {
    input?: { jobTitle?: string; industry?: string; seniorityLevel?: string; companyName?: string | null };
    content?: string;
  };
}

const JobDescriptionGenerator = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [history, setHistory] = useState<JobProfileHistoryItem[]>([]);
  const { toast } = useToast();
  const { credits, hasEnoughCredits, getCost } = useCredits();
  const previewRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await apiRequest<JobProfileHistoryItem[]>(
        "/workspace/outputs?featureKey=job_engineering.job_profile&limit=20",
      );
      setHistory(rows);
    } catch (error) {
      console.warn("Job-profile history could not be loaded:", error);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const restoreHistory = (item: JobProfileHistoryItem) => {
    const input = item.payload.input;
    setJobTitle(input?.jobTitle || item.title);
    setIndustry(input?.industry || "");
    setSeniorityLevel(input?.seniorityLevel || "");
    setCompanyName(input?.companyName || "");
    setGeneratedContent(item.payload.content || "");
  };

  const removeHistory = async (id: string) => {
    try {
      await apiRequest(`/workspace/outputs/${id}`, { method: "DELETE" });
      setHistory((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Job-profile history deletion failed:", error);
      toast({ title: "خطا", description: "حذف خروجی انجام نشد", variant: "destructive" });
    }
  };

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    await waitForPrintableAssets(previewRef.current);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await pdf.html(previewRef.current, {
      callback: (document) => document.save(`HRing-job-profile-${jobTitle || 'report'}.pdf`),
      margin: [12, 12, 12, 12],
      autoPaging: 'text',
      html2canvas: { scale: 0.8, useCORS: true },
      width: 186,
      windowWidth: 900,
    });
  };

  const handleGenerate = async () => {
    if (!jobTitle || !industry || !seniorityLevel) {
      toast({
        title: "خطا",
        description: "لطفاً عنوان شغلی، صنعت و سطح ارشدیت را وارد کنید.",
        variant: "destructive",
      });
      return;
    }

    if (!hasEnoughCredits('JOB_PROFILE')) {
      toast({
        title: "اعتبار ناکافی",
        description: `برای این عملیات ${getCost('JOB_PROFILE')} جم نیاز دارید. اعتبار فعلی: ${credits}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const requestKey = idempotencyKeyRef.current || crypto.randomUUID();
      idempotencyKeyRef.current = requestKey;
      const data = await apiRequest<{ content: string }>("/job-engineering/job-profiles/generate", {
        method: "POST",
        headers: { "X-Idempotency-Key": requestKey },
        body: JSON.stringify({ jobTitle, industry, seniorityLevel, companyName: companyName || null }),
      });
      if (typeof data?.content !== "string" || !data.content.trim()) {
        throw new Error("پروفایل شغلی کامل دریافت نشد؛ اعتبار شما کسر نشده یا در صورت کسر خودکار بازگردانده می‌شود.");
      }
      setGeneratedContent(data.content.trim());
      idempotencyKeyRef.current = null;
      window.dispatchEvent(new Event("hring:credits-changed"));
      toast({ title: "موفق", description: "پروفایل شغلی با موفقیت تولید شد." });
      await loadHistory();
    } catch (error) {
      if (error instanceof ApiError) idempotencyKeyRef.current = null;
      console.error("Error:", error);
      toast({ title: "خطا", description: "خطا در تولید پروفایل شغلی", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      
      <WorkspaceHeader title="ایجاد پروفایل شغلی" subtitle="با هوش مصنوعی سند شرح شغلی حرفه‌ای بسازید" icon={<Briefcase className="h-6 w-6" />} />
      <div className="relative z-10 container mx-auto px-4 py-8">

        {/* Data Privacy Warning for non-Plus users */}
        <DataPrivacyWarning className="mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 space-y-6">
            <div className="space-y-2">
              <Label>عنوان شغلی *</Label>
              <Input placeholder="مثال: مدیر محصول" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>صنعت *</Label>
              <Input placeholder="مثال: فناوری اطلاعات" value={industry} onChange={(e) => setIndustry(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>سطح ارشدیت *</Label>
              <Select value={seniorityLevel} onValueChange={setSeniorityLevel}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="انتخاب کنید..." /></SelectTrigger>
                <SelectContent>
                  {seniorityLevels.map((level) => (<SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نام شرکت (اختیاری)</Label>
              <Input placeholder="مثال: شرکت فناوری" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <Button className="w-full glow-button text-foreground" onClick={handleGenerate} disabled={isLoading || !hasEnoughCredits('JOB_PROFILE')}>
              {isLoading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />در حال تولید...</> : <><Sparkles className="w-4 h-4 ml-2" />تولید پروفایل شغلی ({getCost('JOB_PROFILE')} جم)</>}
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">پیش‌نمایش</h2>
              {generatedContent && (
                <Button onClick={() => void downloadPDF()} className="glow-button text-foreground">
                  <Download className="w-4 h-4 ml-2" />
                  دانلود PDF
                </Button>
              )}
            </div>
            {generatedContent && (
              <Textarea
                aria-label="ویرایش متن پروفایل شغلی"
                value={generatedContent}
                onChange={(event) => setGeneratedContent(event.target.value)}
                className="mb-4 min-h-[220px] bg-background font-sans leading-7"
              />
            )}
            <div ref={previewRef} className="bg-secondary/30 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
              {generatedContent ? (
                <div className="text-sm text-foreground leading-relaxed space-y-2" style={{ fontFamily: 'BNazanin, Tahoma, sans-serif' }}>
                  <div className="mb-6 flex items-center justify-between border-b border-primary/30 pb-4">
                    <div className="text-right">
                      <h1 className="text-xl font-bold">پروفایل شغلی</h1>
                      <p className="text-muted-foreground">{companyName || 'HRing'} — {jobTitle}</p>
                    </div>
                    <img src={logo} alt="HRing" className="h-12 w-12 rounded-lg object-contain" />
                  </div>
                  {generatedContent.split('\n').map((line, index) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.match(/^-{3,}$/)) return null;
                    
                    if (trimmed.startsWith("##")) {
                      const text = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                      return <h3 key={index} className="text-primary font-bold mt-4 mb-2 text-base border-b border-primary/30 pb-1">{text}</h3>;
                    }
                    if (trimmed.startsWith("###")) {
                      const text = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                      return <h4 key={index} className="text-muted-foreground font-semibold mt-3 mb-1">{text}</h4>;
                    }
                    if (trimmed.startsWith("|")) {
                      const cells = trimmed.split("|").filter(c => c.trim() && !c.match(/^-+$/));
                      if (cells.length >= 2) {
                        return (
                          <div key={index} className="grid grid-cols-2 gap-2 bg-secondary/50 px-3 py-1.5 rounded text-xs">
                            {cells.map((cell, i) => (
                              <span key={i} className={i === 0 ? "font-semibold" : ""}>{cell.trim().replace(/\*\*/g, '')}</span>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }
                    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
                      const text = trimmed.replace(/^[-•]\s*/, '').replace(/\*\*/g, '');
                      return <p key={index} className="pr-4 relative before:content-['•'] before:absolute before:right-0 before:text-primary">{text}</p>;
                    }
                    const text = trimmed.replace(/\*\*/g, '');
                    return <p key={index}>{text}</p>;
                  })}
                </div>
              ) : (
                <p className="text-center mt-20 text-muted-foreground">فرم را پر کنید و روی "تولید پروفایل شغلی" کلیک کنید...</p>
              )}
            </div>
          </motion.div>
        </div>

        {history.length > 0 && (
          <div className="mt-8 glass-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <History className="h-5 w-5" /> تاریخچه پروفایل‌های شغلی
            </h2>
            <div className="space-y-2">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDescriptionGenerator;
