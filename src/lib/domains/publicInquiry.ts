import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult } from '../../types.ts';

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

export interface SubmitPublicInquiryInput {
  senderName: string;
  phone?: string;
  email?: string;
  subject: string;
  message: string;
}

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function submitPublicInquiry(
  input: SubmitPublicInquiryInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; status: string; createdAt: string }>> {
  if (
    input.senderName.trim().length < 2 ||
    input.subject.trim().length < 2 ||
    input.message.trim().length < 5
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_inquiry_input',
      errorMessage: 'Please enter your name, subject, and message (at least 5 characters).',
    };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('submit_public_inquiry', {
      p_sender_name: input.senderName.trim(),
      p_phone: input.phone?.trim() || null,
      p_email: input.email?.trim() || null,
      p_subject: input.subject.trim(),
      p_message: input.message.trim(),
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { id: string; status: string; createdAt: string },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listPublicInquiries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<PublicInquiryItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('public_school_inquiries')
      .select(
        'id, sender_name, phone, email, subject, message, status, staff_response, responded_at, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const mapped: PublicInquiryItem[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          senderName: String(row.sender_name),
          phone: row.phone ? String(row.phone) : null,
          email: row.email ? String(row.email) : null,
          subject: String(row.subject),
          message: String(row.message),
          status: (String(row.status) as PublicInquiryItem['status']) || 'NEW',
          staffResponse: row.staff_response ? String(row.staff_response) : null,
          respondedAt: row.responded_at ? String(row.responded_at) : null,
          createdAt: String(row.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function respondPublicInquiry(
  inquiryId: string,
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED',
  staffResponse: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; status: string; respondedAt: string }>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('respond_public_inquiry', {
      p_inquiry_id: inquiryId,
      p_status: status,
      p_staff_response: staffResponse.trim(),
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { id: string; status: string; respondedAt: string },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
