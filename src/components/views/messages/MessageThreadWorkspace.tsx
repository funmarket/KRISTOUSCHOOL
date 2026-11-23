import React from 'react';
import { SHORT_MESSAGE_MAX_CHARS } from '../../../lib/schoolContent';
import type { MessageThread, User } from '../../../types';
import { MessageSquare } from 'lucide-react';

interface MessageThreadWorkspaceProps {
  currentUser: User | null;
  messages: MessageThread[];
  messagesStatus: string;
  selectedThreadId: string;
  onSelectThread: (id: string) => void;
  activeThread: MessageThread | null;
  unreadSyncNotice?: React.ReactNode;
  replyText: string;
  setReplyText: (value: string) => void;
  submitting: boolean;
  onSendReply: (e: React.FormEvent) => void;
  t: (key: 'noItems' | 'replyPlaceholder' | 'reply') => string;
}

export const MessageThreadWorkspace: React.FC<MessageThreadWorkspaceProps> = ({
  currentUser,
  messages,
  messagesStatus,
  selectedThreadId,
  onSelectThread,
  activeThread,
  unreadSyncNotice,
  replyText,
  setReplyText,
  submitting,
  onSendReply,
  t,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
    {/* Thread List */}
    <div className="bg-white dark:bg-[#111111] p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
      {messages.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6">
          {messagesStatus === 'READY' ? t('noItems') : ''}
        </p>
      ) : (
        messages.map((thread) => (
          <button
            key={thread.id}
            id={`notification-thread-${thread.id}`}
            type="button"
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-start p-3 rounded-2xl border transition-all ${
              selectedThreadId === thread.id
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                : 'border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                {thread.subject || thread.recipientName}
              </span>
              {thread.unread && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-1">{thread.lastMessage}</p>
          </button>
        ))
      )}
    </div>

    {/* Active Thread */}
    <div className="lg:col-span-2 bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between min-h-[20rem] space-y-4">
      {!activeThread ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
          <MessageSquare className="w-6 h-6" />
          <span>{messagesStatus === 'READY' ? t('noItems') : ''}</span>
        </div>
      ) : (
        <>
          {unreadSyncNotice}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activeThread.messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                  m.senderId === currentUser?.id
                    ? 'ms-auto bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="text-[10px] opacity-80 font-bold mb-1">
                  {m.senderName || (m.senderId === currentUser?.id ? currentUser?.fullName : 'School')}
                </div>
                <p>{m.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={onSendReply} className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <input
              type="text"
              maxLength={SHORT_MESSAGE_MAX_CHARS}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('replyPlaceholder')}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <span className="text-[10px] font-mono text-gray-400">
              {replyText.length}/{SHORT_MESSAGE_MAX_CHARS}
            </span>
            <button
              type="submit"
              disabled={submitting || !replyText.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {t('reply')}
            </button>
          </form>
        </>
      )}
    </div>
  </div>
);
