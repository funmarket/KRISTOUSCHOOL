import React,{useState} from 'react';
import {completeEnrollmentAdmission,type EnrollmentApplication} from '../../../lib/domains/enrollment';
import type {Language} from '../../../types';
import {pickText} from '../../../i18n/homepages';

export function CompleteAdmissionForm({application,language,onCompleted}:{application:EnrollmentApplication;language:Language;onCompleted:()=>void}) {
  const [mode,setMode]=useState<'new'|'existing'>('new');
  const [studentId,setStudentId]=useState('');
  const [verify,setVerify]=useState(Boolean(application.submittedByUserId));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const text=(en:string,fr:string,ar:string)=>pickText({en,fr,ar,es:en,de:en,pt:en},language);
  return <form className="space-y-3 border-t border-gray-200 dark:border-zinc-800 pt-3" onSubmit={async event=>{
    event.preventDefault(); if(busy) return;
    setBusy(true);setError('');
    try {
      const result=await completeEnrollmentAdmission({applicationId:application.id,expectedVersion:application.version,verifyGuardian:verify,
        ...(mode==='existing'?{existingStudentId:studentId.trim()}:{}),});
      if(!result.ok) {setError(result.errorMessage||result.errorCode||text('Completion failed. Reload before retrying.','Échec. Rechargez avant de réessayer.','تعذر الإتمام. أعد التحميل.'));return;}
      onCompleted();
    } finally {setBusy(false);}
  }}>
    <p className="text-xs">{text('Admission creates or links one student. Class placement is separate.','L’admission crée ou associe un élève. L’affectation se fait séparément.','القبول ينشئ أو يربط تلميذاً واحداً. التسكين في قسم منفصل.')}</p>
    <label className="block text-xs font-bold">{text('Student record','Dossier élève','سجل التلميذ')}
      <select disabled={busy} value={mode} onChange={e=>setMode(e.target.value as 'new'|'existing')} className="block w-full rounded-xl p-2 bg-white dark:bg-zinc-900 border">
        <option value="new">{text('Create a new student','Créer un élève','إنشاء تلميذ جديد')}</option>
        <option value="existing">{text('Link an existing student','Associer un élève existant','ربط تلميذ موجود')}</option>
      </select>
    </label>
    {mode==='existing' && <label className="block text-xs">{text('Existing student UUID (explicit selection)','UUID de l’élève existant (sélection explicite)','معرّف التلميذ الموجود (اختيار صريح)')}
      <input required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={studentId} onChange={e=>setStudentId(e.target.value)} disabled={busy} className="block w-full rounded-xl p-2 border bg-white dark:bg-zinc-900" />
    </label>}
    {application.submittedByUserId ? <label className="flex items-start gap-2 text-xs">
      <input type="checkbox" checked={verify} disabled={busy} onChange={e=>setVerify(e.target.checked)} />
      <span>{text('Verify the attached Parent account as guardian; contact text is never used for matching.','Vérifier le compte Parent associé comme responsable ; aucun rapprochement par coordonnées.','تأكيد حساب الولي المرفق؛ لا مطابقة بالاسم أو بيانات الاتصال.')} <span className="font-mono break-all">{application.submittedByUserId}</span></span>
    </label>:<p className="text-xs">{text('No attached Parent account. No guardian will be inferred.','Aucun compte Parent associé. Aucun responsable ne sera déduit.','لا حساب ولي مرفق. لن يتم استنتاج علاقة ولي.')}</p>}
    {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    <button disabled={busy} className="px-4 py-2 rounded-xl bg-k-brand text-white text-xs font-bold disabled:opacity-50">{busy?text('Completing…','Finalisation…','جارٍ الإتمام…'):text('Complete Admission','Finaliser l’admission','إتمام القبول')}</button>
  </form>;
}
