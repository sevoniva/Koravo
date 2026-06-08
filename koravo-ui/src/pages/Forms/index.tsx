import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormList,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Empty, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  createFormSchema,
  listFormSchemas,
  updateFormSchema,
  type FormSchemaItem,
} from '@/services/koravo/api';
import { history } from '@umijs/max';

interface FormSchemaForm {
  formKey: string;
  formName: string;
  fields: FormFieldConfig[];
}

interface FormFieldConfig {
  fieldKey: string;
  title: string;
  type: 'string' | 'number' | 'boolean';
  widget?: 'input' | 'textarea' | 'number' | 'switch';
  placeholder?: string;
  optionsText?: string;
  format?: string;
  required?: boolean;
}

interface JsonSchemaProperty {
  title?: string;
  type?: string;
  enum?: unknown[];
  format?: string;
  'ui:placeholder'?: string;
  'ui:widget'?: string;
}

const defaultFields: FormFieldConfig[] = [
  { fieldKey: 'applicant', title: '申请人', type: 'string', widget: 'input', required: true },
  { fieldKey: 'department', title: '申请部门', type: 'string', widget: 'input', required: true },
  { fieldKey: 'itemName', title: '采购事项', type: 'string', widget: 'input', required: true },
  { fieldKey: 'amount', title: '采购金额', type: 'number', widget: 'number', required: true },
  { fieldKey: 'reason', title: '申请事由', type: 'string', widget: 'textarea', required: true },
  { fieldKey: 'managerApprover', title: '部门审批人', type: 'string', widget: 'input', required: true },
  { fieldKey: 'financeApprover', title: '财务审批人', type: 'string', widget: 'input', required: true },
];

const fieldTypeOptions = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '开关', value: 'boolean' },
];

const widgetOptions = [
  { label: '单行文本', value: 'input' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字输入', value: 'number' },
  { label: '开关', value: 'switch' },
];

const fieldTypeText: Record<FormFieldConfig['type'], string> = {
  string: '文本',
  number: '数字',
  boolean: '开关',
};

const widgetText: Record<NonNullable<FormFieldConfig['widget']>, string> = {
  input: '单行文本',
  textarea: '多行文本',
  number: '数字输入',
  switch: '开关',
};

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
  return 'string';
};

const normalizeWidget = (
  widget: unknown,
  type: FormFieldConfig['type'],
): NonNullable<FormFieldConfig['widget']> => {
  if (widget === 'textarea') return 'textarea';
  if (widget === 'switch') return 'switch';
  if (widget === 'number') return 'number';
  if (type === 'boolean') return 'switch';
  if (type === 'number') return 'number';
  return 'input';
};

const normalizeOptionsText = (options?: unknown[]) => {
  if (!Array.isArray(options)) return undefined;
  return options.map(String).filter(Boolean).join('\n');
};

const optionsTextToEnum = (optionsText?: string) => {
  const options = (optionsText || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return options.length ? options : undefined;
};

const schemaToFields = (
  schemaJson?: string,
  uiSchemaJson?: string,
  fallback: FormFieldConfig[] = [],
): FormFieldConfig[] => {
  const schema = parseJsonObject(schemaJson);
  const uiSchema = parseJsonObject(uiSchemaJson);
  const properties = schema.properties as Record<string, JsonSchemaProperty> | undefined;
  if (!properties || typeof properties !== 'object') return fallback;
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];

  return Object.entries(properties).map(([fieldKey, property]) => {
    const type = normalizeFieldType(property?.type);
    const uiField = uiSchema[fieldKey] as Record<string, unknown> | undefined;
    const widget = uiField?.['ui:widget'] || uiField?.widget || property?.['ui:widget'];
    const placeholder =
      uiField?.['ui:placeholder'] || uiField?.placeholder || property?.['ui:placeholder'];
    return {
      fieldKey,
      title: property?.title || fieldKey,
      type,
      widget: normalizeWidget(widget, type),
      placeholder: typeof placeholder === 'string' ? placeholder : undefined,
      optionsText: normalizeOptionsText(property?.enum),
      format: property?.format,
      required: required.includes(fieldKey),
    };
  });
};

