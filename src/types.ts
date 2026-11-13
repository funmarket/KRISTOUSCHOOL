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

export type AppTab =
  | 'home'
  | 'publicSite'
  | 'community'
  | 'notes'
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
  academicYear: string;
  homeroomTeacherName: string | null;
  activeStudentCount: number;
  roomLabel?: string | null;
}

export interface ClassStudentRosterItem {
  studentId: string;
  studentCode: string;
  fullName: string;
  enrollmentStatus: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN';
  enrolledAt: string;
  primaryGuardianName?: string | null;
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

export interface CalendarEvent {
  id: string;
  classId?: string;
  title: string;
  date: string;
  category: 'TEST' | 'ACTIVITY' | 'MEETING' | 'TRIP' | 'OTHER';
  description: string;
}

export interface ClassQuestion {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  content: string; // max 200 chars
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
  teacherId?: string;
  topic: 'ABSENCE' | 'HOMEWORK' | 'BEHAVIOR' | 'HEALTH' | 'PICKUP' | 'OTHER';
  content: string;
  createdAt: string;
  status: 'SENT' | 'READ' | 'REPLIED';
  replyContent?: string;
}

export interface MessageThread {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  lastMessage: string;
  updatedAt: string;
  unread: boolean;
  messages: {
    id: string;
    senderId: string;
    content: string; // max 200 chars
    createdAt: string;
  }[];
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
}

export interface AdminDirectoryMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string;
  bio: string;
  responsibilities: string[];
}
