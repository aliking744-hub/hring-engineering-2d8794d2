import React, { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { 
  ArrowLeft, 
  Users, 
  GraduationCap, 
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Star,
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
  Clock,
  Printer,
  Filter
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCampaignDetail, Candidate as DBCandidate } from "@/hooks/useCampaigns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface LayerScores {
  activitySentiment: number;
  hardSkillMatch: number;
  careerTrajectory: number;
  cultureFit: number;
  riskOpportunity: number;
}

// Transform DB candidate to UI format
interface UICandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  education: string;
  experience: string;
  lastCompany: string;
  location: string;
  linkedin?: string;
  skills: string[];
  matchScore: number;
  candidateTemperature?: "hot" | "warm" | "cold";
  layerScores?: LayerScores;
  scores: {
    skills: number;
    experience: number;
    education: number;
    culture: number;
  };
  redFlags?: string[];
  greenFlags?: string[];
  summary?: string;
  recommendation?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'waiting';
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'waiting';

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Redirect legacy numeric ids (old localStorage campaigns) to their migrated DB uuid if available
  useEffect(() => {
    if (!id) return;
    try {
      const mapStr = localStorage.getItem("smart_headhunting_legacy_id_map");
      if (!mapStr) return;
      const map = JSON.parse(mapStr) as Record<string, string>;
      const migratedId = map?.[id];
      if (migratedId && migratedId !== id) {
        navigate(`/campaign/${migratedId}`, { replace: true });
      }
    } catch {
      // ignore
    }
  }, [id, navigate]);

  const { campaign, candidates: dbCandidates, stats, loading, error } = useCampaignDetail(id);
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Transform DB candidates to UI format
  const allCandidates: UICandidate[] = useMemo(() => dbCandidates.map((c: any) => ({
    id: c.id,
    name: c.name || "بدون نام",
    email: c.email || "",
    phone: c.phone || "",
    title: c.title || "",
    education: c.education || "",
    experience: c.experience || "",
    lastCompany: c.last_company || "",
    location: c.location || "",
    skills: c.skills ? c.skills.split(",").map((s: string) => s.trim()) : [],
    matchScore: c.match_score,
    candidateTemperature: c.candidate_temperature as "hot" | "warm" | "cold",
    layerScores: c.layer_scores as LayerScores | undefined,
    scores: {
      skills: c.layer_scores?.hardSkillMatch || c.match_score,
      experience: c.layer_scores?.careerTrajectory || c.match_score,
      education: 70,
      culture: c.layer_scores?.cultureFit || 70,
    },
    redFlags: c.red_flags || [],
    greenFlags: c.green_flags || [],
    recommendation: c.recommendation || undefined,
    status: c.status as 'pending' | 'approved' | 'rejected' | 'waiting' | undefined,
  })), [dbCandidates]);

  // Filter candidates by status
  const candidates = useMemo(() => {
    if (statusFilter === 'all') return allCandidates;
    return allCandidates.filter(c => c.status === statusFilter);
  }, [allCandidates, statusFilter]);

  // Status counts for filter badges
  const statusCounts = useMemo(() => ({
    all: allCandidates.length,
    pending: allCandidates.filter(c => !c.status || c.status === 'pending').length,
    approved: allCandidates.filter(c => c.status === 'approved').length,
    rejected: allCandidates.filter(c => c.status === 'rejected').length,
    waiting: allCandidates.filter(c => c.status === 'waiting').length,
  }), [allCandidates]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            <Check className="w-3 h-3 ml-1" />
            تأیید
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
            <X className="w-3 h-3 ml-1" />
            رد
          </Badge>
        );
      case 'waiting':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
            <Clock className="w-3 h-3 ml-1" />
            انتظار
          </Badge>
        );
      default:
        return null;
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

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">{error || "کمپین پیدا نشد"}</p>
          <Link to="/smart-headhunting">
            <Button variant="outline" className="border-slate-700">بازگشت</Button>
          </Link>
        </div>
      </div>
    );
  }

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

  const getTemperatureIcon = (temp?: string) => {
    switch (temp) {
      case "hot":
        return <Flame className="w-4 h-4 text-red-400" />;
      case "warm":
        return <ThermometerSun className="w-4 h-4 text-amber-400" />;
      case "cold":
        return <Snowflake className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getTemperatureBadge = (temp?: string) => {
    switch (temp) {
      case "hot":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <Flame className="w-3 h-3 ml-1" />
            داغ
          </Badge>
        );
      case "warm":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <ThermometerSun className="w-3 h-3 ml-1" />
            گرم
          </Badge>
        );
      case "cold":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Snowflake className="w-3 h-3 ml-1" />
            سرد
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRecommendationColor = (rec?: string) => {
    if (rec?.includes("فوری")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (rec?.includes("انتظار")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (rec?.includes("رد")) return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  // Chart data from actual stats
  const qualityData = [
    { name: "عالی", value: stats.excellent, color: "#10b981" },
    { name: "خوب", value: stats.good, color: "#8b5cf6" },
    { name: "متوسط", value: stats.average, color: "#f59e0b" },
  ];

  // Temperature distribution data
  const temperatureData = [
    { name: "داغ", value: stats.hotCandidates || 0, color: "#ef4444" },
    { name: "گرم", value: stats.warmCandidates || 0, color: "#f59e0b" },
    { name: "سرد", value: stats.coldCandidates || 0, color: "#3b82f6" },
  ];

  // Status distribution data
  const statusDistributionData = [
    { name: "در انتظار", value: statusCounts.pending, color: "#94a3b8" },
    { name: "تأیید شده", value: statusCounts.approved, color: "#10b981" },
    { name: "رد شده", value: statusCounts.rejected, color: "#ef4444" },
    { name: "در انتظار بررسی", value: statusCounts.waiting, color: "#f59e0b" },
  ].filter(item => item.value > 0);

  // Calculate education distribution from candidates
  const educationMap: Record<string, number> = {};
  candidates.forEach(c => {
    const edu = c.education || "نامشخص";
    educationMap[edu] = (educationMap[edu] || 0) + 1;
  });
  const educationData = Object.entries(educationMap).map(([name, count]) => ({ name, count }));

  // Calculate experience distribution
  const experienceMap: Record<string, number> = {};
  candidates.forEach(c => {
    const exp = c.experience || "نامشخص";
    experienceMap[exp] = (experienceMap[exp] || 0) + 1;
  });
  const experienceData = Object.entries(experienceMap).map(([name, count]) => ({ name, count }));

  const layerLabels: Record<keyof LayerScores, { label: string; icon: React.ReactNode }> = {
    activitySentiment: { label: "تحلیل رفتار و محتوا", icon: <Brain className="w-4 h-4" /> },
    hardSkillMatch: { label: "تطبیق مهارت سخت", icon: <Target className="w-4 h-4" /> },
    careerTrajectory: { label: "مسیر شغلی", icon: <TrendingUp className="w-4 h-4" /> },
    cultureFit: { label: "تناسب فرهنگی", icon: <Heart className="w-4 h-4" /> },
    riskOpportunity: { label: "ریسک و فرصت", icon: <Shield className="w-4 h-4" /> },
  };

  return (
    <>
      <Helmet>
        <title>{campaign.name} | هدهانتینگ هوشمند</title>
        <meta name="description" content={`جزئیات کمپین ${campaign.name}`} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-8 print:bg-white print:p-4" dir="rtl">
        <Link to="/dashboard" className="fixed top-6 right-6 z-50 print:hidden">
          <Button variant="outline" className="border-slate-700 bg-slate-800/80 backdrop-blur-sm shadow-lg gap-2 text-slate-200 hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4 rotate-180" />
            بازگشت به داشبورد
          </Button>
        </Link>
        <div className="max-w-[1600px] mx-auto">
          {/* Print Header with Logo */}
          <div className="hidden print:flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-300">
            <img src="/src/assets/logo.png" alt="Logo" className="h-12" />
            <div className="text-left">
              <p className="text-sm text-gray-500">تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}</p>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8 print:mb-4">
            <div className="flex items-center gap-4">
              <Link to="/smart-headhunting" className="print:hidden">
                <Button variant="outline" size="icon" className="border-slate-700 bg-slate-800/50 hover:bg-slate-700">
                  <ArrowLeft className="w-5 h-5 text-slate-300" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white print:!text-black print:!text-3xl">{campaign.name}</h1>
                <p className="text-slate-400 text-sm mt-1 print:!text-gray-600">{campaign.city} • {stats.total} کاندیدا • میانگین امتیاز: {stats.avgScore}%</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="border-slate-700 bg-slate-800/50 hover:bg-slate-700 print:hidden"
            >
              <Printer className="w-4 h-4 ml-2" />
              پرینت
            </Button>
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-12 text-center">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">هنوز کاندیدایی در این کمپین وجود ندارد</p>
              <p className="text-slate-500 text-sm mt-2">لطفاً فایل اکسل کاندیداها را آپلود کنید</p>
            </div>
          ) : (
            <>
              {/* Stats Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                {/* Status Distribution */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    وضعیت کاندیداها
                  </h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {statusDistributionData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-slate-300">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality Distribution */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-violet-400" />
                    توزیع کیفیت
                  </h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={qualityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {qualityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-3 mt-2">
                    {qualityData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-slate-300">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Temperature Distribution */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-red-400" />
                    دمای کاندیداها
                  </h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={temperatureData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {temperatureData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-3 mt-2">
                    {temperatureData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-slate-300">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education Distribution */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-violet-400" />
                    مدارک تحصیلی
                  </h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={educationData} layout="vertical">
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={100} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Experience Distribution */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-violet-400" />
                    سابقه کار
                  </h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={experienceData} layout="vertical">
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={80} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Candidates List - Full Width */}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                        <Users className="w-5 h-5 text-violet-400" />
                        لیست کاندیداها ({candidates.length})
                      </h2>
                    </div>
                    
                    {/* Status Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Filter className="w-4 h-4 text-slate-400" />
                      <Button
                        variant={statusFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                        className={statusFilter === 'all' 
                          ? 'bg-violet-600 hover:bg-violet-500' 
                          : 'border-slate-600 text-slate-400 hover:text-white'}
                      >
                        همه ({statusCounts.all})
                      </Button>
                      <Button
                        variant={statusFilter === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('pending')}
                        className={statusFilter === 'pending' 
                          ? 'bg-slate-600 hover:bg-slate-500' 
                          : 'border-slate-600 text-slate-400 hover:text-white'}
                      >
                        <Target className="w-3 h-3 ml-1" />
                        بررسی ({statusCounts.pending})
                      </Button>
                      <Button
                        variant={statusFilter === 'approved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('approved')}
                        className={statusFilter === 'approved' 
                          ? 'bg-emerald-600 hover:bg-emerald-500' 
                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}
                      >
                        <Check className="w-3 h-3 ml-1" />
                        تأیید ({statusCounts.approved})
                      </Button>
                      <Button
                        variant={statusFilter === 'waiting' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('waiting')}
                        className={statusFilter === 'waiting' 
                          ? 'bg-amber-600 hover:bg-amber-500' 
                          : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}
                      >
                        <Clock className="w-3 h-3 ml-1" />
                        انتظار ({statusCounts.waiting})
                      </Button>
                      <Button
                        variant={statusFilter === 'rejected' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('rejected')}
                        className={statusFilter === 'rejected' 
                          ? 'bg-red-600 hover:bg-red-500' 
                          : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}
                      >
                        <X className="w-3 h-3 ml-1" />
                        رد ({statusCounts.rejected})
                      </Button>
                    </div>
                  </div>
                  
                  {candidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">کاندیدایی با این وضعیت یافت نشد</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 max-h-[700px] overflow-y-auto">
                      {[...candidates].sort((a, b) => b.matchScore - a.matchScore).map((candidate) => (
                        <Link
                          key={candidate.id}
                          to={`/campaign/${id}/candidate/${candidate.id}`}
                          className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/50 cursor-pointer transition-all hover:bg-slate-800 hover:border-violet-500/30"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                              {candidate.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-white truncate">{candidate.name}</h3>
                                {getTemperatureIcon(candidate.candidateTemperature)}
                                {getStatusBadge(candidate.status)}
                              </div>
                              <p className="text-sm text-slate-400 truncate">{candidate.title || candidate.lastCompany || "—"}</p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  {candidate.experience || "—"}
                                </Badge>
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  {candidate.location || "—"}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-left flex-shrink-0">
                              <div className={`text-2xl font-bold ${getScoreColor(candidate.matchScore)}`}>
                                {candidate.matchScore}%
                              </div>
                              <div className="w-16 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${getScoreBgColor(candidate.matchScore)}`}
                                  style={{ width: `${candidate.matchScore}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CampaignDetail;
