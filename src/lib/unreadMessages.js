/**
 * Unread message tracking utilities — strictly per-user and per-channel.
 * Provides instant zero-latency UI updates via localStorage alongside backend persistence.
 */

const STORAGE_PREFIX = 'studycord_unread_v1';

export function getStoredUnreadCount(userId, channelId) {
  if (typeof window === 'undefined' || !userId || !channelId) return 0;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}_${userId}_${channelId}`);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

export function setStoredUnreadCount(userId, channelId, count) {
  if (typeof window === 'undefined' || !userId || !channelId) return;
  try {
    const safeCount = Math.max(0, count || 0);
    if (safeCount === 0) {
      localStorage.removeItem(`${STORAGE_PREFIX}_${userId}_${channelId}`);
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}_${userId}_${channelId}`, String(safeCount));
    }
  } catch {}
}

export function incrementStoredUnread(userId, channelId) {
  const current = getStoredUnreadCount(userId, channelId);
  const next = current + 1;
  setStoredUnreadCount(userId, channelId, next);
  return next;
}

export function clearStoredUnread(userId, channelId) {
  setStoredUnreadCount(userId, channelId, 0);
}
