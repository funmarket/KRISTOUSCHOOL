import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DirectorySubTab } from '../../types';
import { canManagePublicContentUi } from '../homepages/homepageAccess';
import { pickText } from '../../i18n/homepages';
import { upsertDirectoryEntry } from '../../lib/schoolContent';
import { Plus, AlertCircle, CheckCircle2, Edit3 } from 'lucide-react';

export interface DirectoryViewProps {
  initialSubTab?: DirectorySubTab;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  initialSubTab = 'teachers',
}) => {
  const { currentUser, teachers, admins, directoryStatus, language, refreshSchoolData, t } = useApp();
  const [tab, setTab] = useState<DirectorySubTab>(initialSubTab);

  const canManage = canManagePublicContentUi(currentUser);

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

  useEffect(() => {
    setTab(initialSubTab);
  }, [initialSubTab]);

  const startEdit = (
    type: 'TEACHER' | 'ADMIN',
    entry: { id: string; name: string; title: string; bio: string; tags: string[]; languages?: string[]; isPublished?: boolean },
  ) => {
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
    setFeedback(null);
    setSaving(true);
    const res = await upsertDirectoryEntry({
      id: editingId,
      entryType,
      displayName,
      title,
      bio,
      tags: tagsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      languages: languagesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isPublished,
    });
    setSaving(false);

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
      text: pickText(
        { ar: 'تم حفظ بطاقة الدليل بنجاح.', fr: 'Fiche annuaire enregistrée.', en: 'Directory entry saved.' },
        language,
      ),
    });
    await refreshSchoolData();
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
            {directoryStatus !== 'READY' && (
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

          {canManage && (
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
              <span>{pickText({ ar: 'إضافة عضو', fr: 'Ajouter', en: 'Add Entry' }, language)}</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
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

      {canManage && showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h2 className="font-bold text-sm text-gray-900 dark:text-white">
            {editingId
              ? pickText({ ar: 'تحديث بطاقة الدليل', fr: 'Modifier la fiche', en: 'Update Directory Entry' }, language)
              : pickText({ ar: 'بطاقة جديدة في دليل المدرسة', fr: 'Nouvelle fiche annuaire', en: 'New Directory Entry' }, language)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as 'TEACHER' | 'ADMIN')}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-semibold"
            >
              <option value="TEACHER">{t('teachers')}</option>
              <option value="ADMIN">{t('administration')}</option>
            </select>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={pickText({ ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Display name' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={pickText({ ar: 'الصفة / المادة', fr: 'Titre / Poste', en: 'Role / Subject title' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={pickText({ ar: 'نبذة تعريفية', fr: 'Biographie courte', en: 'Short bio' }, language)}
            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <input
              type="text"
              value={tagsCsv}
              onChange={(e) => setTagsCsv(e.target.value)}
              placeholder="Tags (comma-separated, e.g. CP, CE1)"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={languagesCsv}
                onChange={(e) => setLanguagesCsv(e.target.value)}
                placeholder="AR, FR, EN"
                className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                <span>Published</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border text-xs font-semibold">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {tab === 'teachers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teachers.map((teach) => (
            <div key={teach.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 sm:gap-5">
              <img src={teach.photoUrl} alt={teach.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">{teach.name}</h3>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        startEdit('TEACHER', {
                          id: teach.id,
                          name: teach.name,
                          title: teach.title,
                          bio: teach.bio,
                          tags: teach.classes,
                          languages: teach.languages,
                          isPublished: teach.isPublished,
                        })
                      }
                      aria-label={`Edit ${teach.name}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{teach.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{teach.bio}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {teach.classes.map((cls, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded-lg">
                      {cls}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {admins.map((adm) => (
            <div key={adm.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 sm:gap-5">
              <img src={adm.photoUrl} alt={adm.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-md shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">{adm.name}</h3>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        startEdit('ADMIN', {
                          id: adm.id,
                          name: adm.name,
                          title: adm.title,
                          bio: adm.bio,
                          tags: adm.responsibilities,
                          isPublished: adm.isPublished,
                        })
                      }
                      aria-label={`Edit ${adm.name}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{adm.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{adm.bio}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {adm.responsibilities.map((resp, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-lg">
                      {resp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
