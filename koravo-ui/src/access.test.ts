import { describe, expect, it } from 'vitest';
import access from './access';

describe('access rules', () => {
  it('keeps applicant navigation focused on personal workflow work', () => {
    const rules = access({ currentUser: { access: 'applicant' } });

    expect(rules.canViewOwnWork).toBe(true);
    expect(rules.canHandleTask).toBe(true);
    expect(rules.canStartProcess).toBe(true);
    expect(rules.canClaimTask).toBe(false);
    expect(rules.canConfigureWorkflow).toBe(false);
    expect(rules.canManageIntegration).toBe(false);
    expect(rules.canOperateSystem).toBe(false);
    expect(rules.canViewDashboard).toBe(false);
  });

  it('lets approval roles work on tasks without exposing admin consoles', () => {
    const rules = access({ currentUser: { access: 'manager' } });

    expect(rules.canViewOwnWork).toBe(true);
    expect(rules.canClaimTask).toBe(true);
    expect(rules.canStartProcess).toBe(false);
    expect(rules.canConfigureWorkflow).toBe(false);
    expect(rules.canOperateSystem).toBe(false);
  });

  it('keeps admin responsible for configuration and operations', () => {
    const rules = access({ currentUser: { access: 'admin' } });

    expect(rules.canAdmin).toBe(true);
    expect(rules.canViewDashboard).toBe(true);
    expect(rules.canViewOwnWork).toBe(false);
    expect(rules.canStartProcess).toBe(false);
    expect(rules.canClaimTask).toBe(false);
    expect(rules.canConfigureWorkflow).toBe(true);
    expect(rules.canManageOrganization).toBe(true);
    expect(rules.canManageIntegration).toBe(true);
    expect(rules.canManageSystem).toBe(true);
    expect(rules.canOperateSystem).toBe(false);
  });

  it('keeps operators focused on monitoring and audit', () => {
    const rules = access({ currentUser: { access: 'operator' } });

    expect(rules.canViewDashboard).toBe(true);
    expect(rules.canViewOwnWork).toBe(false);
    expect(rules.canStartProcess).toBe(false);
    expect(rules.canClaimTask).toBe(false);
    expect(rules.canConfigureWorkflow).toBe(false);
    expect(rules.canManageOrganization).toBe(false);
    expect(rules.canManageIntegration).toBe(false);
    expect(rules.canOperateSystem).toBe(true);
  });
});
