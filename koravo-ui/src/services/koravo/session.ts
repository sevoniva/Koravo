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
  userId: 'anonymous',
  role: 'applicant',
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
  if (!value) return defaultSession.userId;
  return value;
}

export function getSessionContext(): SessionContext {
  if (!canUseStorage()) return runtimeSession;
  const lastRequestId =
    window.localStorage.getItem(LAST_REQUEST_STORAGE_KEY) || undefined;
  return { ...runtimeSession, lastRequestId };
}

export function sessionRequestHeaders(headers?: Record<string, string>) {
  const session = getSessionContext();
  return {
    ...(session.requestId ? { 'X-Request-Id': session.requestId } : {}),
    ...headers,
  };
}

export function setRuntimeSessionContext(value: Partial<SessionContext>) {
  const nextUserId = Object.prototype.hasOwnProperty.call(value, 'userId')
    ? normalizeUserId(value.userId)
    : runtimeSession.userId;
  const nextRole = Object.prototype.hasOwnProperty.call(value, 'role')
    ? normalizeRole(value.role)
    : runtimeSession.role;
  runtimeSession = {
    ...runtimeSession,
    tenantId: value.tenantId || runtimeSession.tenantId,
    userId: nextUserId,
    role: nextRole,
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
