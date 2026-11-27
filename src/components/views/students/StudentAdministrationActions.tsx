import React,{useEffect,useRef,useState} from 'react';
import {useApp} from '../../../context/AppContext';
import {canManageClassesUi} from '../../homepages/homepageAccess';
import {assignExistingStudentToClass} from '../../../lib/domains/academics';
import {listStudentGuardians,reviewStudentGuardian,type StudentGuardianLink} from '../../../lib/domains/family';
import type {SchoolStudentIdentityDetail} from '../../../lib/domains/people';
import {pickText} from '../../../i18n/homepages';
import type {Language} from '../../../types';
import type {AvailableStudentClassItem} from './useStudentsManagement';

interface Props {student:SchoolStudentIdentityDetail;classes:AvailableStudentClassItem[];onChanged:()=>void}
export function StudentAdministrationActions(props:Props) {
  const {currentUser,language,refreshSchoolData}=useApp();
  if(!currentUser || currentUser.accountStatus!=='APPROVED') return null;
  const scope=`${currentUser.id}:${currentUser.role}:${currentUser.capabilities?.join(',')}:${props.student.studentId}`;
  return <Actions key={scope} {...props} language={language} canManage={canManageClassesUi(currentUser)} refreshContext={refreshSchoolData} />;
}
function Actions({student,classes,onChanged,language,canManage,refreshContext}:Props & {language:Language;canManage:boolean;refreshContext:()=>Promise<unknown>}) {
  const [classId,setClassId]=useState('');
  const [guardians,setGuardians]=useState<StudentGuardianLink[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const mounted=useRef(true);
  const text=(en:string,fr:string,ar:string)=>pickText({en,fr,ar,es:en,de:en,pt:en},language);
  async function reloadGuardians() {
    const result=await listStudentGuardians(student.studentId);
    if(!mounted.current) return;
    setGuardians(result.ok?result.data||[]:[]);
    if(!result.ok) setError(result.errorMessage||result.errorCode||text('Guardian links unavailable.','Liens indisponibles.','روابط الأولياء غير متاحة.'));
    setLoading(false);
  }
  useEffect(()=>{
    mounted.current=true;void reloadGuardians();
    return ()=>{mounted.current=false;};
  },[]);
  const changed=async()=>{
    // Refresh the same canonical projections after a confirmed server receipt.
    await refreshContext();
    if(mounted.current) onChanged();
  };
  return <div className="space-y-5 border-t border-gray-200 dark:border-zinc-800 pt-5" data-testid="student-administration-actions">
    {student.status==='ACTIVE' && !student.memberships.some(m=>m.enrollmentStatus==='ACTIVE') && <span className="inline-block px-3 py-1 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold">{text('Unassigned','Non affecté','غير معيّن')}</span>}
    {canManage && student.status==='ACTIVE' && <form className="space-y-3" onSubmit={async e=>{
      e.preventDefault(); if(busy) return;
      const target=classes.find(c=>c.id===classId);if(!target) return;
      const current=student.memberships.find(m=>m.enrollmentStatus==='ACTIVE' && m.academicYearCode===target.academicYear);
      setBusy(true);setError('');setMessage('');
      try {
        const result=await assignExistingStudentToClass({studentId:student.studentId,classId,expectedMembershipId:current?.membershipId||null});
        if(!mounted.current) return;
        if(!result.ok) {setError(result.errorMessage||result.errorCode||'Placement failed.');return;}
        setMessage(text('Class placement saved.','Affectation enregistrée.','تم حفظ التسكين.'));await changed();
      } finally {if(mounted.current) setBusy(false);}
    }}>
      <h3 className="font-bold text-sm">{text('Assign to Class / Change Class','Affecter / Changer de classe','تعيين / تغيير القسم')}</h3>
      <p className="text-xs text-gray-500">{text('The existing student is retained. Previous placement history is preserved.','Le même élève est conservé avec son historique.','يُحفظ سجل التلميذ وتاريخ التسكين السابق.')}</p>
      <label className="block text-xs">{text('Destination class and academic year','Classe et année de destination','القسم والسنة الدراسية')}
        <select required value={classId} onChange={e=>setClassId(e.target.value)} disabled={busy} className="block mt-1 w-full rounded-xl border p-2 bg-white dark:bg-zinc-900">
          <option value="">{text('Select a class','Choisir une classe','اختر قسماً')}</option>
          {classes.map(c=><option key={c.id} value={c.id}>{c.name} · {c.levelCode} · {c.academicYear}</option>)}
        </select>
      </label>
      <button disabled={busy||!classId} className="rounded-xl bg-k-brand text-white px-4 py-2 text-xs font-bold disabled:opacity-50">{text('Confirm Class Placement','Confirmer l’affectation','تأكيد التسكين')}</button>
    </form>}
    <section className="space-y-3">
      <h3 className="font-bold text-sm">{text('Manage Guardians','Gérer les responsables','إدارة الأولياء')}</h3>
      {loading?<p role="status">{text('Loading…','Chargement…','جارٍ التحميل…')}</p>:guardians.length===0?<p className="text-xs">{text('No guardian links recorded. Admission links only explicitly attached Parent accounts.','Aucun lien enregistré. L’admission associe seulement un compte Parent explicite.','لا روابط أولياء مسجلة. القبول يربط حساب الولي المرفق صراحة فقط.')}</p>:guardians.map(link=><div key={link.id} className="p-3 border rounded-xl border-gray-200 dark:border-zinc-800 space-y-2">
        <p className="font-bold text-sm">{link.parentName} · {link.relationshipLabel}</p>
        <p className="text-xs">{!link.active?text('Revoked','Révoqué','ملغى'):link.verified?text('Verified','Vérifié','موثّق'):text('Unverified','Non vérifié','غير موثّق')}</p>
        {canManage && <div className="space-y-2">
          <label className="block text-xs">{text('Verification / revocation reason','Motif de vérification / révocation','سبب التوثيق / الإلغاء')}
            <input disabled={busy} value={reasons[link.id]||''} onChange={e=>setReasons(prev=>({...prev,[link.id]:e.target.value}))} minLength={3} maxLength={500} className="block w-full p-2 border rounded-xl bg-white dark:bg-zinc-900" />
          </label>
          <div className="flex flex-wrap gap-2">{(['VERIFY','REVOKE'] as const).filter(action=>action==='VERIFY'?!(link.active&&link.verified):link.active).map(action=><button type="button" key={action} disabled={busy||(reasons[link.id]?.trim().length||0)<3} className="px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-50" onClick={async()=>{
            setBusy(true);setError('');setMessage('');
            try {
              const result=await reviewStudentGuardian({studentId:student.studentId,linkId:link.id,action,expectedUpdatedAt:link.updatedAt,reason:reasons[link.id]});
              if(!mounted.current) return;
              if(!result.ok) {setError(result.errorMessage||result.errorCode||'Guardian update failed.');await reloadGuardians();return;}
              setMessage(text('Guardian relationship updated.','Lien du responsable mis à jour.','تم تحديث علاقة الولي.'));
              await reloadGuardians();await changed();
            } finally {if(mounted.current) setBusy(false);}
          }}>{action==='VERIFY'?text('Verify Guardian','Vérifier le responsable','توثيق الولي'):text('Revoke Guardian','Révoquer le responsable','إلغاء الولي')}</button>)}</div>
        </div>}
      </div>)}
    </section>
    {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    {message && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}
  </div>;
}
