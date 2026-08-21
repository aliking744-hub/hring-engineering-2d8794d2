import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  ApiUser,
  AuthEnvelope,
  authRequest,
  refreshSession,
  setAccessToken,
} from '@/lib/api';

export type AuthUser = ApiUser;

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

interface SmsChallenge {
  challenge_id: string;
  expires_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error: Error | null; user: AuthUser | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; user: AuthUser | null }>;
  requestSmsLogin: (phone: string) => Promise<{ error: Error | null; challenge: SmsChallenge | null }>;
  verifySmsLogin: (
    challengeId: string,
    code: string,
  ) => Promise<{ error: Error | null; user: AuthUser | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toSession = (auth: AuthEnvelope): AuthSession => ({
  access_token: auth.tokens.access_token,
  user: auth.user,
});

const asError = (error: unknown) => {
  if (error instanceof Error) return error;
  return new Error('خطای ناشناخته در ارتباط با سرور');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuth = (auth: AuthEnvelope | null) => {
    if (!auth) {
      setAccessToken(null);
      setUser(null);
      setSession(null);
      return null;
    }
    setAccessToken(auth.tokens.access_token);
    setUser(auth.user);
    setSession(toSession(auth));
    return auth.user;
  };

  const restoreSession = async () => {
    const auth = await refreshSession();
    return applyAuth(auth);
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const auth = await refreshSession();
      if (!active) return;
      applyAuth(auth);
      setLoading(false);
    };
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const auth = await authRequest<AuthEnvelope>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      return { error: null, user: applyAuth(auth) };
    } catch (error) {
      return { error: asError(error), user: null };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const auth = await authRequest<AuthEnvelope>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          full_name: fullName?.trim() || null,
        }),
      });
      return { error: null, user: applyAuth(auth) };
    } catch (error) {
      return { error: asError(error), user: null };
    }
  };

  const requestSmsLogin = async (phone: string) => {
    try {
      const challenge = await authRequest<SmsChallenge>('/auth/sms/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      return { error: null, challenge };
    } catch (error) {
      return { error: asError(error), challenge: null };
    }
  };

  const verifySmsLogin = async (challengeId: string, code: string) => {
    try {
      const auth = await authRequest<AuthEnvelope>('/auth/sms/verify', {
        method: 'POST',
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      return { error: null, user: applyAuth(auth) };
    } catch (error) {
      return { error: asError(error), user: null };
    }
  };

  const signInWithGoogle = async () => ({
    error: new ApiError(
      'ورود با گوگل در نسخه مستقل هنوز پیکربندی نشده است',
      501,
    ),
  });

  const signOut = async () => {
    try {
      await authRequest<void>('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      applyAuth(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signUp,
      signIn,
      requestSmsLogin,
      verifySmsLogin,
      signInWithGoogle,
      signOut,
      restoreSession,
    }),
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
