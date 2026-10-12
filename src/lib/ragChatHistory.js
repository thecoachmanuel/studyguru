const DATABASE_NAME = 'studycord-rag1';
const DATABASE_VERSION = 2;
const MESSAGE_STORE = 'messages';
const SESSION_SEQUENCE_INDEX = 'by_user_session_sequence';
const STUDY_OUTPUT_STORE = 'study_outputs';
const OUTPUT_SESSION_INDEX = 'by_user_session';
const OUTPUT_SESSION_TYPE_INDEX = 'by_user_session_type';

let databasePromise = null;

function requireIdentity(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function createMessageId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sessionRange(userId, sessionId) {
  const keyRange = globalThis.IDBKeyRange;
  if (!keyRange) {
    throw new Error('IndexedDB key ranges are unavailable.');
  }
  return keyRange.bound(
    [userId, sessionId, Number.MIN_SAFE_INTEGER],
    [userId, sessionId, Number.MAX_SAFE_INTEGER],
  );
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(
      transaction.error || new Error('IndexedDB transaction failed.'),
    );
    transaction.onabort = () => reject(
      transaction.error || new Error('IndexedDB transaction was aborted.'),
    );
  });
}

export function initializeRagChatDb() {
  if (databasePromise) return databasePromise;
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(MESSAGE_STORE)
        ? request.transaction.objectStore(MESSAGE_STORE)
        : database.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });

      if (!store.indexNames.contains(SESSION_SEQUENCE_INDEX)) {
        store.createIndex(
          SESSION_SEQUENCE_INDEX,
          ['user_id', 'session_id', 'sequence'],
          { unique: true },
        );
      }

      const outputStore = database.objectStoreNames.contains(STUDY_OUTPUT_STORE)
        ? request.transaction.objectStore(STUDY_OUTPUT_STORE)
        : database.createObjectStore(STUDY_OUTPUT_STORE, { keyPath: 'id' });

      if (!outputStore.indexNames.contains(OUTPUT_SESSION_INDEX)) {
        outputStore.createIndex(
          OUTPUT_SESSION_INDEX,
          ['user_id', 'session_id'],
          { unique: false },
        );
      }
      if (!outputStore.indexNames.contains(OUTPUT_SESSION_TYPE_INDEX)) {
        outputStore.createIndex(
          OUTPUT_SESSION_TYPE_INDEX,
          ['user_id', 'session_id', 'output_type'],
          { unique: true },
        );
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('IndexedDB could not be opened.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('IndexedDB upgrade is blocked.'));
    };
  });

  return databasePromise;
}

export async function getSessionMessages(userId, sessionId) {
  const safeUserId = requireIdentity(userId, 'user_id');
  const safeSessionId = requireIdentity(sessionId, 'session_id');

  try {
    const database = await initializeRagChatDb();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(MESSAGE_STORE, 'readonly');
      const index = transaction.objectStore(MESSAGE_STORE).index(
        SESSION_SEQUENCE_INDEX,
      );
      const request = index.getAll(sessionRange(safeUserId, safeSessionId));

      request.onsuccess = () => {
        const results = request.result.sort((left, right) => left.sequence - right.sequence);
        if (results && results.length > 0) {
          resolve(results);
        } else {
          // If IndexedDB returned empty, check localStorage backup
          const lsBackup = getLocalStorageBackup(safeUserId, safeSessionId);
          resolve(lsBackup);
        }
      };
      request.onerror = () => {
        const lsBackup = getLocalStorageBackup(safeUserId, safeSessionId);
        resolve(lsBackup);
      };
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to localStorage backup:', err);
    return getLocalStorageBackup(safeUserId, safeSessionId);
  }
}

export async function addMessage(
  userId,
  sessionId,
  { role, content, id, created_at: createdAt } = {},
) {
  const safeUserId = requireIdentity(userId, 'user_id');
  const safeSessionId = requireIdentity(sessionId, 'session_id');
  if (!['user', 'assistant'].includes(role)) {
    throw new Error('Message role must be user or assistant.');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Message content is required.');
  }

  const database = await initializeRagChatDb();
  const transaction = database.transaction(MESSAGE_STORE, 'readwrite');
  const store = transaction.objectStore(MESSAGE_STORE);
  const index = store.index(SESSION_SEQUENCE_INDEX);
  const range = sessionRange(safeUserId, safeSessionId);

  const sequence = await new Promise((resolve, reject) => {
    const cursorRequest = index.openCursor(range, 'prev');
    cursorRequest.onsuccess = () => {
      resolve((cursorRequest.result?.value.sequence || 0) + 1);
    };
    cursorRequest.onerror = () => reject(
      cursorRequest.error || new Error('Message sequence could not be created.'),
    );
  });

  const message = {
    id: id || createMessageId(),
    user_id: safeUserId,
    session_id: safeSessionId,
    role,
    content,
    created_at: createdAt || new Date().toISOString(),
    sequence,
  };
  store.add(message);
  await transactionDone(transaction);

  // Mirror to localStorage as robust device storage backup
  try {
    saveToLocalStorageBackup(safeUserId, safeSessionId, message);
  } catch {}

  // Update session cookie with 7-day TTL for continued conversation
  try {
    setDeviceSessionCookie({ sessionId: safeSessionId, userId: safeUserId });
  } catch {}

  return message;
}

