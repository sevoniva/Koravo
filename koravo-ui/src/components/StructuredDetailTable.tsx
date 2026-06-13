import { type ProColumns, ProTable } from '@ant-design/pro-components';
import { Empty, Space, Tag, Typography } from 'antd';
import React from 'react';
import {
  organizationMemberName,
  organizationRoleLabel,
} from '@/services/koravo/organization';
import type { SessionRole } from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  businessFieldLabel,
  businessKeyLabel,
  dataSourceTypeLabel,
  genericStatusLabel,
  processDefinitionLabel,
  processModelKeyLabel,
  processNameLabel,
  productCopy,
  shortTraceLabel,
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

function isMemberField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return [
    'userId',
    'startUserId',
    'assignee',
    'approver',
    'handler',
    'targetUserId',
    'createdBy',
    'updatedBy',
    'approvalUser',
  ].includes(field || '');
}

function isMemberListField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return field === 'approvalUsers' || field === 'candidateUsers';
}

function isRoleListField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return field === 'candidateGroups' || field === 'roles';
}

function roleGroupLabel(value: string) {
  const match = /^role[-_]?(\d+)$/i.exec(value);
  if (match) return `审批角色 ${Number(match[1])}`;
  return organizationRoleLabel(value as SessionRole);
}

function domainText(rowKey: string, value: unknown) {
  if (typeof value !== 'string') return undefined;
  const field = rowKey.split('.').pop();
  if (field === 'action') return auditActionLabel(value);
  if (field === 'resourceType') return auditResourceLabel(value);
  if (field === 'role') return organizationRoleLabel(value as SessionRole);
  if (field === 'candidateGroup') return roleGroupLabel(value);
  if (isMemberField(rowKey)) return organizationMemberName(value);
  if (field === 'businessKey') return businessKeyLabel(value);
  if (field === 'resourceId') {
    const label = businessKeyLabel(value);
    return /^[a-f0-9]{16,}$/i.test(label) || /^[0-9a-f-]{24,}$/i.test(label)
      ? shortTraceLabel(label)
      : label;
  }
  if (field === 'processDefinitionId') return processDefinitionLabel(value);
  if (field === 'processDefinitionKey' || field === 'modelKey') {
    return processModelKeyLabel(value);
  }
  if (field === 'modelName' || field === 'processName')
    return processNameLabel(value);
  if (field === 'taskDefinitionKey' || field === 'elementId') {
    return taskDefinitionLabel(value);
  }
  if (field === 'type') return dataSourceTypeLabel(value);
  if (field === 'status' || field === 'statusText')
    return genericStatusLabel(value);
  const copy = productCopy(value);
  return copy && copy !== value ? copy : undefined;
}

function valueToText(value: unknown, rowKey = ''): string {
  const domainValue = domainText(rowKey, value);
  if (domainValue) return domainValue;
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    if (isMemberListField(rowKey)) {
      return value
        .map((item) =>
          typeof item === 'string'
            ? organizationMemberName(item)
            : valueToText(item),
        )
        .join('、');
    }
    if (isRoleListField(rowKey)) {
      return value
        .map((item) =>
          typeof item === 'string' ? roleGroupLabel(item) : valueToText(item),
        )
        .join('、');
    }
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

function tagList(items: string[]) {
  const counts = new Map<string, number>();
  return (
    <Space size={[0, 6]} wrap>
      {items.map((item) => {
        const count = (counts.get(item) || 0) + 1;
        counts.set(item, count);
        return <Tag key={`${item}-${count}`}>{item}</Tag>;
      })}
    </Space>
  );
}

function arrayValueItems(value: unknown[], rowKey: string) {
  if (isMemberListField(rowKey)) {
    return value.map((item) =>
      typeof item === 'string' ? organizationMemberName(item) : valueToText(item),
    );
  }
  if (isRoleListField(rowKey)) {
    return value.map((item) =>
      typeof item === 'string' ? roleGroupLabel(item) : valueToText(item),
    );
  }
  return value.map((item, index) => valueToText(item, `${rowKey}.${index + 1}`));
}

function isLongText(value: string) {
  return value.length > 56 || value.includes('\n');
}

function formatValue(value: unknown, rowKey = ''): React.ReactNode {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') {
    return <Tag color={value ? 'success' : 'error'}>{value ? '是' : '否'}</Tag>;
  }
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    if (!value.length) return '无';
    return tagList(arrayValueItems(value, rowKey).filter(Boolean));
  }
  const text = valueToText(value, rowKey);
  if (isLongText(text)) {
    return (
      <Typography.Paragraph
        copyable={{ text }}
        ellipsis={{
          rows: 3,
          expandable: 'collapsible',
          symbol: (expanded) => (expanded ? '收起' : '展开'),
        }}
        style={{ marginBottom: 0 }}
      >
        {text}
      </Typography.Paragraph>
    );
  }
  return (
    <Typography.Text
      copyable={{ text }}
      ellipsis={{ tooltip: text }}
    >
      {text}
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
        {
          key: rowKey,
          field: pathLabel(rowKey),
          value: formatValue(item, rowKey),
        },
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
          {
            key: 'content',
            field: '内容',
            value: formatValue(parsed, 'content'),
          },
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
