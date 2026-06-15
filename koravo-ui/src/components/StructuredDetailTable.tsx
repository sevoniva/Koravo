import { type ProColumns, ProTable } from '@ant-design/pro-components';
import { Empty, Space, Tag, Typography } from 'antd';
import React from 'react';
import {
  organizationMemberName,
  organizationRoleLabel,
  tenantDisplayName,
} from '@/services/koravo/organization';
import type { SessionRole } from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  businessFieldLabel,
  businessKeyLabel,
  connectionAddressLabel,
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
  if (text.startsWith('<')) return value;
  return parseJsonValue(text) ?? parseSummaryText(text) ?? value;
}

function isMemberField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return [
    'userId',
    'startUserId',
    'applicantUserId',
    'requesterUserId',
    'applyUserId',
    'submitUserId',
    'assignee',
    'assigneeUser',
    'assigneeUserId',
    'approver',
    'approverUser',
    'approverUserId',
    'reviewer',
    'reviewerUser',
    'reviewerUserId',
    'handler',
    'handlerUser',
    'handlerUserId',
    'processor',
    'processorUser',
    'processorUserId',
    'targetUserId',
    'createdBy',
    'updatedBy',
    'approvalUser',
    'approvalUserId',
  ].includes(field || '');
}

function isMemberListField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return [
    'approvalUsers',
    'approvers',
    'reviewers',
    'assignees',
    'handlers',
    'processors',
    'candidateUsers',
  ].includes(field || '');
}

function isRoleListField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return field === 'candidateGroups' || field === 'roles';
}

function isInternalDetailField(rowKey: string) {
  const field = rowKey.split('.').pop() || '';
  return (
    [
      'approvalUser',
      'approvalUserId',
      'approvalUserName',
      'nrOfInstances',
      'nrOfActiveInstances',
      'nrOfCompletedInstances',
      'nrOfTerminatedInstances',
      'loopCounter',
    ].includes(field) || /^nrOf[A-Z].*Instances$/.test(field)
  );
}

function isOpaqueIdentifier(value: string) {
  return /^[a-f0-9]{16,}$/i.test(value) || /^[0-9a-f-]{24,}$/i.test(value);
}

function isTechnicalIdField(rowKey: string) {
  const field = rowKey.split('.').pop() || '';
  return [
    'id',
    'resourceId',
    'requestId',
    'processInstanceId',
    'processModelId',
    'modelId',
    'taskId',
    'jobId',
    'executionId',
    'deploymentId',
    'formSchemaId',
    'formBindingId',
    'dataSourceId',
    'connectorExecutionId',
  ].includes(field);
}

function isDecisionField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return ['accepted', 'approved', 'decision', 'decisionText'].includes(
    field || '',
  );
}

function isFormDefinitionField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return ['schemaJson', 'schema'].includes(field || '');
}

function isFormLayoutField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return ['uiSchemaJson', 'uiSchema'].includes(field || '');
}

function isWorkflowXmlField(rowKey: string) {
  const field = rowKey.split('.').pop();
  return ['bpmnXml', 'bpmn'].includes(field || '');
}

function decisionValueText(value: unknown) {
  if (value === true) return '同意';
  if (value === false) return '不同意';
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  if (
    ['APPROVED', 'APPROVE', 'ACCEPTED', 'AGREE', 'YES', 'TRUE'].includes(
      normalized,
    )
  ) {
    return '同意';
  }
  if (
    ['REJECTED', 'REJECT', 'DENIED', 'DISAGREE', 'NO', 'FALSE'].includes(
      normalized,
    )
  ) {
    return '不同意';
  }
  if (['RETURNED', 'RETURN', 'BACK'].includes(normalized)) return '退回';
  return undefined;
}

function roleGroupLabel(value: string) {
  const match = /^role[-_]?(\d+)$/i.exec(value);
  if (match) return `审批角色 ${Number(match[1])}`;
  return organizationRoleLabel(value as SessionRole);
}

function fieldTitle(key: string, value?: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const title = (value as Record<string, unknown>).title;
    if (typeof title === 'string' && title.trim()) return title.trim();
  }
  return businessFieldLabel(key);
}

