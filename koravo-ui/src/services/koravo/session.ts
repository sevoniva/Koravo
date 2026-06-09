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

let runtimeSession: SessionContext = defaultSession;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function normalizeRole(role?: string): SessionRole {
  if (role === 'admin' || role === 'applicant' || role === 'manager' || role === 'finance') {
    return role;
  }
  return defaultSession.role;
}

function normalizeUserId(userId?: string) {
  const value = String(userId || '').trim();
  if (!value || value === 'anonymous') return runtimeSession.userId;
  return value;
}

export function getSessionContext(): SessionContext {
  if (!canUseStorage()) return runtimeSession;
  const lastRequestId =
    window.localStorage.getItem(LAST_REQUEST_STORAGE_KEY) || undefined;
  return { ...runtimeSession, lastRequestId };
}

export function setRuntimeSessionContext(value: Partial<SessionContext>) {
  runtimeSession = {
    ...runtimeSession,
    tenantId: value.tenantId || runtimeSession.tenantId,
    userId: normalizeUserId(value.userId),
    role: normalizeRole(value.role || runtimeSession.role),
    requestId: value.requestId || runtimeSession.requestId,
  };
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