// ── LocalStorage Fallback & Mirror ──
const LS_PREFIX = 'studycord_chat_';
const LS_META_KEY = 'studycord_device_sessions_meta';
export const COOKIE_TUTOR_SESSION_NAME = 'studycord_tutor_session';
export const COOKIE_TUTOR_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getLsKey(userId, sessionId) {
  return `${LS_PREFIX}${userId}_${sessionId}`;
}

function saveToLocalStorageBackup(userId, sessionId, message) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = getLsKey(userId, sessionId);
  let messages = [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) messages = JSON.parse(raw);
  } catch {}
  if (!Array.isArray(messages)) messages = [];
  messages.push(message);
  // Cap at 100 messages per session to avoid quota pressure
  if (messages.length > 100) messages = messages.slice(-100);
  window.localStorage.setItem(key, JSON.stringify(messages));

  // Update session metadata index with timestamp for TTL pruning
  try {
    const metaRaw = window.localStorage.getItem(LS_META_KEY);
    const meta = metaRaw ? JSON.parse(metaRaw) : {};
    meta[`${userId}_${sessionId}`] = {
      userId,
      sessionId,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch {}
}

export function getLocalStorageBackup(userId, sessionId) {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const key = getLsKey(userId, sessionId);
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

// ── Cookie Session Tracking (7-day TTL, zero DB storage) ──
export function setDeviceSessionCookie({ sessionId, documentId, filename, userId } = {}) {
  if (typeof document === 'undefined') return;
  try {
    const existing = getDeviceSessionCookie() || {};
    const payload = {
      sessionId: sessionId || existing.sessionId,
      documentId: documentId || existing.documentId,
      filename: filename || existing.filename,
      userId: userId || existing.userId,
      updatedAt: Date.now(),
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    const expires = new Date(Date.now() + COOKIE_TUTOR_SESSION_TTL_SECONDS * 1000).toUTCString();
    document.cookie = `${COOKIE_TUTOR_SESSION_NAME}=${encoded}; expires=${expires}; max-age=${COOKIE_TUTOR_SESSION_TTL_SECONDS}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn('Could not set device session cookie:', err);
  }
}

export function getDeviceSessionCookie() {
  if (typeof document === 'undefined') return null;
  try {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
      const [name, ...valParts] = c.split('=');
      if (name.trim() === COOKIE_TUTOR_SESSION_NAME) {
        const val = valParts.join('=');
        if (!val) return null;
        const parsed = JSON.parse(decodeURIComponent(val));
        // Verify 7-day TTL
        if (parsed?.updatedAt && Date.now() - parsed.updatedAt < COOKIE_TUTOR_SESSION_TTL_SECONDS * 1000) {
          return parsed;
        }
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function clearDeviceSessionCookie() {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${COOKIE_TUTOR_SESSION_NAME}=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch {}
}

// ── Automatic Device Storage TTL Pruning (Clean up sessions > 7 days) ──
export function pruneExpiredDeviceSessions(userId, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const metaRaw = window.localStorage.getItem(LS_META_KEY);
    if (!metaRaw) return;
    const meta = JSON.parse(metaRaw);
    const now = Date.now();
    let changed = false;

    for (const [key, record] of Object.entries(meta)) {
      if (record?.updatedAt && now - record.updatedAt > maxAgeMs) {
        window.localStorage.removeItem(`${LS_PREFIX}${key}`);
        delete meta[key];
        changed = true;
      }
    }

    if (changed) {
      window.localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
    }
  } catch (err) {
    console.warn('Prune device sessions notice:', err);
  }
}

export async function clearSessionMessages(userId, sessionId) {
  const safeUserId = requireIdentity(userId, 'user_id');
  const safeSessionId = requireIdentity(sessionId, 'session_id');

  // Clear localStorage mirror
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(getLsKey(safeUserId, safeSessionId));
    }
  } catch {}

  // Clear cookie if this was the active session
  try {
    const cookie = getDeviceSessionCookie();
    if (cookie?.sessionId === safeSessionId) {
      clearDeviceSessionCookie();
    }
  } catch {}

  const database = await initializeRagChatDb();
  const transaction = database.transaction(MESSAGE_STORE, 'readwrite');
  const index = transaction.objectStore(MESSAGE_STORE).index(
    SESSION_SEQUENCE_INDEX,
  );
  const request = index.openCursor(sessionRange(safeUserId, safeSessionId));

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await transactionDone(transaction);
}

export const deleteSessionHistory = clearSessionMessages;

export async function closeRagChatDbForTests() {
  if (!databasePromise) return;
  try {
    const database = await databasePromise;
    database.close();
  } finally {
    databasePromise = null;
  }
}
