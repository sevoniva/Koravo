import type { SessionRole } from '@/services/koravo/session';

export interface OrganizationMemberFormValues {
  userId: string;
  name: string;
  department: string;
  role: SessionRole;
  status?: 'ACTIVE' | 'DISABLED';
  password?: string;
}

export function organizationMemberProfilePayload(
  values: OrganizationMemberFormValues,
) {
  return {
    userId: values.userId,
    name: values.name,
    department: values.department,
    role: values.role,
    status: values.status,
  };
}

export function organizationMemberCreatePayload(
  values: OrganizationMemberFormValues,
) {
  return {
    ...organizationMemberProfilePayload(values),
    password: values.password,
  };
}
