import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DirectorySubTab } from '../../types';
import { canManagePublicContentUi } from '../homepages/homepageAccess';
import { pickText } from '../../i18n/homepages';
import { upsertDirectoryEntry } from '../../lib/schoolContent';
import { visibleDirectoryEntries } from '../../lib/directoryVisibility';
import { DirectoryEntryForm } from './directory/DirectoryEntryForm';
import { DirectoryProfileDialog } from './directory/DirectoryProfileDialog';
import { Plus, AlertCircle, CheckCircle2, Edit3, Lock, ChevronRight } from 'lucide-react';

export interface DirectoryViewProps {
  initialSubTab?: DirectorySubTab;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  initialSubTab = 'teachers',
}) => {
  const {
    currentUser,
    teachers,
    admins,
    directoryStatus,
    directoryError,
    isHydratingSchoolData,
    language,
    refreshSchoolData,
    t,
  } = useApp();
  const [tab, setTab] = useState<DirectorySubTab>(initialSubTab);

  const canManage = canManagePublicContentUi(currentUser);
  const isDirectoryUnauthorized = directoryStatus === 'UNAUTHORIZED';

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<'TEACHER' | 'ADMIN'>('TEACHER');
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [languagesCsv, setLanguagesCsv] = useState('AR, FR');
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [selectedDirectoryEntry, setSelectedDirectoryEntry] = useState<{ kind: 'TEACHER' | 'ADMIN'; id: string } | null>(null);
  const detailDialogRef = useRef<HTMLDialogElement>(null);
  const detailOpenerRef = useRef<HTMLButtonElement>(null);

  const visibleTeachers = visibleDirectoryEntries(teachers, directoryStatus, canManage);
  const visibleAdmins = visibleDirectoryEntries(admins, directoryStatus, canManage);
  const canOpenDetails = directoryStatus === 'READY' && !isHydratingSchoolData;
  const selectedTeacher = canOpenDetails && selectedDirectoryEntry?.kind === 'TEACHER'
    ? visibleTeachers.find((entry) => entry.id === selectedDirectoryEntry.id)
    : undefined;
  const selectedAdmin = canOpenDetails && selectedDirectoryEntry?.kind === 'ADMIN'
    ? visibleAdmins.find((entry) => entry.id === selectedDirectoryEntry.id)
    : undefined;
  const selectedMember = selectedTeacher ?? selectedAdmin;
  const detailTags = selectedTeacher?.classes ?? selectedAdmin?.responsibilities ?? [];
  const detailLanguages = selectedTeacher?.languages ?? selectedAdmin?.languages ?? [];

  const closeDirectoryProfile = () => {
    const dialog = detailDialogRef.current;
    if (dialog?.open) dialog.close();
    setSelectedDirectoryEntry(null);
    if (detailOpenerRef.current?.isConnected) detailOpenerRef.current.focus();
  };

  useLayoutEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if (selectedMember && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('[data-testid="directory-detail-close"]')?.focus();
    } else if (!selectedMember && dialog.open) {
      dialog.close();
    }
  }, [selectedMember]);

  const openDirectoryProfile = (opener: HTMLButtonElement, kind: 'TEACHER' | 'ADMIN', id: string) => {
    if (!canOpenDetails) return;
    detailOpenerRef.current = opener;
    setSelectedDirectoryEntry({ kind, id });
  };

  useEffect(() => {
    setTab(initialSubTab);
    setSelectedDirectoryEntry(null);
  }, [initialSubTab]);

  const startEdit = (
    type: 'TEACHER' | 'ADMIN',
    entry: { id: string; name: string; title: string; bio: string; tags: string[]; languages?: string[]; isPublished?: boolean },
  ) => {
    if (isDirectoryUnauthorized) return;
    setEditingId(directoryStatus === 'READY' ? entry.id : null);
    setEntryType(type);
    setDisplayName(entry.name);
    setTitle(entry.title);
    setBio(entry.bio);
    setTagsCsv(entry.tags.join(', '));
    setLanguagesCsv((entry.languages ?? ['FR']).join(', '));
    setIsPublished(entry.isPublished !== false);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isDirectoryUnauthorized) return;
    setFeedback(null);
    setSaving(true);
    try {
      const res = await upsertDirectoryEntry({
        id: editingId,
        entryType,
        displayName,
        title,
        bio,
        tags: tagsCsv.split(',').map((s) => s.trim()).filter(Boolean),
        languages: languagesCsv.split(',').map((s) => s.trim()).filter(Boolean),
        isPublished,
      });

      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
        return;
      }

      setShowForm(false);
      setEditingId(null);
      setDisplayName('');
      setTitle('');
      setBio('');
      setTagsCsv('');
      setFeedback({
        type: 'success',
        text: pickText({ ar: 'تم حفظ بطاقة الدليل بنجاح.', fr: 'Fiche annuaire enregistrée.', en: 'Directory entry saved.', es: 'Ficha del directorio guardada.', de: 'Verzeichniseintrag gespeichert.', pt: 'Registo do diretório guardado.' }, language),
      });
      await refreshSchoolData();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="directory-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
              {t('directoryTitle')}
            </h1>
            {directoryStatus === 'BLOCKED_BACKEND' && (
              <span
                data-testid="directory-preview-badge"
                className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[10px] font-extrabold text-amber-700 dark:text-amber-300"
              >
                {t('demoPreview')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('directoryDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setTab('teachers')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'teachers' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {t('teachers')}
            </button>
            <button
              type="button"
              onClick={() => setTab('admin')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'admin' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {t('administration')}
            </button>
          </div>

          {canManage && !isDirectoryUnauthorized && (
            <button
              type="button"
              data-testid="directory-add-entry-btn"
              onClick={() => {
                setEditingId(null);
                setEntryType(tab === 'admin' ? 'ADMIN' : 'TEACHER');
                setDisplayName('');
                setTitle('');
                setBio('');
                setTagsCsv('');
                setShowForm((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'إضافة عضو', fr: 'Ajouter', en: 'Add Entry', es: 'Añadir ficha', de: 'Eintrag hinzufügen', pt: 'Adicionar registo' }, language)}</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {canManage && !isDirectoryUnauthorized && showForm && (
        <DirectoryEntryForm
          language={language}
          editingId={editingId}
          entryType={entryType}
          setEntryType={setEntryType}
          displayName={displayName}
          setDisplayName={setDisplayName}
          title={title}
          setTitle={setTitle}
          bio={bio}
          setBio={setBio}
          tagsCsv={tagsCsv}
          setTagsCsv={setTagsCsv}
          languagesCsv={languagesCsv}
          setLanguagesCsv={setLanguagesCsv}
          isPublished={isPublished}
          setIsPublished={setIsPublished}
          saving={saving}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSave}
          t={t}
        />
      )}

      {isDirectoryUnauthorized && (
        <div
          data-testid="directory-unauthorized-banner"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {directoryError ||
                pickText({ ar: 'غير مصرح بعرض دليل المدرسة حالياً.', fr: 'Accès non autorisé à l’annuaire de l’école.', en: 'Not authorized to access the school directory.', es: 'No autorizado para acceder al directorio escolar.', de: 'Nicht berechtigt, auf das Schulverzeichnis zuzugreifen.', pt: 'Sem autorização para aceder ao diretório escolar.' }, language)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
          </button>
        </div>
      )}

      {directoryStatus === 'ERROR' && (
        <div
          data-testid="directory-error-banner"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {directoryError ||
                pickText({ ar: 'تعذر تحميل بيانات الدليل المباشر من الخادم.', fr: 'Impossible de charger l’annuaire en direct depuis le serveur.', en: 'Failed to load live school directory from server.', es: 'No se pudo cargar el directorio escolar en directo desde el servidor.', de: 'Das Live-Schulverzeichnis konnte nicht vom Server geladen werden.', pt: 'Falha ao carregar o diretório escolar em tempo real do servidor.' }, language)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
          </button>
        </div>
      )}

      {isDirectoryUnauthorized ? null : isHydratingSchoolData && visibleTeachers.length === 0 && visibleAdmins.length === 0 ? (
        <div
          data-testid="directory-loading-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500"
        >
          {t('loading')}
        </div>
      ) : tab === 'teachers' && visibleTeachers.length === 0 && directoryStatus === 'READY' ? (
        <div
          data-testid="directory-empty-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500"
        >
          {t('noItems')}
        </div>
      ) : tab === 'admin' && visibleAdmins.length === 0 && directoryStatus === 'READY' ? (
        <div
          data-testid="directory-empty-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500"
        >
          {t('noItems')}
        </div>
      ) : tab === 'teachers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleTeachers.map((teach) => (
            <div key={teach.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4">
              <button
                type="button"
                data-testid={'directory-open-' + teach.id}
                disabled={!canOpenDetails}
                onClick={(event) => openDirectoryProfile(event.currentTarget, 'TEACHER', teach.id)}
                aria-label={pickText({ ar: 'عرض ملف', fr: 'Voir le profil de', en: 'View profile of', es: 'Ver perfil de', de: 'Profil anzeigen von', pt: 'Ver perfil de' }, language) + ' ' + teach.name}
                className="flex flex-1 items-start gap-4 sm:gap-5 min-w-0 text-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default disabled:opacity-90"
              >
                <img src={teach.photoUrl || '/assets/kristou-logo.png'} alt={teach.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0" />
                <span className="space-y-2 flex-1 min-w-0">
                  <span className="block font-bold text-base text-gray-900 dark:text-white">{teach.name}</span>
                  <span className="block text-xs text-blue-600 dark:text-blue-400 font-semibold">{teach.title}</span>
                  {teach.bio && <span className="block text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{teach.bio}</span>}
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    {teach.classes.map((cls, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded-lg">{cls}</span>
                    ))}
                  </span>
                  {canOpenDetails && <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {pickText({ ar: 'عرض التفاصيل', fr: 'Voir les détails', en: 'View details', es: 'Ver detalles', de: 'Details anzeigen', pt: 'Ver detalhes' }, language)}
                    <ChevronRight className="w-3 h-3" />
                  </span>}
                  {canManage && teach.isPublished !== true && directoryStatus === 'READY' && <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {pickText({ ar: 'مسودة غير منشورة', fr: 'Brouillon non publié', en: 'Unpublished draft', es: 'Borrador sin publicar', de: 'Unveröffentlichter Entwurf', pt: 'Rascunho não publicado' }, language)}
                  </span>}
                </span>
              </button>
              {canManage && !isDirectoryUnauthorized && (
                <button
                  type="button"
                  onClick={() => startEdit('TEACHER', {
                    id: teach.id, name: teach.name, title: teach.title, bio: teach.bio,
                    tags: teach.classes, languages: teach.languages, isPublished: teach.isPublished,
                  })}
                  aria-label={pickText({ ar: 'تعديل', fr: 'Modifier', en: 'Edit', es: 'Editar', de: 'Bearbeiten', pt: 'Editar' }, language) + ' ' + teach.name}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleAdmins.map((adm) => (
            <div key={adm.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4">
              <button
                type="button"
                data-testid={'directory-open-' + adm.id}
                disabled={!canOpenDetails}
                onClick={(event) => openDirectoryProfile(event.currentTarget, 'ADMIN', adm.id)}
                aria-label={pickText({ ar: 'عرض ملف', fr: 'Voir le profil de', en: 'View profile of', es: 'Ver perfil de', de: 'Profil anzeigen von', pt: 'Ver perfil de' }, language) + ' ' + adm.name}
                className="flex flex-1 items-start gap-4 sm:gap-5 min-w-0 text-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default disabled:opacity-90"
              >
                <img src={adm.photoUrl || '/assets/kristou-logo.png'} alt={adm.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-md shrink-0" />
                <span className="space-y-2 flex-1 min-w-0">
                  <span className="block font-bold text-base text-gray-900 dark:text-white">{adm.name}</span>
                  <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{adm.title}</span>
                  {adm.bio && <span className="block text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{adm.bio}</span>}
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    {adm.responsibilities.map((resp, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-lg">{resp}</span>
                    ))}
                  </span>
                  {canOpenDetails && <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {pickText({ ar: 'عرض التفاصيل', fr: 'Voir les détails', en: 'View details', es: 'Ver detalles', de: 'Details anzeigen', pt: 'Ver detalhes' }, language)}
                    <ChevronRight className="w-3 h-3" />
                  </span>}
                  {canManage && adm.isPublished !== true && directoryStatus === 'READY' && <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {pickText({ ar: 'مسودة غير منشورة', fr: 'Brouillon non publié', en: 'Unpublished draft', es: 'Borrador sin publicar', de: 'Unveröffentlichter Entwurf', pt: 'Rascunho não publicado' }, language)}
                  </span>}
                </span>
              </button>
              {canManage && !isDirectoryUnauthorized && (
                <button
                  type="button"
                  onClick={() => startEdit('ADMIN', {
                    id: adm.id, name: adm.name, title: adm.title, bio: adm.bio,
                    tags: adm.responsibilities, languages: adm.languages, isPublished: adm.isPublished,
                  })}
                  aria-label={pickText({ ar: 'تعديل', fr: 'Modifier', en: 'Edit', es: 'Editar', de: 'Bearbeiten', pt: 'Editar' }, language) + ' ' + adm.name}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <DirectoryProfileDialog
        detailDialogRef={detailDialogRef}
        language={language}
        selectedMember={selectedMember}
        selectedTeacher={selectedTeacher}
        detailTags={detailTags}
        detailLanguages={detailLanguages}
        canManage={canManage}
        onClose={closeDirectoryProfile}
        onClearSelection={() => setSelectedDirectoryEntry(null)}
      />
    </div>
  );
};
