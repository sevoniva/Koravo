import type { ConnectorExecutionLogItem } from '@/services/koravo/api';
import {
  connectionAddressLabel,
  connectorTypeLabel,
  requestMethodLabel,
  shortTraceLabel,
} from '@/utils/display';
import { formatDuration } from '@/utils/format';

type ConnectorExecutionDisplay = Pick<
  ConnectorExecutionLogItem,
  'connectorType' | 'elapsedMillis' | 'status' | 'statusCode' | 'url'
>;

export function connectorTraceDisplay(requestId?: string) {
  if (!requestId) return '';
  return shortTraceLabel(requestId);
}

export function connectorExecutionTitle(
  record?: Pick<ConnectorExecutionLogItem, 'connectorType' | 'url'>,
) {
  if (!record) return '-';
  const address = connectionAddressLabel(record.url);
  return address && address !== '-'
    ? `${connectorTypeLabel(record.connectorType)} · ${address}`
    : connectorTypeLabel(record.connectorType);
}

export function connectorExecutionStatusTitle(status?: string) {
  return status === 'SUCCESS' ? '连接器调用成功' : '连接器调用失败';
}

export function connectorMethodDisplay(method?: string | null) {
  return requestMethodLabel(method);
}

export function connectorRequestDisplay(
  record?: Pick<ConnectorExecutionLogItem, 'method' | 'url'>,
) {
  if (!record) return '-';
  const method = connectorMethodDisplay(record.method);
  const address = connectionAddressLabel(record.url);
  if (method === '-' && address === '-') return '-';
  return [method, address].filter((item) => item && item !== '-').join(' ');
}

export function connectorExecutionResultSummary(
  record?: ConnectorExecutionDisplay,
) {
  if (!record) return '暂无执行结果';
  const parts: string[] = [];
  if (record.statusCode !== undefined && record.statusCode !== null) {
    parts.push(`状态码 ${record.statusCode}`);
  }
  if (record.elapsedMillis !== undefined && record.elapsedMillis !== null) {
    parts.push(`耗时 ${formatDuration(record.elapsedMillis)}`);
  }
  return parts.join('，') || connectorExecutionStatusTitle(record.status);
}
