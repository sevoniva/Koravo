import { describe, expect, it } from 'vitest';
import { accessDeniedHomePath, accessDeniedLoginPath } from './accessDenied';

describe('access denied navigation', () => {
  it('returns a role-owned landing path', () => {
    expect(accessDeniedHomePath('applicant')).toBe('/process-start');
    expect(accessDeniedHomePath('manager')).toBe('/tasks');
    expect(accessDeniedHomePath('operator')).toBe('/ops');
    expect(accessDeniedHomePath('admin')).toBe('/dashboard');
  });

  it('keeps the current route when switching accounts', () => {
    expect(
      accessDeniedLoginPath({
        pathname: '/organization-permissions',
        search: '?tab=members',
        hash: '#current',
      }),
    ).toBe(
      '/login?redirect=%2Forganization-permissions%3Ftab%3Dmembers%23current',
    );
  });
});
