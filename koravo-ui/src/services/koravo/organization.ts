import type { SessionRole } from './session';

export interface OrganizationMember {
  key: string;
  name: string;
  userId: string;
  department: string;
  role: SessionRole;
  status: string;
}

const STORAGE_KEY = 'koravo:organization-members';
const expression = (name: string) => `$${`{${name}}`}`;

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
