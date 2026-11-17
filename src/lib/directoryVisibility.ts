/** Pure presentation projection. Server RLS remains the publication authority. */
export function visibleDirectoryEntries<T extends { isPublished?: boolean }>(
  entries: readonly T[],
  status: 'READY' | 'BLOCKED_BACKEND' | 'ERROR' | 'UNAUTHORIZED',
  canManage: boolean,
): T[] {
  if (status === 'BLOCKED_BACKEND') return [...entries];
  if (status !== 'READY') return [];
  return entries.filter((entry) => entry.isPublished === true || canManage);
}
