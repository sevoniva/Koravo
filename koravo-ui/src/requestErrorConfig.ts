import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import {
  showErrorMessage,
  showErrorNotification,
} from './services/koravo/feedback';
import { getSessionContext, setLastRequestId } from './services/koravo/session';

interface KoravoResponse {
  success?: boolean;
  code?: string;
  message?: string;
  requestId?: string;
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
        const suffix = info.requestId ? `（追踪号 ${info.requestId}）` : '';
        showErrorMessage(`${info.message || '请求失败'}${suffix}`);
        return;
      }

      if (error.response) {
        const requestId =
          error.response?.data?.requestId || error.response?.headers?.['x-request-id'];
        const suffix = requestId ? `（追踪号 ${requestId}）` : '';
        showErrorNotification({
          message: `HTTP ${error.response.status}`,
          description: `后端请求失败${suffix}`,
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
        'X-Tenant-Id': session.tenantId,
        'X-User-Id': session.userId,
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
