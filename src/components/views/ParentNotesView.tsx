import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, Plus, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ParentNote } from '../../types';

export const ParentNotesView: React.FC = () => {
  const { currentUser, childrenList, parentNotes, addParentNote, t } = useApp();

  const [selectedChildId, setSelectedChildId] = useState(childrenList[0]?.id || '');
  const [topic, setTopic] = useState<ParentNote['topic']>('ABSENCE');
  const [content, setContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const userNotes = parentNotes.filter(n => n.parentId === currentUser?.id);
  const remainingQuota = 11 - userNotes.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!content.trim()) {
      setErrorMsg(t('error'));
      return;
    }

    const res = addParentNote(selectedChildId, topic, content);
    if (!res.success) {
      setErrorMsg(res.error || t('error'));
    } else {
      setSuccessMsg(t('success'));
      setContent('');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('parentNotes')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {t('notesDescription')}
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-4 py-2 rounded-2xl flex items-center space-x-3 rtl:space-x-reverse">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{t('dailyQuota')}</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">{remainingQuota} / 11 {t('notesRemaining')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form to send note */}
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('sendNote')}</h3>

          <p className="text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl">
            {t('sendingHours')}
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-medium flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('childConcerned')}</label>
              <select
                value={selectedChildId}
                onChange={e => setSelectedChildId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
              >
                {childrenList.map(child => (
                  <option key={child.id} value={child.id}>
                    {child.fullName} ({child.className})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('subject')}</label>
              <select
                value={topic}
                onChange={e => setTopic(e.target.value as any)}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
              >
                <option value="ABSENCE">{t('calendar')} / Retard</option>
                <option value="HOMEWORK">{t('homework')}</option>
                <option value="BEHAVIOR">{t('subject')}</option>
                <option value="HEALTH">{t('subject')}</option>
                <option value="PICKUP">{t('pickup')}</option>
                <option value="OTHER">{t('subject')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('message')}</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                placeholder={t('notePlaceholder')}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-md transition-all"
            >
              Envoyer la note
            </button>
          </form>
        </div>

        {/* History of notes */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('noteHistory')}</h3>
          
          <div className="space-y-3">
            {userNotes.length === 0 ? (
              <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-gray-500 text-xs">
                {t('noNotes')}
              </div>
            ) : (
              userNotes.map(n => (
                <div key={n.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold text-[10px] rounded-xl uppercase">
                        {n.topic}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">Enfant: {n.childName}</span>
                    </div>
                    <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>

                  <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3.5 rounded-2xl">
                    {n.content}
                  </p>

                  {n.replyContent && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3.5 rounded-2xl text-xs space-y-1">
                      <div className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400">{t('schoolReply')} :</div>
                      <p className="text-emerald-900 dark:text-emerald-300">{n.replyContent}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
