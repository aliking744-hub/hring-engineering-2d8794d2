import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  createCampaignRecord,
  deleteCampaignRecord,
  getCampaignRecord,
  insertCandidateRecords,
  listCampaignsForUser,
  listCandidatesForCampaign,
  listCandidateScores,
  updateCampaignRecord,
  type CampaignRow,
  type CampaignUpdate,
  type CandidateInsert,
  type CandidateRow,
} from "@/features/headhunting/data/campaignRepository";

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
  // Computed fields
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
  recommendation: string | null;
  green_flags: string[] | null;
  red_flags: string[] | null;
  layer_scores: any;
  raw_data: any;
  created_at: string;
}

type CreateCampaignInput = {
  name: string;
  city: string;
  job_title?: string;
  industry?: string;
  experience_range?: string;
  education_level?: string;
  skills?: string[];
  auto_headhunting?: boolean;
};

type CandidateDraft = {
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
  recommendation?: string;
  green_flags?: string[];
  red_flags?: string[];
  layer_scores?: Record<string, number>;
  raw_data?: Record<string, unknown>;
};

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

      const campaignRows = await listCampaignsForUser(user.id);
      const campaignIds = campaignRows.map((campaign) => campaign.id);
      const candidateScores = await listCandidateScores(campaignIds);

      const countMap: Record<string, { count: number; totalScore: number }> = {};
      candidateScores.forEach((candidate) => {
        if (!countMap[candidate.campaign_id]) {
          countMap[candidate.campaign_id] = { count: 0, totalScore: 0 };
        }
        countMap[candidate.campaign_id].count++;
        countMap[candidate.campaign_id].totalScore += candidate.match_score || 0;
      });

      const enrichedCampaigns = campaignRows.map((campaign) => {
        const stats = countMap[campaign.id] || { count: 0, totalScore: 0 };
        return {
          ...normalizeCampaign(campaign),
          candidatesCount: stats.count,
          avgMatchScore: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
          source: campaign.auto_headhunting ? "auto" : "excel",
          lastUpdated: formatDate(campaign.updated_at),
        };
      });

      setCampaigns(enrichedCampaigns);
    } catch (err: any) {
      console.error("Error fetching campaigns:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (campaignData: CreateCampaignInput) => {
    if (!user) throw new Error("User not authenticated");

    const campaign = await createCampaignRecord({
      user_id: user.id,
      name: campaignData.name,
      city: campaignData.city,
      job_title: campaignData.job_title || null,
      industry: campaignData.industry || null,
      experience_range: campaignData.experience_range || null,
      education_level: campaignData.education_level || null,
      skills: campaignData.skills || null,
      auto_headhunting: campaignData.auto_headhunting || false,
      status: "processing",
      progress: 0,
    });

    return normalizeCampaign(campaign);
  };

  const updateCampaign = async (
    campaignId: string,
    updates: Partial<Campaign>,
  ) => {
    const safeUpdates: CampaignUpdate = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.city !== undefined ? { city: updates.city } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.progress !== undefined ? { progress: updates.progress } : {}),
      ...(updates.job_title !== undefined ? { job_title: updates.job_title } : {}),
      ...(updates.industry !== undefined ? { industry: updates.industry } : {}),
      ...(updates.experience_range !== undefined
        ? { experience_range: updates.experience_range }
        : {}),
      ...(updates.education_level !== undefined
        ? { education_level: updates.education_level }
        : {}),
      ...(updates.skills !== undefined ? { skills: updates.skills } : {}),
      ...(updates.auto_headhunting !== undefined
        ? { auto_headhunting: updates.auto_headhunting }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const campaign = await updateCampaignRecord(campaignId, safeUpdates);
    await fetchCampaigns();
    return normalizeCampaign(campaign);
  };

  const deleteCampaign = async (campaignId: string) => {
    await deleteCampaignRecord(campaignId);
    await fetchCampaigns();
  };

  const addCandidates = async (
    campaignId: string,
    candidates: CandidateDraft[],
  ) => {
    const candidatesWithCampaignId: CandidateInsert[] = candidates.map((candidate) => ({
      campaign_id: campaignId,
      name: candidate.name || null,
      email: candidate.email || null,
      phone: candidate.phone || null,
      skills: candidate.skills || null,
      experience: candidate.experience || null,
      education: candidate.education || null,
      last_company: candidate.last_company || null,
      location: candidate.location || null,
      title: candidate.title || null,
      match_score: candidate.match_score || 0,
      candidate_temperature: candidate.candidate_temperature || "cold",
      recommendation: candidate.recommendation || null,
      green_flags: candidate.green_flags || null,
      red_flags: candidate.red_flags || null,
      layer_scores: candidate.layer_scores
        ? JSON.parse(JSON.stringify(candidate.layer_scores))
        : null,
      raw_data: candidate.raw_data
        ? JSON.parse(JSON.stringify(candidate.raw_data))
        : null,
    }));

    return insertCandidateRecords(candidatesWithCampaignId);
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

        const campaignRow = await getCampaignRecord(campaignId);

        if (!campaignRow) {
          setError("کمپین پیدا نشد");
          setLoading(false);
          return;
        }

        const candidateRows = await listCandidatesForCampaign(campaignId);

        setCampaign(normalizeCampaign(campaignRow));
        setCandidates(candidateRows.map(normalizeCandidate));
      } catch (err: any) {
        console.error("Error fetching campaign detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaignDetail();
  }, [user, campaignId]);

  const stats = {
    total: candidates.length,
    excellent: candidates.filter((candidate) => candidate.match_score >= 85).length,
    good: candidates.filter(
      (candidate) => candidate.match_score >= 70 && candidate.match_score < 85,
    ).length,
    average: candidates.filter((candidate) => candidate.match_score < 70).length,
    avgScore:
      candidates.length > 0
        ? Math.round(
            candidates.reduce((sum, candidate) => sum + candidate.match_score, 0) /
              candidates.length,
          )
        : 0,
    hotCandidates: candidates.filter(
      (candidate) => candidate.candidate_temperature === "hot",
    ).length,
    warmCandidates: candidates.filter(
      (candidate) => candidate.candidate_temperature === "warm",
    ).length,
    coldCandidates: candidates.filter(
      (candidate) => candidate.candidate_temperature === "cold",
    ).length,
  };

  return {
    campaign,
    candidates,
    stats,
    loading,
    error,
  };
};

function normalizeCampaign(campaign: CampaignRow): Campaign {
  return {
    ...campaign,
    auto_headhunting: campaign.auto_headhunting ?? false,
  };
}

function normalizeCandidate(candidate: CandidateRow): Candidate {
  return {
    ...candidate,
    match_score: candidate.match_score ?? 0,
    candidate_temperature: candidate.candidate_temperature ?? "cold",
  };
}

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
