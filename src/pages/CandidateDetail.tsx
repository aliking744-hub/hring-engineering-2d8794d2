import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { 
  ArrowRight, 
  GraduationCap, 
  Briefcase,
  Phone,
  Mail,
  MapPin,
  X,
  Check,
  Target,
  AlertCircle,
  Flame,
  ThermometerSun,
  Snowflake,
  AlertTriangle,
  CheckCircle2,
  Linkedin,
  TrendingUp,
  Brain,
  Heart,
  Shield,
  Loader2,
  Building2,
  Award,
  FileText,
  User,
  Clock
} from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Candidate as DBCandidate } from "@/hooks/useCampaigns";
import { toast } from "@/hooks/use-toast";

interface LayerScores {
  activitySentiment: number;
  hardSkillMatch: number;
  careerTrajectory: number;
  cultureFit: number;
  riskOpportunity: number;
}

interface CampaignInfo {
  id: string;
  name: string;
  job_title: string;
  city: string;
}

type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'waiting';

const CandidateDetail = () => {
  const { campaignId, candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<(DBCandidate & { status?: CandidateStatus }) | null>(null);
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId || !candidateId) {
        setError("شناسه نامعتبر");
        setLoading(false);
        return;
      }

      try {
        // Fetch candidate
        const { data: candidateData, error: candidateError } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single();

        if (candidateError) throw candidateError;
        if (!candidateData) throw new Error("کاندیدا پیدا نشد");

        setCandidate(candidateData as DBCandidate);

        // Fetch campaign info
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('id, name, job_title, city')
          .eq('id', campaignId)
          .single();

        if (campaignError) throw campaignError;
        setCampaign(campaignData as CampaignInfo);

      } catch (err) {
        console.error('Error fetching candidate:', err);
        setError(err instanceof Error ? err.message : "خطا در بارگذاری");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId, candidateId]);

  const updateCandidateStatus = async (newStatus: CandidateStatus) => {
    if (!candidateId) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', candidateId);

      if (error) throw error;

      setCandidate(prev => prev ? { ...prev, status: newStatus } : null);

      const statusLabels: Record<CandidateStatus, string> = {
        approved: 'تأیید شد',
        rejected: 'رد شد',
        waiting: 'در لیست انتظار قرار گرفت',
        pending: 'به حالت بررسی برگشت'
      };

      toast({
        title: "وضعیت بروزرسانی شد",
        description: `کاندیدا ${statusLabels[newStatus]}`,
      });
    } catch (err) {
      console.error('Error updating status:', err);
      toast({
        title: "خطا",
        description: "بروزرسانی وضعیت انجام نشد",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status?: CandidateStatus) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm px-3 py-1">
            <Check className="w-4 h-4 ml-1" />
            تأیید شده
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-sm px-3 py-1">
            <X className="w-4 h-4 ml-1" />
            رد شده
          </Badge>
        );
      case 'waiting':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-sm px-3 py-1">
            <Clock className="w-4 h-4 ml-1" />
            در انتظار
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-sm px-3 py-1">
            <Target className="w-4 h-4 ml-1" />
            در بررسی
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-violet-400 mx-auto mb-4 animate-spin" />
          <p className="text-slate-400">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">{error || "کاندیدا پیدا نشد"}</p>
          <Button variant="outline" className="border-slate-700" onClick={() => navigate(-1)}>
            بازگشت
          </Button>
        </div>
      </div>
    );
  }

  const layerScores = candidate.layer_scores as LayerScores | null;
  const skills = candidate.skills ? candidate.skills.split(",").map(s => s.trim()) : [];

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400";
    if (score >= 70) return "text-violet-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return "bg-emerald-500";
    if (score >= 70) return "bg-violet-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const getTemperatureBadge = (temp?: string) => {
    switch (temp) {
      case "hot":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-2">
            <Flame className="w-5 h-5 ml-2" />
            داغ - آماده تماس فوری
          </Badge>
        );
      case "warm":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-lg px-4 py-2">
            <ThermometerSun className="w-5 h-5 ml-2" />
            گرم - مستعد تغییر
          </Badge>
        );
      case "cold":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-lg px-4 py-2">
            <Snowflake className="w-5 h-5 ml-2" />
            سرد - نیاز به پیگیری بیشتر
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRecommendationStyle = (rec?: string) => {
    if (rec?.includes("فوری")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (rec?.includes("انتظار")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (rec?.includes("رد")) return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  const layerLabels: Record<keyof LayerScores, { label: string; icon: React.ReactNode; description: string }> = {
    activitySentiment: { 
      label: "تحلیل رفتار و محتوا", 
      icon: <Brain className="w-6 h-6" />,
      description: "بررسی فعالیت‌ها، پست‌ها و سیگنال‌های نارضایتی یا آمادگی برای تغییر"
    },
    hardSkillMatch: { 
      label: "تطبیق مهارت‌های سخت", 
      icon: <Target className="w-6 h-6" />,
      description: "میزان تطابق مهارت‌های فنی با الزامات شغلی"
    },
    careerTrajectory: { 
      label: "مسیر شغلی", 
      icon: <TrendingUp className="w-6 h-6" />,
      description: "رشد شغلی، ثبات و پیشرفت در کارنامه حرفه‌ای"
    },
    cultureFit: { 
      label: "تناسب فرهنگی", 
      icon: <Heart className="w-6 h-6" />,
      description: "سازگاری با فرهنگ سازمانی و ارزش‌های تیم"
    },
    riskOpportunity: { 
      label: "ارزیابی ریسک و فرصت", 
      icon: <Shield className="w-6 h-6" />,
      description: "شناسایی ریسک‌ها و فرصت‌های استخدام"
    },
  };

  return (
    <>
      <Helmet>
        <title>{candidate.name} | {campaign?.name || 'کاندیدا'}</title>
        <meta name="description" content={`پروفایل ${candidate.name}`} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to={`/campaign/${campaignId}`}>
                  <Button variant="outline" size="icon" className="border-slate-700 bg-slate-800/50 hover:bg-slate-700">
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="outline" className="border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-200 gap-2">
                    <ArrowRight className="w-4 h-4" />
                    بازگشت به داشبورد
                  </Button>
                </Link>
                <div>
                  <p className="text-sm text-slate-400">{campaign?.name}</p>
                  <h1 className="text-xl font-bold text-white">{candidate.name}</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(candidate.status)}
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                  onClick={() => updateCandidateStatus('approved')}
                  disabled={updating || candidate.status === 'approved'}
                >
                  <Check className="w-4 h-4 ml-2" />
                  تأیید
                </Button>
                <Button 
                  variant="outline" 
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                  onClick={() => updateCandidateStatus('waiting')}
                  disabled={updating || candidate.status === 'waiting'}
                >
                  <Clock className="w-4 h-4 ml-2" />
                  انتظار
                </Button>
                <Button 
                  variant="outline" 
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  onClick={() => updateCandidateStatus('rejected')}
                  disabled={updating || candidate.status === 'rejected'}
                >
                  <X className="w-4 h-4 ml-2" />
                  رد
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {/* Hero Section - Score & Temperature */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Score Card */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-800/50 backdrop-blur-sm p-8">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg shadow-violet-500/20">
                  {candidate.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-3xl font-bold text-white">{candidate.name}</h2>
                    {getTemperatureBadge(candidate.candidate_temperature)}
                  </div>
                  <p className="text-xl text-slate-300 mb-4">{candidate.title || campaign?.job_title}</p>
                  
                  <div className="flex flex-wrap gap-4">
                    {candidate.last_company && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Building2 className="w-5 h-5" />
                        <span>{candidate.last_company}</span>
                      </div>
                    )}
                    {candidate.location && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin className="w-5 h-5" />
                        <span>{candidate.location}</span>
                      </div>
                    )}
                    {candidate.experience && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Briefcase className="w-5 h-5" />
                        <span>{candidate.experience} سال تجربه</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Score Display */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-8 flex flex-col items-center justify-center">
              <p className="text-slate-400 mb-2">امتیاز کلی تطابق</p>
              <div className={`text-7xl font-bold ${getScoreColor(candidate.match_score)}`}>
                {candidate.match_score}%
              </div>
              <div className="w-full h-3 bg-slate-700 rounded-full mt-4 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(candidate.match_score)}`}
                  style={{ width: `${candidate.match_score}%` }}
                />
              </div>
              {candidate.recommendation && (
                <Badge className={`mt-4 text-base px-4 py-2 ${getRecommendationStyle(candidate.recommendation)}`}>
                  {candidate.recommendation}
                </Badge>
              )}
            </div>
          </div>

          {/* Contact & Basic Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Info */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-violet-400" />
                اطلاعات تماس
              </h3>
              <div className="space-y-4">
                {candidate.email && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">ایمیل</p>
                      <a href={`mailto:${candidate.email}`} className="text-slate-200 hover:text-blue-400 transition-colors">
                        {candidate.email}
                      </a>
                    </div>
                  </div>
                )}
                {candidate.phone && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">تلفن</p>
                      <a href={`tel:${candidate.phone}`} className="text-slate-200 hover:text-emerald-400 transition-colors">
                        {candidate.phone}
                      </a>
                    </div>
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">موقعیت مکانی</p>
                      <p className="text-slate-200">{candidate.location}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Education & Experience */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-violet-400" />
                سوابق تحصیلی و کاری
              </h3>
              <div className="space-y-4">
                {candidate.education && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">تحصیلات</p>
                      <p className="text-slate-200">{candidate.education}</p>
                    </div>
                  </div>
                )}
                {candidate.experience && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">سابقه کار</p>
                      <p className="text-slate-200">{candidate.experience}</p>
                    </div>
                  </div>
                )}
                {candidate.last_company && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">آخرین محل کار</p>
                      <p className="text-slate-200">{candidate.last_company}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-400" />
                مهارت‌ها
              </h3>
              <div className="flex flex-wrap gap-3">
                {skills.map((skill, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="border-violet-500/30 text-violet-300 text-base px-4 py-2"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 5-Layer Analysis */}
          {layerScores && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6 text-violet-400" />
                تحلیل ۵ لایه‌ای هوش مصنوعی
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(layerScores) as Array<keyof LayerScores>).map((key) => {
                  const score = layerScores[key];
                  const layer = layerLabels[key];
                  return (
                    <div key={key} className="p-5 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          score >= 85 ? 'bg-emerald-500/10 text-emerald-400' :
                          score >= 70 ? 'bg-violet-500/10 text-violet-400' :
                          score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {layer.icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">{layer.label}</p>
                          <p className="text-xs text-slate-500">{layer.description}</p>
                        </div>
                        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                          {score}%
                        </span>
                      </div>
                      <Progress value={score} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Green & Red Flags */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Green Flags */}
            {candidate.green_flags && candidate.green_flags.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm p-6">
                <h3 className="text-xl font-semibold text-emerald-400 mb-6 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6" />
                  نقاط قوت ({candidate.green_flags.length})
                </h3>
                <ul className="space-y-4">
                  {candidate.green_flags.map((flag, index) => (
                    <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/10">
                      <Check className="w-6 h-6 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-200 leading-relaxed">{flag}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red Flags */}
            {candidate.red_flags && candidate.red_flags.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-6">
                <h3 className="text-xl font-semibold text-red-400 mb-6 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6" />
                  نکات هشدار ({candidate.red_flags.length})
                </h3>
                <ul className="space-y-4">
                  {candidate.red_flags.map((flag, index) => (
                    <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10">
                      <X className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-200 leading-relaxed">{flag}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-center gap-4 pt-4 pb-8">
            <Button 
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-lg px-8 py-6 disabled:opacity-50"
              onClick={() => updateCandidateStatus('approved')}
              disabled={updating || candidate.status === 'approved'}
            >
              {updating ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <Check className="w-5 h-5 ml-2" />}
              تأیید و دعوت به مصاحبه
            </Button>
            <Button 
              variant="outline" 
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-lg px-8 py-6 disabled:opacity-50"
              onClick={() => updateCandidateStatus('waiting')}
              disabled={updating || candidate.status === 'waiting'}
            >
              <Clock className="w-5 h-5 ml-2" />
              در لیست انتظار
            </Button>
            <Button 
              variant="outline" 
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-lg px-8 py-6 disabled:opacity-50"
              onClick={() => updateCandidateStatus('rejected')}
              disabled={updating || candidate.status === 'rejected'}
            >
              <X className="w-5 h-5 ml-2" />
              رد کردن
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CandidateDetail;
