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
    const text = error.response?.data?.message || error.message || 'Request failed'
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
