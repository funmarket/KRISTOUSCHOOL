import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { pickText } from '../../../i18n/homepages';
import { fetchAttendanceRegister, saveAttendanceRegister } from '../../../lib/attendance/api';
import { getTunisTodayIsoDate } from '../../../lib/attendance/dateUtils';
import {
  buildAttendanceEntriesPayload,
  cloneAttendanceDraft,
  isAttendanceRegisterResultApplicable,
  reconcileConflictWithFreshRegister,
  resolveAttendanceSaveIntent,
  type AttendanceAccessMode,
} from '../../../lib/attendance/logic';
import type {
  AttendanceEntryDraft, AttendanceRegisterData, AttendanceSaveIntent, AttendanceSaveReceipt, BackendOpStatus, Language,
} from '../../../types';

export interface ScopedRegisterState {
  actorScopeKey: string; accessMode: AttendanceAccessMode; classId: string;
  schoolDate: string; teacherUserId: string; status: BackendOpStatus | 'LOADING' | 'IDLE';
  data: AttendanceRegisterData | null; errorCode: string | null; errorMessage: string | null;
}

export interface PendingConflictRecovery {
  actorScopeKey: string; accessMode: AttendanceAccessMode; classId: string;
  schoolDate: string; teacherUserId: string; conflictKind: 'version_conflict' | 'roster_conflict';
  previousRegister: AttendanceRegisterData; unsavedDraftByStudentId: Record<string, AttendanceEntryDraft>;
  unsavedReasonText: string; refreshErrorMessage: string | null;
}

export interface ConflictBannerState {
  kind: 'version_conflict' | 'roster_conflict'; droppedCount: number; addedNames: string[];
}

export interface SaveFeedbackState {
  type: 'success' | 'error' | 'warning'; text: string;
}

export function doesRecoveryMatchScope(
  recovery: PendingConflictRecovery | null,
  snap: { actorScopeKey: string; accessMode: AttendanceAccessMode; classId: string; schoolDate: string; teacherUserId: string },
): recovery is PendingConflictRecovery {
  return Boolean(
    recovery &&
      recovery.actorScopeKey === snap.actorScopeKey &&
      recovery.accessMode === snap.accessMode &&
      recovery.classId === snap.classId &&
      recovery.schoolDate === snap.schoolDate &&
      recovery.teacherUserId === snap.teacherUserId,
  );
}

interface UseRegisterDraftAndSaveParams {
  actorScopeKey: string; accessMode: AttendanceAccessMode; isOffice: boolean;
  activeClassId: string; schoolDate: string; activeTeacherUserIdParam: string;
  canReadRegisterNow: boolean; language: Language; t: (key: any) => string;
  mountedRef: MutableRefObject<boolean>; auditRegisterIdRef: MutableRefObject<string>;
  invalidateAuditState: (nextActorScopeKey: string) => void; showAuditPanel: boolean;
  loadAuditHistory: (registerId: string) => Promise<void>; onOfficeSaved: () => void;
}

