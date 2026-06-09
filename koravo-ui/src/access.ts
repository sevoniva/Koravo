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
    canStartProcess: isAdmin || role === 'applicant',
    canHandleTask: isAdmin || isApprover,
    canConfigureWorkflow: isAdmin,
    canManageOrganization: isAdmin,
    canManageIntegration: isAdmin,
    canOperateSystem: isAdmin,
  };
}
