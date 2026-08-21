import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
export type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];
export type CandidateRow = Database["public"]["Tables"]["candidates"]["Row"];
export type CandidateInsert = Database["public"]["Tables"]["candidates"]["Insert"];

export async function listCampaignsForUser(userId: string): Promise<CampaignRow[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listCandidateScores(
  campaignIds: string[],
): Promise<Array<Pick<CandidateRow, "campaign_id" | "match_score">>> {
  if (campaignIds.length === 0) return [];

  const { data, error } = await supabase
    .from("candidates")
    .select("campaign_id, match_score")
    .in("campaign_id", campaignIds);

  if (error) throw error;
  return data ?? [];
}

export async function createCampaignRecord(input: CampaignInsert): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCampaignRecord(
  campaignId: string,
  updates: CampaignUpdate,
): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", campaignId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCampaignRecord(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId);

  if (error) throw error;
}

export async function insertCandidateRecords(
  candidates: CandidateInsert[],
): Promise<CandidateRow[]> {
  if (candidates.length === 0) return [];

  const { data, error } = await supabase
    .from("candidates")
    .insert(candidates)
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function getCampaignRecord(campaignId: string): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listCandidatesForCampaign(campaignId: string): Promise<CandidateRow[]> {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("match_score", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
