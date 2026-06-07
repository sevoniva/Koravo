import axios from 'axios'
import { message } from 'ant-design-vue'
import { useSessionStore } from '../stores/session'

export interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
  requestId?: string
}

export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 10000
})

http.interceptors.request.use((config) => {
  const session = useSessionStore()
  config.headers['X-Tenant-Id'] = session.tenantId
  config.headers['X-User-Id'] = session.userId
  if (session.requestId) {
    config.headers['X-Request-Id'] = session.requestId
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const session = useSessionStore()
    session.setLastRequestId(response.data?.requestId || response.headers['x-request-id'])
    return response
  },
  (error) => {
    const session = useSessionStore()
    session.setLastRequestId(error.response?.data?.requestId || error.response?.headers?.['x-request-id'])
    const text = readableError(error)
    message.error(text)
    return Promise.reject(error)
  }
)

export async function apiData<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await request
  if (!response.data.success) {
    message.error(response.data.message)
    throw new Error(response.data.message)
  }
  return response.data.data
}

function readableError(error: any) {
  const requestId = error.response?.data?.requestId || error.response?.headers?.['x-request-id']
  const suffix = requestId ? `（请求 ID：${requestId}）` : ''
  const serverMessage = error.response?.data?.message
  if (serverMessage) {
    return `${serverMessage}${suffix}`
  }
  if (error.code === 'ECONNABORTED') {
    return `请求超时，请检查后端服务是否正常${suffix}`
  }
  if (!error.response) {
    return `无法连接后端服务，请确认 koravo-server 已启动${suffix}`
  }
  return `请求失败：HTTP ${error.response.status}${suffix}`
}
