import React from 'react';
import { ParentNote } from '../../../types';
import { pickText } from '../../../i18n/homepages';

interface ParentNotesHistorySectionProps {
  visibleNotes: ParentNote[];
  isStaffReviewer: boolean;
  replyTextMap: Record<string, string>;
  setReplyTextMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  replyingId: string | null;
  handleStaffReply: (noteId: string) => void;
  t: (key: string) => string;
  language: string;
}

export const ParentNotesHistorySection: React.FC<ParentNotesHistorySectionProps> = ({
  visibleNotes,
  isStaffReviewer,
  replyTextMap,
  setReplyTextMap,
  replyingId,
  handleStaffReply,
  t,
  language,
}) => {
  return (
    <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('noteHistory')}</h3>
      {visibleNotes.length === 0 ? (
        <p className="text-xs text-gray-500">{t('noNotes')}</p>
      ) : (
        <div className="space-y-3">
          {visibleNotes.map((note) => (
            <div
              key={note.id}
              id={`notification-parent-note-${note.id}`}
              className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between font-bold text-gray-800 dark:text-gray-200">
                <span>{note.childName} • {note.topic}</span>
                <span className="text-[10px] text-gray-400">{new Date(note.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{note.content}</p>
              {((note as any).replyText || (note as any).replyContent) && (
                <div data-testid="parent-note-teacher-tag" className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 text-[11px] text-blue-700 dark:text-blue-300">
                  <span className="font-bold">{t('schoolReply')} ({(note as any).repliedByName || 'Staff'}):</span> {(note as any).replyText || (note as any).replyContent}
                </div>
              )}
              {isStaffReviewer && !(note as any).replyText && (
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
                  <input
                    type="text"
                    placeholder={pickText({ ar: 'اكتب رد المدرسة...', fr: 'Répondre en tant qu’école...', en: 'Write school reply...', es: 'Escribe la respuesta de la escuela...', de: 'Schulantwort schreiben...', pt: 'Escreva a resposta da escola...' }, language as any)}
                    value={replyTextMap[note.id] || ''}
                    onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [note.id]: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={replyingId === note.id}
                      onClick={() => handleStaffReply(note.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs disabled:opacity-50"
                    >
                      {replyingId === note.id ? t('loading') : t('save')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
