import { defaultRouteForRole, type SessionRole } from '@/services/koravo/session';
import { loginRedirectPath } from '@/requestErrorConfig';

interface RouteLocation {
  pathname?: string;
  search?: string;
  hash?: string;
}

export function accessDeniedHomePath(role?: SessionRole) {
  return defaultRouteForRole(role);
}

export function accessDeniedLoginPath(location: RouteLocation) {
  return loginRedirectPath(location);
}
