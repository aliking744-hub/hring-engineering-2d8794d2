import { useCallback, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { ApiError, apiBlobRequest, apiRequest } from "@/lib/api";
import { ArrowRight, Megaphone, Loader2, Copy, Download, Sparkles, Image as ImageIcon, Upload, X, Coins, History } from "lucide-react";
import logo from "@/assets/logo.png";
import WorkspaceHeader from "@/components/WorkspaceHeader";

// Platform options for job ad
const platforms = [
  { value: "jobboard", label: "سایت‌های کاریابی (رسمی)" },
  { value: "linkedin", label: "لینکدین (تعاملی)" },
  { value: "instagram", label: "اینستاگرام (کوتاه و جذاب)" },
];

const tones = [
  { value: "formal", label: "رسمی و اداری" },
  { value: "friendly", label: "صمیمی و پرانرژی" },
  { value: "challenge", label: "چالشی و رشد محور" },
];

const imageFormats = [
  { value: "16:9", label: "افقی (16:9) - مناسب لینکدین", width: 1920, height: 1080 },
  { value: "1:1", label: "مربعی (1:1) - مناسب اینستاگرام", width: 1080, height: 1080 },
  { value: "9:16", label: "عمودی (9:16) - مناسب استوری", width: 1080, height: 1920 },
];

type UnknownRecord = Record<string, unknown>;

interface SmartAdHistoryItem {
  id: string;
  jobTitle: string;
  companyName: string;
  contentType: string;
  createdAt: string;
}

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("تصویر دریافتی قابل خواندن نیست"));
  reader.onload = () => {
    if (typeof reader.result === "string" && reader.result.startsWith("data:image/")) {
      resolve(reader.result);
      return;
    }
    reject(new Error("فرمت تصویر دریافتی معتبر نیست"));
  };
  reader.readAsDataURL(blob);
});

