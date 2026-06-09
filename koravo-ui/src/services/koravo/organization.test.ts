import { describe, expect, it } from 'vitest';
import { organizationMemberName } from './organization';

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
});
