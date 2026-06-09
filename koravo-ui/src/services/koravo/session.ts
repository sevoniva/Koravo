export interface SessionContext {
  tenantId: string;
  userId: string;
  role: SessionRole;
  requestId: string;
  lastRequestId?: string;
}

export type SessionRole = 'admin' | 'applicant' | 'manager' | 'finance';

const LEGACY_SESSION_STORAGE_KEY = 'koravo.session';
const LAST_REQUEST_STORAGE_KEY = 'koravo.lastRequestId';

const defaultSession: SessionContext = {
  tenantId: 'default',
  userId: 'admin',
  role: 'admin',
  requestId: '',
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getSessionContext(): SessionContext {
  if (!canUseStorage()) return defaultSession;
  const lastRequestId =
    window.localStorage.getItem(LAST_REQUEST_STORAGE_KEY) || undefined;
  return { ...defaultSession, lastRequestId };
}

function clearLegacySessionOverride() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; the immutable default session still wins.
  }
}

export function setLastRequestId(requestId?: string) {
  if (!requestId || !canUseStorage()) return;
  clearLegacySessionOverride();
  try {
    window.localStorage.setItem(LAST_REQUEST_STORAGE_KEY, requestId);
  } catch {
    // Ignore storage failures; the request itself has already completed.
  }
}
