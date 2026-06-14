import type {
  SessionPermissionKey,
  SessionPermissions,
} from './services/koravo/session';

export const sessionPermissionKeys: SessionPermissionKey[] = [
  'canAdmin',
  'canViewDashboard',
  'canViewOwnWork',
  'canViewProcessContext',
  'canStartProcess',
  'canClaimTask',
  'canHandleTask',
  'canConfigureWorkflow',
  'canManageOrganization',
  'canManageIntegration',
  'canManageSystem',
  'canViewAudit',
  'canOperateSystem',
];

export function permissionsForRole(
  role?: string,
): Required<SessionPermissions> {
  const isAdmin = role === 'admin';
  const isApprover = role === 'manager' || role === 'finance';
  const isWorkflowUser = role === 'applicant' || isApprover;
  const isOperator = role === 'operator';
  return {
    canAdmin: isAdmin,
    canViewDashboard: isAdmin || isOperator,
    canViewOwnWork: isWorkflowUser,
    canViewProcessContext: isAdmin || isWorkflowUser || isOperator,
    canStartProcess: role === 'applicant',
    canClaimTask: isApprover,
    canHandleTask: isApprover,
    canConfigureWorkflow: isAdmin,
    canManageOrganization: isAdmin,
    canManageIntegration: isAdmin,
    canManageSystem: isAdmin,
    canViewAudit: isAdmin || isOperator,
    canOperateSystem: isOperator,
  };
}

function normalizePermissions(role?: string, permissions?: SessionPermissions) {
  const fallback = permissionsForRole(role);
  return sessionPermissionKeys.reduce<Required<SessionPermissions>>(
    (result, key) => {
      result[key] =
        typeof permissions?.[key] === 'boolean'
          ? permissions[key]
          : fallback[key];
      return result;
    },
    fallback,
  );
}

export default function access(
  initialState:
    | { currentUser?: { access?: string; permissions?: SessionPermissions } }
    | undefined,
) {
  const { currentUser } = initialState ?? {};
  return normalizePermissions(currentUser?.access, currentUser?.permissions);
}
