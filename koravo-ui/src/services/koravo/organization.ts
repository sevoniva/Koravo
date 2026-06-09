import { getSessionContext, type SessionContext, type SessionRole } from './session';

export interface OrganizationMember {
  key: string;
  name: string;
  userId: string;
  department: string;
  role: SessionRole;
  status: string;
}

const STORAGE_KEY = 'koravo:organization-members';
const expression = (name: string) => '$' + `{${name}}`;

export const defaultOrganizationMembers: OrganizationMember[] = [
  {
    key: 'admin',
    name: '管理员',
    userId: 'admin',
    department: '流程平台组',
    role: 'admin',
    status: '启用',
  },
  {
    key: 'applicant',
    name: '发起人',
    userId: 'applicant',
    department: '业务部门',
    role: 'applicant',
    status: '启用',
  },
  {
    key: 'manager',
    name: '业务处理人',
    userId: 'manager',
    department: '业务部门',
    role: 'manager',
    status: '启用',
  },
  {
    key: 'finance',
    name: '财务复核人',
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
  return tenantId === 'default' ? '默认组织' : tenantId;
}

export function getOrganizationMembers() {
  if (typeof window === 'undefined') return defaultOrganizationMembers;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultOrganizationMembers;
  try {
    const members = JSON.parse(raw) as OrganizationMember[];
    return Array.isArray(members) && members.length ? members : defaultOrganizationMembers;
  } catch {
    return defaultOrganizationMembers;
  }
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
  return '未登记成员';
}

export function isOrganizationProfileField(fieldKey?: string | null) {
  const normalized = String(fieldKey || '').trim().toLowerCase();
  return ['applicant', 'requester', 'department'].includes(normalized);
}

export function organizationAssigneeRole(fieldKey?: string | null): SessionRole | undefined {
  const normalized = String(fieldKey || '').trim();
  const mapping: Record<string, SessionRole> = {
    managerApprover: 'manager',
    financeApprover: 'finance',
  };
  return mapping[normalized];
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
) {
  const normalized = String(fieldKey || '').trim().toLowerCase();
  const existing = fieldKey ? readableOrganizationValue(values?.[fieldKey]) : undefined;
  if (existing) {
    return normalized === 'applicant' || normalized === 'requester'
      ? organizationMemberByUserId(existing)?.name || existing
      : existing;
  }

  const member = organizationMemberByUserId(session.userId);
  if (normalized === 'department') return member?.department || '-';
  if (normalized === 'applicant' || normalized === 'requester') {
    return member?.name || organizationMemberName(session.userId);
  }
  return undefined;
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
) {
  const existing = fieldKey ? readableOrganizationValue(values?.[fieldKey]) : undefined;
  if (existing) return existing;
  const role = organizationAssigneeRole(fieldKey);
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

export function saveOrganizationMembers(members: OrganizationMember[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

export function organizationHandlerOptions() {
  const userOptions = getOrganizationMembers()
    .filter((item) => item.status === '启用')
    .map((item) => ({
      label: `${item.name}（${item.department}）`,
      value: item.userId,
    }));
  return [
    { label: '发起人变量', value: expression('startUserId') },
    { label: '业务处理人变量', value: expression('managerApprover') },
    { label: '财务复核人变量', value: expression('financeApprover') },
    ...userOptions,
  ];
}

export function organizationGroupOptions() {
  return Array.from(new Set(getOrganizationMembers().map((item) => item.department)))
    .filter(Boolean)
    .map((department) => ({ label: department, value: department }));
}
