import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Sparkles, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import logoImage from "@/assets/logo.png";
import DataPrivacyWarning from "@/components/DataPrivacyWarning";
import jsPDF from "jspdf";
import { ApiError, apiRequest } from "@/lib/api";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { Textarea } from "@/components/ui/textarea";

const seniorityLevels = [
  { value: "junior", label: "کارشناس (Junior)" },
  { value: "senior", label: "کارشناس ارشد (Senior)" },
  { value: "lead", label: "سرپرست (Lead)" },
  { value: "manager", label: "مدیر (Manager)" },
];

const JobDescriptionGenerator = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const { toast } = useToast();
  const { credits, hasEnoughCredits, getCost } = useCredits();
  const previewRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const downloadPDF = async () => {
    if (!previewRef.current) return;
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
      setGeneratedContent(data.content);
      idempotencyKeyRef.current = null;
      window.dispatchEvent(new Event("hring:credits-changed"));
      toast({ title: "موفق", description: "پروفایل شغلی با موفقیت تولید شد." });
    } catch (error) {
      if (error instanceof ApiError) idempotencyKeyRef.current = null;
      console.error("Error:", error);
      toast({ title: "خطا", description: "خطا در تولید پروفایل شغلی", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    if (!generatedContent) return;

    // Build HTML content for the print area
    const parsedContent = generatedContent
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .split('\n')
      .map(line => {
        const t = line.trim();
        if (!t || t.match(/^-{3,}$/)) return '';
        if (t.startsWith('##')) {
          const text = t.replace(/^#+\s*/, '');
          return `<h2 class="pdf-section-title">${text}</h2>`;
        }
        if (t.startsWith('#')) {
          const text = t.replace(/^#+\s*/, '');
          return `<h3 class="pdf-sub-title">${text}</h3>`;
        }
        if (t.startsWith('|')) {
          const cells = t.split('|').filter(c => c.trim() && !c.trim().match(/^-+$/));
          if (cells.length >= 2) {
            return `<div class="pdf-table-row">${cells.map(c => `<span>${c.trim()}</span>`).join('')}</div>`;
          }
          return '';
        }
        if (t.startsWith('-') || t.startsWith('•')) {
          const text = t.replace(/^[-•]\s*/, '');
          return `<li>${text}</li>`;
        }
        return `<p>${t}</p>`;
      })
      .filter(Boolean)
      .join('\n');

    const today = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
    const meta = [
      companyName ? `شرکت: ${companyName}` : '',
      industry ? `صنعت: ${industry}` : '',
      seniorityLevel ? `سطح: ${seniorityLevels.find(s => s.value === seniorityLevel)?.label ?? seniorityLevel}` : '',
    ].filter(Boolean).join('  |  ');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>پروفایل شغلی - ${jobTitle}</title>
  <style>
    @font-face {
      font-family: 'BNazanin';
      src: url('/fonts/BNAZANIN.TTF') format('truetype');
      font-weight: normal;
    }
    @font-face {
      font-family: 'IRANSans';
      src: url('/fonts/IRANSansBold-Edit.ttf') format('truetype');
      font-weight: bold;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'BNazanin', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #1a1a2e;
      font-size: 11pt;
      line-height: 1.8;
    }
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }
    /* HEADER */
    .pdf-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      margin-bottom: 18px;
      border-bottom: 3px solid #2563eb;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 16px 20px;
      border-radius: 8px;
      color: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-header-right {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pdf-header-title {
      font-family: 'IRANSans', 'BNazanin', Tahoma, sans-serif;
      font-size: 18pt;
      font-weight: bold;
      color: #ffffff;
    }
    .pdf-header-subtitle {
      font-size: 10pt;
      color: #bfdbfe;
    }
    .pdf-logo {
      width: 52px;
      height: 52px;
      object-fit: contain;
      filter: brightness(0) invert(1);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* META STRIP */
    .pdf-meta {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 8px 16px;
      margin-bottom: 20px;
      font-size: 9.5pt;
      color: #1e40af;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* CONTENT */
    .pdf-body {
      padding: 0 4px;
    }
    .pdf-section-title {
      font-family: 'IRANSans', 'BNazanin', Tahoma, sans-serif;
      font-size: 13pt;
      font-weight: bold;
      color: #1e40af;
      background: linear-gradient(90deg, #dbeafe 0%, transparent 100%);
      padding: 6px 10px;
      border-right: 4px solid #2563eb;
      border-radius: 0 4px 4px 0;
      margin: 18px 0 8px 0;
      page-break-after: avoid;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-sub-title {
      font-size: 11pt;
      font-weight: bold;
      color: #374151;
      margin: 10px 0 4px 0;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 6px;
      color: #111827;
    }
    li {
      margin: 4px 0 4px 0;
      padding-right: 8px;
      color: #1f2937;
      list-style: none;
      position: relative;
    }
    li::before {
      content: '◆';
      color: #2563eb;
      font-size: 7pt;
      position: absolute;
      right: -10px;
      top: 3px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-table-row {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 5px 10px;
      margin-bottom: 4px;
      font-size: 10pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-table-row span:first-child {
      font-weight: bold;
      color: #1e40af;
    }
    /* FOOTER */
    .pdf-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #dbeafe;
      padding: 6px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
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
    <div class="pdf-header-right">
      <div class="pdf-header-title">پروفایل شغلی: ${jobTitle}</div>
      <div class="pdf-header-subtitle">سند هویت و مشخصات شغلی | ${today}</div>
    </div>
    <img class="pdf-logo" src="${window.location.origin}/favicon.ico" onerror="this.style.display='none'" />
  </div>
  ${meta ? `<div class="pdf-meta">${meta}</div>` : ''}
  <div class="pdf-body">
    ${parsedContent}
  </div>
  <div class="pdf-footer">
    <span>hring.io</span>
    <span>${today}</span>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 600);
    };
  </script>
</body>
</html>`);

    printWindow.document.close();
    toast({ title: "موفق", description: "فایل PDF با موفقیت آماده شد." });
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
      </div>
    </div>
  );
};

export default JobDescriptionGenerator;
