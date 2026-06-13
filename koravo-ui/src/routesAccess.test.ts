import { describe, expect, it } from 'vitest';
import routes from '../config/routes';

interface AppRoute {
  key?: string;
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

function routeByKey(items: AppRoute[], key: string): AppRoute | undefined {
  for (const route of items) {
    if (route.key === key) return route;
    if (route.routes) {
      const child = routeByKey(route.routes, key);
      if (child) return child;
    }
  }
  return undefined;
}

describe('route access declarations', () => {
  it('protects configuration and integration leaf routes directly', () => {
    const accessByPath = routeAccessByPath(routes);

    expect(accessByPath.get('/tasks')).toBe('canHandleTask');
    expect(accessByPath.get('/started-instances')).toBe('canViewOwnWork');
    expect(accessByPath.get('/process-start')).toBe('canStartProcess');
    expect(accessByPath.get('/process-instances')).toBe('canOperateSystem');
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

  it('keeps applicant menu focused on process center', () => {
    const accessByPath = routeAccessByPath(routes);

    expect(routeByKey(routes, 'workbench')?.access).toBe('canHandleTask');
    expect(accessByPath.get('/started-instances')).toBe('canViewOwnWork');
  });
});
