export type AccountRole =
  | 'APP_ADMIN'
  | 'MANAGER'
  | 'PARENT'
  | 'STUDENT'
  | 'TEACHER'
  | 'SCHOOL_STAFF'
  | 'ADMINISTRATIVE_PERSONNEL';

export type UserRole = AccountRole;

export type Language = 'ar' | 'fr' | 'en';
export type ThemeMode = 'light' | 'pitch-black';
export type NotificationSoundOption =
  | 'Kristou Bell'
  | 'Soft Chime'
  | 'Classroom Bell'
  | 'Gentle Pop'
  | 'Silent';

export type AccountApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUSPENDED' | 'REVOKED';

export type HomePageKey =
  | 'PUBLIC_HOME'
  | 'PARENT_HOME'
  | 'STUDENT_HOME'
  | 'TEACHER_HOME'
  | 'SCHOOL_STAFF_HOME'
  | 'ADMINISTRATIVE_PERSONNEL_HOME'
  | 'MANAGER_HOME'
  | 'OWNER_HOME'
  | 'APPLICATION_STATUS';

export type CardAvailabilityState =
  | 'AVAILABLE'
  | 'AVAILABLE_READ_ONLY'
  | 'COMING_SOON'
  | 'UNAUTHORIZED'
  | 'BLOCKED_BACKEND';

export type BackendOpStatus =
  | 'READY'
  | 'BLOCKED_BACKEND'
  | 'UNAUTHORIZED'
  | 'ERROR';

export interface BackendOpResult<T> {
  ok: boolean;
  status: BackendOpStatus;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
}

export type AppTab =
  | 'home'
  | 'publicSite'
  | 'community'
  | 'announcements'
  | 'performance'
  | 'attendance'
  | 'notes'
  | 'messages'
  | 'pickup'
  | 'foodMenu'
  | 'directory'
  | 'classes'
  | 'registration'
  | 'students';

export type CommunitySubTab =
  | 'announcements'
  | 'homework'
  | 'calendar'
  | 'questions'
  | 'documents'
  | 'gallery';

export type DirectorySubTab = 'teachers' | 'admin';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: AccountRole;
  email?: string;
  avatarUrl?: string;
  linkedChildrenIds?: string[];
  assignedClassIds?: string[];
  capabilities?: string[];
  telegramLinked?: boolean;
  accountStatus?: AccountApprovalStatus;
  requestedRole?: AccountRole;
}

export interface Child {
  id: string;
  fullName: string;
  classId: string;
  className: string;
  level: string;
  birthDate: string;
  photoUrl: string;
  medicalNotes?: string;
  pickupAuthorizedNames: string[];
}

export interface ClassItem {
  id: string;
  name: string;
  level: string;
  teacherId: string;
  teacherName: string;
  academicYear: string;
  studentCount: number;
}

export interface ApprovedProfileSummary {
  id: string;
  username: string;
  fullName: string;
  role: AccountRole;
}

export interface OperationalCounts {
  activeClasses?: number;
  activeStudents?: number;
  pendingAdmissions?: number;
  openInquiries?: number;
}

export type {
  PickupDurableState, PickupPresentationState, PickupWindowStatus,
  PickupAttendanceEligibility, PickupRevocationStatus, PickupOutboxStatus,
  PickupAvailabilityStatus, PickupBackendStatus, PickupReasonCode,
  PickupAuthorizedCollectorSummary, PickupCycleRecord, PickupReadResult,
  AnnounceArrivalInput, ConfirmReleaseInput, PickupCommandOutcome,
  PickupMutationEntry, PickupRecord,
} from './lib/domains/pickup';
export type { PickupDurableState as PickupState } from './lib/domains/pickup';

