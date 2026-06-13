import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { history } from '@umijs/max';
import {
  showErrorMessage,
  showErrorNotification,
} from './services/koravo/feedback';
import {
  clearAuthSession,
  getSessionContext,
  setLastRequestId,
} from './services/koravo/session';

interface KoravoResponse {
  success?: boolean;
  code?: string;
  message?: string;
  requestId?: string;
}

interface RouteLocation {
  pathname?: string;
  search?: string;
  hash?: string;
}

function requestIdSuffix(requestId?: string) {
  return requestId ? `（追踪号 ${requestId}）` : '';
}

export function loginRedirectPath(location: RouteLocation = history.location) {
  const currentPath = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
  if (!currentPath || location.pathname === '/login') return '/login';
  return `/login?redirect=${encodeURIComponent(currentPath)}`;
}

export function handleAuthExpired() {
  clearAuthSession();
  showErrorMessage('登录已过期，请重新登录');
  history.replace(loginRedirectPath());
}

function handleForbidden(requestId?: string) {
  showErrorNotification({
    message: '无权访问',
    description: `当前账号没有此操作权限${requestIdSuffix(requestId)}`,
  });
}

export const errorConfig: RequestConfig = {
  errorConfig: {
    errorThrower: (res) => {
      const response = res as KoravoResponse;
      if (response && response.success === false) {
        const error: any = new Error(response.message || '请求失败');
        error.name = 'KoravoBizError';
        error.info = response;
        throw error;
      }
    },
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler || opts?.silentError) throw error;

      if (error.name === 'KoravoBizError') {
        const info = error.info as KoravoResponse;
        showErrorMessage(`${info.message || '请求失败'}${requestIdSuffix(info.requestId)}`);
        return;
      }

      if (error.response) {
        const requestId =
          error.response?.data?.requestId || error.response?.headers?.['x-request-id'];
        if (error.response.status === 401 && history.location.pathname !== '/login') {
          handleAuthExpired();
          return;
        }
        if (error.response.status === 403) {
          handleForbidden(requestId);
          return;
        }
        showErrorNotification({
          message: `HTTP ${error.response.status}`,
          description: `后端请求失败${requestIdSuffix(requestId)}`,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        showErrorMessage('网络不可用，请检查连接后重试');
        return;
      }

      showErrorMessage('无法连接后端服务，请确认 koravo-server 已启动');
    },
  },

  requestInterceptors: [
    (config: RequestOptions) => {
      const session = getSessionContext();
      config.headers = {
        ...config.headers,
        ...(session.requestId ? { 'X-Request-Id': session.requestId } : {}),
      };
      return config;
    },
  ],

  responseInterceptors: [
    (response) => {
      const data = response?.data as KoravoResponse | undefined;
      setLastRequestId(data?.requestId || response?.headers?.['x-request-id']);
      return response;
    },
  ],
};
