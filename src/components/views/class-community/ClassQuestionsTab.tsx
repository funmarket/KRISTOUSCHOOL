import React from 'react';
import { Send, Eye, EyeOff } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type { useClassCommunityView } from './useClassCommunityView';

export interface ClassQuestionsTabProps {
  vm: ReturnType<typeof useClassCommunityView>;
}

export const ClassQuestionsTab: React.FC<ClassQuestionsTabProps> = ({ vm }) => {
  const {
    language,
    t,
    canModerate,
    activeClass,
    newQuestionText,
    setNewQuestionText,
    questionError,
    postingQuestion,
    replyTextMap,
    setReplyTextMap,
    replyErrorMap,
    replyingId,
    visibleQuestions,
    handlePostQuestion,
    handleReplySubmit,
    handleModerateQuestion,
  } = vm;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2">{t('askClassmates')}</h3>
        <p className="text-xs text-gray-500 mb-4">{t('questionRule')}</p>

        {questionError && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs rounded-xl font-medium">
            {questionError}
          </div>
        )}

        <form onSubmit={(e) => void handlePostQuestion(e)} className="space-y-3">
          <textarea
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder={t('questionPlaceholder')}
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-mono ${
                newQuestionText.length > 180 ? 'text-red-500 font-bold' : 'text-gray-400'
              }`}
            >
              {newQuestionText.length} / 200
            </span>
            <button
              type="submit"
              disabled={postingQuestion || !activeClass}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{postingQuestion ? t('loading') : t('publish')}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {visibleQuestions.map((q) => (
          <div
            key={q.id}
            className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {q.studentName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white">{q.studentName}</h4>
                  <span className="text-[10px] text-gray-400">
                    {new Date(q.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              {canModerate && (
                <button
                  type="button"
                  onClick={() => void handleModerateQuestion(q.id, !q.isHidden)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-[11px] font-bold text-gray-600 dark:text-zinc-300"
                >
                  {q.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{q.isHidden ? 'Unhide' : 'Hide'}</span>
                </button>
              )}
            </div>

            {q.isHidden && (
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                HIDDEN BY MODERATOR
              </span>
            )}

            <p className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-3.5 rounded-2xl">
              {q.content}
            </p>

            {q.replies && q.replies.length > 0 && (
              <div className="space-y-2 ps-4 border-s-2 border-blue-500">
                {q.replies.map((r) => (
                  <div key={r.id} className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-2xl text-xs space-y-1">
                    <div className="font-bold text-[11px] text-blue-600 dark:text-blue-400">
                      {r.authorName}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{r.content}</p>
                  </div>
                ))}
              </div>
            )}

            {replyErrorMap[q.id] && (
              <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                {replyErrorMap[q.id]}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={replyTextMap[q.id] || ''}
                onChange={(e) => setReplyTextMap({ ...replyTextMap, [q.id]: e.target.value })}
                maxLength={200}
                placeholder={t('replyPlaceholder')}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                disabled={replyingId === q.id}
                onClick={() => void handleReplySubmit(q.id)}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                {replyingId === q.id ? t('loading') : t('reply')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