export type {
  TeacherSubjectComponentSummary,
  TeacherAllocatedSubjectItem,
  SchoolClassSummary,
  ClassStudentRosterItem,
  SchoolLevelOption,
} from './lib/domains/academics';
export type { Announcement, SchoolBroadcastItem } from './lib/domains/broadcasts';
export type {
  CalendarEventCategory,
  CalendarAudienceMode,
  CalendarEvent,
} from './lib/domains/calendarMutations';
export type {
  Homework,
  ClassDocumentItem,
  ClassGalleryItem,
  ClassQuestion,
  ClassQuestionReply,
} from './lib/domains/classCommunity';
export type { ParentNote } from './lib/domains/parentNotes';
export type { MessageThread, MessageRecipientOption } from './lib/domains/messaging';
export type { FoodMenuItem, FoodMenuWeek } from './lib/domains/foodMenu';
export type { TeacherDirectoryMember, AdminDirectoryMember } from './lib/domains/directory';
export type {
  EnrollmentApplicationStatus,
  EnrollmentApplication,
} from './lib/domains/enrollment';
export type { PublicInquiryItem } from './lib/domains/publicInquiry';
export type { NotificationItem } from './lib/domains/notifications';
export type { UserPreferencesState } from './lib/domains/preferences';
export type { PublicContentEntry } from './lib/domains/publicContent';

export type AttendanceMark = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type AttendanceRegisterStatus = 'DRAFT' | 'SUBMITTED';

export interface AttendanceRegisterEntry {
  studentId: string;
  membershipId: string | null;
  fullName: string;
  studentCode: string;
  mark: AttendanceMark | null;
  internalComment: string;
}

export interface AttendanceRegisterData {
  registerId: string | null;
  academicYearId: string;
  classId: string;
  teacherUserId: string;
  schoolDate: string;
  status: AttendanceRegisterStatus;
  version: number;
  rosterFingerprint: string;
  submittedAt: string | null;
  entries: AttendanceRegisterEntry[];
}

export interface AttendanceEntryDraft {
  mark: AttendanceMark | null;
  internalComment: string;
}

export interface AttendanceSaveEntryPatch {
  studentId: string;
  mark: AttendanceMark | null;
  internalComment?: string;
}

export interface AttendanceSaveReceipt {
  registerId: string;
  version: number;
  status: AttendanceRegisterStatus;
  requestId: string;
}

export interface AttendanceSaveIntent {
  requestId: string;
  payloadSignature: string;
  classId: string;
  schoolDate: string;
  teacherUserId: string | null;
  expectedVersion: number;
  rosterFingerprint: string;
  submit: boolean;
  reason: string | null;
  entries: AttendanceSaveEntryPatch[];
  confirmedSavePendingRefresh: boolean;
}

export interface StudentAttendanceRecord {
  registerId: string;
  classId: string;
  teacherUserId: string;
  schoolDate: string;
  mark: AttendanceMark;
}

export interface AttendanceAuditEvent {
  id: number;
  registerId: string;
  registerVersion: number;
  responsibleTeacherUserId: string;
  actorUserId: string;
  eventType: string;
  reason: string | null;
  beforeState: unknown;
  afterState: unknown;
  recordedAt: string;
}

export interface StudentSelfRecord {
  id: string;
  studentCode: string;
  fullName: string;
}

export interface OfficeAttendanceClassOption {
  id: string;
  name: string;
  levelLabel: string;
  academicYear: string;
  isArchived: boolean;
}

export interface OfficeAttendanceTeacherOption {
  userId: string;
  fullName: string;
  username: string;
  accountStatus: AccountApprovalStatus | null;
  hasActiveAssignmentInClass: Record<string, boolean>;
  hasSavedRegisterInClass: Record<string, boolean>;
  isHomeroomInClass: Record<string, boolean>;
}

export interface OfficeAttendanceRegisterSummary {
  registerId: string;
  classId: string;
  teacherUserId: string;
  schoolDate: string;
  status: AttendanceRegisterStatus;
  version: number;
  submittedAt: string | null;
}

export interface OfficeAttendanceContext {
  classes: OfficeAttendanceClassOption[];
  teachers: OfficeAttendanceTeacherOption[];
  savedRegisters: OfficeAttendanceRegisterSummary[];
  accountNamesById: Record<string, string>;
}
