import { getSessionContext, type SessionContext, type SessionRole } from './session';

export interface OrganizationMember {
  key: string;
  name: string;
  userId: string;
  department: string;
  role: SessionRole;
  status: string;
}

const expression = (name: string) => '$' + `{${name}}`;

export const defaultOrganizationMembers: OrganizationMember[] = [
  {
    key: 'admin',
    name: '流程平台负责人',
    userId: 'admin',
    department: '流程平台组',
    role: 'admin',
    status: '启用',
  },
  {
    key: 'applicant',
    name: '业务申请专员',
    userId: 'applicant',
    department: '业务一部',
    role: 'applicant',
    status: '启用',
  },
  {
    key: 'manager',
    name: '业务审批主管',
    userId: 'manager',
    department: '业务一部',
    role: 'manager',
    status: '启用',
  },
  {
    key: 'finance',
    name: '财务复核专员',
    userId: 'finance',
    department: '财务部门',
    role: 'finance',
    status: '启用',
  },
];

export const roleLabels: Record<SessionRole, string> = {
  admin: '管理员',
  applicant: '发起人',
  manager: '业务处理人',
  finance: '财务复核人',
};

export function tenantDisplayName(tenantId?: string | null) {
  if (!tenantId) return '-';
  return tenantId === 'default' ? '当前组织' : tenantId;
}

export function getOrganizationMembers() {
  return defaultOrganizationMembers;
}

export function organizationMemberByUserId(userId?: string | null) {
  if (!userId) return undefined;
  return getOrganizationMembers().find((item) => item.userId === userId);
}

export function organizationMemberName(userId?: string | null) {
  if (!userId) return '-';
  const member = organizationMemberByUserId(userId);
  if (member) return member.name;
  if (/^\$\{.+\}$/.test(userId)) return '按流程变量分配';
  return '待同步成员';
}

type OrganizationProfileFieldKind = 'applicant' | 'department';

interface OrganizationProfileFieldLike {
  fieldKey: string;
  title?: string;
}

function normalizeFieldText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSemanticKey(value?: string | null) {
  return normalizeFieldText(value).replace(/[^a-z0-9]/g, '');
}

function organizationProfileFieldKind(
  fieldKey?: string | null,
  fieldTitle?: string | null,
): OrganizationProfileFieldKind | undefined {
  const key = normalizeSemanticKey(fieldKey);
  const title = String(fieldTitle || '').trim();
  const combined = `${key} ${title}`;
  const assigneeLike =
    /approver|assignee|handler|processor|reviewer/.test(key) ||
    /审批人|处理人|办理人|复核人|负责人/.test(title);

  if (
    [
      'applicant',
      'applicantname',
      'applicantuser',
      'applicantuserid',
      'applicantusername',
      'applicantperson',
      'applicantpersonname',
      'requester',
      'requestername',
      'requesteruser',
      'requesteruserid',
      'requesterusername',
      'requesterperson',
      'requesterpersonname',
      'startuserid',
      'startuser',
      'startusername',
      'startperson',
      'startpersonname',
      'applyuser',
      'applyuserid',
      'applyusername',
      'applyperson',
      'applypersonname',
      'applyemployee',
      'applyemployeename',
      'submitter',
      'submittername',
      'submituserid',
      'submitusername',
      'submitperson',
      'submitpersonname',
      'creator',
      'createdby',
      'creatorname',
      'operator',
      'operatorname',
      'initiator',
      'initiatorname',
    ].includes(key) ||
    /申请人|申请员工|申请人员|申请者|发起人|提交人|填报人|经办人|创建人|报送人|办理发起人|申请账号|发起账号/.test(
      title,
    )
  ) {
    return 'applicant';
  }

  if (
    !assigneeLike &&
    ([
      'department',
      'departmentname',
      'dept',
      'deptname',
      'orgdepartment',
      'orgdept',
      'applydept',
      'applydeptname',
      'applydepartment',
      'applydepartmentname',
      'applicantdepartment',
      'applicantdept',
      'applicantdepartmentname',
      'applicantdeptname',
      'requesterdepartment',
      'requesterdept',
      'requesterdepartmentname',
      'requesterdeptname',
      'startdepartment',
      'startdepartmentname',
      'startdept',
      'startdeptname',
      'submitdepartment',
      'submitdepartmentname',
      'submitdept',
      'submitdeptname',
      'applyunit',
      'applyunitname',
      'applicantunit',
      'applicantunitname',
      'requesterunit',
      'requesterunitname',
      'startunit',
      'startunitname',
      'submitunit',
      'submitunitname',
      'createdepartment',
      'createdept',
      'createunit',
      'createunitname',
      'operatordepartment',
      'operatordept',
      'operatorunit',
      'operatorunitname',
    ].includes(key) ||
      /申请部门|发起部门|提交部门|填报部门|所属部门|所在部门|经办部门|创建部门|报送部门|组织部门|部门名称|所属组织|申请单位|发起单位|提交单位|填报单位|经办单位|创建单位|报送单位|所在单位|所属单位|申请科室|发起科室|提交科室|所属科室|所在科室|部门$|单位$|科室$/.test(
        title,
      ) ||
      /department|dept|unit/.test(combined))
  ) {
    return 'department';
  }

  return undefined;
}

