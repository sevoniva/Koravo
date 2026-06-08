export interface SessionContext {
  tenantId: string;
  userId: string;
  requestId: string;
  lastRequestId?: string;
}

const STORAGE_KEY = 'koravo.session';

const defaultSession: SessionContext = {
  tenantId: 'default',
  userId: 'admin',
  requestId: '',
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getSessionContext(): SessionContext {
  if (!canUseStorage()) return defaultSession;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSession;
  try {
    return { ...defaultSession, ...JSON.parse(raw) };
  } catch {
    return defaultSession;
  }
}

export function setSessionContext(value: Partial<SessionContext>) {
  if (!canUseStorage()) return;
  const next = { ...getSessionContext(), ...value };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function setLastRequestId(requestId?: string) {
  if (!requestId) return;
  setSessionContext({ lastRequestId: requestId });
}
