import { beforeEach, describe, expect, it } from 'vitest';
import {
  getOrganizationMembers,
  applyOrganizationProfileValues,
  isOrganizationAssigneeField,
  isOrganizationProfileField,
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationHandlerOptions,
  organizationMemberName,
  organizationProfileFieldValue,
} from './organization';

describe('organization display helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows registered members by business name', () => {
    expect(organizationMemberName('manager')).toBe('业务审批主管');
  });

  it('does not expose unknown account ids in business-facing copy', () => {
    expect(organizationMemberName('123')).toBe('未登记成员');
  });

  it('keeps unresolved assignee expressions readable', () => {
    expect(organizationMemberName('${managerApprover}')).toBe('按流程变量分配');
  });

  it('fills applicant and department from the current organization member', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };
    expect(organizationProfileFieldValue('applicant', undefined, session)).toBe(
      '业务申请专员',
    );
    expect(organizationProfileFieldValue('department', undefined, session)).toBe('业务一部');
  });

  it('recognizes applicant and department fields by business titles', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };
    expect(isOrganizationProfileField('applyUserName', '申请人')).toBe(true);
    expect(isOrganizationProfileField('applyDeptName', '申请部门')).toBe(true);
    expect(isOrganizationProfileField('apply_user_name', '申请员工')).toBe(true);
    expect(isOrganizationProfileField('requesterDept', '提交部门')).toBe(true);
    expect(isOrganizationProfileField('submit_department', '经办部门')).toBe(true);
    expect(isOrganizationProfileField('applicantUserName', '申请人员')).toBe(true);
    expect(isOrganizationProfileField('applyPersonName', '申请者')).toBe(true);
    expect(isOrganizationProfileField('requesterDepartmentName', '部门名称')).toBe(true);
    expect(organizationProfileFieldValue('applyUserName', undefined, session, '申请人')).toBe(
      '业务申请专员',
    );
    expect(organizationProfileFieldValue('applyDeptName', undefined, session, '申请部门')).toBe(
      '业务一部',
    );
  });

  it('keeps existing process applicant values readable during task handling', () => {
    const session = { userId: 'manager', role: 'manager' as const };
    expect(
      organizationProfileFieldValue('applicant', { applicant: 'applicant' }, session),
    ).toBe('业务申请专员');
  });

  it('overwrites applicant and department fields from the linked organization profile', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };

    expect(
      applyOrganizationProfileValues(
        [
          { fieldKey: 'requester', title: '发起人' },
          { fieldKey: 'department', title: '所属部门' },
          { fieldKey: 'subject', title: '事项名称' },
        ],
        {
          requester: '手工输入',
          department: '手工部门',
          subject: '合同审批',
        },
        undefined,
        session,
      ),
    ).toEqual({
      requester: '业务申请专员',
      department: '业务一部',
      subject: '合同审批',
    });
  });

  it('uses the platform organization profile instead of browser-local overrides', () => {
    window.localStorage.setItem(
      'koravo:organization-members',
      JSON.stringify([
        {
          key: 'manager',
          name: '业务处理人',
          userId: 'manager',
          department: '业务部门',
          role: 'manager',
          status: '启用',
        },
        {
          key: 'local-only',
          name: '浏览器本地成员',
          userId: 'local-only',
          department: '临时部门',
          role: 'manager',
          status: '启用',
        },
      ]),
    );

    expect(organizationMemberName('manager')).toBe('业务审批主管');
    expect(organizationMemberName('admin')).toBe('流程平台负责人');
    expect(organizationMemberName('local-only')).toBe('未登记成员');
    expect(
      getOrganizationMembers().find((item) => item.userId === 'manager'),
    ).toMatchObject({
      name: '业务审批主管',
      department: '业务一部',
    });
  });

  it('keeps handler options business-facing', () => {
    const labels = organizationHandlerOptions().map((item) => item.label);
    expect(labels).toContain('流程发起人');
    expect(labels).not.toContain('发起人变量');
  });

  it('defaults approval assignee fields from organization roles', () => {
    expect(organizationAssigneeRole('managerApprover')).toBe('manager');
    expect(organizationAssigneeRole('financeApprover')).toBe('finance');
    expect(organizationAssigneeFieldValue('managerApprover')).toBe('manager');
    expect(organizationAssigneeFieldValue('financeApprover')).toBe('finance');
  });

  it('recognizes approver fields without treating comments as assignees', () => {
    expect(isOrganizationAssigneeField('businessUser', '业务审批人')).toBe(true);
    expect(organizationAssigneeRole('businessUser', '业务审批人')).toBe('manager');
    expect(isOrganizationAssigneeField('approvalComment', '审批意见')).toBe(false);
  });
});
