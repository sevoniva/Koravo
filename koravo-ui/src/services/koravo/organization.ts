import type { SessionContext, SessionRole } from './session';

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
  return organizationMemberByUserId(userId)?.name || userId || '-';
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
