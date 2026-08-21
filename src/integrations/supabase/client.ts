// This file remains the compatibility boundary for legacy Supabase consumers.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { apiRequest } from '@/lib/api';

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

const legacySupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

const legacyFunctions = legacySupabase.functions;
const recruitingFunctions = new Proxy(legacyFunctions, {
  get(target, property, receiver) {
    if (property !== 'invoke') {
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }

    return async (functionName: string, options?: { body?: unknown }) => {
      if (functionName !== 'auto-headhunt' && functionName !== 'analyze-candidates') {
        return target.invoke(functionName, options);
      }

      try {
        const body = (options?.body || {}) as Record<string, unknown>;
        if (functionName === 'auto-headhunt') {
          const campaignId = body.campaignId;
          if (typeof campaignId !== 'string' || !campaignId) {
            throw new Error('campaignId is required');
          }
          const data = await apiRequest(`/recruiting/campaigns/${campaignId}/auto-source`, {
            method: 'POST',
            body: JSON.stringify({ jobRequirements: body.jobRequirements }),
          });
          return { data, error: null };
        }

        const data = await apiRequest('/recruiting/analyze-candidates', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { data, error: null };
      } catch (error) {
        return {
          data: null,
          error: {
            name: 'HRingApiError',
            message: error instanceof Error ? error.message : 'Independent HRing API request failed',
            context: error,
          },
        };
      }
    };
  },
});

// Legacy callers keep the same import while selected domains are strangled
// over to HRing API. New code must use domain/API adapters directly.
export const supabase = new Proxy(legacySupabase, {
  get(target, property, receiver) {
    if (property === 'functions') return recruitingFunctions;
    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as typeof legacySupabase;