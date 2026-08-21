import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "./useAuth";

export interface Campaign {
  id: string;
  name: string;
  city: string | null;
  status: string;
  progress: number;
  job_title: string | null;
  industry: string | null;
  experience_range: string | null;
  education_level: string | null;
  skills: string[] | null;
  auto_headhunting: boolean;
  created_at: string;
  updated_at: string;
  candidatesCount?: number;
  avgMatchScore?: number;
  source?: string;
  lastUpdated?: string;
}

export interface Candidate {
  id: string;
  campaign_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string | null;
  experience: string | null;
  education: string | null;
  last_company: string | null;
  location: string | null;
  title: string | null;
  match_score: number;
  candidate_temperature: string;
  status: string;
  recommendation: string | null;
  green_flags: string[] | null;
  red_flags: string[] | null;
  layer_scores: Record<string, unknown> | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ApiCampaign extends Omit<Campaign, "candidatesCount" | "avgMatchScore" | "source" | "lastUpdated"> {
  owner_user_id: string;
  company_id: string | null;
  description: string | null;
  candidates_count: number;
  avg_match_score: number;
}

interface ApiCampaignDetail extends ApiCampaign {
  candidates: Candidate[];
}

const mapCampaign = (campaign: ApiCampaign): Campaign => ({
  id: campaign.id,
  name: campaign.name,
  city: campaign.city,
  status: campaign.status,
  progress: campaign.progress,
  job_title: campaign.job_title,
  industry: campaign.industry,
  experience_range: campaign.experience_range,
  education_level: campaign.education_level,
  skills: campaign.skills,
  auto_headhunting: campaign.auto_headhunting,
  created_at: campaign.created_at,
  updated_at: campaign.updated_at,
  candidatesCount: campaign.candidates_count,
  avgMatchScore: campaign.avg_match_score,
  source: campaign.auto_headhunting ? "auto" : "excel",
  lastUpdated: formatDate(campaign.updated_at),
});

export const useCampaigns = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!user) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const rows = await apiRequest<ApiCampaign[]>("/recruiting/campaigns");
      setCampaigns(rows.map(mapCampaign));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Campaign fetch failed";
      console.error("Error fetching campaigns:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (campaignData: {
    name: string;
    city: string;
    job_title?: string;
    industry?: string;
    experience_range?: string;
    education_level?: string;
    skills?: string[];
    auto_headhunting?: boolean;
    description?: string;
  }) => {
    if (!user) throw new Error("User not authenticated");
    const data = await apiRequest<ApiCampaign>("/recruiting/campaigns", {
      method: "POST",
      body: JSON.stringify(campaignData),
    });
    return mapCampaign(data);
  };

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    const payload: Record<string, unknown> = {};
    const allowed = [
      "name",
      "city",
      "status",
      "progress",
      "job_title",
      "industry",
      "experience_range",
      "education_level",
      "skills",
      "auto_headhunting",
    ] as const;
    for (const key of allowed) {
      if (key in updates) payload[key] = updates[key];
    }

    const data = await apiRequest<ApiCampaign>(`/recruiting/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await fetchCampaigns();
    return mapCampaign(data);
  };

  const deleteCampaign = async (campaignId: string) => {
    await apiRequest<void>(`/recruiting/campaigns/${campaignId}`, { method: "DELETE" });
    await fetchCampaigns();
  };

  const addCandidates = async (
    campaignId: string,
    candidates: Array<{
      name?: string;
      email?: string;
      phone?: string;
      skills?: string;
      experience?: string;
      education?: string;
      last_company?: string;
      location?: string;
      title?: string;
      match_score?: number;
      candidate_temperature?: string;
      status?: "pending" | "approved" | "rejected" | "waiting";
      recommendation?: string;
      green_flags?: string[];
      red_flags?: string[];
      layer_scores?: Record<string, unknown>;
      raw_data?: Record<string, unknown>;
    }>
  ) => {
    return apiRequest<Candidate[]>(`/recruiting/campaigns/${campaignId}/candidates`, {
      method: "POST",
      body: JSON.stringify({
        candidates: candidates.map((candidate) => ({
          ...candidate,
          match_score: candidate.match_score || 0,
          candidate_temperature: candidate.candidate_temperature || "cold",
          status: candidate.status || "pending",
        })),
      }),
    });
  };

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    addCandidates,
  };
};

export const useCampaignDetail = (campaignId: string | undefined) => {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaignDetail = async () => {
      if (!user || !campaignId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<ApiCampaignDetail>(`/recruiting/campaigns/${campaignId}`);
        setCampaign(mapCampaign(data));
        setCandidates(data.candidates || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "کمپین پیدا نشد";
        console.error("Error fetching campaign detail:", err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchCampaignDetail();
  }, [user, campaignId]);

  const stats = {
    total: candidates.length,
    excellent: candidates.filter((c) => c.match_score >= 85).length,
    good: candidates.filter((c) => c.match_score >= 70 && c.match_score < 85).length,
    average: candidates.filter((c) => c.match_score < 70).length,
    avgScore: candidates.length > 0
      ? Math.round(candidates.reduce((sum, c) => sum + c.match_score, 0) / candidates.length)
      : 0,
    hotCandidates: candidates.filter((c) => c.candidate_temperature === "hot").length,
    warmCandidates: candidates.filter((c) => c.candidate_temperature === "warm").length,
    coldCandidates: candidates.filter((c) => c.candidate_temperature === "cold").length,
  };

  return { campaign, candidates, stats, loading, error };
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "همین الان";
  if (diffMins < 60) return `${diffMins} دقیقه پیش`;
  if (diffHours < 24) {
    const mins = diffMins % 60;
    if (mins === 0) return `${diffHours} ساعت پیش`;
    return `${diffHours} ساعت و ${mins} دقیقه پیش`;
  }
  if (diffDays < 7) return `${diffDays} روز پیش`;
  return date.toLocaleDateString("fa-IR");
}