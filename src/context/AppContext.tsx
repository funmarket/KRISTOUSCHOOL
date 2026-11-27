import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  Announcement,
  BackendOpResult,
  BackendOpStatus,
  PublicContentEntry,
} from '../types';
import { classifySignInError, resolveSignInErrorMessage } from '../i18n/authMessages';
import { PreferencesContext, PreferencesProvider, usePreferences } from './PreferencesContext';
import { NotificationContext, NotificationProvider, useNotifications } from './NotificationContext';
import { IdentityContext, IdentityProvider, useIdentity, type SignupInput } from './IdentityContext';
import {
  localizeDirectoryAdmins,
  localizeDirectoryTeachers,
  localizeFoodMenuWeek,
  localizePublicAnnouncements,
  PUBLIC_PREVIEW_ANNOUNCEMENTS,
  type AppContextType,
} from './appContextTypes';
import { useParentNotesState } from './useParentNotesState';
import { usePickupState } from './usePickupState';
import { useSchoolDataHydration } from './useSchoolDataHydration';
import { useCommunityAndNotesActions } from './useCommunityAndNotesActions';

const AppContext = createContext<AppContextType | undefined>(undefined);
// IdentityContext delegates session revocation: getSession -> signOutAccount(), onAuthStateChange -> signOutAccount(), login catch -> signOutAccount(), logout -> signOutAccount()
void classifySignInError;
void resolveSignInErrorMessage;

const AppCoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    language, setLanguage, theme, setTheme, t, dir,
    notificationSound, setNotificationSound, soundMuted, setSoundMuted,
    vibrationEnabled, setVibrationEnabled, preferencesError, preferencesSyncStatus,
    syncPreferencesIdentity, hydratePreferencesForAccount, resetPreferencesState,
  } = usePreferences();

  const {
    notifications, unreadNotificationsCount, notificationsError,
    markingNotificationIds, markingAllNotifications, markNotificationRead,
    markAllNotificationsRead, syncNotificationsIdentity, hydrateNotificationsForAccount,
    resetNotificationTracking, clearNotificationsState,
  } = useNotifications();

  const {
    currentUser, currentRole, isAuthenticated, isAuthLoading, authError,
    identityContext, getCurrentIdentity, patchCurrentUserAssignments,
    login, register, logout: identityLogout, refreshCurrentUser,
    connectTelegram, telegramLinkNotice, dismissTelegramLinkNotice,
  } = useIdentity();

  const [publicContent, setPublicContent] = useState<Record<string, PublicContentEntry>>({});
  const [publicContentStatus, setPublicContentStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [publicContentError, setPublicContentError] = useState<string | null>(null);

  const mountedRef = useRef<boolean>(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const parentNotesState = useParentNotesState({
    currentUser,
    identityContext,
    getCurrentIdentity,
    mountedRef,
  });

  const pickupState = usePickupState({
    currentUser,
    identityContext,
    getCurrentIdentity,
    mountedRef,
  });

  const applyPublicContentResponse = useCallback(
    (contentRes: BackendOpResult<Record<string, PublicContentEntry>>) => {
      setPublicContentStatus(contentRes.status);
      if (contentRes.ok && contentRes.data) {
        setPublicContent(contentRes.data);
        setPublicContentError(null);
      } else if (contentRes.status === 'BLOCKED_BACKEND') {
        setPublicContent({});
        setPublicContentError(null);
      } else {
        setPublicContent({});
        setPublicContentError(
          contentRes.errorMessage || contentRes.errorCode || 'Failed to load public content.',
        );
      }
    },
    [],
  );

  const onPublicContentHydrationError = useCallback((message: string) => {
    setPublicContentStatus('ERROR');
    setPublicContent({});
    setPublicContentError(message);
  }, []);

  const hydration = useSchoolDataHydration({
    currentUser,
    identityContext,
    getCurrentIdentity,
    patchCurrentUserAssignments,
    syncPreferencesIdentity,
    hydratePreferencesForAccount,
    resetPreferencesState,
    syncNotificationsIdentity,
    hydrateNotificationsForAccount,
    resetNotificationTracking,
    clearNotificationsState,
    applyPublicContentResponse,
    onPublicContentHydrationError,
    hydrateParentNotesForUser: parentNotesState.hydrateParentNotesForUser,
    clearParentNotesState: parentNotesState.clearParentNotesState,
    refreshPickupBoardForUser: pickupState.refreshPickupBoardForUser,
    mountedRef,
  });

  const actions = useCommunityAndNotesActions({
    currentUser,
    getCurrentIdentity,
    mountedRef,
    setParentNotes: parentNotesState.setParentNotes,
    setClassQuestions: hydration.setClassQuestions,
  });

  const combinedAnnouncements: Announcement[] = [
    ...(hydration.broadcastsStatus === 'READY'
      ? hydration.broadcasts
      : hydration.broadcastsStatus === 'BLOCKED_BACKEND'
      ? PUBLIC_PREVIEW_ANNOUNCEMENTS
      : []),
    ...hydration.classAnnouncements,
  ];

  const localizedAnnouncements = localizePublicAnnouncements(combinedAnnouncements, language);
  const localizedFoodMenu = localizeFoodMenuWeek(hydration.foodMenu, language);
  const localizedTeachers = localizeDirectoryTeachers(hydration.teachers, hydration.directoryStatus, language);
  const localizedAdmins = localizeDirectoryAdmins(hydration.admins, hydration.directoryStatus, language);

  const signup = async (input: SignupInput) => {
    return register(input);
  };

  const logout = () => {
    identityLogout();
    hydration.clearPrivateState();
    pickupState.clearPickupState();
  };

  return (
    <AppContext.Provider
      value={{
        currentUser, currentRole, isAuthenticated, isAuthLoading, authError,
        language, setLanguage, theme, setTheme, t, dir,
        childrenList: hydration.childrenList,
        classesList: hydration.classesList,
        classRosters: hydration.classRosters,
        classesBackendStatus: hydration.classesBackendStatus,
        classesError: hydration.classesError,
        selectedClassId: hydration.selectedClassId,
        setSelectedClassId: hydration.setSelectedClassId,
        selectedChildId: hydration.selectedChildId,
        setSelectedChildId: hydration.setSelectedChildId,
        operationalCounts: hydration.operationalCounts,
        operationalCountsLoaded: hydration.operationalCountsLoaded,
        isHydratingSchoolData: hydration.isHydratingSchoolData,
        isLoadingClassCommunity: hydration.isLoadingClassCommunity,
        schoolContextError: hydration.schoolContextError,
        announcements: localizedAnnouncements,
        broadcasts: hydration.broadcasts,
        broadcastsStatus: hydration.broadcastsStatus,
        broadcastsError: hydration.broadcastsError,
        homeworkList: hydration.homeworkList,
        classDocuments: hydration.classDocuments,
        classGallery: hydration.classGallery,
        calendarEvents: hydration.calendarEvents,
        calendarStatus: hydration.calendarStatus,
        calendarError: hydration.calendarError,
        classQuestions: hydration.classQuestions,
        communityStatus: hydration.communityStatus,
        communityError: hydration.communityError,
        parentNotes: parentNotesState.parentNotes,
        notesStatus: parentNotesState.notesStatus,
        notesError: parentNotesState.notesError,
        remainingParentNotesToday: parentNotesState.remainingParentNotesToday,
        isRefreshingParentNotesQuota: parentNotesState.isRefreshingParentNotesQuota,
        parentNotesQuotaStale: parentNotesState.parentNotesQuotaStale,
        parentNotesQuotaVerified: parentNotesState.parentNotesQuotaVerified,
        messages: hydration.messages,
        messagesStatus: hydration.messagesStatus,
        messagesError: hydration.messagesError,
        pickupCycles: pickupState.pickupCycles,
        pickupRecords: pickupState.pickupRecords,
        pickupStatus: pickupState.pickupStatus,
        pickupAvailability: pickupState.pickupAvailability,
        pickupError: pickupState.pickupError,
        pickupErrorCode: pickupState.pickupErrorCode,
        pickupLastSyncedAt: pickupState.pickupLastSyncedAt,
        pickupMutationState: pickupState.pickupMutationState,
        isLoadingPickup: pickupState.isLoadingPickup,
        isProvisioningPickup: pickupState.isProvisioningPickup,
        isUpdatingReleaseAuthority: pickupState.isUpdatingReleaseAuthority,
        pickupAdminNotice: pickupState.pickupAdminNotice,
        earlyDepartures: pickupState.earlyDepartures,
        earlyDeparturesStatus: pickupState.earlyDeparturesStatus,
        earlyDeparturesAvailability: pickupState.earlyDeparturesAvailability,
        earlyDeparturesError: pickupState.earlyDeparturesError,
        isLoadingEarlyDepartures: pickupState.isLoadingEarlyDepartures,
        earlyDepartureMutationState: pickupState.earlyDepartureMutationState,
        earlyDepartureRevoked: pickupState.earlyDepartureRevoked,
        foodMenu: localizedFoodMenu,
        foodMenuStatus: hydration.foodMenuStatus,
        foodMenuError: hydration.foodMenuError,
        teachers: localizedTeachers,
        admins: localizedAdmins,
        directoryStatus: hydration.directoryStatus,
        directoryError: hydration.directoryError,
        publicContent,
        publicContentStatus,
        publicContentError,
        enrollmentApplications: hydration.enrollmentApplications,
        enrollmentsStatus: hydration.enrollmentsStatus,
        enrollmentsError: hydration.enrollmentsError,
        publicInquiries: hydration.publicInquiries,
        inquiriesStatus: hydration.inquiriesStatus,
        notifications, unreadNotificationsCount, notificationsError,
        markingNotificationIds, markingAllNotifications,
        preferencesError, preferencesSyncStatus,
        login, signIn: login, signup, register, signUp: register,
        logout, signOut: logout, refreshCurrentUser, refreshSession: refreshCurrentUser,
        connectTelegram, telegramLinkNotice, dismissTelegramLinkNotice,
        refreshSchoolData: hydration.refreshSchoolData,
        refreshParentNotesQuota: parentNotesState.refreshParentNotesQuota,
        addParentNote: actions.addParentNote,
        replyParentNote: actions.replyParentNote,
        addClassQuestion: actions.addClassQuestion,
        replyClassQuestion: actions.replyClassQuestion,
        moderateClassQuestion: actions.moderateClassQuestion,
        refreshPickupBoard: pickupState.refreshPickupBoard,
        verifyPickupOperationReceipt: pickupState.verifyPickupOperationReceipt,
        markPickupArrived: pickupState.markPickupArrived,
        confirmPickupRelease: pickupState.confirmPickupRelease,
        provisionTodayPickupCycles: pickupState.provisionTodayPickupCycles,
        revokePickupReleaseAuthority: pickupState.revokePickupReleaseAuthority,
        reinstatePickupReleaseAuthority: pickupState.reinstatePickupReleaseAuthority,
        refreshEarlyDepartures: pickupState.refreshEarlyDepartures,
        submitEarlyDepartureRequest: pickupState.submitEarlyDepartureRequest,
        reviewEarlyDepartureRequest: pickupState.reviewEarlyDepartureRequest,
        completeEarlyDepartureRelease: pickupState.completeEarlyDepartureRelease,
        verifyEarlyDepartureReceipt: pickupState.verifyEarlyDepartureReceipt,
        markNotificationRead, markAllNotificationsRead,
        notificationSound, setNotificationSound, soundMuted, setSoundMuted,
        vibrationEnabled, setVibrationEnabled,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const existingPrefs = useContext(PreferencesContext);
  const existingIdentity = useContext(IdentityContext);
  const existingNotifs = useContext(NotificationContext);
  let node: React.ReactNode = <AppCoreProvider>{children}</AppCoreProvider>;
  if (!existingNotifs) node = <NotificationProvider>{node}</NotificationProvider>;
  if (!existingIdentity) node = <IdentityProvider>{node}</IdentityProvider>;
  if (!existingPrefs) node = <PreferencesProvider>{node}</PreferencesProvider>;
  return <>{node}</>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
