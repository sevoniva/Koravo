import { ProDescriptions, type ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Empty, Grid, Tag, Typography } from 'antd';
import React from 'react';
import { businessFieldLabel } from '@/utils/display';
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

function schemaFields(schemaJson?: string, uiSchemaJson?: string): BusinessField[] {
  const schema = parseJsonObject(schemaJson);
  const uiSchema = parseJsonObject(uiSchemaJson);
  const properties = schema.properties as Record<string, JsonRecord> | undefined;
  if (!properties || typeof properties !== 'object') return [];

  return Object.entries(properties).map(([key, property]) => {
    const uiField = uiSchema[key] as JsonRecord | undefined;
    return {
      key,
      title: String(property.title || businessFieldLabel(key)),
      type: typeof property.type === 'string' ? property.type : undefined,
      widget: String(property['ui:widget'] || uiField?.['ui:widget'] || uiField?.widget || ''),
    };
  });
}

function valueText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map(valueText).join('、') || '-';
  if (typeof value === 'object') {
    const entries = Object.entries(value as JsonRecord);
    if (!entries.length) return '-';
    return entries
      .map(([key, item]) => `${businessFieldLabel(key)}：${valueText(item)}`)
      .join('，');
  }
  return String(value);
}

function renderValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') {
    return <Tag color={value ? 'success' : 'default'}>{value ? '是' : '否'}</Tag>;
  }
  if (typeof value === 'number') return value.toLocaleString('zh-CN');
  return (
    <Typography.Text ellipsis={{ tooltip: valueText(value) }}>
      {valueText(value)}
    </Typography.Text>
  );
}

function isLongField(field: BusinessField, value: unknown) {
  if (field.widget === 'textarea') return true;
  const text = valueText(value);
  return text.length > 32 || field.type === 'array' || typeof value === 'object';
}

const BusinessDataDescriptions: React.FC<BusinessDataDescriptionsProps> = ({
  emptyText = '暂无业务数据',
  schemaJson,
  uiSchemaJson,
  values,
}) => {
  const screens = Grid.useBreakpoint();
  const wideLayout = Boolean(screens.md);
  const dataSource = (maskSecret(values || {}) || {}) as JsonRecord;
  const fieldsFromSchema = schemaFields(schemaJson, uiSchemaJson);
  const fields = fieldsFromSchema.length
    ? fieldsFromSchema
    : Object.keys(dataSource).map((key) => ({ key, title: businessFieldLabel(key) }));

  const visibleFields = fields.filter((field) => dataSource[field.key] !== undefined);

  if (!visibleFields.length) {
    return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const columns: ProDescriptionsItemProps<JsonRecord>[] = visibleFields.map((field) => ({
    title: field.title,
    dataIndex: field.key,
    span: isLongField(field, dataSource[field.key]) && wideLayout ? 2 : 1,
    render: (_, record) => renderValue(record[field.key]),
  }));

  return (
    <ProDescriptions<JsonRecord>
      column={{ xs: 1, sm: 1, md: 2 }}
      dataSource={dataSource}
      columns={columns}
    />
  );
};

export default BusinessDataDescriptions;
