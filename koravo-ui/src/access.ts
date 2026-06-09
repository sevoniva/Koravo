/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState:
    | { currentUser?: { access?: string } }
    | undefined,
) {
  const { currentUser } = initialState ?? {};
  const role = currentUser?.access;
  const isAdmin = role === 'admin';
  const isApprover = role === 'manager' || role === 'finance';
  return {
    canAdmin: isAdmin,
    canViewDashboard: isAdmin,
    canViewOwnWork: Boolean(role),
    canStartProcess: isAdmin || role === 'applicant',
    canClaimTask: isAdmin || isApprover,
    canHandleTask: Boolean(role),
    canConfigureWorkflow: isAdmin,
    canManageOrganization: isAdmin,
    canManageIntegration: isAdmin,
    canOperateSystem: isAdmin,
  };
}
