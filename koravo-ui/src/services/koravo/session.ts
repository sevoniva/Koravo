export interface SessionContext {
  tenantId: string;
  userId: string;
  role: SessionRole;
  requestId: string;
  lastRequestId?: string;
}

export type SessionRole = 'admin' | 'applicant' | 'manager' | 'finance';

const STORAGE_KEY = 'koravo.session';

const defaultSession: SessionContext = {
  tenantId: 'default',
  userId: 'admin',
  role: 'admin',
  requestId: '',
};

export function roleForUserId(userId?: string): SessionRole {
  if (userId === 'admin') return 'admin';
  if (userId === 'manager' || userId === 'managerApprover') return 'manager';
  if (userId === 'finance' || userId === 'financeApprover') return 'finance';
  return 'applicant';
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getSessionContext(): SessionContext {
  if (!canUseStorage()) return defaultSession;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSession;
  try {
    const next = { ...defaultSession, ...JSON.parse(raw) };
    return { ...next, role: roleForUserId(next.userId) };
  } catch {
    return defaultSession;
  }
}

export function setSessionContext(value: Partial<SessionContext>) {
  if (!canUseStorage()) return;
  const next = { ...getSessionContext(), ...value };
  next.role = roleForUserId(next.userId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function setLastRequestId(requestId?: string) {
  if (!requestId) return;
  setSessionContext({ lastRequestId: requestId });
}
