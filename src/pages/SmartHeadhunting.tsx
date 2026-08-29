import React, { useEffect, useState } from "react";
import logoWhite from "@/assets/logo_zir_white.png";
import { Helmet } from "react-helmet-async";
import { 
  Crosshair, 
  Plus, 
  Upload, 
  Pause, 
  FileSpreadsheet,
  Zap,
  ChevronRight,
  ArrowLeft,
  FileText,
  Target,
  Users,
  Check,
  X,
  Loader2,
  Trash2,
  Search
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "@e965/xlsx";

const SmartHeadhunting = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaigns, loading, fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, addCandidates } = useCampaigns();
  
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [autoHeadhunting, setAutoHeadhunting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    jobTitle: "",
    seniorityLevel: "",
    city: "",
    skills: "",
    experience: "",
    industry: "",
    description: "",
  });

  // File upload states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [parsedCandidates, setParsedCandidates] = useState<any[]>([]);

  // One-time migration from legacy localStorage to database (if old data still exists in this browser)
  useEffect(() => {
    if (!user || loading) return;

    const LEGACY_CAMPAIGNS_STORAGE_KEY = "smart_headhunting_campaigns";
    const LEGACY_ID_MAP_KEY = "smart_headhunting_legacy_id_map";
    const MIGRATED_KEY = `smart_headhunting_db_migrated_${user.id}`;

    // Avoid duplicates: if user already has DB campaigns, we skip auto-migration.
    if (campaigns.length > 0) {
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }

    if (localStorage.getItem(MIGRATED_KEY) === "1") return;

    const legacyListStr = localStorage.getItem(LEGACY_CAMPAIGNS_STORAGE_KEY);
    if (!legacyListStr) {
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }

    let legacyList: any[] = [];
    try {
      const parsed = JSON.parse(legacyListStr);
      legacyList = Array.isArray(parsed) ? parsed : [];
    } catch {
      legacyList = [];
    }

    if (legacyList.length === 0) {
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }

    const normalizeSkillsToString = (skills: any): string => {
      if (Array.isArray(skills)) return skills.map(String).join(", ");
      if (typeof skills === "string") return skills;
      return "";
    };

    const run = async () => {
      try {
        toast.info("در حال انتقال کمپین‌های قبلی به دیتابیس...");

        let legacyMap: Record<string, string> = {};
        try {
          const storedMap = localStorage.getItem(LEGACY_ID_MAP_KEY);
          legacyMap = storedMap ? JSON.parse(storedMap) : {};
        } catch {
          legacyMap = {};
        }

        let migratedCount = 0;

        for (const legacyCampaign of legacyList) {
          const legacyId = String(legacyCampaign?.id ?? "").trim();
          if (!legacyId) continue;
          if (legacyMap[legacyId]) continue;

          let detail: any = null;
          try {
            const detailStr = localStorage.getItem(`campaign_${legacyId}`);
            detail = detailStr ? JSON.parse(detailStr) : null;
          } catch {
            detail = null;
          }

          const name = String(detail?.name ?? legacyCampaign?.name ?? "").trim();
          const city = String(detail?.city ?? legacyCampaign?.city ?? "").trim();
          if (!name || !city) continue;

          const skillsArr = (() => {
            const s = detail?.skills ?? legacyCampaign?.skills;
            if (Array.isArray(s)) return s.map((x: any) => String(x).trim()).filter(Boolean);
            if (typeof s === "string") return s.split(",").map((x) => x.trim()).filter(Boolean);
            return undefined;
          })();

          const dbCampaign = await createCampaign({
            name,
            city,
            job_title: String(detail?.job_title ?? detail?.jobTitle ?? name),
            industry: detail?.industry ?? legacyCampaign?.industry,
            experience_range: detail?.experience_range ?? legacyCampaign?.experience,
            skills: skillsArr,
            auto_headhunting: legacyCampaign?.source === "auto" || !!detail?.auto_headhunting,
          });

          const legacyCandidates = Array.isArray(detail?.candidates) ? detail.candidates : [];
          if (legacyCandidates.length > 0) {
            const mapped = legacyCandidates.map((c: any) => ({
              name: c?.name ?? null,
              email: c?.email ?? null,
              phone: c?.phone ?? null,
              skills: normalizeSkillsToString(c?.skills ?? ""),
              experience: c?.experience ?? null,
              education: c?.education ?? null,
              last_company: c?.lastCompany ?? c?.last_company ?? null,
              location: c?.location ?? null,
              title: c?.title ?? null,
              match_score: Number(c?.matchScore ?? c?.match_score ?? 0) || 0,
              candidate_temperature: c?.candidateTemperature ?? c?.candidate_temperature ?? "cold",
              recommendation: c?.recommendation ?? null,
              green_flags: c?.greenFlags ?? c?.green_flags ?? null,
              red_flags: c?.redFlags ?? c?.red_flags ?? null,
              layer_scores: c?.layerScores ?? c?.layer_scores ?? null,
              raw_data: c?.rawData ?? c?.raw_data ?? null,
            }));

            await addCandidates(dbCampaign.id, mapped);
          }

          const status = String(detail?.status ?? legacyCampaign?.status ?? "active");
          await updateCampaign(dbCampaign.id, {
            status,
            progress: status === "active" ? 100 : 0,
          });

          legacyMap[legacyId] = dbCampaign.id;
          migratedCount++;
        }

        localStorage.setItem(LEGACY_ID_MAP_KEY, JSON.stringify(legacyMap));
        localStorage.setItem(MIGRATED_KEY, "1");
        localStorage.removeItem(LEGACY_CAMPAIGNS_STORAGE_KEY);

        await fetchCampaigns();

        if (migratedCount > 0) {
          toast.success(`${migratedCount} کمپین منتقل شد`);
        } else {
          toast.info("کمپین قابل انتقالی پیدا نشد");
        }
      } catch (e: any) {
        console.error("Legacy migration failed:", e);
        localStorage.setItem(MIGRATED_KEY, "1");
      }
    };

    void run();
  }, [user, loading, campaigns.length, createCampaign, addCandidates, updateCampaign, fetchCampaigns]);

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "excel":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
            <FileSpreadsheet className="w-3 h-3 ml-1" />
            Excel
          </Badge>
        );
      case "pdf":
        return (
          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 hover:bg-sky-500/30">
            <FileText className="w-3 h-3 ml-1" />
            PDF
          </Badge>
        );
      case "api":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30">
            <Zap className="w-3 h-3 ml-1" />
            API
          </Badge>
        );
      case "auto":
        return (
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30">
            <Target className="w-3 h-3 ml-1" />
            هوش مصنوعی
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full ml-1.5 animate-pulse" />
          فعال
        </Badge>
      );
    }
    if (status === "processing") {
      return (
        <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full ml-1.5 animate-pulse" />
          در حال پردازش
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        <Pause className="w-3 h-3 ml-1" />
        متوقف
      </Badge>
    );
  };

  // Filter campaigns by search query and sort (newest created first)
  const filteredCampaigns = campaigns
    .filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.city?.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));


  const handleDeleteCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("آیا از حذف این کمپین مطمئن هستید؟")) return;
    
    try {
      setDeletingCampaignId(campaignId);
      await deleteCampaign(campaignId);
      toast.success("کمپین با موفقیت حذف شد");
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("خطا در حذف کمپین");
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const findColumnValue = (row: any, patterns: string[]): string => {
    // First try exact key match (case insensitive)
    for (const key of Object.keys(row)) {
      const keyLower = key.toLowerCase().trim();
      for (const pattern of patterns) {
        if (keyLower === pattern.toLowerCase()) {
          return (row[key] ?? '').toString().trim();
        }
      }
    }
    // Then try partial match (key contains pattern)
    for (const key of Object.keys(row)) {
      const keyLower = key.toLowerCase().trim();
      for (const pattern of patterns) {
        if (keyLower.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(keyLower)) {
          return (row[key] ?? '').toString().trim();
        }
      }
    }
    return '';
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      console.log("Excel raw data:", jsonData);
      console.log("Excel columns:", jsonData.length > 0 ? Object.keys(jsonData[0] as object) : []);
      
      if (jsonData.length > 100) {
        toast.error("حداکثر ۱۰۰ ردیف قابل پردازش است");
        return;
      }
      
      // Smart column mapping - searches for patterns in column names
      const namePatterns = ['نام', 'name', 'firstname', 'first_name', 'نام و نام خانوادگی', 'fullname', 'full_name', 'اسم', 'نام کامل'];
      const emailPatterns = ['ایمیل', 'email', 'e-mail', 'mail', 'پست الکترونیک', 'آدرس ایمیل'];
      const phonePatterns = ['تلفن', 'phone', 'mobile', 'موبایل', 'شماره تماس', 'شماره تلفن', 'همراه', 'tel', 'telephone'];
      const skillsPatterns = ['مهارت', 'skills', 'skill', 'توانایی', 'مهارت‌ها', 'تخصص'];
      const experiencePatterns = ['سابقه', 'experience', 'تجربه', 'سابقه کار', 'سال تجربه', 'years'];
      const educationPatterns = ['تحصیلات', 'education', 'مدرک', 'مدرک تحصیلی', 'degree', 'رشته'];
      const companyPatterns = ['شرکت', 'company', 'سازمان', 'آخرین شرکت', 'محل کار', 'employer', 'organization'];
      const locationPatterns = ['شهر', 'city', 'location', 'محل', 'محل زندگی', 'استان', 'آدرس'];
      
      const candidatesRaw = jsonData.map((row: any, index: number) => {
        const candidate = {
          name: findColumnValue(row, namePatterns),
          email: findColumnValue(row, emailPatterns),
          phone: findColumnValue(row, phonePatterns),
          skills: findColumnValue(row, skillsPatterns),
          experience: findColumnValue(row, experiencePatterns),
          education: findColumnValue(row, educationPatterns),
          lastCompany: findColumnValue(row, companyPatterns),
          location: findColumnValue(row, locationPatterns),
          rawData: row,
        };
        console.log(`Row ${index + 1} parsed:`, candidate);
        return candidate;
      });

      const candidatesNonEmpty = candidatesRaw.filter((c) =>
        Object.values(c).some((v) => v && typeof v === 'string' && v.trim().length > 0)
      );

      const candidates = candidatesNonEmpty.filter((c) => c.name || c.email || c.phone);

      console.log("Final candidates:", candidates);

      if (candidates.length === 0) {
        setParsedCandidates([]);
        setExcelFile(null);
        const foundCols = jsonData.length > 0 ? Object.keys(jsonData[0] as object).join('، ') : 'هیچ';
        toast.error(`ستون‌های شناسایی‌شده: ${foundCols}\nحداقل یکی از ستون‌های «نام»، «ایمیل» یا «تلفن» لازم است`);
        return;
      }

      if (candidates.length !== candidatesNonEmpty.length) {
        toast.info(`${candidatesNonEmpty.length - candidates.length} ردیف بدون نام/ایمیل/تلفن حذف شد`);
      }

      setParsedCandidates(candidates);
      setExcelFile(file);
      toast.success(`${candidates.length} کاندیدا از فایل استخراج شد`);

    } catch (error) {
      console.error("Error parsing Excel:", error);
      toast.error("خطا در خواندن فایل اکسل");
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 10) {
      toast.error("حداکثر ۱۰ فایل PDF می‌توانید آپلود کنید");
      return;
    }
    setPdfFiles(files);
    toast.success(`${files.length} فایل رزومه آپلود شد`);
  };

  const handleCreateCampaign = async () => {
    if (!user) {
      toast.error("لطفاً ابتدا وارد شوید");
      navigate("/auth");
      return;
    }

    if (!formData.jobTitle || !formData.city) {
      toast.error("لطفاً عنوان شغل و نام شهر را وارد کنید");
      return;
    }

    if (!autoHeadhunting && parsedCandidates.length === 0 && pdfFiles.length === 0) {
      toast.error("لطفاً فایل آپلود کنید یا گزینه هدهانتینگ خودکار را فعال کنید");
      return;
    }

    setIsProcessing(true);

    try {
      // Create campaign in database
      const campaign = await createCampaign({
        name: formData.jobTitle,
        city: formData.city,
        job_title: formData.jobTitle,
        industry: formData.industry || undefined,
        experience_range: formData.experience || undefined,
        skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : undefined,
        auto_headhunting: autoHeadhunting,
      });

      setShowNewCampaignForm(false);

      if (autoHeadhunting) {
        toast.info("در حال ارسال درخواست به سیستم هدهانتینگ خودکار...");

        // A source run must be accepted by the configured connector and then return
        // through a signed callback. Until that connector is configured, fail closed:
        // do not claim that candidates were found.
        await updateCampaign(campaign.id, { status: "paused", progress: 0 });
        toast.warning("منبع‌یابی خودکار هنوز به اتصال امن sourcing متصل نشده است؛ کمپین ذخیره شد اما نتیجه‌ای ثبت نشده.");
      } else if (parsedCandidates.length > 0) {
        toast.info("در حال تحلیل کاندیداها با هوش مصنوعی...");

        const data = await apiRequest<{
          candidates: Array<Record<string, any>>;
          stats: { total: number };
        }>("/recruiting/analyze-candidates", {
          method: "POST",
          body: JSON.stringify({
            candidates: parsedCandidates,
            jobRequirements: {
              jobTitle: formData.jobTitle,
              city: formData.city,
              skills: formData.skills,
              experience: formData.experience,
              industry: formData.industry,
              description: formData.description,
              seniorityLevel: formData.seniorityLevel,
            },
            // Web enrichment is intentionally opt-in; imported private contact data
            // is not sent to the AI provider by the HRing API.
            enableWebSearch: false,
          }),
        });

        // Save analyzed candidates to database
        const candidatesToInsert = data.candidates.map((c: any) => ({
          name: c.name || null,
          email: c.email || null,
          phone: c.phone || null,
          // skills in DB is text, convert array to comma-separated string
          skills: Array.isArray(c.skills) ? c.skills.join(", ") : (c.skills || null),
          experience: c.experience || null,
          education: c.education || null,
          last_company: c.lastCompany || null,
          location: c.location || null,
          title: c.title || null,
          match_score: c.matchScore || 0,
          candidate_temperature: c.candidateTemperature || "cold",
          recommendation: c.recommendation || null,
          green_flags: c.greenFlags || null,
          red_flags: c.redFlags || null,
          layer_scores: c.layerScores || null,
          raw_data: c.rawData || null,
        }));

        await addCandidates(campaign.id, candidatesToInsert);

        // Update campaign status to active
        await updateCampaign(campaign.id, {
          status: "active",
          progress: 100,
        });

        toast.success(`تحلیل ${data.stats.total} کاندیدا با موفقیت انجام شد!`);
        
      } else if (pdfFiles.length > 0) {
        toast.error("تحلیل رزومه‌های PDF هنوز فعال نیست؛ لطفاً اکسل آپلود کنید.");
        
        await updateCampaign(campaign.id, {
          status: "paused",
          progress: 0,
        });
      }

      // Refresh campaigns list
      await fetchCampaigns();

    } catch (error: any) {
      console.error("Error processing campaign:", error);
      toast.error(error?.message || "خطا در پردازش کمپین");
    } finally {
      setIsProcessing(false);
      setFormData({
        jobTitle: "",
        seniorityLevel: "",
        city: "",
        skills: "",
        experience: "",
        industry: "",
        description: "",
      });
      setExcelFile(null);
      setPdfFiles([]);
      setParsedCandidates([]);
      setAutoHeadhunting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-slate-400 mb-4">برای استفاده از این قابلیت ابتدا وارد شوید</p>
          <Link to="/auth">
            <Button className="bg-violet-600 hover:bg-violet-500">ورود / ثبت‌نام</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>هدهانتینگ هوشمند | HRing</title>
        <meta 
          name="description" 
          content="مدیریت کمپین‌های جذب و غربالگری هوشمند کاندیداها" 
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 lg:p-8" dir="rtl">
        <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto">
          {/* Logo - Top Left */}
          <div className="fixed top-6 left-6 z-50">
            <img 
              src={logoWhite} 
              alt="HRing Logo" 
              className="h-[100px] lg:h-[120px] animate-pulse opacity-80 hover:opacity-100 transition-opacity duration-300"
              style={{ animationDuration: '3s' }}
            />
          </div>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="outline" className="gap-2 border-slate-700 bg-slate-800/50 hover:bg-slate-700">
                  <ArrowLeft className="h-5 w-5 text-slate-300" />
                  بازگشت به داشبورد
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30">
                    <Crosshair className="w-6 h-6 text-violet-400" />
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white">هدهانتینگ هوشمند</h1>
                </div>
                <p className="text-slate-400 text-sm lg:text-base mr-14">مدیریت کمپین‌های جذب و غربالگری هوشمند کاندیداها</p>
              </div>
            </div>
          </div>

          {/* New Campaign Button */}
          {!showNewCampaignForm && (
            <div className="mb-8">
              <Button 
                onClick={() => setShowNewCampaignForm(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/25 h-14 px-8 text-lg"
              >
                <Plus className="w-5 h-5 ml-2" />
                کمپین جدید
              </Button>
            </div>
          )}

          {/* New Campaign Form */}
          {showNewCampaignForm && (
            <div className="mb-8 rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/20">
                    <Plus className="w-5 h-5 text-violet-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">ایجاد کمپین جدید</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowNewCampaignForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6">
                {/* Job Details Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-400" />
                    مشخصات موقعیت شغلی
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        عنوان شغل <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        placeholder="مثال: Senior React Developer"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">سطح ارشدیت</Label>
                      <Select
                        value={formData.seniorityLevel}
                        onValueChange={(value) => setFormData({ ...formData, seniorityLevel: value })}
                      >
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="junior">Junior</SelectItem>
                          <SelectItem value="mid">Mid-Level</SelectItem>
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        نام شهر <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        placeholder="مثال: تهران"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">مهارت‌ها</Label>
                      <Input
                        placeholder="مثال: React, Node.js, TypeScript"
                        value={formData.skills}
                        onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">سابقه کار (سال)</Label>
                      <Select
                        value={formData.experience}
                        onValueChange={(value) => setFormData({ ...formData, experience: value })}
                      >
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="0-1">کمتر از ۱ سال</SelectItem>
                          <SelectItem value="1-3">۱ تا ۳ سال</SelectItem>
                          <SelectItem value="3-5">۳ تا ۵ سال</SelectItem>
                          <SelectItem value="5-10">۵ تا ۱۰ سال</SelectItem>
                          <SelectItem value="10+">بیش از ۱۰ سال</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">صنعت مورد نظر</Label>
                      <Input
                        placeholder="مثال: فناوری اطلاعات"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label className="text-slate-300">توضیحات بیشتر در مورد انتظارات</Label>
                    <Textarea
                      placeholder="توضیحات اضافی در مورد ویژگی‌های مورد نظر کاندیدا..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 min-h-[100px]"
                    />
                  </div>
                </div>

                {/* Import Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-violet-400" />
                    منبع کاندیداها
                  </h3>

                  {/* Auto Headhunting Toggle */}
                  <div className="mb-6 p-4 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id="autoHeadhunting"
                        checked={autoHeadhunting}
                        onCheckedChange={(checked) => setAutoHeadhunting(checked === true)}
                        className="mt-1 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                      />
                      <div className="flex-1">
                        <label htmlFor="autoHeadhunting" className="text-white font-medium cursor-pointer flex items-center gap-2">
                          <Target className="w-5 h-5 text-violet-400" />
                          هدهانتینگ خودکار با هوش مصنوعی
                        </label>
                        <p className="text-sm text-slate-400 mt-1">
                          سیستم با استفاده از Perplexity AI در اینترنت برای کاندیداهای مناسب جستجو می‌کند.
                          برای نتایج بهتر، فایل اکسل آپلود کنید تا AI تحلیل عمیق‌تری انجام دهد.
                        </p>
                        {autoHeadhunting && (
                          <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                            <p className="text-xs text-violet-300 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              کمپین ایجاد می‌شود و می‌توانید بعداً فایل اکسل کاندیداها را آپلود کنید
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File Upload Options */}
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${autoHeadhunting ? 'opacity-40 pointer-events-none' : ''}`}>
                    {/* Excel Upload */}
                    <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">آپلود فایل اکسل</h4>
                          <p className="text-xs text-slate-400 mt-0.5">حداکثر ۱۰۰ ردیف</p>
                        </div>
                      </div>
                      <label className="block">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleExcelUpload}
                          className="hidden"
                          disabled={autoHeadhunting}
                        />
                        <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5 text-slate-400" />
                          <span className="text-sm text-slate-400">
                            {excelFile ? excelFile.name : "فایل Excel یا CSV را اینجا بکشید"}
                          </span>
                        </div>
                      </label>
                      {excelFile && (
                        <div className="mt-2 flex items-center gap-2 text-emerald-400 text-sm">
                          <Check className="w-4 h-4" />
                          فایل آپلود شد
                        </div>
                      )}
                    </div>

                    {/* PDF Upload */}
                    <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/30">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">آپلود رزومه PDF</h4>
                          <p className="text-xs text-slate-400 mt-0.5">حداکثر ۱۰ فایل</p>
                        </div>
                      </div>
                      <label className="block">
                        <input
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={handlePdfUpload}
                          className="hidden"
                          disabled={autoHeadhunting}
                        />
                        <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-700 rounded-lg hover:border-blue-500/50 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5 text-slate-400" />
                          <span className="text-sm text-slate-400">
                            {pdfFiles.length > 0 ? `${pdfFiles.length} فایل انتخاب شده` : "فایل‌های PDF را اینجا بکشید"}
                          </span>
                        </div>
                      </label>
                      {pdfFiles.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-blue-400 text-sm">
                          <Check className="w-4 h-4" />
                          {pdfFiles.length} فایل آپلود شد
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Enrichment Note */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-300">
                          <strong className="text-white">غنی‌سازی هوشمند:</strong> سیستم هوش مصنوعی تمام اطلاعات رزومه‌ها و اکسل را بررسی می‌کند، 
                          در شبکه‌های اجتماعی و اینترنت بر اساس نام و حوزه فعالیت جستجو می‌کند و تحلیل کاملی از تطابق هر کاندیدا ارائه می‌دهد.
                        </p>
                        <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                          ۶۰ الماس • از جستجوی پیشرفته بلادرنگ و تحلیل عمیق AI استفاده می‌کند
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNewCampaignForm(false)}
                    className="border-slate-700 text-slate-300 hover:text-white"
                  >
                    انصراف
                  </Button>
                  <Button 
                    onClick={handleCreateCampaign}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        در حال پردازش...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 ml-2" />
                        ایجاد کمپین
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Active Campaigns Table */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm overflow-hidden overflow-x-auto">
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                  <Users className="w-5 h-5 text-violet-400" />
                  کمپین‌های فعال ({filteredCampaigns.length})
                </h2>
                <div className="relative max-w-xs">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="جستجو بر اساس عنوان..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto mb-4" />
                <p className="text-slate-400">در حال بارگذاری...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">هنوز کمپینی ایجاد نشده است</p>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="p-12 text-center">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">کمپینی با این عنوان یافت نشد</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/50 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-right">عنوان کمپین</TableHead>
                    <TableHead className="text-slate-400 text-right">وضعیت</TableHead>
                    <TableHead className="text-slate-400 text-right">منبع</TableHead>
                    <TableHead className="text-slate-400 text-right">شهر</TableHead>
                    <TableHead className="text-slate-400 text-right">تعداد کاندیدا</TableHead>
                    <TableHead className="text-slate-400 text-right">میانگین امتیاز</TableHead>
                    <TableHead className="text-slate-400 text-right">آخرین تغییر</TableHead>
                    <TableHead className="text-slate-400 text-right w-16">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => (
                    <TableRow
                      key={campaign.id}
                      className="border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors"
                      onClick={() => navigate(`/campaign/${campaign.id}`)}
                    >
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          {campaign.name}
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>{getSourceBadge(campaign.source || "excel")}</TableCell>
                      <TableCell className="text-slate-300">{campaign.city}</TableCell>
                      <TableCell className="text-slate-300">
                        {campaign.status === "processing" ? (
                          <span className="text-violet-400">در حال پردازش...</span>
                        ) : (
                          <>
                            <span className="font-semibold text-white">{campaign.candidatesCount || 0}</span> نفر
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        {campaign.status === "processing" ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                                style={{ width: `${campaign.avgMatchScore || 0}%` }}
                              />
                            </div>
                            <span className="text-white font-medium">{campaign.avgMatchScore || 0}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">{campaign.lastUpdated}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteCampaign(campaign.id, e)}
                          disabled={deletingCampaignId === campaign.id}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          {deletingCampaignId === campaign.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SmartHeadhunting;
