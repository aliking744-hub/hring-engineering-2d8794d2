/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic types preserve the legacy Supabase-compatible surface during cutover. */
// Temporary source-compatible facade for legacy UI code.
// Despite the exported variable name, this module has ZERO Supabase runtime dependency.
// All data/functions/storage/auth calls terminate at the independent HRing API.
import {
  ApiError,
  ApiUser,
  AuthEnvelope,
  apiRequest,
  authRequest,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';

type JsonRecord = Record<string, any>;
type QueryOperation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';
type FilterOperator = 'eq' | 'neq' | 'in' | 'is' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

interface QueryOrder {
  column: string;
  ascending: boolean;
}

interface CompatEnvelope<T = any> {
  data: T;
  count?: number | null;
}

interface LegacyResult<T = any> {
  data: T | null;
  error: any | null;
  count?: number | null;
}

const PUBLIC_READ_TABLES = new Set(['posts', 'testimonials', 'digital_products']);
const PUBLIC_STORAGE_BUCKETS = new Set(['avatars', 'products', 'blog-images', 'site-assets']);
const METERED_COMPAT_FUNCTIONS = new Set([
  'generate-job-profile',
  'generate-interview-kit',
  'generate-onboarding-plan',
  'generate-job-ad',
  'generate-job-ad-text',
  'generate-job-ad-image',
  'legal-advisor-chat',
  'defense-builder',
  'labor-complaint-assistant',
  'hring-support',
]);

const newIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const notifyCreditsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hring:credits-changed'));
};

const errorShape = (error: unknown) => ({
  name: error instanceof Error ? error.name : 'HRingApiError',
  message: error instanceof Error ? error.message : 'Independent HRing API request failed',
  context: error,
});

