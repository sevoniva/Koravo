import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorConfig, loginRedirectPath } from './requestErrorConfig';
import {
  clearAuthSession,
  getSessionContext,
  setAuthSession,
} from './services/koravo/session';

const mocks = vi.hoisted(() => ({
  location: {
    pathname: '/tasks',
    search: '?tab=todo',
    hash: '',
  },
  replace: vi.fn(),
  showErrorMessage: vi.fn(),
  showErrorNotification: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: {
    get location() {
      return mocks.location;
    },
    replace: mocks.replace,
  },
}));

vi.mock('./services/koravo/feedback', () => ({
  showErrorMessage: mocks.showErrorMessage,
  showErrorNotification: mocks.showErrorNotification,
}));

function errorHandler() {
  return errorConfig.errorConfig?.errorHandler as (
    error: any,
    opts?: Record<string, unknown>,
  ) => void;
}

describe('request error handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthSession();
    mocks.location = {
      pathname: '/tasks',
      search: '?tab=todo',
      hash: '',
    };
    mocks.replace.mockClear();
    mocks.showErrorMessage.mockClear();
    mocks.showErrorNotification.mockClear();
  });

  it('builds a login redirect from the current route', () => {
    expect(
      loginRedirectPath({
        pathname: '/process-instances',
        search: '?status=active',
        hash: '#current',
      }),
    ).toBe(
      '/login?redirect=%2Fprocess-instances%3Fstatus%3Dactive%23current',
    );
    expect(loginRedirectPath({ pathname: '/login' })).toBe('/login');
  });

  it('clears expired api sessions and preserves the current route', () => {
    setAuthSession({
      tenantId: 'default',
      userId: 'manager',
      role: 'manager',
      token: 'session-token',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    errorHandler()({
      response: {
        status: 401,
        data: { requestId: 'TRACE-401' },
        headers: {},
      },
    });

    expect(getSessionContext()).toMatchObject({
      userId: 'anonymous',
      role: 'applicant',
    });
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      '登录已过期，请重新登录',
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      '/login?redirect=%2Ftasks%3Ftab%3Dtodo',
    );
  });

  it('shows a permission message for forbidden responses', () => {
    errorHandler()({
      response: {
        status: 403,
        data: { requestId: 'TRACE-403' },
        headers: {},
      },
    });

    expect(mocks.showErrorNotification).toHaveBeenCalledWith({
      message: '无权访问',
      description: '当前账号没有此操作权限（追踪号 TRACE-403）',
    });
  });

  it('keeps business error trace ids readable', () => {
    errorHandler()({
      name: 'KoravoBizError',
      info: {
        message: '发布检查未通过',
        requestId: 'TRACE-BIZ',
      },
    });

    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      '发布检查未通过（追踪号 TRACE-BIZ）',
    );
  });
});
