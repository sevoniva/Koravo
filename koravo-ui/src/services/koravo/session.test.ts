import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSessionContext,
  sessionRequestHeaders,
  setLastRequestId,
  setRuntimeSessionContext,
} from './session';

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
      tenantId: 'ops-org',
      userId: 'operator',
      role: 'operator',
    });

    expect(getSessionContext()).toMatchObject({
      tenantId: 'ops-org',
      userId: 'operator',
      role: 'operator',
    });
  });

  it('sends the platform identity context with each request', () => {
    setRuntimeSessionContext({
      tenantId: 'finance-org',
      userId: 'finance',
      role: 'finance',
      requestId: 'TRACE-20260609-002',
    });

    expect(sessionRequestHeaders()).toEqual({
      'X-Koravo-Tenant-Id': 'finance-org',
      'X-Koravo-User-Id': 'finance',
      'X-Koravo-User-Role': 'finance',
      'X-Request-Id': 'TRACE-20260609-002',
    });
  });

  it('keeps anonymous responses as unsynced platform identity', () => {
    setRuntimeSessionContext({ userId: 'anonymous', role: undefined });

    expect(getSessionContext()).toMatchObject({
      userId: 'anonymous',
      role: 'applicant',
    });
  });
});
