import { supabase, classifySupabaseError } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import { CANONICAL_SCHOOL_LEVELS } from './academics.ts';
import type { BackendOpResult } from '../../types.ts';

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
  studentId?: string | null;
  status: EnrollmentApplicationStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  version: number;
  createdAt: string;
}

export interface SubmitEnrollmentInput {
  studentFullName: string;
  birthDate: string;
  desiredLevelCode: string;
  parentFullName: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface SubmitEnrollmentReceipt {
  id: string;
  referenceCode: string;
  status: EnrollmentApplicationStatus;
  createdAt: string;
}

export interface ReviewEnrollmentInput {
  applicationId: string;
  decision: Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'>;
  reviewNote?: string;
  expectedVersion: number;
}

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export function validateEnrollmentInput(
  input: SubmitEnrollmentInput,
): { valid: true } | { valid: false; errorCode: string } {
  if (!input.studentFullName || input.studentFullName.trim().length < 2) {
    return { valid: false, errorCode: 'invalid_student_name' };
  }
  if (!input.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate.trim())) {
    return { valid: false, errorCode: 'invalid_birth_date' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input.birthDate.trim() > today) {
    return { valid: false, errorCode: 'invalid_birth_date' };
  }
  const level = (input.desiredLevelCode || '').trim().toUpperCase();
  if (!CANONICAL_SCHOOL_LEVELS.some((l) => l.code === level)) {
    return { valid: false, errorCode: 'invalid_level' };
  }
  if (!input.parentFullName || input.parentFullName.trim().length < 2) {
    return { valid: false, errorCode: 'invalid_parent_name' };
  }
  if (!input.phone || input.phone.trim().length < 6) {
    return { valid: false, errorCode: 'invalid_phone' };
  }
  return { valid: true };
}

export async function submitEnrollmentApplication(
  input: SubmitEnrollmentInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SubmitEnrollmentReceipt>> {
  const check = validateEnrollmentInput(input);
  if (check.valid === false) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: check.errorCode,
      errorMessage: 'Please complete all required admission fields.',
    };
  }
  if (!client) return unavailableResult();
  try {
    const tg = await invokeTelegramPrivateOperation('enrollment.submit', {...input}, client);
    const { data, error } = tg.handled ? {data:tg.data,error:null} : await client.rpc('submit_enrollment_application', {
      p_student_full_name: input.studentFullName.trim(),
      p_birth_date: input.birthDate.trim(),
      p_desired_level_code: input.desiredLevelCode.trim().toUpperCase(),
      p_parent_full_name: input.parentFullName.trim(),
      p_phone: input.phone.trim(),
      p_email: input.email?.trim() || null,
      p_notes: input.notes?.trim() || null,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as SubmitEnrollmentReceipt,
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listEnrollmentApplications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<EnrollmentApplication[]>> {
  if (!client) return unavailableResult();
  try {
    const tg = await invokeTelegramPrivateOperation('enrollment.list', {}, client);
    const { data, error } = tg.handled ? {data:tg.data,error:null} : await client.rpc('list_enrollment_applications');
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    if (!Array.isArray(data)) throw new Error('invalid_enrollment_list');
    const mapped: EnrollmentApplication[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          referenceCode: String(row.reference_code),
          studentFullName: String(row.student_full_name),
          birthDate: String(row.birth_date),
          desiredLevelCode: String(row.desired_level_code),
          parentFullName: String(row.parent_full_name),
          phone: String(row.phone),
          email: row.email ? String(row.email) : null,
          notes: row.notes ? String(row.notes) : null,
          submittedByUserId: row.submitted_by_user_id ? String(row.submitted_by_user_id) : null,
          studentId: row.student_id ? String(row.student_id) : null,
          status: String(row.status) as EnrollmentApplicationStatus,
          reviewNote: row.review_note ? String(row.review_note) : null,
          reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
          version: Number(row.version ?? 1),
          createdAt: String(row.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export interface CompleteEnrollmentAdmissionInput {
  applicationId: string;
  existingStudentId?: string;
  verifyGuardian?: boolean;
  expectedVersion: number;
}

export interface AdmissionCompletionReceipt {
  applicationId: string;
  studentId: string;
  status: 'ENROLLED';
  version: number;
  guardianVerified: boolean;
  replayed: boolean;
}

export async function completeEnrollmentAdmission(
  input: CompleteEnrollmentAdmissionInput,
  client: typeof supabase = supabase,
): Promise<BackendOpResult<AdmissionCompletionReceipt>> {
  if (!client) return unavailableResult();
  try {
    const tg = await invokeTelegramPrivateOperation('enrollment.complete', {...input}, client);
    const { data, error } = tg.handled ? {data:tg.data,error:null} : await client.rpc('complete_enrollment_admission', {
      p_application_id: input.applicationId,
      ...(input.existingStudentId ? { p_existing_student_id: input.existingStudentId } : {}),
      p_verify_guardian: input.verifyGuardian ?? true,
      p_expected_version: input.expectedVersion,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = data as unknown as AdmissionCompletionReceipt | null;
    if (!row || typeof row.studentId !== 'string' || row.applicationId !== input.applicationId ||
        row.status !== 'ENROLLED' || !Number.isInteger(row.version) ||
        typeof row.guardianVerified !== 'boolean' || typeof row.replayed !== 'boolean') {
      return { ok: false, status: 'ERROR', errorCode: 'invalid_admission_receipt', errorMessage: 'Admission result could not be verified. Reload before retrying.' };
    }
    return { ok: true, status: 'READY', data: row };
  } catch (err) { return { ok: false, ...classifySupabaseError(err) }; }
}

export async function reviewEnrollmentApplication(
  input: ReviewEnrollmentInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<
  BackendOpResult<{
    id: string;
    referenceCode: string;
    status: EnrollmentApplicationStatus;
    version: number;
    reviewedAt: string;
  }>
> {
  if (!client) return unavailableResult();
  try {
    const tg = await invokeTelegramPrivateOperation('enrollment.review', {...input}, client);
    const { data, error } = tg.handled ? {data:tg.data,error:null} : await client.rpc('review_enrollment_application', {
      p_application_id: input.applicationId,
      p_decision: input.decision,
      p_review_note: input.reviewNote?.trim() || null,
      p_expected_version: input.expectedVersion,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as {
        id: string;
        referenceCode: string;
        status: EnrollmentApplicationStatus;
        version: number;
        reviewedAt: string;
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export type EnrollmentQueue = 'pending' | 'completion' | 'history';
export function getEnrollmentQueue(app: {status: string; studentId?: string | null}): EnrollmentQueue {
  if (app.status==='ACCEPTED' && !app.studentId) return 'completion';
  return ['DRAFT','SUBMITTED','UNDER_REVIEW','WAITLIST','NEED_DOCUMENTS','WAITLISTED','NEEDS_INFO'].includes(app.status) ? 'pending' : 'history';
}
export function getEnrollmentReviewDecisions(status: string): ReviewEnrollmentInput['decision'][] {
  switch(status) {
    case 'SUBMITTED': return ['UNDER_REVIEW'];
    case 'UNDER_REVIEW': return ['UNDER_REVIEW','NEED_DOCUMENTS','ACCEPTED','WAITLIST','REJECTED'];
    case 'NEED_DOCUMENTS': return ['UNDER_REVIEW'];
    case 'WAITLIST': return ['UNDER_REVIEW','ACCEPTED','REJECTED'];
    default: return [];
  }
}
export async function getEnrollmentReviewAccess(client: typeof supabase = supabase): Promise<BackendOpResult<boolean>> {
  if (!client) return unavailableResult();
  try {
    const tg = await invokeTelegramPrivateOperation<boolean>('enrollment.reviewAccess', {}, client);
    const {data,error} = tg.handled ? {data:tg.data,error:null} : await client.rpc('get_enrollment_review_access');
    if (error) return {ok:false,...classifySupabaseError(error)};
    return {ok:true,status:'READY',data:data===true};
  } catch(error) {return {ok:false,...classifySupabaseError(error)};}
}
