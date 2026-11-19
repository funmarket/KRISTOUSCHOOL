export { listSchoolCalendarEvents } from './calendar/calendarQueries.ts';
export {
  getMonthCalendarRange,
  sortCalendarEvents,
  getEventsForCalendarDate,
  isWholeSchoolCalendarEvent,
  getVisibleCalendarTargetClassIds,
  calendarEventMatchesClassScope,
  calendarEventMatchesAuthorizedClasses,
} from './calendar/calendarModel.ts';
export {
  resolveCalendarAudiencePlan,
  validateCalendarCreateInput,
  type CalendarAudienceMode,
  type CalendarAudienceOptionDescriptor,
  type CalendarAudiencePlan,
  type CalendarAudienceUnavailableReason,
  type CalendarClassOption,
  type CalendarCreateValidationResult,
  type CalendarTeacherOption,
} from './calendar/calendarAudience.ts';

export {
  upsertSchoolCalendarEvent,
  cancelSchoolCalendarEvent,
  respondToCalendarEvent,
} from './domains/calendarMutations.ts';

export {
  PARENT_NOTES_DAILY_QUOTA,
  getTunisTimeParts,
  isWithinParentNotesTunisWindow,
  getTunisSchoolDay,
  getParentNotesQuotaDay,
  getRemainingParentNotesQuota,
  validateParentNoteSubmission,
  listParentNotes,
  sendParentNote,
  replyParentNote,
} from './domains/parentNotes.ts';

export {
  SHORT_MESSAGE_MAX_CHARS,
  countUnreadThreads,
  validateShortMessageContent,
  canParticipantMessage,
  listMessageThreads,
  listApprovedMessageRecipients,
  sendOperationalMessage,
  replyOperationalThread,
} from './domains/messaging.ts';

export {
  listSchoolBroadcasts,
  publishSchoolBroadcast,
} from './domains/broadcasts.ts';

export {
  listClassCommunityContent,
  createClassAnnouncement,
  createClassHomework,
  postClassQuestion,
  replyClassQuestion,
  moderateClassQuestion,
} from './domains/classCommunity.ts';

export {
  listSchoolDirectory,
  listPublicDirectory,
  upsertDirectoryEntry,
} from './domains/directory.ts';

export {
  listFoodMenus,
  fetchActiveFoodMenu,
  saveFoodMenuWeek,
} from './domains/foodMenu.ts';

export {
  listNotifications,
  listMyNotifications,
  markNotificationReadOnServer,
  markAllNotificationsReadOnServer,
} from './domains/notifications.ts';

export {
  fetchUserPreferences,
  updateUserPreferences,
  loadMyPreferences,
  saveMyPreferences,
} from './domains/preferences.ts';

export {
  listPublicContent,
  fetchPublicContent,
} from './domains/publicContent.ts';

export function isSafeExternalOrAssetUrl(rawUrl: string | null | undefined): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/assets/') && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
