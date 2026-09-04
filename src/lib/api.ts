const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE = (configuredBase || '/api/v1').replace(/\/$/, '');

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthEnvelope | null> | null = null;

export interface ApiUser {
  id: string;
  email: string;
  is_active: boolean;
  email_verified_at: string | null;
  created_at: string;
}

export interface AuthEnvelope {
  user: ApiUser;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    access_expires_at: string;
    refresh_expires_at: string;
  };
  mfa_required?: boolean;
  mfa_enrollment_required?: boolean;
  mfa_verified?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

const urlFor = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? (payload as { detail?: unknown }).detail
      : payload;
    const message = typeof detail === 'string' ? detail : `HTTP ${response.status}`;
    throw new ApiError(message, response.status, detail);
  }

  return payload as T;
};

const execute = async <T>(
  path: string,
  init: RequestInit = {},
  token: string | null = accessToken,
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(urlFor(path), {
    ...init,
    headers,
    credentials: 'include',
  });
  return parseResponse<T>(response);
};

export const refreshSession = async (): Promise<AuthEnvelope | null> => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const auth = await execute<AuthEnvelope>(
        '/auth/refresh',
        { method: 'POST' },
        null,
      );
      setAccessToken(auth.tokens.access_token);
      return auth;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Session refresh failed:', error);
      }
      setAccessToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; retryAuth?: boolean } = {},
): Promise<T> => {
  const authRequired = options.auth !== false;
  const retryAuth = options.retryAuth !== false;

  try {
    return await execute<T>(path, init, authRequired ? accessToken : null);
  } catch (error) {
    if (
      authRequired &&
      retryAuth &&
      error instanceof ApiError &&
      error.status === 401 &&
      error.detail === 'Authentication required'
    ) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return execute<T>(path, init, accessToken);
      }
    }
    throw error;
  }
};

export const authRequest = async <T>(path: string, init: RequestInit = {}) =>
  apiRequest<T>(path, init, { auth: false, retryAuth: false });

const executeBlob = async (
  path: string,
  init: RequestInit = {},
  token: string | null = accessToken,
): Promise<Blob> => {
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(urlFor(path), {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    await parseResponse<unknown>(response);
    throw new ApiError(`HTTP ${response.status}`, response.status);
  }
  return response.blob();
};

export const apiBlobRequest = async (
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; retryAuth?: boolean } = {},
): Promise<Blob> => {
  const authRequired = options.auth !== false;
  const retryAuth = options.retryAuth !== false;

  try {
    return await executeBlob(path, init, authRequired ? accessToken : null);
  } catch (error) {
    if (
      authRequired &&
      retryAuth &&
      error instanceof ApiError &&
      error.status === 401 &&
      error.detail === 'Authentication required'
    ) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return executeBlob(path, init, accessToken);
      }
    }
    throw error;
  }
};

const installLegacyFunctionFetchBridge = () => {
  if (typeof window === 'undefined') return;
  const marker = '__hringLegacyFunctionFetchInstalled';
  const markedWindow = window as typeof window & Record<string, unknown>;
  if (markedWindow[marker]) return;
  markedWindow[marker] = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const match = rawUrl.match(/\/functions\/v1\/([A-Za-z0-9_-]+)/);
    if (!match) return nativeFetch(input, init);

    const functionName = match[1];
    const headers = new Headers(init?.headers);
    headers.delete('apikey');
    headers.delete('Authorization');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    let legacyBody: unknown = null;
    if (typeof init?.body === 'string') {
      try {
        legacyBody = JSON.parse(init.body);
      } catch {
        legacyBody = init.body;
      }
    } else if (init?.body instanceof FormData) {
      // Multipart legacy document imports use a dedicated HRing endpoint.
      const uploadHeaders = new Headers();
      if (accessToken) uploadHeaders.set('Authorization', `Bearer ${accessToken}`);
      return nativeFetch(urlFor(`/compat/files/${encodeURIComponent(functionName)}`), {
        method: init.method || 'POST',
        body: init.body,
        headers: uploadHeaders,
        credentials: 'include',
      });
    }

    const isPublicSupport = functionName === 'hring-support' && !accessToken;
    const target = isPublicSupport
      ? '/compat/public-functions/hring-support'
      : `/compat/functions/${encodeURIComponent(functionName)}`;
    const response = await nativeFetch(urlFor(target), {
      ...init,
      method: init?.method || 'POST',
      headers,
      body: JSON.stringify({ body: legacyBody }),
      credentials: 'include',
    });

    if (functionName !== 'hring-support' || !response.ok) return response;

    const envelope = await response.json() as { data?: unknown };
    const value = envelope.data;
    const content = typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null && 'content' in value && typeof (value as { content?: unknown }).content === 'string'
        ? (value as { content: string }).content
        : JSON.stringify(value ?? '');
    const streamText = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(streamText, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  };
};

installLegacyFunctionFetchBridge();
