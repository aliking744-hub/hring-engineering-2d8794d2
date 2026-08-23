import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  ApiError,
  ApiUser,
  AuthEnvelope,
  authRequest,
  apiRequest,
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

export interface MfaStatus {
  required: boolean;
  enrollment_required: boolean;
  verification_required: boolean;
  enabled: boolean;
  verified: boolean;
  recovery_codes_remaining: number;
  locked_until: string | null;
}

export interface MfaEnrollment {
  secret: string;
  otpauth_uri: string;
}

interface MfaConfirmation {
  status: MfaStatus;
  recovery_codes: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  mfaRequired: boolean;
  mfaEnrollmentRequired: boolean;
  mfaVerified: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{
    error: Error | null;
    user: AuthUser | null;
    mfaRequired: boolean;
    mfaEnrollmentRequired: boolean;
  }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    error: Error | null;
    user: AuthUser | null;
    mfaRequired: boolean;
    mfaEnrollmentRequired: boolean;
  }>;
  requestSmsLogin: (phone: string) => Promise<{ error: Error | null; challenge: SmsChallenge | null }>;
  verifySmsLogin: (
    challengeId: string,
    code: string,
  ) => Promise<{
    error: Error | null;
    user: AuthUser | null;
    mfaRequired: boolean;
    mfaEnrollmentRequired: boolean;
  }>;
  beginMfaEnrollment: () => Promise<{ error: Error | null; enrollment: MfaEnrollment | null }>;
  confirmMfaEnrollment: (
    code: string,
  ) => Promise<{ error: Error | null; recoveryCodes: string[] }>;
  verifyMfa: (code: string) => Promise<{ error: Error | null }>;
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
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  const applyAuth = (auth: AuthEnvelope | null) => {
    if (!auth) {
      setAccessToken(null);
      setUser(null);
      setSession(null);
      setMfaRequired(false);
      setMfaEnrollmentRequired(false);
      setMfaVerified(false);
      return null;
    }
    setAccessToken(auth.tokens.access_token);
    setUser(auth.user);
    setSession(toSession(auth));
    setMfaRequired(Boolean(auth.mfa_required));
    setMfaEnrollmentRequired(Boolean(auth.mfa_enrollment_required));
    setMfaVerified(Boolean(auth.mfa_verified));
    return auth.user;
  };

  const applyMfaStatus = (status: MfaStatus) => {
    setMfaRequired(status.required);
    setMfaEnrollmentRequired(status.enrollment_required);
    setMfaVerified(status.verified);
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
      return {
        error: null,
        user: applyAuth(auth),
        mfaRequired: Boolean(auth.mfa_required),
        mfaEnrollmentRequired: Boolean(auth.mfa_enrollment_required),
      };
    } catch (error) {
      return { error: asError(error), user: null, mfaRequired: false, mfaEnrollmentRequired: false };
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
      return {
        error: null,
        user: applyAuth(auth),
        mfaRequired: Boolean(auth.mfa_required),
        mfaEnrollmentRequired: Boolean(auth.mfa_enrollment_required),
      };
    } catch (error) {
      return { error: asError(error), user: null, mfaRequired: false, mfaEnrollmentRequired: false };
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
      return {
        error: null,
        user: applyAuth(auth),
        mfaRequired: Boolean(auth.mfa_required),
        mfaEnrollmentRequired: Boolean(auth.mfa_enrollment_required),
      };
    } catch (error) {
      return { error: asError(error), user: null, mfaRequired: false, mfaEnrollmentRequired: false };
    }
  };

  const beginMfaEnrollment = useCallback(async () => {
    try {
      const enrollment = await apiRequest<MfaEnrollment>('/auth/mfa/enroll', {
        method: 'POST',
      });
      return { error: null, enrollment };
    } catch (error) {
      return { error: asError(error), enrollment: null };
    }
  }, []);

  const confirmMfaEnrollment = async (code: string) => {
    try {
      const confirmation = await apiRequest<MfaConfirmation>('/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      applyMfaStatus(confirmation.status);
      return { error: null, recoveryCodes: confirmation.recovery_codes };
    } catch (error) {
      return { error: asError(error), recoveryCodes: [] };
    }
  };

  const verifyMfa = async (code: string) => {
    try {
      const status = await apiRequest<MfaStatus>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      applyMfaStatus(status);
      return { error: null };
    } catch (error) {
      return { error: asError(error) };
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

  const value = {
    user,
    session,
    loading,
    mfaRequired,
    mfaEnrollmentRequired,
    mfaVerified,
    signUp,
    signIn,
    requestSmsLogin,
    verifySmsLogin,
    beginMfaEnrollment,
    confirmMfaEnrollment,
    verifyMfa,
    signInWithGoogle,
    signOut,
    restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
