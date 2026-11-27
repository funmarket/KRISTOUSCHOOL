export {
  CANONICAL_SCHOOL_LEVELS,
  type SchoolClassWithRoster,
  type SchoolClassSummary,
  type MySchoolContextPayload,
  type CreateSchoolClassInput,
  type CreateAndEnrollStudentInput,
  type AssignTeacherInput,
  type AcademicYearItem,
  fetchMySchoolContext,
  fetchSchoolClassesWithRosters,
  createSchoolClass,
  createAndEnrollStudent,
  assignTeacherToClass,
  listAcademicYears,
  assignExistingStudentToClass,
} from './domains/academics.ts';

export {
  type SchoolStudentSummary,
  type ListSchoolStudentsResponse,
  type SchoolStudentIdentityDetail,
  listSchoolStudents,
  getSchoolStudentIdentity,
} from './domains/people.ts';

export {
  type SubmitEnrollmentInput,
  type SubmitEnrollmentReceipt,
  type ReviewEnrollmentInput,
  type CompleteEnrollmentAdmissionInput,
  type AdmissionCompletionReceipt,
  validateEnrollmentInput,
  submitEnrollmentApplication,
  listEnrollmentApplications,
  reviewEnrollmentApplication,
  completeEnrollmentAdmission,
  getEnrollmentReviewAccess,
} from './domains/enrollment.ts';

export { listStudentGuardians, reviewStudentGuardian, type StudentGuardianLink } from './domains/family.ts';

export {
  type SubmitPublicInquiryInput,
  submitPublicInquiry,
  listPublicInquiries,
  respondPublicInquiry,
} from './domains/publicInquiry.ts';
