import type { BpmnTaskDefinition, ProcessModelItem } from '../types/koravo'

export function processDisplayName(modelKey?: string, fallback?: string) {
  const mapping: Record<string, string> = {
    leaveApproval: '请假审批',
    httpConnectorDemo: 'HTTP 健康检查'
  }
  return mapping[modelKey || ''] || fallback || modelKey || '-'
}

export function processDescriptionLabel(model?: Pick<ProcessModelItem, 'modelKey' | 'description'> | null) {
  const description = model?.description?.trim()
  if (!description || /演示|示例|demo/i.test(description)) return processKindLabel(model?.modelKey)
  return description
}

export function productCopy(value?: string | null) {
  if (!value) return ''
  return value
    .replaceAll('演示数据', '流程配置')
    .replaceAll('演示流程', '内置流程')
    .replaceAll('演示接口', '配置接口')
    .replaceAll('内置演示', '内置')
    .replaceAll('演示', '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function processKindLabel(modelKey?: string) {
  const mapping: Record<string, string> = {
    leaveApproval: '人员请假审批流程',
    httpConnectorDemo: 'HTTP 连接器调用流程'
  }
  return mapping[modelKey || ''] || '流程模型'
}

export function processDefinitionLabel(value?: string) {
  if (!value) return ''
  const [key, version] = value.split(':')
  const name = processDisplayName(key)
  return version ? `${name} v${version}` : name
}

export function taskDefinitionLabel(key?: string, task?: Pick<BpmnTaskDefinition, 'name'>) {
  if (!key) return '-'
  const mapping: Record<string, string> = {
    approveTask: '审批请假',
    reviewTask: '确认调用结果'
  }
  return task?.name || mapping[key] || key
}

export function shortTraceLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return ''
  const text = String(value)
  return text.length > 12 ? `追踪号 ${text.slice(0, 8)}` : text
}
