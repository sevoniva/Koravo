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
  const isWorkflowUser = role === 'applicant' || isApprover;
  const isOperator = role === 'operator';
  return {
    canAdmin: isAdmin,
    canViewDashboard: isAdmin || isOperator,
    canViewOwnWork: isWorkflowUser,
    canStartProcess: role === 'applicant',
    canClaimTask: isApprover,
    canHandleTask: isWorkflowUser,
    canConfigureWorkflow: isAdmin,
    canManageOrganization: isAdmin,
    canManageIntegration: isAdmin,
    canManageSystem: isAdmin,
    canOperateSystem: isOperator,
  };
}
