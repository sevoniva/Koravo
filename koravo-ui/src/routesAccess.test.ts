import { describe, expect, it } from 'vitest';
import routes from '../config/routes';

interface AppRoute {
  path?: string;
  access?: string;
  routes?: AppRoute[];
}

function routeAccessByPath(items: AppRoute[]) {
  const result = new Map<string, string | undefined>();
  const visit = (routeItems: AppRoute[]) => {
    routeItems.forEach((route) => {
      if (route.path) result.set(route.path, route.access);
      if (route.routes) visit(route.routes);
    });
  };
  visit(items);
  return result;
}

describe('route access declarations', () => {
  it('protects configuration and integration leaf routes directly', () => {
    const accessByPath = routeAccessByPath(routes);

    expect(accessByPath.get('/process-models')).toBe('canConfigureWorkflow');
    expect(accessByPath.get('/process-designer')).toBe('canConfigureWorkflow');
    expect(accessByPath.get('/forms')).toBe('canConfigureWorkflow');
    expect(accessByPath.get('/form-bindings')).toBe('canConfigureWorkflow');
    expect(accessByPath.get('/organization-permissions')).toBe(
      'canManageOrganization',
    );
    expect(accessByPath.get('/system-settings')).toBe('canManageSystem');
    expect(accessByPath.get('/datasources')).toBe('canManageIntegration');
    expect(accessByPath.get('/http-connector')).toBe('canManageIntegration');
  });
});
