import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AccountRole, Language, User } from '../types';
import {
  classifySignInError,
  classifySignUpError,
  resolveSignInErrorMessage,
  resolveSignUpErrorMessage,
  type SignInErrorCode,
  type SignUpErrorCode,
} from '../i18n/authMessages';
import { supabase } from '../lib/supabase';
import {
  authenticateTelegramInitData,
  createTelegramLinkChallenge,
  loadCanonicalUser,
  signInAccount,
  signOutAccount,
  signUpAccount,
  type SignupRole,
} from '../lib/auth';
import { getTelegramWebAppInitData, initializeTelegramWebApp } from '../lib/telegram';
import type { AccountIdentityContext } from '../lib/appStateGuards';
import { PreferencesContext } from './PreferencesContext';

export interface SignupInput {
  username?: string;
  password: string;
  email?: string;
  phone?: string;
  fullName: string;
  requestedRole: SignupRole;
  staffId?: string;
  admissionId?: string;
}

export interface SignInOutcome {
  success: boolean;
  error?: string;
  errorCode?: SignInErrorCode;
}

export interface SignupOutcome {
  success: boolean;
  confirmationRequired?: boolean;
  secondaryPhoneVerificationRequired?: boolean;
  error?: string;
  errorCode?: SignUpErrorCode;
}

export interface IdentityContextType {
  currentUser: User | null;
  currentRole: AccountRole | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  identityContext: AccountIdentityContext;
  getCurrentIdentity: () => AccountIdentityContext;
  patchCurrentUserAssignments: (
    userId: string,
    patch: { linkedChildrenIds?: string[]; assignedClassIds?: string[] },
  ) => void;
  login: (identifier: string, pass: string) => Promise<SignInOutcome>;
  signIn: (identifier: string, pass: string) => Promise<SignInOutcome>;
  signup: (input: SignupInput) => Promise<SignupOutcome>;
  register: (input: SignupInput) => Promise<SignupOutcome>;
  signUp: (input: SignupInput) => Promise<SignupOutcome>;
  logout: () => void;
  signOut: () => void;
  refreshCurrentUser: () => Promise<User | null>;
  refreshSession: () => Promise<User | null>;
  connectTelegram: () => Promise<{ linkUrl?: string; error?: string }>;
  telegramLinkNotice: 'success' | 'error' | null;
  dismissTelegramLinkNotice: () => void;
}

