import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult } from '../../types.ts';
import type { Announcement } from './broadcasts.ts';

export interface Homework {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueDate: string;
  teacherName: string;
  createdAt: string;
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
  authorUserId?: string;
  authorName?: string;
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

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function listClassCommunityContent(
  classId?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<
  BackendOpResult<{
    announcements: Announcement[];
    homework: Homework[];
    questions: ClassQuestion[];
    documents: ClassDocumentItem[];
    gallery: ClassGalleryItem[];
  }>
> {
  if (!client) return unavailableResult();
  try {
    const annQuery = classId
      ? client.from('class_announcements').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      : client.from('class_announcements').select('*').order('created_at', { ascending: false });
    const hwQuery = classId
      ? client.from('class_homework_items').select('*').eq('class_id', classId).order('due_date', { ascending: true })
      : client.from('class_homework_items').select('*').order('due_date', { ascending: true });
    const qQuery = classId
      ? client.from('class_questions').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      : client.from('class_questions').select('*').order('created_at', { ascending: false });
    const docQuery = classId
      ? client.from('class_documents').select('*').eq('class_id', classId).order('created_at', { ascending: false })
      : client.from('class_documents').select('*').order('created_at', { ascending: false });
    const galQuery = classId
      ? client.from('class_gallery_items').select('*').or(`class_id.eq.${classId},class_id.is.null`).order('created_at', { ascending: false })
      : client.from('class_gallery_items').select('*').order('created_at', { ascending: false });

    const [annRes, hwRes, qRes, docRes, galRes] = await Promise.all([
      annQuery,
      hwQuery,
      qQuery,
      docQuery,
      galQuery,
    ]);

    if (annRes.error) return { ok: false, ...classifySupabaseError(annRes.error) };
    if (hwRes.error) return { ok: false, ...classifySupabaseError(hwRes.error) };
    if (qRes.error) return { ok: false, ...classifySupabaseError(qRes.error) };
    if (docRes.error) return { ok: false, ...classifySupabaseError(docRes.error) };
    if (galRes.error) return { ok: false, ...classifySupabaseError(galRes.error) };

    const questionsRows = Array.isArray(qRes.data) ? (qRes.data as Record<string, unknown>[]) : [];
    const questionIds = questionsRows.map((q) => String(q.id));
    const repliesMap = new Map<string, ClassQuestionReply[]>();
    if (questionIds.length > 0) {
      const { data: repRows, error: repErr } = await client
        .from('class_question_replies')
        .select('*')
        .in('question_id', questionIds)
        .order('created_at', { ascending: true });
      if (repErr) return { ok: false, ...classifySupabaseError(repErr) };
      if (Array.isArray(repRows)) {
        for (const r of repRows as Record<string, unknown>[]) {
          const qid = String(r.question_id);
          const list = repliesMap.get(qid) ?? [];
          list.push({
            id: String(r.id),
            questionId: qid,
            authorId: String(r.author_user_id || r.author_id || ''),
            authorName: String(r.author_name ?? 'School Member'),
            content: String(r.content || r.body || ''),
            createdAt: String(r.created_at),
          });
          repliesMap.set(qid, list);
        }
      }
    }

    const announcements: Announcement[] = Array.isArray(annRes.data)
      ? annRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: r.class_id ? String(r.class_id) : undefined,
          title: String(r.title),
          body: String(r.body),
          priority: r.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
          authorName: String(r.author_name ?? 'Teacher'),
          authorRole: String(r.author_role ?? 'TEACHER'),
          createdAt: String(r.created_at),
        }))
      : [];

