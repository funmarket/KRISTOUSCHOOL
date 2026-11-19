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
  validateEnrollmentInput,
  submitEnrollmentApplication,
  listEnrollmentApplications,
  reviewEnrollmentApplication,
} from './domains/enrollment.ts';

export {
  type SubmitPublicInquiryInput,
  submitPublicInquiry,
  listPublicInquiries,
  respondPublicInquiry,
} from './domains/publicInquiry.ts';
