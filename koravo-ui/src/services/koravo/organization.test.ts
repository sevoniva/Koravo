import { describe, expect, it } from 'vitest';
import {
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationMemberName,
  organizationProfileFieldValue,
} from './organization';

describe('organization display helpers', () => {
  it('shows registered members by business name', () => {
    expect(organizationMemberName('manager')).toBe('业务处理人');
  });

  it('does not expose unknown account ids in business-facing copy', () => {
    expect(organizationMemberName('123')).toBe('未登记成员');
  });

  it('keeps unresolved assignee expressions readable', () => {
    expect(organizationMemberName('${managerApprover}')).toBe('按流程变量分配');
  });

  it('fills applicant and department from the current organization member', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };
    expect(organizationProfileFieldValue('applicant', undefined, session)).toBe('发起人');
    expect(organizationProfileFieldValue('department', undefined, session)).toBe('业务部门');
  });

  it('keeps existing process applicant values readable during task handling', () => {
    const session = { userId: 'manager', role: 'manager' as const };
    expect(
      organizationProfileFieldValue('applicant', { applicant: 'applicant' }, session),
    ).toBe('发起人');
  });

  it('defaults approval assignee fields from organization roles', () => {
    expect(organizationAssigneeRole('managerApprover')).toBe('manager');
    expect(organizationAssigneeRole('financeApprover')).toBe('finance');
    expect(organizationAssigneeFieldValue('managerApprover')).toBe('manager');
    expect(organizationAssigneeFieldValue('financeApprover')).toBe('finance');
  });
});
