import React from 'react';
import { pickText } from '../../../i18n/homepages';
import type { Language } from '../../../types';

interface DirectoryEntryFormProps {
  language: Language;
  editingId: string | null;
  entryType: 'TEACHER' | 'ADMIN';
  setEntryType: (value: 'TEACHER' | 'ADMIN') => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  tagsCsv: string;
  setTagsCsv: (value: string) => void;
  languagesCsv: string;
  setLanguagesCsv: (value: string) => void;
  isPublished: boolean;
  setIsPublished: (value: boolean) => void;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  t: (key: 'teachers' | 'administration' | 'cancel' | 'loading' | 'save') => string;
}

export const DirectoryEntryForm: React.FC<DirectoryEntryFormProps> = ({
  language,
  editingId,
  entryType,
  setEntryType,
  displayName,
  setDisplayName,
  title,
  setTitle,
  bio,
  setBio,
  tagsCsv,
  setTagsCsv,
  languagesCsv,
  setLanguagesCsv,
  isPublished,
  setIsPublished,
  saving,
  onCancel,
  onSubmit,
  t,
}) => (
  <form
    onSubmit={onSubmit}
    className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
  >
    <h2 className="font-bold text-sm text-gray-900 dark:text-white">
      {editingId
        ? pickText({ ar: 'تحديث بطاقة الدليل', fr: 'Modifier la fiche', en: 'Update Directory Entry', es: 'Actualizar ficha del directorio', de: 'Verzeichniseintrag aktualisieren', pt: 'Atualizar registo do diretório' }, language)
        : pickText({ ar: 'بطاقة جديدة في دليل المدرسة', fr: 'Nouvelle fiche annuaire', en: 'New Directory Entry', es: 'Nueva ficha en el directorio', de: 'Neuer Verzeichniseintrag', pt: 'Novo registo no diretório' }, language)}
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
        placeholder={pickText({ ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Display name', es: 'Nombre completo', de: 'Vollständiger Name', pt: 'Nome completo' }, language)}
        className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
      />
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={pickText({ ar: 'الصفة / المادة', fr: 'Titre / Poste', en: 'Role / Subject title', es: 'Cargo / Asignatura', de: 'Rolle / Fach', pt: 'Cargo / Disciplina' }, language)}
        className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
      />
    </div>
    <textarea
      rows={2}
      value={bio}
      onChange={(e) => setBio(e.target.value)}
      placeholder={pickText({ ar: 'نبذة تعريفية', fr: 'Biographie courte', en: 'Short bio', es: 'Biografía breve', de: 'Kurzbiografie', pt: 'Breve biografia' }, language)}
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
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border text-xs font-semibold">
        {t('cancel')}
      </button>
      <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
        {saving ? t('loading') : t('save')}
      </button>
    </div>
  </form>
);