    const homework: Homework[] = Array.isArray(hwRes.data)
      ? hwRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: String(r.class_id),
          title: String(r.title),
          description: String(r.description || r.body || ''),
          dueDate: String(r.due_date),
          teacherName: String(r.teacher_name ?? 'Teacher'),
          createdAt: String(r.created_at),
        }))
      : [];

    const questions: ClassQuestion[] = questionsRows.map((r) => {
      const reps = repliesMap.get(String(r.id)) ?? [];
      const authorUserId = typeof r.author_user_id === 'string' ? r.author_user_id : '';
      const authorName = typeof r.author_name === 'string' ? r.author_name : '';
      return {
        id: String(r.id),
        classId: String(r.class_id),
        authorUserId,
        authorName,
        studentId: typeof r.student_id === 'string' ? r.student_id : '',
        studentName: typeof r.student_name === 'string' && r.student_name ? r.student_name : authorName,
        content: String(r.content || r.body || r.title || ''),
        isHidden: Boolean(r.is_hidden),
        createdAt: String(r.created_at),
        repliesCount: reps.length,
        replies: reps,
      };
    });

    const documents: ClassDocumentItem[] = Array.isArray(docRes.data)
      ? docRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: String(r.class_id),
          title: String(r.title),
          description: String(r.description || ''),
          documentUrl: String(r.file_url || r.document_url || ''),
          fileType: r.file_type ? String(r.file_type) : 'pdf',
          createdAt: String(r.created_at),
        }))
      : [];

    const gallery: ClassGalleryItem[] = Array.isArray(galRes.data)
      ? galRes.data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          classId: r.class_id ? String(r.class_id) : undefined,
          title: String(r.title),
          caption: String(r.caption || ''),
          imageUrl: String(r.image_url),
          isPublic: Boolean(r.is_public),
          createdAt: String(r.created_at),
        }))
      : [];

    return {
      ok: true,
      status: 'READY',
      data: { announcements, homework, questions, documents, gallery },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function createClassAnnouncement(
  classIdOrInput: string | undefined | { classId?: string; title: string; body: string; priority?: 'NORMAL' | 'URGENT' },
  titleOrClient?: string | any,
  bodyOrClient?: string | any,
  priorityOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<Announcement>> {
  const input = typeof classIdOrInput === 'object' && classIdOrInput !== null
    ? classIdOrInput
    : {
        classId: classIdOrInput,
        title: String(titleOrClient || ''),
        body: String(bodyOrClient || ''),
        priority: (priorityOrClient === 'URGENT' ? 'URGENT' : 'NORMAL'),
      };
  const client = typeof classIdOrInput === 'object' && classIdOrInput !== null ? titleOrClient : maybeClient;
  const activeClient = client || supabase;

  const classId = typeof input.classId === 'string' ? input.classId.trim() : '';
  if (!classId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'class_id_required',
      errorMessage: 'Class selection is required for class announcements.',
    };
  }
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('create_class_announcement', {
      p_class_id: classId,
      p_title: input.title.trim(),
      p_body: input.body.trim(),
      p_priority: input.priority ?? 'NORMAL',
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id || ''),
        classId: r.class_id ? String(r.class_id) : undefined,
        title: String(r.title || input.title),
        body: String(r.body || input.body),
        priority: r.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
        authorName: String(r.author_name ?? 'Teacher'),
        authorRole: String(r.author_role ?? 'TEACHER'),
        createdAt: String(r.created_at || new Date().toISOString()),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function createClassHomework(
  classIdOrInput: string | { classId: string; title: string; description: string; dueDate: string },
  titleOrClient?: string | any,
  descOrClient?: string | any,
  dueOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<Homework>> {
  const input = typeof classIdOrInput === 'object' && classIdOrInput !== null
    ? classIdOrInput
    : {
        classId: String(classIdOrInput || ''),
        title: String(titleOrClient || ''),
        description: String(descOrClient || ''),
        dueDate: String(dueOrClient || new Date().toISOString().slice(0, 10)),
      };
  const client = typeof classIdOrInput === 'object' && classIdOrInput !== null ? titleOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('create_class_homework', {
      p_class_id: input.classId,
      p_title: input.title.trim(),
      p_description: input.description.trim(),
      p_due_date: input.dueDate,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id || ''),
        classId: String(r.class_id || input.classId),
        title: String(r.title || input.title),
        description: String(r.description || input.description),
        dueDate: String(r.due_date || input.dueDate),
        teacherName: String(r.teacher_name ?? 'Teacher'),
        createdAt: String(r.created_at || new Date().toISOString()),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function postClassQuestion(
  classIdOrInput: string | { classId: string; content: string },
  contentOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<ClassQuestion>> {
  const input = typeof classIdOrInput === 'object' && classIdOrInput !== null
    ? classIdOrInput
    : { classId: String(classIdOrInput || ''), content: String(contentOrClient || '') };
  const client = typeof classIdOrInput === 'object' && classIdOrInput !== null ? contentOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('post_class_question', {
      p_class_id: input.classId,
      p_content: input.content.trim(),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    const authorUserId = typeof r.author_user_id === 'string' ? r.author_user_id : '';
    const authorName = typeof r.author_name === 'string' ? r.author_name : '';
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id || ''),
        classId: String(r.class_id || input.classId),
        authorUserId,
        authorName,
        studentId: typeof r.student_id === 'string' ? r.student_id : '',
        studentName: typeof r.student_name === 'string' && r.student_name ? r.student_name : authorName,
        content: String(r.content || input.content),
        createdAt: String(r.created_at || new Date().toISOString()),
        repliesCount: 0,
        replies: [],
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function replyClassQuestion(
  questionIdOrInput: string | { questionId: string; content: string },
  contentOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<ClassQuestionReply>> {
  const input = typeof questionIdOrInput === 'object' && questionIdOrInput !== null
    ? questionIdOrInput
    : { questionId: String(questionIdOrInput || ''), content: String(contentOrClient || '') };
  const client = typeof questionIdOrInput === 'object' && questionIdOrInput !== null ? contentOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('reply_class_question', {
      p_question_id: input.questionId,
      p_content: input.content.trim(),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id || ''),
        questionId: String(r.question_id || input.questionId),
        authorId: String(r.author_user_id ?? r.author_id ?? ''),
        authorName: typeof r.author_name === 'string' ? r.author_name : '',
        content: String(r.content || input.content),
        createdAt: String(r.created_at || new Date().toISOString()),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function moderateClassQuestion(
  questionIdOrInput: string | { questionId: string; isHidden: boolean },
  hiddenOrClient?: boolean | any,
  maybeClient?: any,
): Promise<BackendOpResult<{ id: string; isHidden: boolean }>> {
  const input = typeof questionIdOrInput === 'object' && questionIdOrInput !== null
    ? questionIdOrInput
    : { questionId: String(questionIdOrInput || ''), isHidden: Boolean(hiddenOrClient) };
  const client = typeof questionIdOrInput === 'object' && questionIdOrInput !== null ? hiddenOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('moderate_class_question', {
      p_question_id: input.questionId,
      p_hidden: Boolean(input.isHidden),
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: { id: String(r.id || input.questionId), isHidden: Boolean(r.is_hidden ?? input.isHidden) },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
