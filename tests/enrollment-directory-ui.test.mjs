import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {installNodeDomShim} from './helpers/nodeDomShim.mjs';
const dom=installNodeDomShim();
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url);
async function component(path,name) {
  const out='/tmp/enroll-d02-'+name+'.cjs';
  await build({entryPoints:[path],outfile:out,bundle:true,platform:'node',format:'cjs',jsx:'automatic',
    define:{__KRISTOU_SUPABASE_URL__:'""',__KRISTOU_SUPABASE_PUBLISHABLE_KEY__:'""'},
    plugins:[{name:'lifecycle-test',setup(b){
      b.onResolve({filter:/context\/AppContext$/},()=>({path:'context',namespace:'mock'}));
      b.onResolve({filter:/domains\/(family|academics)$/},a=>({path:a.path.split('/').at(-1),namespace:'mock'}));
      b.onResolve({filter:/domains\/enrollment$/},()=>({path:'enrollment',namespace:'mock'}));
      b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({loader:'js',contents:path==='context'?'export const useApp=()=>globalThis.__D02_CONTEXT;':path==='enrollment'?`
        import {getEnrollmentQueue,getEnrollmentReviewDecisions} from '${process.cwd()}/src/lib/domains/enrollment.ts';
        export {getEnrollmentQueue,getEnrollmentReviewDecisions};
        export const getEnrollmentReviewAccess=async()=>({ok:true,data:true});
        export const completeEnrollmentAdmission=(input)=>globalThis.__D02_COMPLETE(input);
      `:path==='family'?`export const listStudentGuardians=()=>globalThis.__D02_GUARDIANS(); export const reviewStudentGuardian=input=>globalThis.__D02_REVIEW_GUARDIAN(input);`:`export const assignExistingStudentToClass=input=>globalThis.__D02_PLACE(input);`}));
      b.onResolve({filter:/^\//},a=>({path:a.path,namespace:'file'}));
      b.onResolve({filter:/^[^./]/},a=>({path:require.resolve(a.path),external:true}));
    }}]});
  return require(out);
}
const {EnrollmentApplicationsQueueSection}=await component('src/components/views/registration/EnrollmentApplicationsQueueSection.tsx','queues');
const {StudentAdministrationActions}=await component('src/components/views/students/StudentAdministrationActions.tsx','actions');
const app=(id,status)=>({id,status,version:2,studentFullName:'Pupil '+id,referenceCode:id,parentFullName:'Parent',phone:'000000',birthDate:'2018-01-01',desiredLevelCode:'CE1',studentId:status==='ENROLLED'?'student':null,submittedByUserId:'parent-account'});
test('review tabs hide history mutations; accepted completion invokes canonical RPC and refreshes',async()=>{
  const container=dom.document.createElement('div');dom.document.body.appendChild(container);const root=createRoot(container);
  let refreshed=0,completed;
  globalThis.__D02_COMPLETE=async input=>{completed=input;return {ok:true,data:{studentId:'student'}};};
  const props={language:'en',canReview:true,enrollmentApplications:[app('pending','SUBMITTED'),app('accepted','ACCEPTED'),app('done','ENROLLED'),app('rejected','REJECTED')],enrollmentsStatus:'READY',enrollmentsError:null,isHydratingSchoolData:false,notificationIntent:null,notificationUnavailable:false,reviewFeedback:null,reviewDecisionMap:{},setReviewDecisionMap:()=>{},reviewNoteMap:{},setReviewNoteMap:()=>{},reviewingId:null,onReviewSave:()=>{},onRefresh:()=>refreshed++,t:key=>key};
  await act(async()=>root.render(React.createElement(EnrollmentApplicationsQueueSection,props)));
  assert.equal(container.querySelectorAll('select').length,1);
  assert.ok(!container.textContent.includes('Pupil done'));
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes('Completed / History')).click());
  assert.ok(container.textContent.includes('Pupil done'));
  assert.equal(container.querySelectorAll('select').length,0,'history has no status editor');
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes('Accepted — Completion Needed')).click());
  assert.ok(container.textContent.includes('Pupil accepted'));
  assert.ok(!container.textContent.includes('Pupil done'));
  await act(async()=>dom.submitForm(container.querySelector('form')));
  assert.deepEqual(completed,{applicationId:'accepted',expectedVersion:2,verifyGuardian:true});
  assert.equal(refreshed,1);
  await act(async()=>root.unmount());dom.document.body.removeChild(container);
});
test('directory actions place the same unassigned student and verify/revoke an explicit guardian link',async()=>{
  const container=dom.document.createElement('div');dom.document.body.appendChild(container);const root=createRoot(container);
  globalThis.__D02_CONTEXT={currentUser:{id:'office',role:'ADMINISTRATIVE_PERSONNEL',accountStatus:'APPROVED'},language:'en',refreshSchoolData:async()=>{}};
  let placement,review,changed=0;
  globalThis.__D02_PLACE=async input=>{placement=input;return {ok:true};};
  let active=false,verified=false;
  globalThis.__D02_GUARDIANS=async()=>({ok:true,data:[{id:'link',parentName:'Explicit guardian',active,verified,updatedAt:'2026-01-01',parentUserId:'parent',relationshipLabel:'Parent'}]});
  globalThis.__D02_REVIEW_GUARDIAN=async input=>{review=input;active=input.action==='VERIFY';verified=true;return {ok:true};};
  const props={student:{studentId:'same-student',status:'ACTIVE',memberships:[]},classes:[{id:'class',name:'CE1 A',levelCode:'CE1',academicYear:'2026-2027'}],onChanged:()=>changed++};
  await act(async()=>root.render(React.createElement(StudentAdministrationActions,props)));
  assert.ok(container.textContent.includes('Unassigned'));
  await act(async()=>dom.setInputValue(container.querySelector('select'),'class'));
  await act(async()=>dom.submitForm(container.querySelector('form')));
  assert.deepEqual(placement,{studentId:'same-student',classId:'class',expectedMembershipId:null});
  assert.equal(changed,1);
  await act(async()=>dom.setInputValue(container.querySelector('input'),'Verified school evidence'));
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Verify Guardian').click());
  assert.equal(review.linkId,'link');assert.equal(review.action,'VERIFY');assert.equal(review.expectedUpdatedAt,'2026-01-01');
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Revoke Guardian').click());
  assert.equal(review.action,'REVOKE');assert.equal(changed,3);
  globalThis.__D02_CONTEXT={...globalThis.__D02_CONTEXT,currentUser:{id:'reader',role:'MANAGER',accountStatus:'APPROVED',capabilities:['CLASSES_ROSTER_VIEW']}};
  await act(async()=>root.render(React.createElement(StudentAdministrationActions,props)));
  assert.ok(!container.textContent.includes('Confirm Class Placement'));
  assert.ok(!container.textContent.includes('Verify Guardian'));
  assert.ok(!container.textContent.includes('Revoke Guardian'));
  await act(async()=>root.unmount());dom.document.body.removeChild(container);
});
