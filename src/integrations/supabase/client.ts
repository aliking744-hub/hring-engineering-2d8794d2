// This file remains the compatibility client while legacy feature domains migrate.
import { createClient } from '@supabase/supabase-js';
import { apiRequest } from '@/lib/api';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const baseSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

const originalInvoke = baseSupabase.functions.invoke.bind(baseSupabase.functions);

type LegacyJobRequirements = {
  jobTitle?: string;
  city?: string;
  skills?: string;
  experience?: string;
  industry?: string;
  description?: string;
  seniorityLevel?: string;
};

type LegacyCandidate = Record<string, unknown> & {
  lastCompany?: unknown;
  rawData?: unknown;
};

const jobRequirementsToApi = (value: LegacyJobRequirements | undefined) => ({
  job_title: value?.jobTitle || '',
  city: value?.city || '',
  skills: value?.skills || null,
  experience: value?.experience || null,
  industry: value?.industry || null,
  description: value?.description || null,
  seniority_level: value?.seniorityLevel || null,
});

const candidateToApi = (candidate: LegacyCandidate) => ({
  name: candidate.name ?? null,
  email: candidate.email ?? null,
  phone: candidate.phone ?? null,
  skills: candidate.skills ?? null,
  experience: candidate.experience ?? null,
  education: candidate.education ?? null,
  last_company: candidate.lastCompany ?? candidate.last_company ?? null,
  location: candidate.location ?? null,
  title: candidate.title ?? null,
  linkedin: candidate.linkedin ?? null,
  past_companies: candidate.pastCompanies ?? candidate.past_companies ?? null,
  about: candidate.about ?? null,
  raw_data: candidate.rawData ?? candidate.raw_data ?? null,
});

const analysisResponseToLegacy = (payload: any) => ({
  ...payload,
  candidates: Array.isArray(payload?.candidates)
    ? payload.candidates.map((candidate: any) => ({
        ...candidate,
        lastCompany: candidate.last_company,
        matchScore: candidate.match_score,
        candidateTemperature: candidate.candidate_temperature,
        greenFlags: candidate.green_flags,
        redFlags: candidate.red_flags,
        layerScores: candidate.layer_scores,
        rawData: candidate.raw_data,
      }))
    : [],
  stats: payload?.stats
    ? {
        ...payload.stats,
        avgScore: payload.stats.avg_score,
        hotCandidates: payload.stats.hot_candidates,
        warmCandidates: payload.stats.warm_candidates,
        coldCandidates: payload.stats.cold_candidates,
      }
    : payload?.stats,
});

baseSupabase.functions.invoke = (async (functionName: string, options?: { body?: unknown }) => {
  if (functionName === 'analyze-candidates') {
    try {
      const body = (options?.body || {}) as {
        candidates?: LegacyCandidate[];
        jobRequirements?: LegacyJobRequirements;
      };
      const data = await apiRequest<any>('/headhunting/analyze-candidates', {
        method: 'POST',
        body: JSON.stringify({
          candidates: (body.candidates || []).map(candidateToApi),
          job_requirements: jobRequirementsToApi(body.jobRequirements),
          enable_web_search: true,
        }),
      });
      return { data: analysisResponseToLegacy(data), error: null } as any;
    } catch (error) {
      return { data: null, error } as any;
    }
  }

  if (functionName === 'auto-headhunt') {
    try {
      const body = (options?.body || {}) as {
        campaignId?: string;
        jobRequirements?: LegacyJobRequirements;
      };
      const data = await apiRequest<any>('/headhunting/auto-headhunt', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: body.campaignId,
          job_requirements: jobRequirementsToApi(body.jobRequirements),
        }),
      });
      return { data, error: null } as any;
    } catch (error) {
      return { data: null, error } as any;
    }
  }

  return originalInvoke(functionName, options as any);
}) as typeof baseSupabase.functions.invoke;

export const supabase = baseSupabase;
