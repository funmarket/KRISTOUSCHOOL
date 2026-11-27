import {supabase,classifySupabaseError} from '../supabase.ts';
import {invokeTelegramPrivateOperation} from '../telegramPrivateOperations.ts';
import type {BackendOpResult} from '../../types.ts';

export interface StudentGuardianLink {
  id:string; parentUserId:string; parentName:string; relationshipLabel:string;
  active:boolean; verified:boolean; updatedAt:string;
}
export async function listStudentGuardians(studentId:string, client:typeof supabase=supabase):Promise<BackendOpResult<StudentGuardianLink[]>> {
  if (!client) return {ok:false,status:'BLOCKED_BACKEND',errorCode:'backend_unavailable'};
  try {
    const tg=await invokeTelegramPrivateOperation<StudentGuardianLink[]>('family.guardians',{studentId},client);
    const {data,error}=tg.handled?{data:tg.data,error:null}:await client.rpc('list_student_guardians',{p_student_id:studentId});
    if(error) return {ok:false,...classifySupabaseError(error)};
    if(!Array.isArray(data)) throw new Error('invalid_guardians_response');
    return {ok:true,status:'READY',data:data as unknown as StudentGuardianLink[]};
  } catch(error){return {ok:false,...classifySupabaseError(error)};}
}
export async function reviewStudentGuardian(input:{studentId:string;linkId:string;action:'VERIFY'|'REVOKE';expectedUpdatedAt:string;reason:string},client:typeof supabase=supabase):Promise<BackendOpResult<{linkId:string;studentId:string;replayed:boolean}>> {
  if(!client) return {ok:false,status:'BLOCKED_BACKEND',errorCode:'backend_unavailable'};
  try {
    const tg=await invokeTelegramPrivateOperation('family.reviewGuardian',input,client);
    const {data,error}=tg.handled?{data:tg.data,error:null}:await client.rpc('review_student_guardian',{
      p_student_id:input.studentId,p_link_id:input.linkId,p_action:input.action,p_expected_updated_at:input.expectedUpdatedAt,p_reason:input.reason.trim(),
    });
    if(error) return {ok:false,...classifySupabaseError(error)};
    const row=data as {linkId:string;studentId:string;replayed:boolean}|null;
    if(!row||row.linkId!==input.linkId||row.studentId!==input.studentId) throw new Error('invalid_guardian_receipt');
    return {ok:true,status:'READY',data:row};
  } catch(error){return {ok:false,...classifySupabaseError(error)};}
}
