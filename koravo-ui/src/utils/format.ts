import type { JsonRecord } from '../types/koravo'

export function formatDateTime(value?: string | number | Date | null) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function formatDuration(milliseconds?: number | null) {
  if (milliseconds === undefined || milliseconds === null) return '-'
  if (milliseconds < 1000) return `${milliseconds} ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`
  const minutes = Math.floor(milliseconds / 60_000)
  const seconds = Math.round((milliseconds % 60_000) / 1000)
  return `${minutes} 分 ${seconds} 秒`
}

export function parseJsonSafe<T = unknown>(value?: string, fallback?: T): T | unknown {
  if (!value) return fallback ?? {}
  try {
    return JSON.parse(value)
  } catch {
    return fallback ?? {}
  }
}

export function maskSecret(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSecret)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [
        key,
        isSecretKey(key) ? '******' : maskSecret(item)
      ])
    )
  }
  if (typeof value === 'string') {
    return value
      .replace(/(password|token|secret)(=|":"|:)[^\s,}&]+/gi, '$1$2***')
      .replace(/(Bearer\s+)[^\s,}]+/gi, '$1***')
  }
  return value
}

export async function copyText(value?: string | number | null) {
  const text = value === undefined || value === null ? '' : String(value)
  if (!text) return false
  await navigator.clipboard.writeText(text)
  return true
}

function isSecretKey(key: string) {
  return /password|token|secret|authorization/i.test(key)
}