export function isOrganizationProfileField(
  fieldKey?: string | null,
  fieldTitle?: string | null,
) {
  return Boolean(organizationProfileFieldKind(fieldKey, fieldTitle));
}

export function isOrganizationAssigneeField(
  fieldKey?: string | null,
  fieldTitle?: string | null,
) {
  const key = normalizeSemanticKey(fieldKey);
  const title = String(fieldTitle || '').trim();
  return (
    /approver|assignee|handler|processor|reviewer/.test(key) ||
    /审批人|处理人|办理人|复核人|负责人/.test(title)
  );
}

export function organizationAssigneeRole(
  fieldKey?: string | null,
  fieldTitle?: string | null,
): SessionRole | undefined {
  const normalized = String(fieldKey || '').trim();
  const mapping: Record<string, SessionRole> = {
    managerApprover: 'manager',
    financeApprover: 'finance',
  };
  if (mapping[normalized]) return mapping[normalized];
  if (!isOrganizationAssigneeField(fieldKey, fieldTitle)) return undefined;

  const key = normalizeSemanticKey(fieldKey);
  const title = String(fieldTitle || '').trim();
  if (/finance|财务/.test(`${key} ${title}`)) return 'finance';
  if (/manager|business|department|业务|部门/.test(`${key} ${title}`)) return 'manager';
  return undefined;
}

function readableOrganizationValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function organizationProfileFieldValue(
  fieldKey?: string | null,
  values?: Record<string, unknown>,
  session: Pick<SessionContext, 'userId' | 'role'> = getSessionContext(),
  fieldTitle?: string | null,
) {
  const kind = organizationProfileFieldKind(fieldKey, fieldTitle);
  const existing = fieldKey ? readableOrganizationValue(values?.[fieldKey]) : undefined;
  if (existing) {
    return kind === 'applicant'
      ? organizationMemberByUserId(existing)?.name || existing
      : existing;
  }

  const member = organizationMemberByUserId(session.userId);
  if (kind === 'department') return member?.department || '-';
  if (kind === 'applicant') {
    return member?.name || organizationMemberName(session.userId);
  }
  return undefined;
}

export function applyOrganizationProfileValues(
  fields: OrganizationProfileFieldLike[],
  values?: Record<string, unknown>,
  sourceValues?: Record<string, unknown>,
  session: Pick<SessionContext, 'userId' | 'role'> = getSessionContext(),
) {
  return fields.reduce<Record<string, unknown>>(
    (result, field) => {
      if (!isOrganizationProfileField(field.fieldKey, field.title)) return result;
      result[field.fieldKey] = organizationProfileFieldValue(
        field.fieldKey,
        sourceValues,
        session,
        field.title,
      );
      return result;
    },
    { ...(values || {}) },
  );
}

export function organizationMemberSelectOptions(role?: SessionRole) {
  return getOrganizationMembers()
    .filter((member) => member.status === '启用')
    .filter((member) => !role || member.role === role)
    .map((member) => ({
      label: `${member.name}（${member.department}）`,
      value: member.userId,
    }));
}

export function organizationAssigneeFieldValue(
  fieldKey?: string | null,
  values?: Record<string, unknown>,
  fieldTitle?: string | null,
) {
  const existing = fieldKey ? readableOrganizationValue(values?.[fieldKey]) : undefined;
  if (existing) return existing;
  const role = organizationAssigneeRole(fieldKey, fieldTitle);
  return getOrganizationMembers().find((member) => member.status === '启用' && member.role === role)?.userId;
}

export function organizationRoleLabel(role?: SessionRole | null) {
  return role ? roleLabels[role] || role : '-';
}

export function sessionActorLabel(
  session: Pick<SessionContext, 'userId' | 'role'>,
) {
  const memberName = organizationMemberName(session.userId);
  const roleName = organizationRoleLabel(session.role);
  return memberName === roleName ? memberName : `${memberName}（${roleName}）`;
}

export function sessionScopeLabel(session: Pick<SessionContext, 'tenantId' | 'userId' | 'role'>) {
  const member = organizationMemberByUserId(session.userId);
  const department = member?.department ? ` · ${member.department}` : '';
  return `${sessionActorLabel(session)}${department} · ${tenantDisplayName(session.tenantId)}`;
}

export function organizationHandlerOptions() {
  const userOptions = getOrganizationMembers()
    .filter((item) => item.status === '启用')
    .map((item) => ({
      label: `${item.name}（${item.department}）`,
      value: item.userId,
    }));
  return [
    { label: '流程发起人', value: expression('startUserId') },
    { label: '业务审批主管', value: expression('managerApprover') },
    { label: '财务复核专员', value: expression('financeApprover') },
    ...userOptions,
  ];
}

export function organizationGroupOptions() {
  return Array.from(new Set(getOrganizationMembers().map((item) => item.department)))
    .filter(Boolean)
    .map((department) => ({ label: department, value: department }));
}
