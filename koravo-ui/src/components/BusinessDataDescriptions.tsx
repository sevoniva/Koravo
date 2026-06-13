import {
  ProDescriptions,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { Empty, Space, Tag, Typography } from 'antd';
import React from 'react';
import {
  isOrganizationAssigneeField,
  isOrganizationProfileField,
  organizationMemberName,
  organizationProfileFieldValue,
} from '@/services/koravo/organization';
import { businessFieldLabel, productCopy } from '@/utils/display';
import { maskSecret } from '@/utils/format';

type JsonRecord = Record<string, unknown>;

interface BusinessDataDescriptionsProps {
  emptyText?: string;
  schemaJson?: string;
  uiSchemaJson?: string;
  values?: JsonRecord;
}

interface BusinessField {
  key: string;
  title: string;
  type?: string;
  widget?: string;
}

function parseJsonObject(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch {
    return {};
  }
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

function normalizeStructuredValue(value: unknown) {
  if (typeof value !== 'string') return value;
  return parseJsonValue(value) ?? value;
}

function schemaFields(
  schemaJson?: string,
  uiSchemaJson?: string,
): BusinessField[] {
  const schema = parseJsonObject(schemaJson);
  const uiSchema = parseJsonObject(uiSchemaJson);
  const properties = schema.properties as
    | Record<string, JsonRecord>
    | undefined;
  if (!properties || typeof properties !== 'object') return [];

  return Object.entries(properties).map(([key, property]) => {
    const uiField = uiSchema[key] as JsonRecord | undefined;
    return {
      key,
      title: String(property.title || businessFieldLabel(key)),
      type: typeof property.type === 'string' ? property.type : undefined,
      widget: String(
        property['ui:widget'] ||
          uiField?.['ui:widget'] ||
          uiField?.widget ||
          '',
      ),
    };
  });
}

function isMemberField(field: BusinessField) {
  return (
    field.widget === 'organizationMember' ||
    field.widget === 'organizationMemberMulti' ||
    isOrganizationAssigneeField(field.key, field.title)
  );
}

function isMemberListField(field: BusinessField) {
  return (
    field.widget === 'organizationMemberMulti' ||
    ['approvalUsers', 'candidateUsers'].includes(field.key)
  );
}

function valueText(value: unknown, field?: BusinessField): string {
  const normalized = normalizeStructuredValue(value);
  if (normalized === undefined || normalized === null || normalized === '')
    return '-';
  if (typeof normalized === 'boolean') return normalized ? '是' : '否';
  if (typeof normalized === 'string' && field && isMemberField(field)) {
    return organizationMemberName(normalized);
  }
  if (Array.isArray(normalized)) {
    return normalized.map((item) => valueText(item, field)).join('、') || '-';
  }
  if (typeof normalized === 'object') {
    const entries = Object.entries(normalized as JsonRecord);
    if (!entries.length) return '-';
    return entries
      .map(([key, item]) => `${businessFieldLabel(key)}：${valueText(item)}`)
      .join('，');
  }
  return productCopy(String(normalized)) || String(normalized);
}

function fieldValueText(field: BusinessField, value: unknown): string {
  if (isOrganizationProfileField(field.key, field.title)) {
    return (
      organizationProfileFieldValue(
        field.key,
        { [field.key]: value },
        undefined,
        field.title,
      ) || '-'
    );
  }
  return valueText(value, field);
}

function tagItems(field: BusinessField, value: unknown) {
  const normalized = normalizeStructuredValue(value);
  const values = Array.isArray(normalized) ? normalized : [normalized];
  return values
    .map((item) => {
      if (item === undefined || item === null || item === '') return '';
      return valueText(item, field);
    })
    .filter(Boolean);
}

function renderTagList(field: BusinessField, value: unknown) {
  const items = tagItems(field, value);
  if (!items.length) return '-';
  const counts = new Map<string, number>();
  return (
    <Space size={[0, 6]} wrap>
      {items.map((item) => {
        const count = (counts.get(item) || 0) + 1;
        counts.set(item, count);
        return (
          <Tag key={`${field.key}-${item}-${count}`} color="processing">
            {item}
          </Tag>
        );
      })}
    </Space>
  );
}

function renderValue(field: BusinessField, value: unknown) {
  const normalized = normalizeStructuredValue(value);
  if (normalized === undefined || normalized === null || normalized === '')
    return '-';
  if (typeof normalized === 'boolean') {
    return (
      <Tag color={normalized ? 'success' : 'default'}>
        {normalized ? '是' : '否'}
      </Tag>
    );
  }
  if (typeof normalized === 'number') return normalized.toLocaleString('zh-CN');
  if (
    isMemberListField(field) ||
    (Array.isArray(normalized) && isMemberField(field))
  ) {
    return renderTagList(field, normalized);
  }
  if (isLongField(field, normalized)) {
    return (
      <Typography.Paragraph
        ellipsis={{
          rows: 3,
          expandable: 'collapsible',
          symbol: (expanded) => (expanded ? '收起' : '展开'),
        }}
        style={{ marginBottom: 0 }}
      >
        {fieldValueText(field, normalized)}
      </Typography.Paragraph>
    );
  }
  return (
    <Typography.Text ellipsis={{ tooltip: fieldValueText(field, normalized) }}>
      {fieldValueText(field, normalized)}
    </Typography.Text>
  );
}

function isLongField(field: BusinessField, value: unknown) {
  if (field.widget === 'textarea') return true;
  const normalized = normalizeStructuredValue(value);
  const text = fieldValueText(field, normalized);
  return (
    text.length > 32 ||
    field.type === 'array' ||
    (typeof normalized === 'object' && normalized !== null)
  );
}

function appendExtraFields(fields: BusinessField[], dataSource: JsonRecord) {
  const knownKeys = new Set(fields.map((field) => field.key));
  const extraFields = Object.keys(dataSource)
    .filter((key) => !knownKeys.has(key))
    .map((key) => ({
      key,
      title: businessFieldLabel(key),
    }));
  return [...fields, ...extraFields];
}

const BusinessDataDescriptions: React.FC<BusinessDataDescriptionsProps> = ({
  emptyText = '暂无业务数据',
  schemaJson,
  uiSchemaJson,
  values,
}) => {
  const dataSource = (maskSecret(values || {}) || {}) as JsonRecord;
  const fieldsFromSchema = schemaFields(schemaJson, uiSchemaJson);
  const fields = fieldsFromSchema.length
    ? appendExtraFields(fieldsFromSchema, dataSource)
    : Object.keys(dataSource).map((key) => ({
        key,
        title: businessFieldLabel(key),
      }));

  const visibleFields = fields.filter(
    (field) => dataSource[field.key] !== undefined,
  );

  if (!visibleFields.length) {
    return (
      <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  }

  const columns: ProDescriptionsItemProps<JsonRecord>[] = visibleFields.map(
    (field) => ({
      title: field.title,
      dataIndex: field.key,
      span: isLongField(field, dataSource[field.key]) ? 'filled' : 1,
      render: (_, record) => renderValue(field, record[field.key]),
    }),
  );

  return (
    <ProDescriptions<JsonRecord>
      column={{ xs: 1, sm: 1, md: 2, xl: 3 }}
      dataSource={dataSource}
      columns={columns}
      styles={{
        label: { minWidth: 112, whiteSpace: 'nowrap' },
        content: { minWidth: 0, wordBreak: 'break-word' },
      }}
    />
  );
};

export default BusinessDataDescriptions;