const formatGeneratedJobAd = (payload: unknown): string => {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";

  const response = payload as UnknownRecord;
  for (const key of ["generatedText", "content", "text"]) {
    const value = response[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const candidate = response.generated_job_ad ?? response.generatedAd ?? response.job_ad;
  if (typeof candidate === "string") return candidate.trim();
  if (candidate && typeof candidate === "object") {
    const ad = candidate as UnknownRecord;
    const lines: string[] = [];
    const append = (label: string, value: unknown) => {
      if (typeof value === "string" && value.trim()) {
        lines.push(`${label}\n${value.trim()}`);
      } else if (Array.isArray(value) && value.length > 0) {
        lines.push(`${label}\n${value.map((item) => `• ${String(item)}`).join("\n")}`);
      }
    };

    append("عنوان آگهی", ad.title);
    append("شرکت", ad.company ?? response.company);
    append("معرفی فرصت شغلی", ad.summary);
    append("مسئولیت‌ها", ad.responsibilities);
    append("شرایط و مهارت‌های موردنیاز", ad.requirements);
    append("ویژگی‌های ترجیحی", ad.preferred_profile);
    append("نوع همکاری", ad.employment_type);
    append("نحوه ارسال درخواست", ad.application_note);

    if (lines.length > 0) return lines.join("\n\n");
  }

  const fallback = JSON.stringify(payload, null, 2);
  return fallback === "{}" ? "" : fallback;
};

const SmartAdGenerator = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [industry, setIndustry] = useState("");
  const [platform, setPlatform] = useState("");
  const [tone, setTone] = useState("");
  const [imageFormat, setImageFormat] = useState("16:9");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<SmartAdHistoryItem[]>([]);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const textRequestKeyRef = useRef<string | null>(null);
  const imageRequestKeyRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { credits, getCost } = useCredits();

  const loadImageHistory = useCallback(async () => {
    try {
      setImageHistory(await apiRequest<SmartAdHistoryItem[]>("/job-ads/history"));
    } catch (error) {
      console.warn("Smart-ad history could not be loaded:", error);
    }
  }, []);

  useEffect(() => {
    void loadImageHistory();
  }, [loadImageHistory]);

  const restoreHistoryImage = async (item: SmartAdHistoryItem) => {
    try {
      const imageData = await blobToDataUrl(await apiBlobRequest(`/job-ads/assets/${item.id}`));
      setGeneratedImage(imageData);
      setJobTitle(item.jobTitle);
      setCompanyName(item.companyName);
      scrollToResult();
    } catch (error) {
      showRequestError(error, "تصویر تاریخچه قابل بازیابی نیست.");
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "خطا",
          description: "حجم لوگو باید کمتر از ۲ مگابایت باشد",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setCompanyLogo(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const validateInputs = () => {
    if (!jobTitle || !companyName || !contactMethod || !platform || !tone) {
      toast({
        title: "خطا",
        description: "لطفاً تمام فیلدهای ضروری را پر کنید",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const ensureCredits = (requiredCredits: number) => {
    if (credits >= requiredCredits) return true;
    toast({
      title: "اعتبار ناکافی",
      description: `برای این عملیات ${requiredCredits} جم نیاز دارید. اعتبار فعلی: ${credits}`,
      variant: "destructive",
    });
    return false;
  };

  const requestBody = () => {
    const selectedFormat = imageFormats.find((format) => format.value === imageFormat);
    return {
      jobTitle,
      companyName,
      contactMethod,
      industry,
      platform,
      tone,
      generateImage: false,
      imageFormat,
      imageWidth: selectedFormat?.width || 1920,
      imageHeight: selectedFormat?.height || 1080,
      approvedText: editableText || generatedText || null,
      companyLogo: companyLogo,
    };
  };

  const showRequestError = (error: unknown, fallback: string) => {
    console.error("Smart ad request failed:", error);
    const apiError = error as { context?: { status?: number; detail?: unknown }; status?: number };
    const status = error instanceof ApiError ? error.status : apiError.context?.status;
    const serverMessage = error instanceof ApiError
      ? error.message
      : typeof apiError.context?.detail === "string" ? apiError.context.detail : undefined;

    if (status === 429) {
      toast({
        title: "محدودیت درخواست",
        description: "لطفاً کمی صبر کنید و دوباره تلاش کنید",
        variant: "destructive",
      });
    } else if (status === 402) {
      toast({
        title: "اعتبار ناکافی",
        description: "اعتبار هوش مصنوعی کافی نیست. لطفاً حساب را شارژ کنید.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "خطا",
        description: serverMessage || fallback,
        variant: "destructive",
      });
    }
  };

  const scrollToResult = () => {
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleGenerateText = async () => {
    if (!validateInputs() || !ensureCredits(getCost('SMART_AD_TEXT'))) return;

    setIsTextLoading(true);
    try {
      const requestKey = textRequestKeyRef.current || crypto.randomUUID();
      textRequestKeyRef.current = requestKey;
      const data = await apiRequest<{ generatedText: string }>("/job-ads/generate-text", {
        method: "POST",
        headers: { "X-Idempotency-Key": requestKey },
        body: JSON.stringify(requestBody()),
      });
      const responseText = formatGeneratedJobAd(data);
      if (!responseText) {
        toast({
          title: "متن تولید نشد",
          description: "سرویس پاسخ قابل نمایش برنگرداند؛ اعتباری نباید مصرف شود.",
          variant: "destructive",
        });
        return;
      }

      setGeneratedText(responseText);
      setEditableText(responseText);
      textRequestKeyRef.current = null;
      window.dispatchEvent(new Event("hring:credits-changed"));
      toast({ title: "موفق", description: "متن آگهی با موفقیت تولید شد" });
      scrollToResult();
    } catch (error) {
      if (error instanceof ApiError) textRequestKeyRef.current = null;
      showRequestError(error, "مشکلی در تولید متن آگهی پیش آمد. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsTextLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!validateInputs() || !ensureCredits(getCost('SMART_AD_IMAGE'))) return;

    setIsImageLoading(true);
    try {
      const requestKey = imageRequestKeyRef.current || crypto.randomUUID();
      imageRequestKeyRef.current = requestKey;
      const data = await apiRequest<{ imageUrl: string; assetId?: string }>("/job-ads/generate-image", {
        method: "POST",
        headers: { "X-Idempotency-Key": requestKey },
        body: JSON.stringify(requestBody()),
      });
      const responseImage = typeof data?.imageUrl === "string" ? data.imageUrl : null;
      if (!responseImage) {
        toast({
          title: "تصویر تولید نشد",
          description: "سرویس تصویر معتبری برنگرداند؛ اعتباری نباید مصرف شود.",
          variant: "destructive",
        });
        return;
      }

      const privateImageData = data.assetId && responseImage.startsWith("/job-ads/assets/")
        ? await blobToDataUrl(await apiBlobRequest(responseImage))
        : null;
      const composedImage = await composeRecruitmentPoster(privateImageData || responseImage);
      setGeneratedImage(composedImage);

      if (data.assetId && composedImage.startsWith("data:image/")) {
        try {
          await apiRequest(`/job-ads/assets/${data.assetId}/finalize`, {
            method: "POST",
            body: JSON.stringify({ imageData: composedImage }),
          });
        } catch (error) {
          console.warn("Smart-ad history persistence failed:", error);
          toast({
            title: "تصویر ساخته شد",
            description: "ذخیره در تاریخچه انجام نشد؛ می‌توانید همین حالا آن را دانلود کنید.",
            variant: "destructive",
          });
        }
      }
      imageRequestKeyRef.current = null;
      await loadImageHistory();
      window.dispatchEvent(new Event("hring:credits-changed"));
      toast({ title: "موفق", description: "تصویر آگهی با موفقیت تولید شد" });
      scrollToResult();
    } catch (error) {
      if (error instanceof ApiError) imageRequestKeyRef.current = null;
      showRequestError(error, "مشکلی در تولید تصویر آگهی پیش آمد. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsImageLoading(false);
    }
  };

  const composeRecruitmentPoster = async (backgroundUrl: string): Promise<string> => {
    const selectedFormat = imageFormats.find((format) => format.value === imageFormat);
    const width = selectedFormat?.width || 1920;
    const height = selectedFormat?.height || 1080;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return backgroundUrl;

    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });

    let background: HTMLImageElement;
    try {
      background = await loadImage(backgroundUrl);
    } catch {
      // Preserve the provider image if a cross-origin host blocks client-side composition.
      return backgroundUrl;
    }
    context.drawImage(background, 0, 0, width, height);
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(7,12,28,.18)');
    gradient.addColorStop(1, 'rgba(7,12,28,.82)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.round(height * .075)}px Tahoma, sans-serif`;
    context.fillText('استخدام می‌کنیم', width * .9, height * .28);
    context.font = `700 ${Math.round(height * .1)}px Tahoma, sans-serif`;
    context.fillText(jobTitle, width * .9, height * .44, width * .78);
    context.font = `600 ${Math.round(height * .055)}px Tahoma, sans-serif`;
    context.fillText(companyName, width * .9, height * .57, width * .72);
    context.font = `400 ${Math.round(height * .035)}px Tahoma, sans-serif`;
    context.fillText(contactMethod, width * .9, height * .69, width * .72);
    if (companyLogo) {
      try {
        const uploadedLogo = await loadImage(companyLogo);
        const size = Math.min(width, height) * .16;
        context.drawImage(uploadedLogo, width * .08, height * .08, size, size);
      } catch {
        // A bad uploaded logo must not turn a paid, successful image into a failed action.
        console.warn("Smart-ad logo could not be composited");
      }
    }
    return canvas.toDataURL('image/png', 0.95);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editableText);
      toast({
        title: "کپی شد",
        description: "متن آگهی در کلیپ‌بورد کپی شد",
      });
    } catch (err) {
      toast({
        title: "خطا",
        description: "کپی کردن متن با مشکل مواجه شد",
        variant: "destructive",
      });
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;

    try {
      const a = document.createElement("a");
      a.href = generatedImage;
      a.download = `job-ad-${jobTitle.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "دانلود شد",
        description: "تصویر دانلود شد",
      });
    } catch (err) {
      console.error("Download error:", err);
      toast({
        title: "خطا",
        description: "دانلود تصویر با مشکل مواجه شد",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <WorkspaceHeader title="آگهی‌نویس هوشمند" subtitle="نوشتن آگهی‌های شغلی جذاب با هوش مصنوعی" icon={<Megaphone className="h-6 w-6" />} />

      {/* Form Section */}
      <div className="container max-w-4xl 2xl:max-w-5xl mx-auto py-6 sm:py-10 px-2 sm:px-4">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              مشخصات آگهی
            </CardTitle>
            <CardDescription>
              اطلاعات زیر را وارد کنید تا آگهی شغلی حرفه‌ای برای شما تولید شود
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">عنوان شغلی *</Label>
                <Input
                  id="jobTitle"
                  placeholder="مثال: کارشناس منابع انسانی"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">نام شرکت *</Label>
                <div className="flex gap-2">
                  <Input
                    id="companyName"
                    placeholder="مثال: شرکت فناوری پارس"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="flex-1"
                  />
                  {companyLogo && (
                    <div className="relative">
                      <img
                        src={companyLogo}
                        alt="لوگوی شرکت"
                        className="w-10 h-10 rounded-lg object-contain border bg-background"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>لوگوی شرکت (اختیاری)</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {companyLogo ? "تغییر لوگو" : "آپلود لوگو"}
                </Button>
                {companyLogo && (
                  <span className="text-sm text-muted-foreground">لوگو آپلود شد</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">حداکثر ۲ مگابایت - فرمت‌های JPG, PNG, SVG</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">صنعت (برای تولید تصویر بهتر)</Label>
                <Input
                  id="industry"
                  placeholder="مثال: فناوری اطلاعات، بانکداری، تولید"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactMethod">راه ارتباطی (ایمیل یا شماره تماس) *</Label>
                <Input
                  id="contactMethod"
                  placeholder="مثال: hr@company.com یا 021-12345678"
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>پلتفرم انتشار *</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>لحن نوشتار *</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {tones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <Label className="text-base font-medium">فرمت تصویر</Label>
                  <p className="text-sm text-muted-foreground">
                    فقط هنگام فشردن دکمه «تولید تصویر» استفاده می‌شود
                  </p>
                </div>
              </div>
              <Select value={imageFormat} onValueChange={setImageFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب فرمت" />
                </SelectTrigger>
                <SelectContent>
                  {imageFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                onClick={handleGenerateText}
                disabled={isTextLoading || isImageLoading || credits < getCost('SMART_AD_TEXT')}
                className="h-12 text-base gap-2"
              >
                {isTextLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    در حال تولید متن...
                  </>
                ) : (
                  <>
                    <Megaphone className="w-5 h-5" />
                    تولید متن
                    <span className="text-xs opacity-80">({getCost('SMART_AD_TEXT')} جم)</span>
                  </>
                )}
              </Button>
              <Button
                onClick={handleGenerateImage}
                disabled={isTextLoading || isImageLoading || credits < getCost('SMART_AD_IMAGE')}
                variant="secondary"
                className="h-12 text-base gap-2"
              >
                {isImageLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    در حال تولید تصویر...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    تولید تصویر
                    <span className="text-xs opacity-80">({getCost('SMART_AD_IMAGE')} جم)</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result Section */}
        {(generatedText || generatedImage) && (
          <div ref={resultRef} className="mt-8 space-y-6">
            {generatedImage && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      تصویر آگهی
                    </span>
                    <Button variant="outline" size="sm" onClick={handleDownloadImage} className="gap-2">
                      <Download className="w-4 h-4" />
                      دانلود تصویر
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={generatedImage}
                    alt="تصویر آگهی شغلی"
                    className="w-full max-w-full rounded-lg shadow-md object-contain max-h-[60vh] sm:max-h-none"
                  />
                </CardContent>
              </Card>
            )}

            {generatedText && (
              <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    متن آگهی
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? "پیش‌نمایش" : "ویرایش"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopyText} className="gap-2">
                      <Copy className="w-4 h-4" />
                      کپی متن
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    className="min-h-[400px] text-base leading-relaxed"
                    dir="rtl"
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-base leading-relaxed p-4 bg-muted/30 rounded-lg">
                    {editableText}
                  </div>
                )}
              </CardContent>
              </Card>
            )}
          </div>
        )}

        {imageHistory.length > 0 && (
          <Card className="mt-8 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" /> تاریخچه تصاویر آگهی
              </CardTitle>
              <CardDescription>تصاویر فقط برای مالک حساب قابل مشاهده و دانلود هستند.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {imageHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void restoreHistoryImage(item)}
                  className="rounded-lg border border-border p-3 text-right transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <span className="block font-medium">{item.jobTitle}</span>
                  <span className="block text-sm text-muted-foreground">{item.companyName}</span>
                  <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("fa-IR")}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SmartAdGenerator;