export const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export const IdentityProvider: React.FC<{
  children: React.ReactNode;
  languageOverride?: Language;
}> = ({ children, languageOverride }) => {
  const prefsCtx = useContext(PreferencesContext);
  const language: Language = languageOverride ?? prefsCtx?.language ?? 'fr';

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRoleState] = useState<AccountRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(null);
  const [telegramLinkNotice, setTelegramLinkNotice] = useState<'success' | 'error' | null>(null);

  const mountedRef = useRef<boolean>(true);
  const telegramIdentityUser = useRef<User | null>(null);
  const telegramAuthInFlightRef = useRef<boolean>(false);
  const authGenerationRef = useRef<number>(1);
  const currentIdentityRef = useRef<AccountIdentityContext>({
    userId: null,
    accountStatus: null,
    generation: 1,
  });
  const [identityContext, setIdentityContext] = useState<AccountIdentityContext>(
    currentIdentityRef.current,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncAccountIdentity = useCallback((nextUser: User | null) => {
    const prevId = currentIdentityRef.current.userId;
    const prevStatus = currentIdentityRef.current.accountStatus;
    const nextId = nextUser?.id ?? null;
    const nextStatus = nextUser?.accountStatus ?? null;
    if (prevId !== nextId || prevStatus !== nextStatus) {
      authGenerationRef.current += 1;
      const nextIdentity: AccountIdentityContext = {
        userId: nextId,
        accountStatus: nextStatus,
        generation: authGenerationRef.current,
      };
      currentIdentityRef.current = nextIdentity;
      setIdentityContext(nextIdentity);
    }
    setCurrentUser(nextUser);
    setCurrentRoleState(nextUser ? nextUser.role : null);
  }, []);

  const getCurrentIdentity = useCallback((): AccountIdentityContext => {
    return currentIdentityRef.current;
  }, []);

  const patchCurrentUserAssignments = useCallback(
    (userId: string, patch: { linkedChildrenIds?: string[]; assignedClassIds?: string[] }) => {
      setCurrentUser((prev) => {
        if (!prev || prev.id !== userId) return prev;
        return {
          ...prev,
          ...(patch.linkedChildrenIds !== undefined ? { linkedChildrenIds: patch.linkedChildrenIds } : {}),
          ...(patch.assignedClassIds !== undefined ? { assignedClassIds: patch.assignedClassIds } : {}),
        };
      });
    },
    [],
  );

  const rejectIdentityConflict = useCallback((isLinkAttempt = false) => {
    telegramIdentityUser.current = null;
    void signOutAccount();
    setAuthError('telegram_identity_conflict');
    syncAccountIdentity(null);
    if (isLinkAttempt) setTelegramLinkNotice('error');
  }, [syncAccountIdentity]);

  const hydrateCanonicalUser = useCallback(async (
    sessionUser: { id: string; email?: string | null },
    shouldCommit: () => boolean,
    opts?: { clearTelegramOnFail?: boolean; setTelegramIfLinked?: boolean },
  ): Promise<User | null> => {
    try {
      const user = await loadCanonicalUser(sessionUser as any);
      if (shouldCommit()) {
        if (opts?.setTelegramIfLinked && user.telegramLinked) {
          telegramIdentityUser.current = user;
        }
        setAuthError(null);
        syncAccountIdentity(user);
      }
      return user;
    } catch (error) {
      if (error instanceof Error && error.message === 'account_not_approved') {
        if (opts?.clearTelegramOnFail) telegramIdentityUser.current = null;
        void signOutAccount();
      }
      if (shouldCommit()) syncAccountIdentity(null);
      return null;
    }
  }, [syncAccountIdentity]);

  useEffect(() => {
    initializeTelegramWebApp();
    const initData = getTelegramWebAppInitData();
    if (!initData) return;
    const isLinkAttempt = Boolean(new URLSearchParams(initData).get('start_param'));

    let active = true;
    telegramAuthInFlightRef.current = true;
    void authenticateTelegramInitData(initData)
      .then(async ({ user, linked }) => {
        if (!active || !mountedRef.current) return;
        const webSessionUser = supabase
          ? await supabase.auth.getSession().then((res) => res.data.session?.user ?? null).catch(() => null)
          : null;
        if (!active || !mountedRef.current) return;
        if (webSessionUser && webSessionUser.id !== user.id) {
          rejectIdentityConflict(isLinkAttempt);
          return;
        }
        telegramIdentityUser.current = user;
        setAuthError(null);
        syncAccountIdentity(user);
        if (isLinkAttempt && linked) setTelegramLinkNotice('success');
      })
      .catch((error) => {
        if (!active || !mountedRef.current) return;
        telegramIdentityUser.current = null;
        const errorCode =
          error instanceof Error && error.message.trim() ? error.message.trim() : 'telegram_auth_failed';
        if (errorCode === 'telegram_identity_conflict') {
          rejectIdentityConflict(isLinkAttempt);
          return;
        }
        if (errorCode === 'account_not_approved') void signOutAccount();
        if (errorCode !== 'telegram_not_linked') {
          setAuthError(errorCode);
        } else {
          setAuthError(null);
        }
        syncAccountIdentity(null);
        if (isLinkAttempt) setTelegramLinkNotice('error');
      })
      .finally(() => {
        telegramAuthInFlightRef.current = false;
        if (active && mountedRef.current) setIsAuthLoading(false);
      });
    return () => {
      active = false;
      telegramAuthInFlightRef.current = false;
    };
  }, [rejectIdentityConflict, syncAccountIdentity]);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }
    let active = true;
    const canCommit = () => active && mountedRef.current && !telegramAuthInFlightRef.current;

    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active || !mountedRef.current || telegramAuthInFlightRef.current) return;
        if (telegramIdentityUser.current && !data.session?.user) {
          syncAccountIdentity(telegramIdentityUser.current);
          return;
        }
        if (!data.session?.user) return;
        if (telegramIdentityUser.current && data.session.user.id !== telegramIdentityUser.current.id) {
          rejectIdentityConflict();
          return;
        }
        await hydrateCanonicalUser(data.session.user, canCommit);
      })
      .finally(() => {
        if (canCommit()) setIsAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active || !mountedRef.current) return;
      if (telegramAuthInFlightRef.current && event !== 'SIGNED_OUT') return;
      if (!session?.user) {
        if (event === 'SIGNED_OUT' || !telegramIdentityUser.current) {
          telegramIdentityUser.current = null;
          syncAccountIdentity(null);
        }
        return;
      }
      if (telegramIdentityUser.current && session.user.id !== telegramIdentityUser.current.id) {
        rejectIdentityConflict();
        return;
      }
      await hydrateCanonicalUser(session.user, canCommit, { clearTelegramOnFail: true, setTelegramIfLinked: true });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateCanonicalUser, rejectIdentityConflict, syncAccountIdentity]);

  const refreshCurrentUser = useCallback(async (): Promise<User | null> => {
    if (!supabase) {
      if (telegramIdentityUser.current) {
        syncAccountIdentity(telegramIdentityUser.current);
        return telegramIdentityUser.current;
      }
      return null;
    }
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } })); const telegramInitData = getTelegramWebAppInitData();
    if (!data.session?.user && telegramInitData) {
      try {
        const { user } = await authenticateTelegramInitData(telegramInitData, supabase);
        if (telegramIdentityUser.current && telegramIdentityUser.current.id !== user.id) { rejectIdentityConflict(); return null; }
        telegramIdentityUser.current = user; setAuthError(null); syncAccountIdentity(user); return user;
      } catch (error) {
        telegramIdentityUser.current = null; syncAccountIdentity(null);
        const errorCode = error instanceof Error && error.message.trim() ? error.message.trim() : 'telegram_auth_failed'; setAuthError(errorCode === 'telegram_not_linked' ? null : errorCode); return null;
      }
    }
    if (!data.session?.user) {
      telegramIdentityUser.current = null;
      syncAccountIdentity(null);
      return null;
    }
    if (telegramIdentityUser.current && data.session.user.id !== telegramIdentityUser.current.id) { rejectIdentityConflict(); return null; }
    return hydrateCanonicalUser(data.session.user, () => mountedRef.current, { clearTelegramOnFail: true, setTelegramIfLinked: true });
  }, [hydrateCanonicalUser, rejectIdentityConflict, syncAccountIdentity]);

  const login = useCallback(
    async (identifier: string, pass: string): Promise<SignInOutcome> => {
      setAuthError(null);
      try {
        const { user } = await signInAccount(identifier, pass);
        const canonicalUser = await loadCanonicalUser(user);
        syncAccountIdentity(canonicalUser);
        return { success: true };
      } catch (error) {
        await signOutAccount();
        syncAccountIdentity(null);
        const errorCode = classifySignInError(error);
        const message = resolveSignInErrorMessage(language, errorCode);
        setAuthError(message);
        return {
          success: false,
          errorCode,
          error: message,
        };
      }
    },
    [language, syncAccountIdentity],
  );

  const register = useCallback(
    async (input: SignupInput): Promise<SignupOutcome> => {
      setAuthError(null);
      try {
        const data = await signUpAccount(input);
        return {
          success: true,
          confirmationRequired: !data.session,
          secondaryPhoneVerificationRequired: Boolean(data.secondaryPhoneVerificationRequired),
        };
      } catch (error) {
        const errorCode = classifySignUpError(error);
        const message = resolveSignUpErrorMessage(language, errorCode);
        setAuthError(message);
        return {
          success: false,
          errorCode,
          error: message,
        };
      }
    },
    [language],
  );

  const logout = useCallback(() => {
    telegramIdentityUser.current = null;
    setAuthError(null);
    void signOutAccount();
    syncAccountIdentity(null);
  }, [syncAccountIdentity]);

  const connectTelegram = useCallback(async () => {
    if (!currentUser) return { error: 'Authentication required' };
    try {
      const challenge = await createTelegramLinkChallenge();
      return { linkUrl: challenge.linkUrl };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to start Telegram linking' };
    }
  }, [currentUser]);

  const dismissTelegramLinkNotice = useCallback(() => {
    setTelegramLinkNotice(null);
  }, []);

  const isAuthenticated = Boolean(currentUser && currentUser.accountStatus === 'APPROVED');

  return (
    <IdentityContext.Provider
      value={{
        currentUser,
        currentRole,
        isAuthenticated,
        isAuthLoading,
        authError,
        identityContext,
        getCurrentIdentity,
        patchCurrentUserAssignments,
        login,
        signIn: login,
        signup: register,
        register,
        signUp: register,
        logout,
        signOut: logout,
        refreshCurrentUser,
        refreshSession: refreshCurrentUser,
        connectTelegram,
        telegramLinkNotice,
        dismissTelegramLinkNotice,
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
};

export const useIdentity = (): IdentityContextType => {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error('useIdentity must be used within an IdentityProvider');
  }
  return context;
};
