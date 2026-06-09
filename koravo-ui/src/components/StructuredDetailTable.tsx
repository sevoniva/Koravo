import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Empty, Tag, Typography } from 'antd';
import React from 'react';
import {
  auditActionLabel,
  auditResourceLabel,
  businessFieldLabel,
  dataSourceTypeLabel,
  processDefinitionLabel,
  processModelKeyLabel,
  processStatusLabel,
  productCopy,
  taskDefinitionLabel,
} from '@/utils/display';
import { maskSecret } from '@/utils/format';

interface DetailRow {
  key: string;
  field: string;
  value: React.ReactNode;
}

interface StructuredDetailTableProps {
  value?: unknown;
  emptyText?: string;
}

function parseJsonValue(value: string) {
  const text = value.trim();
  if (!/^[{[]/.test(text)) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function splitSummaryPairs(value: string) {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const prev = value[index - 1];
    if (char === '"' && prev !== '\\') quoted = !quoted;
    if (!quoted && (char === '{' || char === '[')) depth += 1;
    if (!quoted && (char === '}' || char === ']')) depth -= 1;
    if (!quoted && depth === 0 && char === ',') {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parseScalar(value: string): unknown {
  const text = value.trim();
  const jsonValue = parseJsonValue(text);
  if (jsonValue !== undefined) return jsonValue;
  if (text.startsWith('{') && text.endsWith('}')) {
    return parseSummaryText(text.slice(1, -1));
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    return splitSummaryPairs(text.slice(1, -1)).map(parseScalar);
  }
  if (text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function parseSummaryText(value: string) {
  if (!value.includes('=')) return undefined;

  const result: Record<string, unknown> = {};
  splitSummaryPairs(value).forEach((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return;
    result[part.slice(0, separator).trim()] = parseScalar(
      part.slice(separator + 1),
    );
  });

  return Object.keys(result).length ? result : undefined;
}

function tryParseStructuredValue(value?: unknown) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return value;
  return parseJsonValue(text) ?? parseSummaryText(text) ?? value;
}

function domainText(rowKey: string, value: unknown) {
  if (typeof value !== 'string') return undefined;
  const field = rowKey.split('.').pop();
  if (field === 'action') return auditActionLabel(value);
  if (field === 'resourceType') return auditResourceLabel(value);
  if (field === 'processDefinitionId') return processDefinitionLabel(value);
  if (field === 'processDefinitionKey' || field === 'modelKey') {
    return processModelKeyLabel(value);
  }
  if (field === 'taskDefinitionKey' || field === 'elementId') {
    return taskDefinitionLabel(value);
  }
  if (field === 'type') return dataSourceTypeLabel(value);
  if (field === 'status' || field === 'statusText') return processStatusLabel(value);
  const copy = productCopy(value);
  return copy && copy !== value ? copy : undefined;
}

function valueToText(value: unknown, rowKey = ''): string {
  const domainValue = domainText(rowKey, value);
  if (domainValue) return domainValue;
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    return value
      .map((item, index) => valueToText(item, `${rowKey}.${index + 1}`))
      .join('、');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([key, child]) =>
          `${businessFieldLabel(key)}：${valueToText(child, rowKey ? `${rowKey}.${key}` : key)}`,
      )
      .join('，');
  }
  return String(value);
}

function formatValue(value: unknown, rowKey = ''): React.ReactNode {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') {
    return <Tag color={value ? 'success' : 'error'}>{value ? '是' : '否'}</Tag>;
  }
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    if (!value.length) return '无';
    return value
      .map((item, index) => valueToText(item, `${rowKey}.${index + 1}`))
      .join('、');
  }
  return (
    <Typography.Text copyable ellipsis={{ tooltip: valueToText(value, rowKey) }}>
      {valueToText(value, rowKey)}
    </Typography.Text>
  );
}

function pathLabel(rowKey: string) {
  return rowKey
    .split('.')
    .map((part) => {
      if (/^\d+$/.test(part)) return `第 ${part} 项`;
      return businessFieldLabel(part);
    })
    .join(' / ');
}

function buildRows(value: unknown, parentKey?: string): DetailRow[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const rowKey = parentKey
        ? `${parentKey}.${index + 1}`
        : String(index + 1);
      if (item && typeof item === 'object') return buildRows(item, rowKey);
      return [
        { key: rowKey, field: pathLabel(rowKey), value: formatValue(item, rowKey) },
      ];
    });
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, item]) => {
      const rowKey = parentKey ? `${parentKey}.${key}` : key;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return buildRows(item, rowKey);
      }
      return [
        {
          key: rowKey,
          field: pathLabel(rowKey),
          value: formatValue(item, rowKey),
        },
      ];
    },
  );
}

const columns: ProColumns<DetailRow>[] = [
  { title: '字段', dataIndex: 'field', width: 220 },
  { title: '内容', dataIndex: 'value', width: 460 },
];

const StructuredDetailTable: React.FC<StructuredDetailTableProps> = ({
  value,
  emptyText = '暂无明细',
}) => {
  const parsed = maskSecret(tryParseStructuredValue(value));
  const rows = buildRows(parsed);

  if (rows.length) {
    return (
      <ProTable<DetailRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        search={false}
        pagination={false}
        options={false}
        scroll={{ x: 680 }}
      />
    );
  }

  if (typeof parsed === 'string' && parsed.trim()) {
    return (
      <ProTable<DetailRow>
        rowKey="key"
        columns={columns}
        dataSource={[
          { key: 'content', field: '内容', value: formatValue(parsed, 'content') },
        ]}
        search={false}
        pagination={false}
        options={false}
        scroll={{ x: 680 }}
      />
    );
  }

  return <Empty description={emptyText} />;
};

export default StructuredDetailTable;
