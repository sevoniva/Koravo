export interface SessionContext {
  tenantId: string;
  userId: string;
  role: SessionRole;
  requestId: string;
  token?: string;
  expiresAt?: string;
  permissions?: SessionPermissions;
  lastRequestId?: string;
}

export type SessionRole = 'admin' | 'applicant' | 'manager' | 'finance' | 'operator';
export type SessionPermissionKey =
  | 'canAdmin'
  | 'canViewDashboard'
  | 'canViewOwnWork'
  | 'canStartProcess'
  | 'canClaimTask'
  | 'canHandleTask'
  | 'canConfigureWorkflow'
  | 'canManageOrganization'
  | 'canManageIntegration'
  | 'canManageSystem'
  | 'canOperateSystem';
export type SessionPermissions = Partial<Record<SessionPermissionKey, boolean>>;

const LEGACY_SESSION_STORAGE_KEY = 'koravo.session';
const AUTH_SESSION_STORAGE_KEY = 'koravo.auth';
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
  if (
    role === 'admin' ||
    role === 'applicant' ||
    role === 'manager' ||
    role === 'finance' ||
    role === 'operator'
  ) {
    return role;
  }
  return defaultSession.role;
}

function normalizeUserId(userId?: string) {
  const value = String(userId || '').trim();
  if (!value) return defaultSession.userId;
  return value;
}

function sessionExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) return false;
  return timestamp <= Date.now();
}

export function getSessionContext(): SessionContext {
  const authSession = readStoredAuthSession();
  if (authSession) {
    runtimeSession = { ...runtimeSession, ...authSession };
  }
  if (!canUseStorage()) return runtimeSession;
  const lastRequestId =
    window.localStorage.getItem(LAST_REQUEST_STORAGE_KEY) || undefined;
  return { ...runtimeSession, lastRequestId };
}

export function sessionRequestHeaders(headers?: Record<string, string>) {
  const session = getSessionContext();
  const platformToken = process.env.UMI_APP_KORAVO_PLATFORM_TOKEN;
  return {
    'X-Koravo-Tenant-Id': session.tenantId,
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(!session.token && platformToken && session.userId !== 'anonymous'
      ? {
          'X-Koravo-User-Id': session.userId,
          'X-Koravo-User-Role': session.role,
          'X-Koravo-Platform-Token': platformToken,
        }
      : {}),
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
    token: value.token ?? runtimeSession.token,
    expiresAt: value.expiresAt ?? runtimeSession.expiresAt,
    permissions: value.permissions ?? runtimeSession.permissions,
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

function readStoredAuthSession() {
  if (!canUseStorage()) return undefined;
  try {
    const value = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!value) return undefined;
    const parsed = JSON.parse(value) as Partial<SessionContext>;
    if (!parsed.token || !parsed.userId) return undefined;
    if (sessionExpired(parsed.expiresAt)) {
      clearAuthSession();
      return undefined;
    }
    return {
      tenantId: parsed.tenantId || defaultSession.tenantId,
      userId: normalizeUserId(parsed.userId),
      role: normalizeRole(parsed.role),
      requestId: parsed.requestId || '',
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      permissions: parsed.permissions,
    };
  } catch {
    return undefined;
  }
}

export function hasAuthSession() {
  return Boolean(getSessionContext().token);
}

export function setAuthSession(value: Partial<SessionContext> & { token: string }) {
  setRuntimeSessionContext(value);
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        tenantId: runtimeSession.tenantId,
        userId: runtimeSession.userId,
        role: runtimeSession.role,
        requestId: runtimeSession.requestId,
        token: runtimeSession.token,
        expiresAt: runtimeSession.expiresAt,
        permissions: runtimeSession.permissions,
      }),
    );
  } catch {
    // Runtime state is enough for the current tab.
  }
}

export function clearAuthSession() {
  runtimeSession = defaultSession;
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LAST_REQUEST_STORAGE_KEY);
    clearLegacySessionOverride();
  } catch {
    // Ignore storage cleanup failures; the next request will still be unauthenticated.
  }
}

export function defaultRouteForRole(role?: SessionRole) {
  if (role === 'admin') return '/dashboard';
  if (role === 'operator') return '/ops';
  return '/tasks';
}
