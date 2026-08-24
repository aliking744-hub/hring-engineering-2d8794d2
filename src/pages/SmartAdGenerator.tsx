import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCredits, CREDIT_COSTS, DIAMOND_COSTS } from "@/hooks/useCredits";
import { ArrowRight, Megaphone, Loader2, Copy, Download, Sparkles, Image as ImageIcon, Upload, X, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

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

const SmartAdGenerator = () => {
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [industry, setIndustry] = useState("");
  const [platform, setPlatform] = useState("");
  const [tone, setTone] = useState("");
  const [generateImage, setGenerateImage] = useState(false);
  const [imageFormat, setImageFormat] = useState("16:9");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { credits } = useCredits();

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

  const handleGenerate = async () => {
    if (!jobTitle || !companyName || !contactMethod || !platform || !tone) {
      toast({
        title: "خطا",
        description: "لطفاً تمام فیلدهای ضروری را پر کنید",
        variant: "destructive",
      });
      return;
    }

    // Calculate required credits
    const requiredCredits = generateImage ? CREDIT_COSTS.SMART_AD_IMAGE : CREDIT_COSTS.SMART_AD_TEXT;
    
    if (credits < requiredCredits) {
      toast({
        title: "اعتبار ناکافی",
        description: `برای این عملیات ${requiredCredits} جم نیاز دارید. اعتبار فعلی: ${credits}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedText("");
    setEditableText("");
    setGeneratedImage(null);

    try {
      const selectedFormat = imageFormats.find((f) => f.value === imageFormat);
      const { data, error } = await supabase.functions.invoke("generate-job-ad", {
        body: {
          jobTitle,
          companyName,
          contactMethod,
          industry,
          platform,
          tone,
          generateImage,
          imageFormat,
          imageWidth: selectedFormat?.width || 1920,
          imageHeight: selectedFormat?.height || 1080,
        },
      });

      if (error) {
        console.error("Error:", error);

        const apiError = error as { context?: { status?: number; detail?: unknown } };
        const status = apiError.context?.status;
        const serverMessage = typeof apiError.context?.detail === 'string'
          ? apiError.context.detail
          : undefined;

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
            description: serverMessage || "مشکلی در تولید آگهی پیش آمد. لطفاً دوباره تلاش کنید.",
            variant: "destructive",
          });
        }
        return;
      }

      if (data?.error) {
        toast({
          title: "خطا",
          description: String(data.error),
          variant: "destructive",
        });
        return;
      }

      if (data?.generatedText) {
        setGeneratedText(data.generatedText);
        setEditableText(data.generatedText);
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
      }

      toast({
        title: "موفق",
        description: "آگهی شغلی با موفقیت تولید شد",
      });

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "خطا",
        description: "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-8 sm:py-12 px-4">
        <div className="container max-w-4xl 2xl:max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link to="/dashboard" className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm sm:text-base">
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">بازگشت به داشبورد</span>
              <span className="sm:hidden">بازگشت</span>
            </Link>
            <img src={logo} alt="لوگو" className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">
              <Megaphone className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">آگهی‌نویس هوشمند</h1>
              <p className="text-primary-foreground/80 mt-1 text-sm sm:text-base">
                نوشتن آگهی‌های شغلی جذاب با هوش مصنوعی
              </p>
            </div>
          </div>
        </div>
      </div>

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

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <Label htmlFor="generateImage" className="text-base font-medium cursor-pointer">
                      تولید تصویر با هوش مصنوعی
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      یک تصویر جذاب برای آگهی شما ساخته می‌شود
                    </p>
                  </div>
                </div>
                <Switch
                  id="generateImage"
                  checked={generateImage}
                  onCheckedChange={setGenerateImage}
                  className="flex-shrink-0"
                />
              </div>

              {generateImage && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                  <Label>فرمت تصویر</Label>
                  <Select value={imageFormat} onValueChange={setImageFormat}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب فرمت" />
                    </SelectTrigger>
                    <SelectContent>
                      {imageFormats.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-12 text-lg gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  در حال تولید...
                </>
              ) : (
                <>
                  <Megaphone className="w-5 h-5" />
                  تولید آگهی
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result Section */}
        {generatedText && (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartAdGenerator;
