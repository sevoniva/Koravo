import { beforeEach, describe, expect, it } from 'vitest';
import { getSessionContext, setLastRequestId, setRuntimeSessionContext } from './session';

describe('session context', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setRuntimeSessionContext({ tenantId: 'default', userId: 'admin', role: 'admin' });
  });

  it('does not restore user identity from browser storage', () => {
    window.localStorage.setItem(
      'koravo.session',
      JSON.stringify({ tenantId: 'default', userId: 'finance', role: 'finance' }),
    );

    expect(getSessionContext()).toMatchObject({
      tenantId: 'default',
      userId: 'admin',
      role: 'admin',
    });
  });

  it('keeps the latest request id without changing identity', () => {
    setLastRequestId('TRACE-20260609-001');

    expect(getSessionContext()).toMatchObject({
      userId: 'admin',
      role: 'admin',
      lastRequestId: 'TRACE-20260609-001',
    });
  });

  it('uses the server runtime context for the current user display', () => {
    setRuntimeSessionContext({
      tenantId: 'finance-org',
      userId: 'finance',
      role: 'finance',
    });

    expect(getSessionContext()).toMatchObject({
      tenantId: 'finance-org',
      userId: 'finance',
      role: 'finance',
    });
  });

  it('keeps the current product user when health reports anonymous', () => {
    setRuntimeSessionContext({ userId: 'anonymous', role: undefined });

    expect(getSessionContext()).toMatchObject({
      userId: 'admin',
      role: 'admin',
    });
  });
});
