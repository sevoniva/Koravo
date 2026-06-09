import { request } from '@umijs/max';
import { getSessionContext, setLastRequestId } from './session';

declare module '@umijs/max' {
  interface RequestOptionsInit {
    silentError?: boolean;
  }
}

export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  requestId?: string;
}

interface KoravoRequestOptions {
  params?: object;
  headers?: Record<string, string>;
  silentError?: boolean;
}

function requestHeaders(headers?: Record<string, string>) {
  const session = getSessionContext();
  return {
    ...(session.requestId ? { 'X-Request-Id': session.requestId } : {}),
    ...headers,
  };
}

async function koravoJsonRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data?: unknown,
  options: KoravoRequestOptions = {},
) {
  const response = await request<ApiResponse<T>>(`/api/v1${url}`, {
    method,
    data,
    params: options.params,
    headers: requestHeaders(options.headers),
    silentError: options.silentError,
  });
  setLastRequestId(response.requestId);
  return { data: response };
}

async function koravoBlobRequest(
  url: string,
  options: KoravoRequestOptions = {},
) {
  const blob = await request<Blob>(`/api/v1${url}`, {
    method: 'GET',
    params: options.params,
    headers: requestHeaders(options.headers),
    responseType: 'blob',
    silentError: options.silentError,
  });
  return { data: blob };
}

export const http = {
  get<T = unknown>(url: string, options?: KoravoRequestOptions) {
    return koravoJsonRequest<T>(url, 'GET', undefined, options);
  },
  post<T = unknown>(url: string, data?: unknown, options?: KoravoRequestOptions) {
    return koravoJsonRequest<T>(url, 'POST', data, options);
  },
  put<T = unknown>(url: string, data?: unknown, options?: KoravoRequestOptions) {
    return koravoJsonRequest<T>(url, 'PUT', data, options);
  },
  delete<T = unknown>(url: string, options?: KoravoRequestOptions) {
    return koravoJsonRequest<T>(url, 'DELETE', undefined, options);
  },
  blob(url: string, options?: KoravoRequestOptions) {
    return koravoBlobRequest(url, options);
  },
};

export async function apiData<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
  options?: { silent?: boolean },
): Promise<T> {
  const response = await promise;
  if (!response.data.success) {
    const error = new Error(response.data.message || '请求失败');
    if (!options?.silent) {
      throw error;
    }
    throw error;
  }
  return response.data.data;
}
