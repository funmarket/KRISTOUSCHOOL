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
