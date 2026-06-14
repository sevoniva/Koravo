import { organizationMemberName } from '@/services/koravo/organization';

export function completionFieldReadOnly() {
  return true;
}

export function completionAssigneeDisplayLabels(value: unknown) {
  const values = Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [];
  return Array.from(new Set(values)).map(organizationMemberName);
}