const buildPayload = (values: FormSchemaForm) => {
  const fields = (values.fields || []).map((field) => ({
    ...field,
    fieldKey: field.fieldKey.trim(),
    title: field.title.trim(),
    widget: normalizeWidget(field.widget, field.type),
  }));

  const properties = fields.reduce<
    Record<
      string,
      {
        title: string;
        type: string;
        enum?: string[];
        format?: string;
        'ui:placeholder'?: string;
        'ui:widget'?: string;
      }
    >
  >(
    (result, field) => {
      const options = optionsTextToEnum(field.optionsText);
      result[field.fieldKey] = {
        title: field.title,
        type: field.type,
        ...(options ? { enum: options } : {}),
        ...(field.format?.trim() ? { format: field.format.trim() } : {}),
        ...(field.placeholder?.trim() ? { 'ui:placeholder': field.placeholder.trim() } : {}),
        ...(field.widget ? { 'ui:widget': field.widget } : {}),
      };
      return result;
    },
    {},
  );
  const uiSchema = fields.reduce<
    Record<string, { 'ui:widget': string; 'ui:placeholder'?: string }>
  >((result, field) => {
    result[field.fieldKey] = {
      'ui:widget': field.widget || normalizeWidget(undefined, field.type),
      ...(field.placeholder?.trim() ? { 'ui:placeholder': field.placeholder.trim() } : {}),
    };
    return result;
  }, {});

  return {
    formKey: values.formKey,
    formName: values.formName,
    schemaJson: JSON.stringify(
      {
        type: 'object',
        required: fields.filter((field) => field.required).map((field) => field.fieldKey),
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
  { title: '字段名称', dataIndex: 'title' },
  {
    title: '字段编码',
    dataIndex: 'fieldKey',
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
    renderText: (value, record) =>
      widgetText[normalizeWidget(value, record.type)],
  },
  {
    title: '选项/格式',
    dataIndex: 'optionsText',
    search: false,
    renderText: (_, record) => {
      if (record.optionsText) return record.optionsText.split(/\r?\n/).join('、');
      return record.format === 'date' ? '日期' : '-';
    },
  },
  {
    title: '规则',
    dataIndex: 'required',
    width: 96,
    render: (_, record) => (record.required ? <Tag color="red">必填</Tag> : <Tag>选填</Tag>),
  },
];

const renderFormFieldsEditor = () => (
  <>
    <Alert
      showIcon
      type="info"
      title="按实际表单逐项维护字段，系统会自动生成运行所需配置。"
      style={{ marginBottom: 16 }}
    />
    <ProFormList
      name="fields"
      label="字段清单"
      creatorButtonProps={{ creatorButtonText: '添加字段' }}
      copyIconProps={false}
      min={1}
    >
      <Space align="start" wrap>
        <ProFormText
          name="fieldKey"
          label="字段编码"
          width="sm"
          rules={[
            { required: true, message: '请输入字段编码' },
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
          rules={[{ required: true, message: '请输入字段名称' }]}
        />
        <ProFormSelect
          name="type"
          label="类型"
          width="xs"
          options={fieldTypeOptions}
          rules={[{ required: true, message: '请选择类型' }]}
        />
        <ProFormSelect
          name="widget"
          label="控件"
          width="sm"
          options={widgetOptions}
          rules={[{ required: true, message: '请选择控件' }]}
        />
        <ProFormText
          name="placeholder"
          label="输入提示"
          width="sm"
          placeholder="例如：请输入申请事由"
        />
        <ProFormText name="format" label="格式" width="xs" placeholder="date" />
        <ProFormTextArea
          name="optionsText"
          label="选项"
          width="sm"
          placeholder="每行一个选项"
          fieldProps={{ rows: 1 }}
        />
        <ProFormSwitch name="required" label="必填" />
      </Space>
    </ProFormList>
  </>
);

const Forms: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<FormSchemaItem>();
  const [preview, setPreview] = useState<FormSchemaItem>();
  const previewFields = schemaToFields(preview?.schemaJson, preview?.uiSchemaJson);

  const saveFormSchema = async (values: FormSchemaForm, id?: string) => {
    if (!values.fields?.length) {
      message.error('请至少配置一个字段');
      return false;
    }
    if (hasDuplicatedFieldKey(values.fields)) {
      message.error('字段编码不能重复');
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

  const columns: ProColumns<FormSchemaItem>[] = [
    { title: '表单名称', dataIndex: 'formName' },
    {
      title: '表单编码',
      dataIndex: 'formKey',
      width: 180,
      render: (_, record) => <CopyableText value={record.formKey} />,
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
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '字段数',
      dataIndex: 'schemaJson',
      width: 96,
      search: false,
      renderText: (_, record) => schemaToFields(record.schemaJson, record.uiSchemaJson).length,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_, record) => [
        <Button key="preview" type="link" onClick={() => setPreview(record)}>
          查看
        </Button>,
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Button
          key="bind"
          type="link"
          onClick={() => history.push(`/form-bindings?formSchemaId=${record.id}`)}
        >
          绑定节点
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer title="表单管理" content="维护任务表单结构和展示配置。">
      <ProTable<FormSchemaItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const data = await listFormSchemas();
          const keyword = String(params.formName || params.formKey || '').trim();
          return {
            data: keyword
              ? data.filter((item) =>
                  [item.formName, item.formKey].some((value) =>
                    String(value).includes(keyword),
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
              label="表单编码"
              tooltip="用于系统保存和表单绑定，建议使用英文、数字和下划线。"
              rules={[{ required: true, message: '请输入表单编码' }]}
            />
            <ProFormText
              name="formName"
              label="表单名称"
              rules={[{ required: true, message: '请输入表单名称' }]}
            />
            {renderFormFieldsEditor()}
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
                formName: editing.formName,
                fields: schemaToFields(editing.schemaJson, editing.uiSchemaJson, defaultFields),
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
          return saveFormSchema(values, editing.id);
        }}
      >
        <ProFormText
          name="formKey"
          label="表单编码"
          tooltip="用于系统保存和表单绑定，建议使用英文、数字和下划线。"
          rules={[{ required: true, message: '请输入表单编码' }]}
        />
        <ProFormText
          name="formName"
          label="表单名称"
          rules={[{ required: true, message: '请输入表单名称' }]}
        />
        {renderFormFieldsEditor()}
      </ModalForm>

      <Drawer
        title={preview?.formName}
        size={720}
        open={Boolean(preview)}
        onClose={() => setPreview(undefined)}
      >
        {previewFields.length ? (
          <ProTable<FormFieldConfig>
            rowKey="fieldKey"
            columns={fieldColumns}
            dataSource={previewFields}
            search={false}
            pagination={false}
            options={false}
          />
        ) : (
          <Empty description="暂无字段配置" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Forms;
