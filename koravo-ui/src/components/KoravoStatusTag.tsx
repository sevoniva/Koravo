import { Badge, Tag } from 'antd';
import React from 'react';

const statusMap: Record<string, { text: string; color: string; badge: string }> = {
  UP: { text: '正常', color: 'success', badge: 'success' },
  OK: { text: '正常', color: 'success', badge: 'success' },
  READY: { text: '就绪', color: 'success', badge: 'success' },
  SUCCESS: { text: '成功', color: 'success', badge: 'success' },
  RUNNING: { text: '运行中', color: 'processing', badge: 'processing' },
  ACTIVE: { text: '启用', color: 'processing', badge: 'processing' },
  DEPLOYED: { text: '已部署', color: 'processing', badge: 'processing' },
  PENDING: { text: '待处理', color: 'warning', badge: 'warning' },
  FAILED: { text: '失败', color: 'error', badge: 'error' },
  DOWN: { text: '异常', color: 'error', badge: 'error' },
  MISSING: { text: '缺失', color: 'default', badge: 'default' },
  UNKNOWN: { text: '未知', color: 'default', badge: 'default' },
};

export function statusText(value?: string | boolean | null) {
  if (typeof value === 'boolean') return value ? '正常' : '异常';
  const key = String(value || 'UNKNOWN').toUpperCase();
  return statusMap[key]?.text || value || '未知';
}

export const KoravoStatusTag: React.FC<{
  status?: string | boolean | null;
  text?: string;
  mode?: 'tag' | 'badge';
}> = ({ status, text, mode = 'tag' }) => {
  const key =
    typeof status === 'boolean'
      ? status
        ? 'READY'
        : 'FAILED'
      : String(status || 'UNKNOWN').toUpperCase();
  const item = statusMap[key] || statusMap.UNKNOWN;
  const label = text || item.text;

  if (mode === 'badge') {
    return <Badge status={item.badge as any} text={label} />;
  }

  return <Tag color={item.color}>{label}</Tag>;
};
