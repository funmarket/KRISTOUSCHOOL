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

  useEffect(() => {
    initializeTelegramWebApp();
    const initData = getTelegramWebAppInitData();
    if (!initData) return;
    const isLinkAttempt = Boolean(new URLSearchParams(initData).get('start_param'));

    let active = true;
    void authenticateTelegramInitData(initData)
      .then(({ user, linked }) => {
        if (!active || !mountedRef.current) return;
        telegramIdentityUser.current = user;
        setAuthError(null);
        syncAccountIdentity(user);
        if (isLinkAttempt && linked) setTelegramLinkNotice('success');
      })
      .catch(() => {
        if (!active || !mountedRef.current) return;
        telegramIdentityUser.current = null;
        syncAccountIdentity(null);
        if (isLinkAttempt) setTelegramLinkNotice('error');
      });
    return () => {
      active = false;
    };
  }, [syncAccountIdentity]);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }
    let active = true;

    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active || !mountedRef.current) return;
        if (telegramIdentityUser.current) {
          syncAccountIdentity(telegramIdentityUser.current);
          return;
        }
        if (!data.session?.user) return;
        try {
          const user = await loadCanonicalUser(data.session.user);
          if (active && mountedRef.current) {
            setAuthError(null);
            syncAccountIdentity(user);
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'account_not_approved') {
            void signOutAccount();
          }
          if (active && mountedRef.current) {
            syncAccountIdentity(null);
          }
        }
      })
      .finally(() => {
        if (active && mountedRef.current) {
          setIsAuthLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active || !mountedRef.current) return;
      if (telegramIdentityUser.current) {
        syncAccountIdentity(telegramIdentityUser.current);
        return;
      }
      if (!session?.user) {
        syncAccountIdentity(null);
        return;
      }
      try {
        const user = await loadCanonicalUser(session.user);
        if (active && mountedRef.current) {
          setAuthError(null);
          syncAccountIdentity(user);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'account_not_approved') {
          void signOutAccount();
        }
        if (active && mountedRef.current) {
          syncAccountIdentity(null);
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [syncAccountIdentity]);

  const refreshCurrentUser = useCallback(async (): Promise<User | null> => {
    if (telegramIdentityUser.current) {
      syncAccountIdentity(telegramIdentityUser.current);
      return telegramIdentityUser.current;
    }
    if (!supabase) return null;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        syncAccountIdentity(null);
        return null;
      }
      const user = await loadCanonicalUser(data.session.user);
      if (mountedRef.current) {
        setAuthError(null);
        syncAccountIdentity(user);
      }
      return user;
    } catch (error) {
      if (error instanceof Error && error.message === 'account_not_approved') {
        void signOutAccount();
      }
      if (mountedRef.current) {
        syncAccountIdentity(null);
      }
      return null;
    }
  }, [syncAccountIdentity]);

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
