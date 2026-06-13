import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  PageContainer,
  type ProColumns,
  ProForm,
  ProFormDatePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormList,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Flex,
  Form,
  Popconfirm,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import KoravoDrawer from '@/components/KoravoDrawer';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import OrganizationProfileFormItem from '@/components/OrganizationProfileFormItem';
import {
  activateFormSchema,
  createFormSchema,
  disableFormSchema,
  type FormBindingItem,
  type FormSchemaItem,
  type FormSchemaVersionItem,
  listFormBindings,
  listFormSchemas,
  listFormSchemaVersions,
  restoreFormSchemaVersion,
  updateFormSchema,
} from '@/services/koravo/api';
import {
  isOrganizationAssigneeField,
  isOrganizationProfileField,
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationMemberSelectOptions,
  organizationProfileFieldValue,
} from '@/services/koravo/organization';
import {
  ASSET_ORIGIN_LABELS,
  assetOriginColor,
  assetOriginLabel,
  formSchemaKeyLabel,
  formSchemaNameLabel,
  productCopy,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface FormSchemaForm {
  formKey: string;
  formName: string;
  fields: FormFieldConfig[];
  confirmBindingImpact?: boolean;
}

interface FormFieldConfig {
  fieldKey: string;
  title: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  widget?:
    | 'input'
    | 'textarea'
    | 'number'
    | 'switch'
    | 'select'
    | 'organizationProfile'
    | 'organizationMember'
    | 'organizationMemberMulti';
  placeholder?: string;
  options?: string[];
  format?: string;
  required?: boolean;
  permission?: 'editable' | 'readonly' | 'hidden';
  visibleWhenField?: string;
  visibleWhenValue?: string;
}

interface JsonSchemaProperty {
  title?: string;
  type?: string;
  enum?: unknown[];
  format?: string;
  'ui:placeholder'?: string;
  'ui:widget'?: string;
}

const START_FORM_TASK_KEY = '__START__';

const useStyles = createStyles(({ css, token }) => ({
  fieldList: css`
    .ant-pro-form-list-container,
    .ant-pro-form-list-row,
    .ant-pro-form-list-content {
      width: 100%;
      min-width: 0;
    }

    .ant-pro-form-list-container {
      display: grid;
      gap: 12px;
    }

    .ant-pro-form-list-row {
      align-items: flex-start;
      padding: 12px 14px;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadius}px;
      background: ${token.colorFillAlter};
    }

    .ant-pro-form-list-action {
      align-self: flex-start;
      padding-top: 30px;
    }
  `,
  fieldGrid: css`
    display: grid;
    width: 100%;
    grid-template-columns:
      minmax(180px, 1.15fr)
      minmax(180px, 1.15fr)
      minmax(126px, 0.75fr)
      minmax(160px, 0.95fr);
    gap: 10px 12px;
    align-items: start;
    padding: 2px 0;

    .ant-form-item {
      min-width: 0;
      margin-bottom: 8px;
    }

    .ant-form-item-label > label {
      color: ${token.colorTextSecondary};
      font-size: ${token.fontSizeSM}px;
    }

    @media (max-width: 760px) {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }

    @media (max-width: 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  fieldWide: css`
    grid-column: span 2;

    .ant-form-item-control-input-content,
    .ant-select,
    .ant-input,
    .ant-input-number,
    .ant-picker {
      width: 100%;
      max-width: 100%;
    }

    @media (max-width: 560px) {
      grid-column: span 1;
    }
  `,
  fieldSwitch: css`
    .ant-form-item-control-input {
      min-height: 34px;
    }
  `,
}));

const defaultFields: FormFieldConfig[] = [
  {
    fieldKey: 'requester',
    title: '发起人',
    type: 'string',
    widget: 'organizationProfile',
    required: true,
  },
  {
    fieldKey: 'department',
    title: '所属部门',
    type: 'string',
    widget: 'organizationProfile',
  },
  {
    fieldKey: 'subject',
    title: '事项名称',
    type: 'string',
    widget: 'input',
    required: true,
  },
  { fieldKey: 'amount', title: '金额', type: 'number', widget: 'number' },
  {
    fieldKey: 'description',
    title: '事项说明',
    type: 'string',
    widget: 'textarea',
    required: true,
  },
  { fieldKey: 'remark', title: '备注', type: 'string', widget: 'textarea' },
];

const defaultNewField: FormFieldConfig = {
  fieldKey: '',
  title: '',
  type: 'string',
  widget: 'input',
  permission: 'editable',
};

const fieldTypeOptions = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '开关', value: 'boolean' },
  { label: '多选', value: 'array' },
];

const widgetOptions = [
  { label: '单行文本', value: 'input' },
  { label: '多行文本', value: 'textarea' },
  { label: '下拉选择', value: 'select' },
  { label: '数字输入', value: 'number' },
  { label: '开关', value: 'switch' },
];

const formatOptions = [{ label: '日期', value: 'date' }];

const permissionOptions = [
  { label: '可填写', value: 'editable' },
  { label: '只读', value: 'readonly' },
  { label: '隐藏', value: 'hidden' },
];

const fieldTypeText: Record<FormFieldConfig['type'], string> = {
  string: '文本',
  number: '数字',
  boolean: '开关',
  array: '多选',
};

interface FormBindingImpact {
  total: number;
  start: number;
  task: number;
  versions: number[];
}

function bindingImpact(
  formSchemaId: string | undefined,
  bindings: FormBindingItem[],
): FormBindingImpact {
  const matched = bindings.filter(
    (binding) => binding.formSchemaId === formSchemaId,
  );
  return {
    total: matched.length,
    start: matched.filter(
      (binding) => binding.taskDefinitionKey === START_FORM_TASK_KEY,
    ).length,
    task: matched.filter(
      (binding) => binding.taskDefinitionKey !== START_FORM_TASK_KEY,
    ).length,
    versions: Array.from(
      new Set(
        matched.map((binding) => binding.formSchemaVersion).filter(Boolean),
      ),
    ).sort((a, b) => a - b),
  };
}

function bindingImpactText(impact: FormBindingImpact) {
  if (!impact.total) return '未绑定流程节点';
  const parts = [
    impact.start ? `${impact.start} 个启动表单` : '',
    impact.task ? `${impact.task} 个任务节点` : '',
  ].filter(Boolean);
  const versionText = impact.versions.length
    ? `，版本 ${impact.versions.map((version) => `v${version}`).join('、')}`
    : '';
  return `${parts.join('、')}${versionText}`;
}

const BindingImpactSummary: React.FC<{
  impact: FormBindingImpact;
  compact?: boolean;
}> = ({ impact, compact }) => {
  if (!impact.total) {
    return compact ? (
      <Badge status="default" text="未绑定" />
    ) : (
      <Alert
        showIcon
        type="info"
        title="尚未绑定流程节点"
        description="可在表单绑定页设置启动表单或任务表单。"
      />
    );
  }

  if (compact) {
    return (
      <Space size={[0, 4]} wrap>
        <Badge status="processing" text={`${impact.total} 处绑定`} />
        {impact.start ? <Tag color="success">启动 {impact.start}</Tag> : null}
        {impact.task ? <Tag color="blue">任务 {impact.task}</Tag> : null}
      </Space>
    );
  }

  return (
    <Alert
      showIcon
      type="warning"
      title={`已绑定 ${impact.total} 处流程配置`}
      description={
        <Flex vertical gap={8}>
          <Typography.Text type="secondary">
            {bindingImpactText(impact)}，历史快照不变。
          </Typography.Text>
          <Space wrap>
            {impact.start ? (
              <Tag color="success">启动表单 {impact.start}</Tag>
            ) : null}
            {impact.task ? (
              <Tag color="blue">任务表单 {impact.task}</Tag>
            ) : null}
            {impact.versions.map((version) => (
              <Tag key={version}>v{version}</Tag>
            ))}
          </Space>
        </Flex>
      }
    />
  );
};

const widgetText: Record<NonNullable<FormFieldConfig['widget']>, string> = {
  input: '单行文本',
  textarea: '多行文本',
  select: '下拉选择',
  number: '数字输入',
  switch: '开关',
  organizationProfile: '系统带出',
  organizationMember: '组织成员',
  organizationMemberMulti: '组织成员多选',
};

const systemFieldTooltip = '系统字段由组织档案联动，保存时自动按系统带出处理。';

const parseJsonObject = (value?: string) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeFieldType = (type?: string): FormFieldConfig['type'] => {
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'array') return 'array';
  return 'string';
};

const normalizeWidget = (
  widget: unknown,
  type: FormFieldConfig['type'],
): NonNullable<FormFieldConfig['widget']> => {
  if (widget === 'organizationProfile') return 'organizationProfile';
  if (widget === 'organizationMember') return 'organizationMember';
  if (widget === 'organizationMemberMulti') return 'organizationMemberMulti';
  if (type === 'array') return 'select';
  if (type === 'boolean') return 'switch';
  if (type === 'number') return 'number';
  if (widget === 'textarea') return 'textarea';
  if (widget === 'select') return 'select';
  return 'input';
};

const usesOrganizationProfile = (field: {
  fieldKey?: string;
  title?: string;
  widget?: string;
}) =>
  field.widget === 'organizationProfile' ||
  isOrganizationProfileField(field.fieldKey, field.title);

const usesOrganizationAssignee = (field: {
  fieldKey?: string;
  title?: string;
  widget?: string;
}) =>
  field.widget === 'organizationMember' ||
  field.widget === 'organizationMemberMulti' ||
  isOrganizationAssigneeField(field.fieldKey, field.title);

const usesOrganizationAssigneeMulti = (field: {
  fieldKey?: string;
  title?: string;
  type?: string;
  widget?: string;
}) =>
  field.widget === 'organizationMemberMulti' ||
  (field.type === 'array' &&
    isOrganizationAssigneeField(field.fieldKey, field.title));

const normalizeOptions = (options?: unknown[]) => {
  if (!Array.isArray(options)) return undefined;
  const normalized = options
    .map(String)
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length ? normalized : undefined;
};

const normalizeOptionValues = (options?: string[]) => {
  const normalized = (options || []).map((item) => item.trim()).filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : undefined;
};

const normalizePermission = (
  permission?: unknown,
): NonNullable<FormFieldConfig['permission']> => {
  return permission === 'readonly' || permission === 'hidden'
    ? permission
    : 'editable';
};

function fieldDisplayName(field: Pick<FormFieldConfig, 'fieldKey' | 'title'>) {
  return field.title?.trim() || field.fieldKey;
}

function comparableField(field: FormFieldConfig) {
  return {
    title: field.title?.trim() || '',
    type: field.type,
    widget: field.widget || normalizeWidget(undefined, field.type),
    placeholder: field.placeholder?.trim() || '',
    options: normalizeOptionValues(field.options) || [],
    format: field.format || '',
    required: Boolean(field.required),
    permission: field.permission || 'editable',
    visibleWhenField: field.visibleWhenField?.trim() || '',
    visibleWhenValue: field.visibleWhenValue?.trim() || '',
  };
}

function fieldChanged(before: FormFieldConfig, after: FormFieldConfig) {
  return (
    JSON.stringify(comparableField(before)) !==
    JSON.stringify(comparableField(after))
  );
}

function fieldChangeSummary(
  originalFields: FormFieldConfig[],
  currentFields?: FormFieldConfig[],
) {
  const original = originalFields.filter((field) => field.fieldKey?.trim());
  const current = (currentFields || []).filter((field) =>
    field.fieldKey?.trim(),
  );
  const originalByKey = new Map(
    original.map((field) => [field.fieldKey, field]),
  );
  const currentByKey = new Map(current.map((field) => [field.fieldKey, field]));

  return {
    added: current.filter((field) => !originalByKey.has(field.fieldKey)),
    removed: original.filter((field) => !currentByKey.has(field.fieldKey)),
    changed: current.filter((field) => {
      const before = originalByKey.get(field.fieldKey);
      return before ? fieldChanged(before, field) : false;
    }),
  };
}

const schemaToFields = (
  schemaJson?: string,
  uiSchemaJson?: string,
  fallback: FormFieldConfig[] = [],
): FormFieldConfig[] => {
  const schema = parseJsonObject(schemaJson);
  const uiSchema = parseJsonObject(uiSchemaJson);
  const properties = schema.properties as
    | Record<string, JsonSchemaProperty>
    | undefined;
  if (!properties || typeof properties !== 'object') return fallback;
  const required = Array.isArray(schema.required)
    ? schema.required.map(String)
    : [];

  return Object.entries(properties).map(([fieldKey, property]) => {
    const type = normalizeFieldType(property?.type);
    const uiField = uiSchema[fieldKey] as Record<string, unknown> | undefined;
    const widget =
      uiField?.['ui:widget'] || uiField?.widget || property?.['ui:widget'];
    const normalizedWidget = normalizeWidget(widget, type);
    const isProfileField =
      normalizedWidget === 'organizationProfile' ||
      isOrganizationProfileField(fieldKey, property?.title);
    const isAssigneeField =
      normalizedWidget === 'organizationMember' ||
      normalizedWidget === 'organizationMemberMulti' ||
      isOrganizationAssigneeField(fieldKey, property?.title);
    const isAssigneeMultiField = usesOrganizationAssigneeMulti({
      fieldKey,
      title: property?.title,
      type,
      widget: String(normalizedWidget),
    });
    const placeholder =
      uiField?.['ui:placeholder'] ||
      uiField?.placeholder ||
      property?.['ui:placeholder'];
    const options = normalizeOptions(property?.enum);
    return {
      fieldKey,
      title: productCopy(property?.title) || fieldKey,
      type: isAssigneeMultiField
        ? 'array'
        : isProfileField || isAssigneeField
          ? 'string'
          : type,
      widget: isProfileField
        ? 'organizationProfile'
        : isAssigneeMultiField
          ? 'organizationMemberMulti'
          : isAssigneeField
            ? 'organizationMember'
            : options?.length
              ? 'select'
              : normalizedWidget,
      placeholder:
        isProfileField || isAssigneeField
          ? undefined
          : typeof placeholder === 'string'
            ? placeholder
            : undefined,
      options: isProfileField || isAssigneeField ? undefined : options,
      format: isProfileField || isAssigneeField ? undefined : property?.format,
      required: required.includes(fieldKey),
      permission: normalizePermission(uiField?.permission),
      visibleWhenField:
        typeof uiField?.visibleWhenField === 'string'
          ? uiField.visibleWhenField
          : undefined,
      visibleWhenValue:
        typeof uiField?.visibleWhenValue === 'string'
          ? uiField.visibleWhenValue
          : undefined,
    };
  });
};

const buildPayload = (values: FormSchemaForm) => {
  const fields = (values.fields || []).map((field) => {
    const isProfileField = usesOrganizationProfile(field);
    const isAssigneeField = usesOrganizationAssignee(field);
    const isAssigneeMultiField = usesOrganizationAssigneeMulti(field);
    const type = isAssigneeMultiField
      ? 'array'
      : isProfileField || isAssigneeField
        ? 'string'
        : field.type;
    const options =
      isProfileField || isAssigneeField
        ? undefined
        : normalizeOptionValues(field.options);
    const widget = isProfileField
      ? 'organizationProfile'
      : isAssigneeMultiField
        ? 'organizationMemberMulti'
        : isAssigneeField
          ? 'organizationMember'
          : field.type === 'string' && options?.length
            ? 'select'
            : normalizeWidget(field.widget, field.type);
    return {
      ...field,
      fieldKey: field.fieldKey.trim(),
      title: field.title.trim(),
      type,
      widget,
      options,
      placeholder:
        isProfileField || isAssigneeField ? undefined : field.placeholder,
      format: isProfileField || isAssigneeField ? undefined : field.format,
    };
  });

  const properties = fields.reduce<
    Record<
      string,
      {
        title: string;
        type: string;
        items?: { type: string };
        enum?: string[];
        format?: string;
        'ui:placeholder'?: string;
        'ui:widget'?: string;
      }
    >
  >((result, field) => {
    const options = normalizeOptionValues(field.options);
    result[field.fieldKey] = {
      title: field.title,
      type: field.type,
      ...(field.type === 'array' ? { items: { type: 'string' } } : {}),
      ...(options ? { enum: options } : {}),
      ...(field.format?.trim() ? { format: field.format.trim() } : {}),
      ...(field.placeholder?.trim()
        ? { 'ui:placeholder': field.placeholder.trim() }
        : {}),
      ...(field.widget ? { 'ui:widget': field.widget } : {}),
    };
    return result;
  }, {});
  const uiSchema = fields.reduce<
    Record<
      string,
      {
        'ui:widget': string;
        'ui:placeholder'?: string;
        permission?: string;
        visibleWhenField?: string;
        visibleWhenValue?: string;
      }
    >
  >((result, field) => {
    result[field.fieldKey] = {
      'ui:widget': field.widget || normalizeWidget(undefined, field.type),
      ...(field.permission && field.permission !== 'editable'
        ? { permission: field.permission }
        : {}),
      ...(field.visibleWhenField?.trim() && field.visibleWhenValue?.trim()
        ? {
            visibleWhenField: field.visibleWhenField.trim(),
            visibleWhenValue: field.visibleWhenValue.trim(),
          }
        : {}),
      ...(field.placeholder?.trim()
        ? { 'ui:placeholder': field.placeholder.trim() }
        : {}),
    };
    return result;
  }, {});

  return {
    formKey: values.formKey,
    formName: formSchemaNameLabel(values.formName),
    schemaJson: JSON.stringify(
      {
        type: 'object',
        required: fields
          .filter((field) => field.required)
          .map((field) => field.fieldKey),
        properties,
      },
      null,
      2,
    ),
    uiSchemaJson: JSON.stringify(uiSchema, null, 2),
  };
};

const hasDuplicatedFieldKey = (fields: FormFieldConfig[]) => {
  const keys = fields.map((field) => field.fieldKey.trim()).filter(Boolean);
  return new Set(keys).size !== keys.length;
};

const fieldColumns: ProColumns<FormFieldConfig>[] = [
  { title: '字段名称', dataIndex: 'title', width: 180 },
  {
    title: '业务字段',
    dataIndex: 'fieldKey',
    width: 180,
    render: (_, record) => <CopyableText value={record.fieldKey} />,
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 96,
    render: (_, record) => <Tag>{fieldTypeText[record.type]}</Tag>,
  },
  {
    title: '控件',
    dataIndex: 'widget',
    width: 120,
    render: (_, record) => {
      if (usesOrganizationProfile(record)) {
        return <Tag color="processing">系统带出</Tag>;
      }
      if (usesOrganizationAssignee(record)) {
        return (
          <Tag color="blue">
            {usesOrganizationAssigneeMulti(record)
              ? '组织成员多选'
              : '组织成员'}
          </Tag>
        );
      }
      return (
        <Tag>{widgetText[normalizeWidget(record.widget, record.type)]}</Tag>
      );
    },
  },
  {
    title: '选项/格式',
    dataIndex: 'options',
    width: 220,
    search: false,
    renderText: (_, record) => {
      if (record.options?.length) return record.options.join('、');
      return record.format === 'date' ? '日期' : '-';
    },
  },
  {
    title: '规则',
    dataIndex: 'required',
    width: 96,
    render: (_, record) =>
      record.required ? <Tag color="red">必填</Tag> : <Tag>选填</Tag>,
  },
  {
    title: '权限',
    dataIndex: 'permission',
    width: 96,
    render: (_, record) => {
      if (record.permission === 'readonly') return <Tag color="blue">只读</Tag>;
      if (record.permission === 'hidden')
        return <Tag color="default">隐藏</Tag>;
      return <Tag color="success">可填写</Tag>;
    },
  },
  {
    title: '显示条件',
    key: 'visibleWhen',
    width: 180,
    renderText: (_, record) =>
      record.visibleWhenField && record.visibleWhenValue
        ? `${record.visibleWhenField} = ${record.visibleWhenValue}`
        : '-',
  },
];

const renderPreviewField = (field: FormFieldConfig) => {
  if (field.permission === 'hidden') return null;
  const rules = field.required
    ? [{ required: true, message: `请填写${field.title}` }]
    : undefined;
  const name = field.fieldKey;
  if (usesOrganizationAssignee(field)) {
    const isMulti = usesOrganizationAssigneeMulti(field);
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={
          isMulti
            ? [
                organizationAssigneeFieldValue(
                  'managerApprover',
                  undefined,
                  '第一审批人',
                ),
                organizationAssigneeFieldValue(
                  'financeApprover',
                  undefined,
                  '第二审批人',
                ),
              ].filter(Boolean)
            : organizationAssigneeFieldValue(
                field.fieldKey,
                undefined,
                field.title,
              )
        }
        options={organizationMemberSelectOptions(
          isMulti
            ? undefined
            : organizationAssigneeRole(field.fieldKey, field.title),
        )}
        tooltip="办理人由组织成员带出。"
        disabled
        fieldProps={
          isMulti ? { mode: 'multiple', maxTagCount: 'responsive' } : undefined
        }
        rules={
          field.required
            ? [{ required: true, message: `${field.title}会自动带出` }]
            : undefined
        }
      />
    );
  }
  if (usesOrganizationProfile(field)) {
    return (
      <OrganizationProfileFormItem
        key={field.fieldKey}
        name={name}
        label={field.title}
        value={organizationProfileFieldValue(
          field.fieldKey,
          undefined,
          undefined,
          field.title,
        )}
        required={field.required}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <ProFormDigit
        key={field.fieldKey}
        name={name}
        label={field.title}
        placeholder={field.placeholder}
        rules={rules}
        fieldProps={{ precision: 2 }}
      />
    );
  }
  if (field.type === 'boolean') {
    return (
      <ProFormSwitch key={field.fieldKey} name={name} label={field.title} />
    );
  }
  if (field.options?.length) {
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        placeholder={field.placeholder}
        options={field.options.map((item) => ({ label: item, value: item }))}
        rules={
          field.required
            ? [{ required: true, message: `请选择${field.title}` }]
            : undefined
        }
      />
    );
  }
  if (field.format === 'date') {
    return (
      <ProFormDatePicker
        key={field.fieldKey}
        name={name}
        label={field.title}
        placeholder={field.placeholder}
        fieldProps={{ format: 'YYYY-MM-DD' }}
        rules={
          field.required
            ? [{ required: true, message: `请选择${field.title}` }]
            : undefined
        }
      />
    );
  }
  if (field.widget === 'textarea') {
    return (
      <ProFormTextArea
        key={field.fieldKey}
        name={name}
        label={field.title}
        placeholder={field.placeholder}
        rules={rules}
        fieldProps={{ rows: 4 }}
      />
    );
  }
  return (
    <ProFormText
      key={field.fieldKey}
      name={name}
      label={field.title}
      placeholder={field.placeholder}
      rules={rules}
    />
  );
};

const renderFormPreview = (fields: FormFieldConfig[]) =>
  fields.length ? (
    <ProForm layout="vertical" disabled submitter={false}>
      {fields.map(renderPreviewField)}
    </ProForm>
  ) : (
    <Empty description="暂无字段配置" />
  );

const renderFormVersionSummary = (
  record: FormSchemaItem,
  fields: FormFieldConfig[],
  impact: FormBindingImpact,
) => (
  <Descriptions
    size="small"
    column={{ xs: 1, sm: 2 }}
    items={[
      {
        key: 'formKey',
        label: '表单标识',
        children: (
          <CopyableText
            value={record.formKey}
            displayValue={formSchemaKeyLabel(record.formKey)}
          />
        ),
      },
      {
        key: 'version',
        label: '当前版本',
        children: <Tag color="blue">v{record.version || 1}</Tag>,
      },
      {
        key: 'status',
        label: '状态',
        children: <KoravoStatusTag status={record.status} />,
      },
      {
        key: 'origin',
        label: '来源',
        children: (
          <Tag color={assetOriginColor(record.assetOrigin)}>
            {assetOriginLabel(record.assetOrigin)}
          </Tag>
        ),
      },
      {
        key: 'fieldCount',
        label: '字段数',
        children: fields.length,
      },
      {
        key: 'impact',
        label: '绑定影响',
        children: <BindingImpactSummary compact impact={impact} />,
      },
    ]}
  />
);

const FormReadiness: React.FC<{
  fields: FormFieldConfig[];
  impact: FormBindingImpact;
}> = ({ fields, impact }) => {
  const requiredFields = fields.filter((field) => field.required);
  const systemFields = fields.filter(usesOrganizationProfile);
  const assigneeFields = fields.filter(usesOrganizationAssignee);
  const conditionalFields = fields.filter(
    (field) => field.visibleWhenField && field.visibleWhenValue,
  );
  const hiddenFields = fields.filter((field) => field.permission === 'hidden');

  const tagGroup = (items: FormFieldConfig[], emptyText: string) =>
    items.length ? (
      <Space size={[0, 6]} wrap>
        {items.map((field) => (
          <Tag key={field.fieldKey}>{fieldDisplayName(field)}</Tag>
        ))}
      </Space>
    ) : (
      <Typography.Text type="secondary">{emptyText}</Typography.Text>
    );

  return (
    <Flex vertical gap={16}>
      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2 }}
        items={[
          {
            key: 'fieldCount',
            label: '字段数量',
            children: `${fields.length} 个`,
          },
          {
            key: 'requiredCount',
            label: '必填字段',
            children: `${requiredFields.length} 个`,
          },
          {
            key: 'systemCount',
            label: '组织联动',
            children: `${systemFields.length + assigneeFields.length} 个`,
          },
          {
            key: 'bindingCount',
            label: '流程绑定',
            children: impact.total ? `${impact.total} 处` : '未绑定',
          },
          {
            key: 'requiredFields',
            label: '必填项',
            span: 'filled',
            children: tagGroup(requiredFields, '无必填项'),
          },
          {
            key: 'systemFields',
            label: '系统带出',
            span: 'filled',
            children: tagGroup(
              [...systemFields, ...assigneeFields],
              '未配置组织联动字段',
            ),
          },
          {
            key: 'conditionalFields',
            label: '条件显示',
            span: 'filled',
            children: tagGroup(conditionalFields, '未配置条件显示'),
          },
          {
            key: 'hiddenFields',
            label: '隐藏字段',
            span: 'filled',
            children: tagGroup(hiddenFields, '无隐藏字段'),
          },
        ]}
      />
      <Alert
        showIcon
        type={impact.total ? 'warning' : 'info'}
        title={impact.total ? '已绑定流程节点' : '尚未绑定流程节点'}
        description={
          impact.total
            ? `${bindingImpactText(impact)}。字段变更只影响新的发起和办理，历史快照保持原样。`
            : '绑定到流程节点后，发起和办理页面会按这里的字段配置渲染。'
        }
      />
    </Flex>
  );
};

interface FormFieldsEditorClassNames {
  fieldList: string;
  fieldGrid: string;
  fieldWide: string;
  fieldSwitch: string;
}

const renderFormFieldsEditor = (classNames: FormFieldsEditorClassNames) => (
  <div className={classNames.fieldList}>
    <ProFormList
      name="fields"
      label="字段清单"
      creatorButtonProps={{ creatorButtonText: '添加字段' }}
      creatorRecord={defaultNewField}
      copyIconProps={false}
      arrowSort
      alwaysShowItemLabel
      min={1}
    >
      <div className={classNames.fieldGrid}>
        <ProFormDependency name={['fieldKey', 'title', 'widget']}>
          {({ fieldKey, title, widget }) => {
            const isSystemField =
              usesOrganizationProfile({ fieldKey, title, widget }) ||
              usesOrganizationAssignee({ fieldKey, title, widget });
            return (
              <>
                <ProFormText
                  name="fieldKey"
                  label="业务字段"
                  width="sm"
                  disabled={isSystemField}
                  tooltip={
                    isSystemField
                      ? systemFieldTooltip
                      : '用于流程变量和表单绑定，建议使用稳定英文名。'
                  }
                  rules={[
                    { required: true, message: '请输入业务字段' },
                    {
                      pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
                      message: '仅支持字母、数字、下划线，且不能以数字开头',
                    },
                  ]}
                />
                <ProFormText
                  name="title"
                  label="字段名称"
                  width="sm"
                  disabled={isSystemField}
                  tooltip={isSystemField ? systemFieldTooltip : undefined}
                  rules={[{ required: true, message: '请输入字段名称' }]}
                />
              </>
            );
          }}
        </ProFormDependency>
        <ProFormDependency name={['fieldKey', 'title', 'widget']}>
          {({ fieldKey, title, widget }) => {
            const isProfileField = usesOrganizationProfile({
              fieldKey,
              title,
              widget,
            });
            const isAssigneeField = usesOrganizationAssignee({
              fieldKey,
              title,
              widget,
            });
            const isSystemField = isProfileField || isAssigneeField;
            return (
              <>
                <ProFormSelect
                  name="type"
                  label="类型"
                  width="xs"
                  disabled={isSystemField}
                  options={fieldTypeOptions}
                  rules={[{ required: true, message: '请选择类型' }]}
                />
                <ProFormSelect
                  name="widget"
                  label="控件"
                  width="sm"
                  disabled={isSystemField}
                  options={
                    isProfileField
                      ? [{ label: '系统带出', value: 'organizationProfile' }]
                      : isAssigneeField
                        ? [
                            {
                              label: usesOrganizationAssigneeMulti({
                                fieldKey,
                                title,
                                widget,
                              })
                                ? '组织成员多选'
                                : '组织成员',
                              value: usesOrganizationAssigneeMulti({
                                fieldKey,
                                title,
                                widget,
                              })
                                ? 'organizationMemberMulti'
                                : 'organizationMember',
                            },
                          ]
                        : widgetOptions
                  }
                  rules={[{ required: true, message: '请选择控件' }]}
                />
                <ProFormText
                  name="placeholder"
                  label="输入提示"
                  className={classNames.fieldWide}
                  disabled={isSystemField}
                  placeholder={
                    isSystemField ? '自动联动' : '例如：请输入事项说明'
                  }
                />
                <ProFormSelect
                  name="format"
                  label="格式"
                  width="xs"
                  allowClear
                  disabled={isSystemField}
                  options={formatOptions}
                  placeholder="不限制"
                />
                <ProFormSelect
                  name="options"
                  label="选项"
                  className={classNames.fieldWide}
                  disabled={isSystemField}
                  placeholder={isSystemField ? '自动联动' : '输入选项后回车'}
                  tooltip="配置后在发起和办理表单中显示为下拉选择。"
                  fieldProps={{
                    mode: 'tags',
                    tokenSeparators: [',', '，'],
                  }}
                />
              </>
            );
          }}
        </ProFormDependency>
        <ProFormSelect
          name="permission"
          label="权限"
          width="xs"
          options={permissionOptions}
        />
        <ProFormText
          name="visibleWhenField"
          label="显示字段"
          className={classNames.fieldWide}
          placeholder="例如：type"
        />
        <ProFormText
          name="visibleWhenValue"
          label="显示值"
          className={classNames.fieldWide}
          placeholder="例如：合同"
        />
        <ProFormSwitch
          name="required"
          label="必填"
          className={classNames.fieldSwitch}
        />
      </div>
    </ProFormList>
  </div>
);

const ChangeTagList: React.FC<{
  label: string;
  fields: FormFieldConfig[];
  color: string;
}> = ({ label, fields, color }) => {
  if (!fields.length) return null;
  return (
    <Space size={[4, 4]} wrap>
      <Tag color={color}>
        {label} {fields.length}
      </Tag>
      {fields.slice(0, 4).map((field) => (
        <Tag key={`${label}-${field.fieldKey}`}>{fieldDisplayName(field)}</Tag>
      ))}
      {fields.length > 4 ? <Tag>还有 {fields.length - 4} 个</Tag> : null}
    </Space>
  );
};

const FieldChangeSummary: React.FC<{
  originalFields: FormFieldConfig[];
  currentFields?: FormFieldConfig[];
}> = ({ originalFields, currentFields }) => {
  const summary = fieldChangeSummary(originalFields, currentFields);
  const changedCount =
    summary.added.length + summary.removed.length + summary.changed.length;

  if (!changedCount) {
    return (
      <Alert
        showIcon
        type="success"
        title="字段未变更"
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <Alert
      showIcon
      type="warning"
      title="字段变更预览"
      description={
        <Flex vertical gap={8}>
          <ChangeTagList label="新增" fields={summary.added} color="green" />
          <ChangeTagList label="删除" fields={summary.removed} color="red" />
          <ChangeTagList label="修改" fields={summary.changed} color="gold" />
        </Flex>
      }
      style={{ marginBottom: 16 }}
    />
  );
};

const Forms: React.FC = () => {
  const { message } = App.useApp();
  const { styles } = useStyles();
  const actionRef = useRef<ActionType>(null);
  const versionActionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<FormSchemaItem>();
  const [preview, setPreview] = useState<FormSchemaItem>();
  const [formBindings, setFormBindings] = useState<FormBindingItem[]>([]);
  const previewFields = schemaToFields(
    preview?.schemaJson,
    preview?.uiSchemaJson,
  );
  const editingImpact = bindingImpact(editing?.id, formBindings);
  const previewImpact = bindingImpact(preview?.id, formBindings);

  const saveFormSchema = async (
    values: FormSchemaForm,
    id?: string,
    impact?: FormBindingImpact,
  ) => {
    if (!values.fields?.length) {
      message.error('请至少配置一个字段');
      return false;
    }
    if (hasDuplicatedFieldKey(values.fields)) {
      message.error('业务字段不能重复');
      return false;
    }
    if (id && impact?.total && !values.confirmBindingImpact) {
      message.warning('请先确认影响范围');
      return false;
    }
    const payload = buildPayload(values);
    if (id) {
      await updateFormSchema(id, payload);
      message.success('已保存');
      setEditing(undefined);
    } else {
      await createFormSchema(payload);
      message.success('已创建');
    }
    actionRef.current?.reload();
    return true;
  };

  const changeFormStatus = async (record: FormSchemaItem) => {
    if (record.status === 'DISABLED') {
      await activateFormSchema(record.id);
      message.success('已启用');
    } else {
      await disableFormSchema(record.id);
      message.success('已停用');
    }
    actionRef.current?.reload();
  };

  const restoreVersion = async (record: FormSchemaVersionItem) => {
    if (!preview) return;
    const updated = await restoreFormSchemaVersion(preview.id, record.version);
    message.success(`已恢复为 v${updated.version}`);
    setPreview(updated);
    actionRef.current?.reload();
    versionActionRef.current?.reload();
  };

  const columns: ProColumns<FormSchemaItem>[] = [
    {
      title: '表单名称',
      dataIndex: 'formName',
      renderText: (value) => formSchemaNameLabel(value),
    },
    {
      title: '表单标识',
      dataIndex: 'formKey',
      width: 180,
      render: (_, record) => (
        <CopyableText
          value={record.formKey}
          displayValue={formSchemaKeyLabel(record.formKey)}
        />
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 88,
      search: false,
      renderText: (value) => `v${value || 1}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      search: false,
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '来源',
      dataIndex: 'assetOrigin',
      width: 120,
      search: false,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(ASSET_ORIGIN_LABELS).map(([value, text]) => [
          value,
          { text },
        ]),
      ),
      render: (_, record) => (
        <Tag color={assetOriginColor(record.assetOrigin)}>
          {assetOriginLabel(record.assetOrigin)}
        </Tag>
      ),
    },
    {
      title: '字段数',
      key: 'fieldCount',
      width: 96,
      search: false,
      renderText: (_, record) =>
        schemaToFields(record.schemaJson, record.uiSchemaJson).length,
    },
    {
      title: '绑定影响',
      key: 'bindingImpact',
      width: 220,
      search: false,
      render: (_, record) => (
        <BindingImpactSummary
          compact
          impact={bindingImpact(record.id, formBindings)}
        />
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      search: false,
      render: (_, record) => {
        const impact = bindingImpact(record.id, formBindings);
        const willActivate = record.status === 'DISABLED';
        return [
          <Button key="preview" type="link" onClick={() => setPreview(record)}>
            查看
          </Button>,
          <Button key="edit" type="link" onClick={() => setEditing(record)}>
            编辑
          </Button>,
          <Button
            key="bind"
            type="link"
            disabled={record.status === 'DISABLED'}
            onClick={() =>
              history.push(`/form-bindings?formSchemaId=${record.id}`)
            }
          >
            绑定节点
          </Button>,
          <Popconfirm
            key="status"
            title={willActivate ? '启用表单' : '停用表单'}
            description={
              willActivate
                ? '启用后可被新的流程绑定和发起使用。'
                : impact.total
                  ? `该表单已被 ${impact.total} 处流程配置使用。停用后不能再新建绑定，已有历史快照不受影响。`
                  : '停用后不能再新建绑定。'
            }
            okText={willActivate ? '启用' : '停用'}
            cancelText="取消"
            okType={willActivate ? 'primary' : 'danger'}
            onConfirm={() => changeFormStatus(record)}
          >
            <Button type="link" danger={!willActivate}>
              {willActivate ? '启用' : '停用'}
            </Button>
          </Popconfirm>,
        ];
      },
    },
  ];

  const versionColumns: ProColumns<FormSchemaVersionItem>[] = [
    {
      title: '版本',
      dataIndex: 'version',
      width: 96,
      render: (_, record) =>
        record.version === preview?.version ? (
          <Tag color="blue">v{record.version} 当前</Tag>
        ) : (
          <Tag>v{record.version}</Tag>
        ),
    },
    {
      title: '表单名称',
      dataIndex: 'formName',
      renderText: (value) => formSchemaNameLabel(value),
    },
    {
      title: '字段数',
      key: 'fieldCount',
      width: 96,
      renderText: (_, record) =>
        schemaToFields(record.schemaJson, record.uiSchemaJson).length,
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      width: 120,
      renderText: (value) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      renderText: formatDateTime,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 96,
      render: (_, record) =>
        record.version === preview?.version
          ? [
              <Typography.Text key="current" type="secondary">
                当前
              </Typography.Text>,
            ]
          : [
              <Popconfirm
                key="restore"
                title="恢复版本"
                description={`恢复 v${record.version} 后会生成新的当前版本。`}
                okText="恢复"
                cancelText="取消"
                onConfirm={() => restoreVersion(record)}
              >
                <Button type="link">恢复</Button>
              </Popconfirm>,
            ],
    },
  ];

  return (
    <PageContainer title="表单管理">
      <ProTable<FormSchemaItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const [data, bindings] = await Promise.all([
            listFormSchemas(),
            listFormBindings(),
          ]);
          setFormBindings(bindings);
          const keyword = String(
            params.formName || params.formKey || '',
          ).trim();
          return {
            data: keyword
              ? data.filter((item) =>
                  [formSchemaNameLabel(item.formName), item.formKey].some(
                    (value) => String(value).includes(keyword),
                  ),
                )
              : data,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <ModalForm<FormSchemaForm>
            key="create"
            title="新建表单"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建表单
              </Button>
            }
            initialValues={{ fields: defaultFields }}
            modalProps={{ destroyOnHidden: true, width: 920 }}
            onFinish={(values) => saveFormSchema(values)}
          >
            <ProFormText
              name="formKey"
              label="表单标识"
              tooltip="用于系统保存和表单绑定，建议使用英文、数字和下划线。"
              rules={[{ required: true, message: '请输入表单标识' }]}
            />
            <ProFormText
              name="formName"
              label="表单名称"
              rules={[{ required: true, message: '请输入表单名称' }]}
            />
            {renderFormFieldsEditor(styles)}
          </ModalForm>,
        ]}
      />

      <ModalForm<FormSchemaForm>
        key={editing?.id || 'edit-form'}
        title="编辑表单"
        open={Boolean(editing)}
        initialValues={
          editing
            ? {
                formKey: editing.formKey,
                formName: formSchemaNameLabel(editing.formName),
                confirmBindingImpact: false,
                fields: schemaToFields(
                  editing.schemaJson,
                  editing.uiSchemaJson,
                  defaultFields,
                ),
              }
            : undefined
        }
        modalProps={{
          destroyOnHidden: true,
          width: 920,
          onCancel: () => setEditing(undefined),
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onFinish={async (values) => {
          if (!editing) return false;
          return saveFormSchema(values, editing.id, editingImpact);
        }}
      >
        <BindingImpactSummary impact={editingImpact} />
        {editing ? (
          <ProFormDependency name={['fields']}>
            {({ fields }) => (
              <FieldChangeSummary
                originalFields={schemaToFields(
                  editing.schemaJson,
                  editing.uiSchemaJson,
                  defaultFields,
                )}
                currentFields={fields as FormFieldConfig[] | undefined}
              />
            )}
          </ProFormDependency>
        ) : null}
        {editingImpact.total ? (
          <Form.Item
            name="confirmBindingImpact"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value
                    ? Promise.resolve()
                    : Promise.reject(new Error('请确认影响范围')),
              },
            ]}
          >
            <Checkbox>已确认影响范围，继续保存</Checkbox>
          </Form.Item>
        ) : null}
        <ProFormText
          name="formKey"
          label="表单标识"
          tooltip="用于系统保存和表单绑定，建议使用英文、数字和下划线。"
          rules={[{ required: true, message: '请输入表单标识' }]}
        />
        <ProFormText
          name="formName"
          label="表单名称"
          rules={[{ required: true, message: '请输入表单名称' }]}
        />
        {renderFormFieldsEditor(styles)}
      </ModalForm>

      <KoravoDrawer
        title={formSchemaNameLabel(preview?.formName)}
        size={720}
        open={Boolean(preview)}
        extra={
          preview ? (
            <Space>
              <Button
                onClick={() => {
                  setEditing(preview);
                  setPreview(undefined);
                }}
              >
                以当前版本编辑
              </Button>
              <Button
                disabled={preview.status === 'DISABLED'}
                onClick={() =>
                  history.push(`/form-bindings?formSchemaId=${preview.id}`)
                }
              >
                绑定节点
              </Button>
            </Space>
          ) : undefined
        }
        onClose={() => setPreview(undefined)}
      >
        {preview ? (
          <Flex vertical gap={16}>
            {renderFormVersionSummary(preview, previewFields, previewImpact)}
            {previewFields.length ? (
              <Tabs
                items={[
                  {
                    key: 'preview',
                    label: '填写预览',
                    children: renderFormPreview(previewFields),
                  },
                  {
                    key: 'fields',
                    label: '字段配置',
                    children: (
                      <ProTable<FormFieldConfig>
                        rowKey="fieldKey"
                        columns={fieldColumns}
                        dataSource={previewFields}
                        search={false}
                        pagination={false}
                        options={false}
                        scroll={{ x: 1040 }}
                      />
                    ),
                  },
                  {
                    key: 'versions',
                    label: '版本记录',
                    children: (
                      <ProTable<FormSchemaVersionItem>
                        actionRef={versionActionRef}
                        rowKey="id"
                        columns={versionColumns}
                        search={false}
                        pagination={false}
                        options={false}
                        request={async () => {
                          if (!preview?.id) {
                            return { data: [], success: true };
                          }
                          const data = await listFormSchemaVersions(preview.id);
                          return { data, success: true };
                        }}
                      />
                    ),
                  },
                  {
                    key: 'readiness',
                    label: '发布检查',
                    children: (
                      <FormReadiness
                        fields={previewFields}
                        impact={previewImpact}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="暂无字段配置" />
            )}
          </Flex>
        ) : null}
      </KoravoDrawer>
    </PageContainer>
  );
};

export default Forms;