export function useRegisterDraftAndSave(params: UseRegisterDraftAndSaveParams) {
  const {
    actorScopeKey, accessMode, isOffice, activeClassId, schoolDate, activeTeacherUserIdParam,
    canReadRegisterNow, language, t, mountedRef, auditRegisterIdRef,
    invalidateAuditState, showAuditPanel, loadAuditHistory, onOfficeSaved,
  } = params;

  const [draftByStudentId, setDraftByStudentId] = useState<Record<string, AttendanceEntryDraft>>({});
  const [reasonText, setReasonText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState | null>(null);
  const [confirmedSavePendingRefresh, setConfirmedSavePendingRefresh] = useState<AttendanceSaveReceipt | null>(null);
  const [conflictBanner, setConflictBanner] = useState<ConflictBannerState | null>(null);
  const [pendingConflictRecovery, setPendingConflictRecoveryState] = useState<PendingConflictRecovery | null>(null);
  const [isRetryingConflictRefresh, setIsRetryingConflictRefresh] = useState<boolean>(false);
  const [registerState, setRegisterState] = useState<ScopedRegisterState>(() => ({
    actorScopeKey, accessMode, classId: '', schoolDate: getTunisTodayIsoDate(),
    teacherUserId: '', status: 'IDLE', data: null, errorCode: null, errorMessage: null,
  }));

  const registerSeqRef = useRef<number>(0);
  const inFlightSaveRef = useRef<boolean>(false);
  const pendingIntentRef = useRef<AttendanceSaveIntent | null>(null);
  const pendingConflictRecoveryRef = useRef<PendingConflictRecovery | null>(null);
  const prevRegisterScopeRef = useRef<string>(actorScopeKey);

  const setPendingConflictRecovery = useCallback((next: PendingConflictRecovery | null) => {
    pendingConflictRecoveryRef.current = next;
    setPendingConflictRecoveryState(next);
  }, []);

  const cancelRegisterRequests = useCallback(() => {
    registerSeqRef.current += 1;
  }, []);

  const currentSnapshotRef = useRef({
    actorScopeKey, accessMode, classId: activeClassId, schoolDate,
    teacherUserId: activeTeacherUserIdParam, canReadRegisterNow,
  });
  currentSnapshotRef.current = {
    actorScopeKey, accessMode, classId: activeClassId, schoolDate,
    teacherUserId: activeTeacherUserIdParam, canReadRegisterNow,
  };

  const clearDraftAndConflict = useCallback((nextScope: string) => {
    pendingIntentRef.current = null;
    setPendingConflictRecovery(null);
    setIsRetryingConflictRefresh(false);
    invalidateAuditState(nextScope);
    setDraftByStudentId({});
    setReasonText('');
    setSaveFeedback(null);
    setConfirmedSavePendingRefresh(null);
    setConflictBanner(null);
  }, [invalidateAuditState, setPendingConflictRecovery]);

  useEffect(() => {
    if (prevRegisterScopeRef.current !== actorScopeKey) {
      prevRegisterScopeRef.current = actorScopeKey;
      registerSeqRef.current += 1;
      inFlightSaveRef.current = false;
      clearDraftAndConflict(actorScopeKey);
      setIsSaving(false);
    }
  }, [actorScopeKey, clearDraftAndConflict]);

  const loadRegister = useCallback(
    async (options?: { preserveDraftOnSuccess?: boolean; recoverySnapshot?: PendingConflictRecovery }) => {
      const snap = currentSnapshotRef.current;
      const seq = ++registerSeqRef.current;
      const baseScope = {
        actorScopeKey: snap.actorScopeKey, accessMode: snap.accessMode,
        classId: snap.classId, schoolDate: snap.schoolDate, teacherUserId: snap.teacherUserId,
      };

      if (!snap.canReadRegisterNow || !snap.classId) {
        setPendingConflictRecovery(null);
        setIsRetryingConflictRefresh(false);
        invalidateAuditState(snap.actorScopeKey);
        setRegisterState({ ...baseScope, status: 'IDLE', data: null, errorCode: null, errorMessage: null });
        return { ok: false as const, data: null };
      }

      const candidateRecovery = options?.recoverySnapshot ?? pendingConflictRecoveryRef.current;
      const activeRecovery = doesRecoveryMatchScope(candidateRecovery, snap) ? candidateRecovery : null;

      if (activeRecovery) {
        setIsRetryingConflictRefresh(true);
        setRegisterState({ ...baseScope, status: 'READY', data: activeRecovery.previousRegister, errorCode: null, errorMessage: null });
      } else {
        setRegisterState({ ...baseScope, status: 'LOADING', data: null, errorCode: null, errorMessage: null });
      }

      const res = await fetchAttendanceRegister({
        classId: snap.classId, schoolDate: snap.schoolDate,
        teacherUserId: snap.teacherUserId || undefined, language,
      });

      const cur = currentSnapshotRef.current;
      const isApplicable = isAttendanceRegisterResultApplicable({
        isMounted: mountedRef.current, requestSeq: seq, currentRequestSeq: registerSeqRef.current,
        originActorScopeKey: snap.actorScopeKey, originClassId: snap.classId,
        originSchoolDate: snap.schoolDate, originTeacherUserId: snap.teacherUserId,
        currentActorScopeKey: cur.actorScopeKey, currentAccessMode: cur.accessMode,
        currentClassId: cur.classId, currentSchoolDate: cur.schoolDate, currentTeacherUserId: cur.teacherUserId,
      });
      if (!isApplicable) {
        if (mountedRef.current && seq === registerSeqRef.current) setIsRetryingConflictRefresh(false);
        return { ok: false as const, data: null };
      }

      setIsRetryingConflictRefresh(false);

      if (!res.ok || !res.data) {
        const errCode = res.errorCode || null;
        const errMsg = res.errorMessage || res.errorCode || null;
        if (res.status === 'UNAUTHORIZED') {
          setPendingConflictRecovery(null);
          setDraftByStudentId({});
          setReasonText('');
          pendingIntentRef.current = null;
          invalidateAuditState(snap.actorScopeKey);
          setRegisterState({ ...baseScope, status: 'UNAUTHORIZED', data: null, errorCode: errCode, errorMessage: errMsg });
          return { ok: false as const, data: null };
        }

        if (activeRecovery) {
          const refreshErr =
            errMsg ||
            pickText({ ar: 'تعذر تحديث السجل من الخادم. تم الاحتفاظ بمسودتك للمحاولة مجدداً.', fr: 'Impossible d’actualiser le registre. Votre brouillon est conservé pour réessayer.', en: 'Could not refresh the latest register. Your unsaved edits are preserved to retry safely.', es: 'No se pudo actualizar el último registro. Sus cambios sin guardar se conservan para reintentar.', de: 'Das aktuelle Register konnte nicht geladen werden. Ihre Entwürfe bleiben zum sicheren Wiederholen erhalten.', pt: 'Não foi possível atualizar o último registo. As suas edições foram guardadas para tentar novamente.' }, language);
          setPendingConflictRecovery({ ...activeRecovery, refreshErrorMessage: refreshErr });
          setDraftByStudentId(cloneAttendanceDraft(activeRecovery.unsavedDraftByStudentId));
          setReasonText(activeRecovery.unsavedReasonText);
          pendingIntentRef.current = null;
          setRegisterState({ ...baseScope, status: 'READY', data: activeRecovery.previousRegister, errorCode: null, errorMessage: null });
          return { ok: false as const, data: null };
        }

        invalidateAuditState(snap.actorScopeKey);
        setRegisterState({ ...baseScope, status: res.status, data: null, errorCode: errCode, errorMessage: errMsg });
        return { ok: false as const, data: null };
      }

      if (activeRecovery) {
        const reconciled = reconcileConflictWithFreshRegister(
          res.data, activeRecovery.unsavedDraftByStudentId, activeRecovery.previousRegister.entries,
        );
        setPendingConflictRecovery(null);
        pendingIntentRef.current = null;
        setDraftByStudentId(reconciled.preservedDraftByStudentId);
        setReasonText(res.data.status === 'SUBMITTED' ? activeRecovery.unsavedReasonText : '');
        setSaveFeedback(null);
        setConflictBanner({
          kind: activeRecovery.conflictKind,
          droppedCount: reconciled.droppedStudentIds.length,
          addedNames: reconciled.addedUnmarkedStudentNames,
        });
      } else if (!options?.preserveDraftOnSuccess) {
        setDraftByStudentId({});
        setReasonText('');
        pendingIntentRef.current = null;
      }

      if ((res.data.registerId ?? '') !== auditRegisterIdRef.current) invalidateAuditState(snap.actorScopeKey);
      setConfirmedSavePendingRefresh(null);
      setRegisterState({ ...baseScope, status: 'READY', data: res.data, errorCode: null, errorMessage: null });
      return { ok: true as const, data: res.data };
    },
    [auditRegisterIdRef, invalidateAuditState, language, mountedRef, setPendingConflictRecovery],
  );

  useEffect(() => {
    clearDraftAndConflict(actorScopeKey);
    void loadRegister();
  }, [actorScopeKey, accessMode, activeClassId, schoolDate, activeTeacherUserIdParam, canReadRegisterNow, loadRegister, clearDraftAndConflict]);

  const isRegisterScopeSynced =
    registerState.actorScopeKey === actorScopeKey &&
    registerState.accessMode === accessMode &&
    registerState.classId === activeClassId &&
    registerState.schoolDate === schoolDate &&
    registerState.teacherUserId === activeTeacherUserIdParam;

  const visibleRegister: AttendanceRegisterData | null =
    isRegisterScopeSynced && registerState.status === 'READY' ? registerState.data : null;

  const activeRecoveryForScope = doesRecoveryMatchScope(pendingConflictRecovery, {
    actorScopeKey, accessMode, classId: activeClassId, schoolDate, teacherUserId: activeTeacherUserIdParam,
  })
    ? pendingConflictRecovery
    : null;
  const isConflictRecoveryActive = Boolean(activeRecoveryForScope);

  const resetDraftForContextSwitch = useCallback(() => {
    clearDraftAndConflict(actorScopeKey);
  }, [actorScopeKey, clearDraftAndConflict]);

  const discardConflictDraftAndReload = useCallback(() => {
    setPendingConflictRecovery(null);
    setDraftByStudentId({});
    setReasonText('');
    pendingIntentRef.current = null;
    void loadRegister();
  }, [loadRegister, setPendingConflictRecovery]);

  const handleSaveOrSubmit = async (submit: boolean) => {
    if (!visibleRegister || inFlightSaveRef.current || confirmedSavePendingRefresh || isConflictRecoveryActive) return;

    const payloadResult = buildAttendanceEntriesPayload(visibleRegister.entries, draftByStudentId);
    if (!payloadResult.ok) {
      setSaveFeedback({ type: 'error', text: payloadResult.errorMessage });
      return;
    }

    const intent = resolveAttendanceSaveIntent(pendingIntentRef.current, {
      classId: visibleRegister.classId, schoolDate: visibleRegister.schoolDate,
      teacherUserId: isOffice ? activeTeacherUserIdParam : null,
      expectedVersion: visibleRegister.version, rosterFingerprint: visibleRegister.rosterFingerprint,
      submit, reason: visibleRegister.status === 'SUBMITTED' ? reasonText : null,
      entries: payloadResult.patches,
    });
    pendingIntentRef.current = intent;
    inFlightSaveRef.current = true;
    setIsSaving(true);
    setSaveFeedback(null);

    const originScope = actorScopeKey;
    const originClassId = visibleRegister.classId;
    const originSchoolDate = visibleRegister.schoolDate;
    const originTeacherParam = activeTeacherUserIdParam;

    try {
      const saveRes = await saveAttendanceRegister({ ...intent, language });
      const cur = currentSnapshotRef.current;
      if (
        !mountedRef.current || cur.actorScopeKey !== originScope ||
        cur.classId !== originClassId || cur.schoolDate !== originSchoolDate ||
        cur.teacherUserId !== originTeacherParam
      ) {
        return;
      }

      if (!saveRes.ok || !saveRes.data) {
        if (saveRes.status === 'UNAUTHORIZED') {
          clearDraftAndConflict(originScope);
          setRegisterState({
            actorScopeKey: originScope, accessMode, classId: originClassId,
            schoolDate: originSchoolDate, teacherUserId: originTeacherParam,
            status: 'UNAUTHORIZED', data: null,
            errorCode: saveRes.errorCode || null, errorMessage: saveRes.errorMessage || null,
          });
          return;
        }

        if (saveRes.errorCode === 'version_conflict' || saveRes.errorCode === 'roster_conflict') {
          pendingIntentRef.current = null;
          setConflictBanner(null);
          const recovery: PendingConflictRecovery = {
            actorScopeKey: originScope, accessMode, classId: originClassId,
            schoolDate: originSchoolDate, teacherUserId: originTeacherParam,
            conflictKind: saveRes.errorCode, previousRegister: visibleRegister,
            unsavedDraftByStudentId: cloneAttendanceDraft(draftByStudentId),
            unsavedReasonText: reasonText, refreshErrorMessage: null,
          };
          setPendingConflictRecovery(recovery);
          await loadRegister({ recoverySnapshot: recovery });
          return;
        }

        if (saveRes.errorCode === 'idempotency_conflict') pendingIntentRef.current = null;
        setSaveFeedback({ type: 'error', text: saveRes.errorMessage || t('error') });
        return;
      }

      pendingIntentRef.current = { ...intent, confirmedSavePendingRefresh: true };
      const freshReadback = await loadRegister();
      if (!mountedRef.current || currentSnapshotRef.current.actorScopeKey !== originScope) return;

      if (!freshReadback.ok || !freshReadback.data) {
        setConfirmedSavePendingRefresh(saveRes.data);
        setSaveFeedback({
          type: 'warning',
          text: pickText({ ar: `تم الحفظ على الخادم (نسخة ${saveRes.data.version})، لكن تعذر تحديث العرض النهائي تلقائياً. أعد القراءة دون إعادة الإرسال.`, fr: `Enregistré sur le serveur (v${saveRes.data.version}), mais le rafraîchissement a échoué. Actualisez la lecture sans renvoyer la sauvegarde.`, en: `Saved on the server (v${saveRes.data.version}), but refreshing the latest register state failed. Reload readback safely without re-submitting.`, es: `Guardado en el servidor (v${saveRes.data.version}), pero falló la actualización de lectura. Recargue sin reenviar.`, de: `Auf dem Server gespeichert (v${saveRes.data.version}), aber Neuladen fehlgeschlagen. Sicher neu laden ohne erneut zu senden.`, pt: `Guardado no servidor (v${saveRes.data.version}), mas a atualização da leitura falhou. Recarregue sem reenviar.` }, language),
        });
        return;
      }

      pendingIntentRef.current = null;
      setConfirmedSavePendingRefresh(null);
      setConflictBanner(null);
      const nextVersion = freshReadback.data.version;
      setSaveFeedback({
        type: 'success',
        text:
          freshReadback.data.status === 'SUBMITTED'
            ? visibleRegister.status === 'SUBMITTED'
              ? pickText({ ar: `تم حفظ التصحيح المعتمد بنجاح (نسخة ${nextVersion}).`, fr: `Correction enregistrée avec succès (v${nextVersion}).`, en: `Submitted correction saved (v${nextVersion}).`, es: `Corrección enviada guardada (v${nextVersion}).`, de: `Eingereichte Korrektur gespeichert (v${nextVersion}).`, pt: `Correção submetida guardada (v${nextVersion}).` }, language)
              : pickText({ ar: `تم اعتماد سجل الحضور بنجاح (نسخة ${nextVersion}).`, fr: `Registre soumis avec succès (v${nextVersion}).`, en: `Attendance register submitted (v${nextVersion}).`, es: `Registro de asistencia enviado (v${nextVersion}).`, de: `Anwesenheitsregister eingereicht (v${nextVersion}).`, pt: `Registo de assiduidade submetido (v${nextVersion}).` }, language)
            : pickText({ ar: `تم حفظ المسودة بنجاح (نسخة ${nextVersion}).`, fr: `Brouillon enregistré avec succès (v${nextVersion}).`, en: `Draft saved (v${nextVersion}).`, es: `Borrador guardado (v${nextVersion}).`, de: `Entwurf gespeichert (v${nextVersion}).`, pt: `Rascunho guardado (v${nextVersion}).` }, language),
      });

      if (showAuditPanel && freshReadback.data.registerId) void loadAuditHistory(freshReadback.data.registerId);
      if (isOffice) onOfficeSaved();
    } finally {
      inFlightSaveRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  };

  return {
    registerState, isRegisterScopeSynced, visibleRegister,
    draftByStudentId, setDraftByStudentId, reasonText, setReasonText,
    isSaving, saveFeedback, setSaveFeedback, confirmedSavePendingRefresh,
    conflictBanner, activeRecoveryForScope, isConflictRecoveryActive,
    isRetryingConflictRefresh, loadRegister, handleSaveOrSubmit,
    resetDraftForContextSwitch, discardConflictDraftAndReload, cancelRegisterRequests,
  };
}