class QueryBuilder<T = any> implements PromiseLike<LegacyResult<T>> {
  private operation: QueryOperation = 'select';
  private columns = '*';
  private values: any = null;
  private filters: QueryFilter[] = [];
  private queryOrder: QueryOrder | null = null;
  private queryLimit: number | null = null;
  private wantsSingle = false;
  private wantsMaybeSingle = false;
  private conflictTarget: string | null = null;

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    if (this.operation !== 'insert' && this.operation !== 'update' && this.operation !== 'upsert') {
      this.operation = 'select';
    }
    if (options?.head) this.queryLimit = 1;
    return this;
  }

  insert(values: JsonRecord | JsonRecord[]) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  update(values: JsonRecord) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(values: JsonRecord | JsonRecord[], options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.values = values;
    this.conflictTarget = options?.onConflict || null;
    return this;
  }

  eq(column: string, value: unknown) { return this.filter('eq', column, value); }
  neq(column: string, value: unknown) { return this.filter('neq', column, value); }
  in(column: string, value: unknown[]) { return this.filter('in', column, value); }
  is(column: string, value: unknown) { return this.filter('is', column, value); }
  gt(column: string, value: unknown) { return this.filter('gt', column, value); }
  gte(column: string, value: unknown) { return this.filter('gte', column, value); }
  lt(column: string, value: unknown) { return this.filter('lt', column, value); }
  lte(column: string, value: unknown) { return this.filter('lte', column, value); }
  contains(column: string, value: unknown) { return this.filter('contains', column, value); }

  private filter(operator: FilterOperator, column: string, value: unknown) {
    this.filters.push({ column, operator, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.queryOrder = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.queryLimit = value;
    return this;
  }

  range(from: number, to: number) {
    // The compatibility API currently implements bounded result size rather than offset.
    // Existing HRing callers use range primarily to cap dashboards, so preserve that safely.
    this.queryLimit = Math.max(1, to - from + 1);
    return this;
  }

  single() {
    this.wantsSingle = true;
    this.wantsMaybeSingle = false;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    this.wantsSingle = false;
    return this;
  }

  then<TResult1 = LegacyResult<T>, TResult2 = never>(
    onfulfilled?: ((value: LegacyResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<LegacyResult<T>> {
    try {
      const payload = {
        table: this.table,
        operation: this.operation,
        columns: this.columns,
        values: this.values,
        filters: this.filters,
        order: this.queryOrder,
        limit: this.queryLimit,
        single: this.wantsSingle,
        maybe_single: this.wantsMaybeSingle,
        on_conflict: this.conflictTarget,
      };
      const usePublic = this.operation === 'select' && PUBLIC_READ_TABLES.has(this.table) && !getAccessToken();
      const envelope = usePublic
        ? await apiRequest<CompatEnvelope<T>>('/compat/public/query', {
            method: 'POST',
            body: JSON.stringify(payload),
          }, { auth: false, retryAuth: false })
        : await apiRequest<CompatEnvelope<T>>('/compat/query', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      return { data: envelope.data ?? null, error: null, count: envelope.count ?? null };
    } catch (error) {
      return { data: null, error: errorShape(error), count: null };
    }
  }
}

const invokeFunction = async (functionName: string, options?: { body?: unknown }): Promise<LegacyResult> => {
  const isMetered = METERED_COMPAT_FUNCTIONS.has(functionName);
  try {
    const body = (options?.body || {}) as Record<string, any>;

    if (functionName === 'generate-job-ad') {
      const data = await apiRequest('/job-ads/generate', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'generate-job-ad-text') {
      const data = await apiRequest('/job-ads/generate-text', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'generate-job-ad-image') {
      const data = await apiRequest('/job-ads/generate-image', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'generate-interview-kit') {
      const data = await apiRequest('/interview/kits/generate', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'generate-job-profile') {
      const data = await apiRequest('/job-engineering/job-profiles/generate', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'legal-advisor-chat') {
      const data = await apiRequest('/legal/advisor/chat', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'defense-builder') {
      const data = await apiRequest('/legal/defense/analyze', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(body),
      });
      notifyCreditsChanged();
      return { data, error: null };
    }
    if (functionName === 'auto-headhunt') {
      const campaignId = body.campaignId;
      if (typeof campaignId !== 'string' || !campaignId) throw new Error('campaignId is required');
      const data = await apiRequest(`/recruiting/campaigns/${campaignId}/auto-source`, {
        method: 'POST',
        body: JSON.stringify({ jobRequirements: body.jobRequirements }),
      });
      return { data, error: null };
    }
    if (functionName === 'analyze-candidates') {
      const data = await apiRequest('/recruiting/analyze-candidates', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { data, error: null };
    }
    if (functionName === 'validate-invite-code') {
      const inviteCode = body.invite_code ?? body.inviteCode ?? body.code;
      const data = await apiRequest('/company-invites/validate', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode }),
      }, { auth: false, retryAuth: false });
      return { data, error: null };
    }
    if (functionName === 'zarinpal-payment') {
      if (body.action === 'init') {
        if (typeof body.plan_type !== 'string' || !body.plan_type) throw new Error('plan_type is required');
        const data = await apiRequest('/billing/payments/init', {
          method: 'POST',
          body: JSON.stringify({ plan_type: body.plan_type }),
        });
        return { data, error: null };
      }
      if (body.action === 'verify') {
        if (typeof body.authority !== 'string' || !body.authority) throw new Error('authority is required');
        const data = await apiRequest('/billing/payments/verify', {
          method: 'POST',
          body: JSON.stringify({ authority: body.authority }),
        });
        return { data, error: null };
      }
      throw new Error('Invalid payment action');
    }

    const envelope = await apiRequest<CompatEnvelope>(`/compat/functions/${encodeURIComponent(functionName)}`, {
      method: 'POST',
      headers: isMetered ? { 'X-Idempotency-Key': newIdempotencyKey() } : undefined,
      body: JSON.stringify({ body: options?.body ?? null }),
    });
    if (isMetered) notifyCreditsChanged();
    return { data: envelope.data ?? null, error: null, count: envelope.count ?? null };
  } catch (error) {
    if (isMetered) notifyCreditsChanged();
    return { data: null, error: errorShape(error) };
  }
};

const rpc = async (name: string, args: JsonRecord = {}): Promise<LegacyResult> => {
  try {
    const envelope = await apiRequest<CompatEnvelope>('/compat/rpc', {
      method: 'POST',
      headers: name === 'deduct_credits' ? { 'X-Idempotency-Key': newIdempotencyKey() } : undefined,
      body: JSON.stringify({ name, args }),
    });
    return { data: envelope.data ?? null, error: null, count: envelope.count ?? null };
  } catch (error) {
    return { data: null, error: errorShape(error) };
  }
};

const storageBucket = (bucket: string) => ({
  upload: async (path: string, file: Blob | File, options?: { cacheControl?: string; contentType?: string; upsert?: boolean }): Promise<LegacyResult> => {
    try {
      const form = new FormData();
      const filename = path.split('/').pop() || 'upload.bin';
      form.append('file', file, filename);
      const envelope = await apiRequest<any>(`/compat/storage/${encodeURIComponent(bucket)}/upload/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST',
        body: form,
      });
      return { data: envelope, error: null };
    } catch (error) {
      return { data: null, error: errorShape(error) };
    }
  },
  remove: async (paths: string[]): Promise<LegacyResult> => {
    try {
      const data = await apiRequest(`/compat/storage/${encodeURIComponent(bucket)}/remove`, {
        method: 'POST',
        body: JSON.stringify({ paths }),
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error: errorShape(error) };
    }
  },
  list: async (prefix = '', options?: { limit?: number; sortBy?: { column: string; order?: 'asc' | 'desc' } }): Promise<LegacyResult> => {
    try {
      const data = await apiRequest<{ data: any[] }>(`/compat/storage/${encodeURIComponent(bucket)}/list`, {
        method: 'POST',
        body: JSON.stringify({ prefix, limit: options?.limit ?? 100 }),
      });
      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: errorShape(error) };
    }
  },
  getPublicUrl: (path: string) => ({
    data: {
      publicUrl: PUBLIC_STORAGE_BUCKETS.has(bucket)
        ? `/api/v1/compat/storage/public/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
        : `/api/v1/compat/storage/private/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,
    },
  }),
  createSignedUrl: async (path: string, _expiresIn: number): Promise<LegacyResult> => ({
    data: { signedUrl: `/api/v1/compat/storage/private/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}` },
    error: null,
  }),
});

const auth = {
  getUser: async () => {
    try {
      const data = await apiRequest<{ user_id: string; email: string }>('/auth/context');
      const user: ApiUser = {
        id: data.user_id,
        email: data.email,
        is_active: true,
        email_verified_at: null,
        created_at: '',
      };
      return { data: { user }, error: null };
    } catch (error) {
      return { data: { user: null }, error: errorShape(error) };
    }
  },
  getSession: async () => ({
    data: {
      session: getAccessToken() ? { access_token: getAccessToken() } : null,
    },
    error: null,
  }),
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    try {
      const envelope = await authRequest<AuthEnvelope>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(envelope.tokens.access_token);
      return { data: { user: envelope.user, session: { access_token: envelope.tokens.access_token } }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: errorShape(error) };
    }
  },
  signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: JsonRecord; emailRedirectTo?: string } }) => {
    try {
      const envelope = await authRequest<AuthEnvelope>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: options?.data?.full_name ?? null }),
      });
      setAccessToken(envelope.tokens.access_token);
      return { data: { user: envelope.user, session: { access_token: envelope.tokens.access_token } }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: errorShape(error) };
    }
  },
  signOut: async () => {
    try {
      await authRequest<void>('/auth/logout', { method: 'POST' });
      setAccessToken(null);
      return { error: null };
    } catch (error) {
      setAccessToken(null);
      return { error: errorShape(error) };
    }
  },
  onAuthStateChange: (_callback: (...args: any[]) => void) => ({
    data: { subscription: { unsubscribe: () => undefined } },
  }),
};

class PollingChannel {
  private timer: number | null = null;
  private handlers: Array<(...args: any[]) => void> = [];
  on(_type: string, _filter: unknown, callback: (...args: any[]) => void) {
    this.handlers.push(callback);
    return this;
  }
  subscribe(callback?: (status: string) => void) {
    callback?.('SUBSCRIBED');
    // Realtime is intentionally emulated by low-frequency invalidation, not an external socket.
    this.timer = window.setInterval(() => this.handlers.forEach((handler) => handler()), 30_000);
    return this;
  }
  unsubscribe() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

export const supabase = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table),
  functions: { invoke: invokeFunction },
  rpc,
  storage: { from: storageBucket },
  auth,
  channel: (_name: string) => new PollingChannel(),
  removeChannel: (channel: PollingChannel) => {
    channel.unsubscribe();
    return Promise.resolve('ok');
  },
};

export type HringCompatibilityClient = typeof supabase;
export { ApiError };



