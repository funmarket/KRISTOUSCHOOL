import React from 'react';
import { pickText } from '../../../i18n/homepages';
import { SHORT_MESSAGE_MAX_CHARS } from '../../../lib/schoolContent';
import type { Language, MessageRecipientOption } from '../../../types';
import { Send } from 'lucide-react';

interface MessageComposerFormProps {
  language: Language;
  recipients: MessageRecipientOption[];
  recipientsError: string | null;
  loadingRecipients: boolean;
  recipientId: string;
  setRecipientId: (value: string) => void;
  subject: string;
  setSubject: (value: string) => void;
  newContent: string;
  setNewContent: (value: string) => void;
  submitting: boolean;
  onRetryRecipients: () => void;
  onSubmit: (e: React.FormEvent) => void;
  t: (key: 'loading' | 'subject' | 'max200' | 'publish') => string;
}

export const MessageComposerForm: React.FC<MessageComposerFormProps> = ({
  language,
  recipients,
  recipientsError,
  loadingRecipients,
  recipientId,
  setRecipientId,
  subject,
  setSubject,
  newContent,
  setNewContent,
  submitting,
  onRetryRecipients,
  onSubmit,
  t,
}) => (
  <form
    onSubmit={onSubmit}
    className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
  >
    <h2 className="font-bold text-sm text-gray-900 dark:text-white">
      {pickText({ ar: 'إرسال رسالة قصيرة', fr: 'Envoyer un message court', en: 'Send Short Message' }, language)}
    </h2>
    {recipientsError && (
      <div
        role="alert"
        className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
      >
        <span>{recipientsError}</span>
        <button
          type="button"
          onClick={onRetryRecipients}
          className="px-3 py-1 rounded-lg bg-red-700 text-white font-bold text-[11px]"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
        </button>
      </div>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <select
        value={recipientId}
        disabled={loadingRecipients}
        onChange={(e) => setRecipientId(e.target.value)}
        className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
      >
        {loadingRecipients ? (
          <option value="">{t('loading')}</option>
        ) : recipients.length === 0 ? (
          <option value="">
            {pickText({ ar: 'لا يوجد مستلمون متاحون', fr: 'Aucun destinataire', en: 'No recipients available' }, language)}
          </option>
        ) : (
          recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.fullName} ({r.role})
            </option>
          ))
        )}
      </select>
      <input
        type="text"
        maxLength={140}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t('subject')}
        className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
      />
    </div>
    <textarea
      required
      maxLength={SHORT_MESSAGE_MAX_CHARS}
      rows={3}
      value={newContent}
      onChange={(e) => setNewContent(e.target.value)}
      placeholder={t('max200')}
      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
    />
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono text-gray-400">
        {newContent.length} / {SHORT_MESSAGE_MAX_CHARS}
      </span>
      <button
        type="submit"
        disabled={submitting || !recipientId || loadingRecipients}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{submitting ? t('loading') : t('publish')}</span>
      </button>
    </div>
  </form>
);
