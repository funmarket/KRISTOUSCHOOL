// Only data-service calls are mocked; the rendered MessagesView and its effects are real.
export const SHORT_MESSAGE_MAX_CHARS = 200;
export function countUnreadThreads(threads: readonly { unread: boolean }[], status: string) {
  return status === 'READY' ? threads.filter((thread) => thread.unread).length : 0;
}
export async function listApprovedMessageRecipients() {
  return { ok: true as const, status: 'READY' as const, data: [] };
}
export async function sendOperationalMessage() {
  throw new Error('Unexpected message send during navigation test');
}
export async function replyOperationalThread() {
  throw new Error('Unexpected reply during navigation test');
}
