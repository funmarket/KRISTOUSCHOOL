import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';
const enrollment = await import('../src/lib/domains/enrollment.ts');

test('admission queues separate pending, completion and immutable history using canonical states', () => {
  for (const status of ['SUBMITTED','UNDER_REVIEW','WAITLIST','NEED_DOCUMENTS','WAITLISTED','NEEDS_INFO']) {
    assert.equal(enrollment.getEnrollmentQueue({status,studentId:null}), 'pending');
  }
  assert.equal(enrollment.getEnrollmentQueue({status:'ACCEPTED',studentId:null}), 'completion');
  for (const status of ['ENROLLED','REJECTED','WITHDRAWN']) {
    assert.equal(enrollment.getEnrollmentQueue({status,studentId:'student'}), 'history');
    assert.deepEqual(enrollment.getEnrollmentReviewDecisions(status), []);
  }
  assert.deepEqual(enrollment.getEnrollmentReviewDecisions('SUBMITTED'), ['UNDER_REVIEW']);
  assert.ok(!enrollment.getEnrollmentReviewDecisions('UNDER_REVIEW').includes('ENROLLED'));
});

test('Telegram context and enrollment reads never fall back to anonymous RPC/table access', async () => {
  const {fetchMySchoolContext} = await import('../src/lib/domains/academics.ts');
  globalThis.window = {Telegram:{WebApp:{initData:'test-signed-init-data'}}};
  const calls=[];
  const client={functions:{invoke:async (name,{body})=>{
    calls.push(body.operation);
    return {data:body.operation==='school.context'?{children:[{id:'existing'},{id:'unassigned'}],linkedChildrenIds:['existing','unassigned']}:[],error:null};
  }},rpc(){throw Error('direct RPC forbidden');},from(){throw Error('direct table forbidden');}};
  try {
    assert.equal((await fetchMySchoolContext(client)).data.children.length,2);
    assert.equal((await enrollment.listEnrollmentApplications(client)).ok,true);
    assert.deepEqual(calls,['school.context','enrollment.list']);
    client.functions.invoke=async()=>({error:{context:new Response(JSON.stringify({error:'invalid_telegram_auth'}),{status:401})}});
    assert.equal((await fetchMySchoolContext(client)).ok,false);
  } finally {delete globalThis.window;}
});

test('placement and Family adapters preserve explicit canonical IDs and stale-state tokens',async()=>{
  const {assignExistingStudentToClass}=await import('../src/lib/domains/academics.ts');
  const {reviewStudentGuardian}=await import('../src/lib/domains/family.ts');
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='assign_existing_student_to_class'?{studentId:'student',classId:'class',membershipId:'membership',replayed:false}:{linkId:'link',studentId:'student',replayed:false},error:null};}};
  assert.equal((await assignExistingStudentToClass({studentId:'student',classId:'class',expectedMembershipId:null},client)).ok,true);
  assert.deepEqual(calls[0],{name:'assign_existing_student_to_class',args:{p_student_id:'student',p_class_id:'class'}});
  assert.equal((await reviewStudentGuardian({studentId:'student',linkId:'link',action:'REVOKE',expectedUpdatedAt:'stamp',reason:' reviewed evidence '},client)).ok,true);
  assert.equal(calls[1].args.p_expected_updated_at,'stamp');assert.equal(calls[1].args.p_reason,'reviewed evidence');
  assert.ok(!JSON.stringify(calls).includes('create_and_enroll_student'));
});
