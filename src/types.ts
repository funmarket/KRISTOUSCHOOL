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
  | 'notes'
  | 'messages'
  | 'pickup'
  | 'foodMenu'
  | 'directory'
  | 'classes'
  | 'registration';

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

export interface SchoolClassSummary {
  id: string;
  name: string;
  level: string;
  levelCode?: string;
  academicYear: string;
  homeroomTeacherName: string | null;
  activeStudentCount: number;
  roomLabel?: string | null;
}

export interface ClassStudentRosterItem {
  studentId: string;
  studentCode: string;
  fullName: string;
  enrollmentStatus: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'COMPLETED';
  enrolledAt: string;
  primaryGuardianName?: string | null;
}

export interface SchoolLevelOption {
  code: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  sortOrder: number;
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

export interface Announcement {
  id: string;
  classId?: string; // undefined if school-wide broadcast
  title: string;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  priority: 'NORMAL' | 'URGENT';
  audienceScope?: 'ALL_SCHOOL' | 'ALL_CLASSES' | 'SELECTED_LEVELS' | 'SELECTED_CLASSES' | 'PUBLIC_SITE';
  isPublic?: boolean;
  isDemoPreview?: boolean;
}

export interface SchoolBroadcastItem extends Announcement {
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'REVOKED';
  audienceScope: 'ALL_SCHOOL' | 'ALL_CLASSES' | 'SELECTED_LEVELS' | 'SELECTED_CLASSES' | 'PUBLIC_SITE';
  targetLevelCodes: string[];
  targetClassIds: string[];
  isPublic: boolean;
}

export interface Homework {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueDate: string;
  teacherName: string;
  createdAt: string;
}

export type CalendarEventCategory =
  | 'EXAM'
  | 'TEST'
  | 'EVENT'
  | 'HOLIDAY'
  | 'MEETING'
  | 'CLOSURE'
  | 'ACTIVITY'
  | 'TRIP'
  | 'OTHER';

export interface CalendarEvent {
  id: string;
  classId?: string;
  title: string;
  date: string;
  endDate?: string;
  isAllDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string;
  status?: 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED';
  cancellationReason?: string | null;
  isPublic?: boolean;
  myResponse?: 'ATTENDING' | 'ACKNOWLEDGED' | 'DECLINED' | null;
  category: CalendarEventCategory;
  description: string;
}

export interface ClassDocumentItem {
  id: string;
  classId: string;
  title: string;
  description: string;
  documentUrl: string;
  fileType: string;
  createdAt: string;
}

export interface ClassGalleryItem {
  id: string;
  classId?: string | null;
  title: string;
  caption: string;
  imageUrl: string;
  isPublic: boolean;
  createdAt: string;
}

export interface ClassQuestion {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  content: string; // max 200 chars
  isHidden?: boolean;
  createdAt: string;
  repliesCount: number;
  replies?: ClassQuestionReply[];
}

export interface ClassQuestionReply {
  id: string;
  questionId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ParentNote {
  id: string;
  parentId: string;
  parentName: string;
  childId: string;
  childName: string;
  classId?: string | null;
  teacherId?: string | null;
  topic: 'ABSENCE' | 'HOMEWORK' | 'BEHAVIOR' | 'HEALTH' | 'PICKUP' | 'OTHER';
  content: string;
  schoolDay?: string;
  createdAt: string;
  status: 'SENT' | 'READ' | 'REPLIED';
  replyContent?: string;
  repliedByName?: string;
  repliedAt?: string;
}

export interface MessageThread {
  id: string;
  subject?: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  lastMessage: string;
  updatedAt: string;
  unread: boolean;
  messages: {
    id: string;
    senderId: string;
    senderName?: string;
    content: string; // max 200 chars
    createdAt: string;
  }[];
}

export interface MessageRecipientOption {
  id: string;
  fullName: string;
  role: AccountRole;
}

export type PickupState = 'WAITING' | 'PARENT_ARRIVED' | 'RELEASED';

export interface PickupRecord {
  id: string;
  childId: string;
  childName: string;
  classId: string;
  className: string;
  state: PickupState;
  parentArrivedAt?: string;
  releasedAt?: string;
  releasedBy?: string;
  authorizedPerson: string;
}

export interface FoodMenuItem {
  day: string;
  starter: string;
  main: string;
  side: string;
  dessert: string;
  notes?: string;
}

export interface FoodMenuWeek {
  id: string;
  weekRange: string;
  published: boolean;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  providerName?: string;
  isDemoPreview?: boolean;
  items: FoodMenuItem[];
}

export interface TeacherDirectoryMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string;
  bio: string;
  classes: string[];
  languages: string[];
  isPublished?: boolean;
}

export interface AdminDirectoryMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string;
  bio: string;
  responsibilities: string[];
  isPublished?: boolean;
}

export type EnrollmentApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEED_DOCUMENTS'
  | 'ACCEPTED'
  | 'WAITLIST'
  | 'REJECTED'
  | 'ENROLLED';

export interface EnrollmentApplication {
  id: string;
  referenceCode: string;
  studentFullName: string;
  birthDate: string;
  desiredLevelCode: string;
  parentFullName: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  submittedByUserId?: string | null;
  status: EnrollmentApplicationStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  version: number;
  createdAt: string;
}

export interface PublicInquiryItem {
  id: string;
  senderName: string;
  phone?: string | null;
  email?: string | null;
  subject: string;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  staffResponse?: string | null;
  respondedAt?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'pickup' | 'note' | 'announcement' | 'message' | 'calendar' | 'system';
  targetTab?: string | null;
  targetRefId?: string | null;
}

export interface UserPreferencesState {
  language: Language;
  theme: ThemeMode;
  notificationSound: NotificationSoundOption;
  soundMuted: boolean;
  vibrationEnabled: boolean;
}