function compactList(items: string[], limit = 4) {
  const values = Array.from(new Set(items.filter(Boolean)));
  if (!values.length) return '';
  const head = values.slice(0, limit).join('、');
  return values.length > limit ? `${head} 等 ${values.length} 项` : head;
}

function formDefinitionSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '表单定义已配置';
  }
  const record = value as Record<string, unknown>;
  const properties =
    record.properties && typeof record.properties === 'object'
      ? (record.properties as Record<string, unknown>)
      : {};
  const fieldNames = Object.entries(properties).map(([key, item]) =>
    fieldTitle(key, item),
  );
  const required = Array.isArray(record.required)
    ? record.required
        .map((key) =>
          typeof key === 'string' ? fieldTitle(key, properties[key]) : '',
        )
        .filter(Boolean)
    : [];

  if (!fieldNames.length) return '表单定义已配置';
  const parts = [`字段 ${fieldNames.length} 个：${compactList(fieldNames)}`];
  if (required.length) parts.push(`必填 ${required.length} 项`);
  return parts.join('；');
}

function widgetLabel(widget?: unknown) {
  const text = String(widget || '').trim();
  const mapping: Record<string, string> = {
    input: '单行文本',
    textarea: '多行文本',
    number: '数字',
    money: '金额',
    select: '下拉选择',
    radio: '单选',
    checkbox: '多选',
    date: '日期',
    dateTime: '日期时间',
    organizationMember: '组织成员',
    organizationMemberMulti: '多人选择',
  };
  return mapping[text] || productCopy(text);
}

function formLayoutSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '表单布局已配置';
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key]) => !key.startsWith('ui:'),
  );
  const widgets = entries
    .map(([, item]) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? widgetLabel(
            (item as Record<string, unknown>)['ui:widget'] ||
              (item as Record<string, unknown>).widget,
          )
        : '',
    )
    .filter(Boolean);
  const parts = [`布局字段 ${entries.length} 个`];
  const widgetText = compactList(widgets, 5);
  if (widgetText) parts.push(`控件：${widgetText}`);
  return parts.join('；');
}

function workflowXmlSummary(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '流程图已配置';
  const text = value.trim();
  const userTaskCount = (text.match(/<(?:\w+:)?userTask\b/g) || []).length;
  const serviceTaskCount = (text.match(/<(?:\w+:)?serviceTask\b/g) || [])
    .length;
  const gatewayCount = (
    text.match(/<(?:\w+:)?(?:parallel|exclusive|inclusive)Gateway\b/g) || []
  ).length;
  const parts = ['流程图已配置'];
  const counts = [
    userTaskCount ? `${userTaskCount} 个审批节点` : '',
    serviceTaskCount ? `${serviceTaskCount} 个系统节点` : '',
    gatewayCount ? `${gatewayCount} 个网关` : '',
  ].filter(Boolean);
  if (counts.length) parts.push(counts.join('、'));
  return parts.join('：');
}

function productSummaryValue(rowKey: string, value: unknown) {
  if (isFormDefinitionField(rowKey)) return formDefinitionSummary(value);
  if (isFormLayoutField(rowKey)) return formLayoutSummary(value);
  if (isWorkflowXmlField(rowKey)) return workflowXmlSummary(value);
  return undefined;
}

function domainText(rowKey: string, value: unknown) {
  if (typeof value !== 'string') return undefined;
  const field = rowKey.split('.').pop();
  if (field === 'action') return auditActionLabel(value);
  if (field === 'resourceType') return auditResourceLabel(value);
  if (field === 'role') return organizationRoleLabel(value as SessionRole);
  if (field === 'candidateGroup') return roleGroupLabel(value);
  if (field === 'tenantId') return tenantDisplayName(value);
  if (isMemberField(rowKey)) return organizationMemberName(value);
  if (field === 'businessKey') return businessKeyLabel(value);
  if (field === 'url' || field === 'jdbcUrl') {
    return connectionAddressLabel(value);
  }
  if (field === 'requestId') return shortTraceLabel(value);
  if (field === 'resourceId') {
    const label = businessKeyLabel(value);
    return /^[a-f0-9]{16,}$/i.test(label) || /^[0-9a-f-]{24,}$/i.test(label)
      ? shortTraceLabel(label)
      : label;
  }
  if (isTechnicalIdField(rowKey) && isOpaqueIdentifier(value)) {
    return shortTraceLabel(value);
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
  if (isDecisionField(rowKey)) {
    return decisionValueText(value) || productCopy(String(value));
  }
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
      typeof item === 'string'
        ? organizationMemberName(item)
        : valueToText(item),
    );
  }
  if (isRoleListField(rowKey)) {
    return value.map((item) =>
      typeof item === 'string' ? roleGroupLabel(item) : valueToText(item),
    );
  }
  return value.map((item, index) =>
    valueToText(item, `${rowKey}.${index + 1}`),
  );
}

