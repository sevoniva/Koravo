import { beforeEach, describe, expect, it } from 'vitest';
import {
  getOrganizationMembers,
  applyOrganizationProfileValues,
  isPlatformIdentitySynced,
  isOrganizationAssigneeField,
  isOrganizationProfileField,
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationApprovalMemberSelectOptions,
  organizationApprovalRoleOptions,
  organizationCoverageSummary,
  organizationGroupOptions,
  organizationHandlerOptions,
  organizationMemberIdsByRoles,
  organizationMemberName,
  organizationProfileFieldValue,
  setOrganizationMembers,
} from './organization';

describe('organization display helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOrganizationMembers();
  });

  it('shows registered members by business name', () => {
    expect(organizationMemberName('manager')).toBe('审批主管');
    expect(organizationMemberName('operator')).toBe('运行审计专员');
  });

  it('does not expose unknown account ids in business-facing copy', () => {
    expect(organizationMemberName('123')).toBe('待同步成员');
  });

  it('shows anonymous runtime context as unsynced platform identity', () => {
    expect(organizationMemberName('anonymous')).toBe('平台身份未同步');
    expect(isPlatformIdentitySynced('anonymous')).toBe(false);
    expect(isPlatformIdentitySynced('manager')).toBe(true);
  });

  it('keeps unresolved assignee expressions readable', () => {
    expect(organizationMemberName('${managerApprover}')).toBe('按表单字段分配');
  });

  it('fills applicant, department, and position from the current organization member', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };
    expect(organizationProfileFieldValue('applicant', undefined, session)).toBe(
      '业务申请专员',
    );
    expect(organizationProfileFieldValue('department', undefined, session)).toBe('业务一部');
    expect(organizationProfileFieldValue('position', undefined, session)).toBe('发起人');
  });

  it('recognizes applicant, department, and position fields by business titles', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };
    expect(isOrganizationProfileField('applyUserName', '申请人')).toBe(true);
    expect(isOrganizationProfileField('applyDeptName', '申请部门')).toBe(true);
    expect(isOrganizationProfileField('apply_user_name', '申请员工')).toBe(true);
    expect(isOrganizationProfileField('requesterDept', '提交部门')).toBe(true);
    expect(isOrganizationProfileField('submit_department', '经办部门')).toBe(true);
    expect(isOrganizationProfileField('applicantUserName', '申请人员')).toBe(true);
    expect(isOrganizationProfileField('applyPersonName', '申请者')).toBe(true);
    expect(isOrganizationProfileField('requesterDepartmentName', '部门名称')).toBe(true);
    expect(isOrganizationProfileField('operatorName', '报送人')).toBe(true);
    expect(isOrganizationProfileField('operatorDepartment', '所在单位')).toBe(true);
    expect(isOrganizationProfileField('applyUnitName', '申请单位')).toBe(true);
    expect(isOrganizationProfileField('requesterUnitName', '所属科室')).toBe(true);
    expect(isOrganizationProfileField('applicantRole', '岗位职责')).toBe(true);
    expect(isOrganizationProfileField('jobTitle', '职务')).toBe(true);
    expect(organizationProfileFieldValue('applyUserName', undefined, session, '申请人')).toBe(
      '业务申请专员',
    );
    expect(organizationProfileFieldValue('applyDeptName', undefined, session, '申请部门')).toBe(
      '业务一部',
    );
    expect(organizationProfileFieldValue('applicantRole', undefined, session, '岗位职责')).toBe(
      '发起人',
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
          { fieldKey: 'position', title: '岗位职责' },
          { fieldKey: 'subject', title: '事项名称' },
        ],
        {
          requester: '手工输入',
          department: '手工部门',
          position: '手工岗位',
          subject: '合同审批',
        },
        undefined,
        session,
      ),
    ).toEqual({
      requester: '业务申请专员',
      department: '业务一部',
      position: '发起人',
      subject: '合同审批',
    });
  });

  it('adds linked organization fields even when users never typed them', () => {
    const session = { userId: 'applicant', role: 'applicant' as const };

    expect(
      applyOrganizationProfileValues(
        [
          { fieldKey: 'requester', title: '发起人' },
          { fieldKey: 'department', title: '所属部门' },
          { fieldKey: 'position', title: '岗位职责' },
          { fieldKey: 'subject', title: '事项名称' },
        ],
        { subject: '合同审批' },
        undefined,
        session,
      ),
    ).toEqual({
      requester: '业务申请专员',
      department: '业务一部',
      position: '发起人',
      subject: '合同审批',
    });
  });

  it('uses the platform organization profile instead of browser-local overrides', () => {
    window.localStorage.setItem(
      'koravo:organization-members',
      JSON.stringify([
        {
          key: 'manager',
          name: '审批人',
          userId: 'manager',
          department: '审批中心',
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

    expect(organizationMemberName('manager')).toBe('审批主管');
    expect(organizationMemberName('admin')).toBe('流程平台负责人');
    expect(organizationMemberName('local-only')).toBe('待同步成员');
    expect(
      getOrganizationMembers().find((item) => item.userId === 'manager'),
    ).toMatchObject({
      name: '审批主管',
      department: '审批中心',
    });
  });

  it('uses server organization directory as the runtime member source', () => {
    setOrganizationMembers([
      {
        key: 'manager',
        tenantId: 'tenant-a',
        name: '租户业务负责人',
        userId: 'manager',
        department: '客户成功部',
        role: 'manager',
        status: 'ACTIVE',
      },
    ]);

    expect(organizationMemberName('manager')).toBe('租户业务负责人');
    expect(organizationAssigneeFieldValue('managerApprover')).toBe('manager');
    expect(organizationMemberName('admin')).toBe('待同步成员');
    expect(getOrganizationMembers()).toEqual([
      {
        key: 'manager',
        tenantId: 'tenant-a',
        name: '租户业务负责人',
        userId: 'manager',
        department: '客户成功部',
        role: 'manager',
        status: '启用',
      },
    ]);
  });

  it('summarizes organization coverage for permission operations', () => {
    const members = setOrganizationMembers([
      {
        key: 'admin',
        name: '平台负责人',
        userId: 'admin',
        department: '平台组',
        role: 'admin',
        status: 'ACTIVE',
      },
      {
        key: 'applicant',
        name: '业务发起人',
        userId: 'applicant',
        department: '业务部',
        role: 'applicant',
        status: 'ACTIVE',
      },
      {
        key: 'manager',
        name: '审批主管',
        userId: 'manager',
        department: '审批中心',
        role: 'manager',
        status: 'ACTIVE',
      },
      {
        key: 'operator',
        name: '审计专员',
        userId: 'operator',
        department: '运维组',
        role: 'operator',
        status: 'DISABLED',
      },
    ]);

    expect(organizationCoverageSummary(members)).toMatchObject({
      total: 4,
      active: 3,
      disabled: 1,
      departmentCount: 3,
      approvalRoleCount: 1,
      missingRoles: ['finance', 'operator'],
      roleCounts: {
        admin: 1,
        applicant: 1,
        manager: 1,
      },
    });
  });

  it('does not fall back to default members after an empty server directory sync', () => {
    setOrganizationMembers([]);

    expect(getOrganizationMembers()).toEqual([]);
    expect(organizationMemberName('manager')).toBe('待同步成员');
    expect(organizationApprovalMemberSelectOptions()).toEqual([]);
  });

  it('keeps handler options business-facing', () => {
    const labels = organizationHandlerOptions().map((item) => item.label);
    expect(labels).toContain('流程发起人');
    expect(labels).not.toContain('发起人变量');
  });

  it('builds candidate groups from active organization roles', () => {
    const options = organizationGroupOptions();

    expect(options).toContainEqual({ label: '审批人（1人）', value: 'manager' });
    expect(options).toContainEqual({ label: '复核人（1人）', value: 'finance' });
    expect(options).not.toContainEqual({ label: '流程角色 01', value: 'role-01' });
  });

  it('defaults approval assignee fields from organization roles', () => {
    expect(organizationAssigneeRole('managerApprover')).toBe('manager');
    expect(organizationAssigneeRole('financeApprover')).toBe('finance');
    expect(organizationAssigneeFieldValue('managerApprover')).toBe('manager');
    expect(organizationAssigneeFieldValue('financeApprover')).toBe('finance');
  });

  it('prefers core approval accounts when acceptance users exist', () => {
    setOrganizationMembers([
      {
        key: 'user-role-01',
        name: 'Department 01 role-01 approver',
        userId: 'user-role-01',
        department: 'Department 01',
        role: 'manager',
        status: 'ACTIVE',
      },
      {
        key: 'user-role-02',
        name: 'Department 01 role-02 approver',
        userId: 'user-role-02',
        department: 'Department 01',
        role: 'finance',
        status: 'ACTIVE',
      },
      {
        key: 'manager',
        name: '业务审批主管',
        userId: 'manager',
        department: '业务一部',
        role: 'manager',
        status: 'ACTIVE',
      },
      {
        key: 'finance',
        name: '财务复核专员',
        userId: 'finance',
        department: '财务部门',
        role: 'finance',
        status: 'ACTIVE',
      },
    ]);

    expect(organizationMemberName('user-role-01')).toBe('业务一部审批主管');
    expect(organizationApprovalMemberSelectOptions()).toContainEqual({
      label: '业务一部审批主管（业务一部）',
      value: 'user-role-01',
    });
    expect(organizationAssigneeFieldValue('managerApprover')).toBe('manager');
    expect(organizationAssigneeFieldValue('financeApprover')).toBe('finance');
  });

  it('keeps default approval picker focused on approval roles', () => {
    const values = organizationApprovalMemberSelectOptions().map((item) => item.value);

    expect(values).toEqual(['manager', 'finance']);
    expect(values).not.toContain('applicant');
    expect(values).not.toContain('operator');
  });

  it('expands selected approval roles to active members', () => {
    expect(organizationApprovalRoleOptions()).toEqual([
      { label: '审批人（1人）', value: 'manager' },
      { label: '复核人（1人）', value: 'finance' },
    ]);
    expect(organizationMemberIdsByRoles(['manager', 'finance'])).toEqual([
      'manager',
      'finance',
    ]);
    expect(organizationMemberIdsByRoles(['applicant', 'operator'])).toEqual(
      [],
    );
  });

  it('recognizes approver fields without treating comments as assignees', () => {
    expect(isOrganizationAssigneeField('approvalUser', '审批人')).toBe(true);
    expect(organizationAssigneeRole('approvalUser', '审批人')).toBe('manager');
    expect(isOrganizationAssigneeField('approvalComment', '审批意见')).toBe(false);
  });
});
