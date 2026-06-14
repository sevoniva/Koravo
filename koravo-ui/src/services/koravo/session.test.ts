import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSessionContext,
  defaultRouteForRole,
  setAuthSession,
  sessionRequestHeaders,
  clearAuthSession,
  setLastRequestId,
  setRuntimeSessionContext,
  loginSuccessRedirectPath,
} from './session';

describe('session context', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthSession();
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

  it('sends bearer session credentials after login', () => {
    setAuthSession({
      tenantId: 'finance-org',
      userId: 'finance',
      role: 'finance',
      token: 'session-token',
      requestId: 'TRACE-20260609-002',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    expect(sessionRequestHeaders()).toEqual({
      'X-Koravo-Tenant-Id': 'finance-org',
      Authorization: 'Bearer session-token',
      'X-Request-Id': 'TRACE-20260609-002',
    });
  });

  it('keeps server permissions with the stored login session', () => {
    setAuthSession({
      tenantId: 'default',
      userId: 'manager',
      role: 'manager',
      token: 'session-token',
      expiresAt: '2099-01-01T00:00:00Z',
      permissions: {
        canHandleTask: true,
        canConfigureWorkflow: false,
      },
    });

    expect(getSessionContext()).toMatchObject({
      userId: 'manager',
      permissions: {
        canHandleTask: true,
        canConfigureWorkflow: false,
      },
    });
  });

  it('clears expired login sessions before sending credentials', () => {
    window.localStorage.setItem(
      'koravo.auth',
      JSON.stringify({
        tenantId: 'default',
        userId: 'manager',
        role: 'manager',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );

    expect(getSessionContext()).toMatchObject({
      tenantId: 'default',
      userId: 'anonymous',
      role: 'anonymous',
    });
    expect(sessionRequestHeaders()).toEqual({
      'X-Koravo-Tenant-Id': 'default',
    });
  });

  it('keeps anonymous responses as unsynced platform identity', () => {
    setRuntimeSessionContext({ userId: 'anonymous', role: undefined });

    expect(getSessionContext()).toMatchObject({
      userId: 'anonymous',
      role: 'anonymous',
    });
  });

  it('routes users to a role-appropriate landing page after login', () => {
    expect(defaultRouteForRole('admin')).toBe('/dashboard');
    expect(defaultRouteForRole('operator')).toBe('/ops');
    expect(defaultRouteForRole('applicant')).toBe('/process-start');
    expect(defaultRouteForRole('manager')).toBe('/tasks');
    expect(defaultRouteForRole('finance')).toBe('/tasks');
  });

  it('returns users to the protected page after login', () => {
    expect(
      loginSuccessRedirectPath(
        'manager',
        '?redirect=%2Ftasks%3Ftab%3Dtodo%23current',
      ),
    ).toBe('/tasks?tab=todo#current');
    expect(loginSuccessRedirectPath('manager')).toBe('/tasks');
  });

  it('ignores unsafe login redirects', () => {
    expect(loginSuccessRedirectPath('admin', '?redirect=https%3A%2F%2Fevil.test')).toBe(
      '/dashboard',
    );
    expect(loginSuccessRedirectPath('admin', '?redirect=%2F%2Fevil.test')).toBe(
      '/dashboard',
    );
    expect(loginSuccessRedirectPath('admin', '?redirect=%2Flogin')).toBe(
      '/dashboard',
    );
  });
});