function isLongText(value: string) {
  return value.length > 56 || value.includes('\n');
}

function formatValue(value: unknown, rowKey = ''): React.ReactNode {
  if (value === undefined || value === null || value === '') return '-';
  if (isDecisionField(rowKey)) {
    const text = decisionValueText(value) || valueToText(value, rowKey);
    return <Tag color={text === '同意' ? 'success' : 'default'}>{text}</Tag>;
  }
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
    <Typography.Text copyable={{ text }} ellipsis={{ tooltip: text }}>
      {text}
    </Typography.Text>
  );
}

function pathLabel(rowKey: string) {
  const parts = rowKey.split('.');
  return parts
    .map((part) => {
      if (/^\d+$/.test(part)) return `第 ${part} 项`;
      const root = parts[0] || '';
      if ((part === 'body' || part === 'headers') && /response/i.test(root)) {
        return part === 'body' ? '响应体' : '响应头';
      }
      return businessFieldLabel(part);
    })
    .join(' / ');
}

function isSecretDetailField(rowKey: string) {
  const field = rowKey.split('.').pop() || '';
  return /password|token|secret|authorization/i.test(field);
}

function normalizeDetailValue(value: unknown) {
  return tryParseStructuredValue(value);
}

function displayDetailValue(value: unknown, rowKey: string) {
  if (isSecretDetailField(rowKey)) return '******';
  return maskSecret(value);
}

function buildRows(value: unknown, parentKey?: string): DetailRow[] {
  const parsedValue = normalizeDetailValue(value);
  if (!parsedValue || typeof parsedValue !== 'object') return [];
  if (Array.isArray(parsedValue)) {
    return parsedValue.flatMap((item, index) => {
      const rowKey = parentKey
        ? `${parentKey}.${index + 1}`
        : String(index + 1);
      const parsedItem = normalizeDetailValue(item);
      if (parsedItem && typeof parsedItem === 'object') {
        return buildRows(parsedItem, rowKey);
      }
      return [
        {
          key: rowKey,
          field: pathLabel(rowKey),
          value: formatValue(displayDetailValue(parsedItem, rowKey), rowKey),
        },
      ];
    });
  }

  return Object.entries(parsedValue as Record<string, unknown>).flatMap(
    ([key, item]) => {
      const rowKey = parentKey ? `${parentKey}.${key}` : key;
      if (isInternalDetailField(rowKey)) return [];
      const parsedItem = normalizeDetailValue(item);
      const productSummary = productSummaryValue(rowKey, parsedItem);
      if (productSummary) {
        return [
          {
            key: rowKey,
            field: pathLabel(rowKey),
            value: formatValue(productSummary, rowKey),
          },
        ];
      }
      if (
        parsedItem &&
        typeof parsedItem === 'object' &&
        !Array.isArray(parsedItem)
      ) {
        return buildRows(parsedItem, rowKey);
      }
      return [
        {
          key: rowKey,
          field: pathLabel(rowKey),
          value: formatValue(displayDetailValue(parsedItem, rowKey), rowKey),
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
  const parsed = normalizeDetailValue(value);
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
    const text = displayDetailValue(parsed, 'content');
    return (
      <ProTable<DetailRow>
        rowKey="key"
        columns={columns}
        dataSource={[
          {
            key: 'content',
            field: '内容',
            value: formatValue(text, 'content'),
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
