import { PlayCircleOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormDependency,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Form } from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  listOpsInstances,
  listFormBindings,
  listFormSchemas,
  listProcessModels,
  startProcessInstance,
  type FormBindingItem,
  type FormSchemaItem,
  type JsonRecord,
  type OpsProcessInstance,
  type ProcessModelItem,
} from '@/services/koravo/api';
import { processDefinitionLabel, processDisplayName } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface StartInstanceForm {
  processDefinitionKey: string;
  businessKey: string;
  applicant?: string;
  department?: string;
  itemName?: string;
  amount?: number;
  reason?: string;
  managerApprover?: string;
  financeApprover?: string;
  processModelId?: string;
  processDefinitionId?: string;
  startFormSchemaId?: string;
  formValues?: JsonRecord;
}

interface StartFormField {
  fieldKey: string;
  title: string;
  type: string;
  format?: string;
  widget?: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
}

interface JsonSchemaProperty {
  title?: string;
  type?: string;
  format?: string;
  widget?: string;
  enum?: string[];
  'ui:widget'?: string;
}

function nextPurchaseBusinessKey() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `PO-${date}-${time}`;
}

function purchaseDefaultValues() {
  return {
    processDefinitionKey: 'purchaseApproval',
    businessKey: nextPurchaseBusinessKey(),
    applicant: '张三',
    department: '研发部',
    itemName: '测试环境服务器',
    amount: 12000,
    reason: '用于流程集成测试和性能验证',
    managerApprover: 'manager',
    financeApprover: 'finance',
  };
}

function parseJsonObject(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as JsonRecord;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function schemaToStartFields(formSchema?: FormSchemaItem): StartFormField[] {
  const schema = parseJsonObject(formSchema?.schemaJson);
  const uiSchema = parseJsonObject(formSchema?.uiSchemaJson);
  const properties = schema.properties as Record<string, JsonSchemaProperty> | undefined;
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];

  return Object.entries(properties || {}).map(([fieldKey, property]) => {
    const uiField = uiSchema[fieldKey] as JsonRecord | undefined;
    return {
      fieldKey,
      title: property.title || fieldKey,
      type: property.type || 'string',
      format: property.format,
      widget: String(uiField?.widget || property['ui:widget'] || property.widget || ''),
      required: required.includes(fieldKey),
      options: Array.isArray(property.enum)
        ? property.enum.map((value) => ({ label: String(value), value: String(value) }))
        : undefined,
    };
  });
}

function findStartSchemaId(
  model: ProcessModelItem | undefined,
  bindings: FormBindingItem[],
) {
  if (!model) return undefined;
  const matchedBinding = bindings.find(
    (binding) =>
      binding.processDefinitionId === model.flowableDefinitionId ||
      binding.processModelId === model.id,
  );
  return matchedBinding?.formSchemaId;
}

function normalizeStartVariables(values?: JsonRecord): JsonRecord {
  return Object.entries(values || {}).reduce<JsonRecord>((result, [key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      'format' in value &&
      typeof (value as { format?: unknown }).format === 'function'
    ) {
      result[key] = (value as { format: (template: string) => string }).format('YYYY-MM-DD');
      return result;
    }
    result[key] = value;
    return result;
  }, {});
}

const columns: ProColumns<OpsProcessInstance>[] = [
  {
    title: '实例编号',
    dataIndex: 'instanceId',
    width: 220,
    render: (_, record) => <CopyableText value={record.instanceId} />,
  },
  {
    title: '流程定义',
    dataIndex: 'processDefinitionId',
    ellipsis: true,
    renderText: (value) => processDefinitionLabel(value),
  },
  {
    title: '业务标识',
    dataIndex: 'businessKey',
    width: 180,
    render: (_, record) => <CopyableText value={record.businessKey} />,
  },
  { title: '发起人', dataIndex: 'startUserId', width: 120 },
  {
    title: '当前任务',
    dataIndex: 'currentTasks',
    width: 120,
    search: false,
    renderText: (_, record) => record.currentTasks?.length ?? 0,
  },
  {
    title: '开始时间',
    dataIndex: 'startTime',
    width: 170,
    search: false,
    renderText: (value) => formatDateTime(value),
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (_, record) => <KoravoStatusTag status={record.status} />,
  },
  {
    title: '操作',
    valueType: 'option',
    width: 96,
    render: (_, record) => (
      <Button
        type="link"
        onClick={() => history.push(`/process-instances/${record.instanceId}`)}
      >
        查看
      </Button>
    ),
  },
];

function buildStartVariables(values: StartInstanceForm): JsonRecord {
  if (values.processDefinitionKey !== 'purchaseApproval') {
    return normalizeStartVariables(values.formValues);
  }

  return {
    applicant: values.applicant,
    department: values.department,
    itemName: values.itemName,
    amount: values.amount,
    reason: values.reason,
    managerApprover: values.managerApprover,
    financeApprover: values.financeApprover,
  };
}

const StartInstanceFields: React.FC = () => {
  const form = Form.useFormInstance();
  const { data: deployedModels = [] } = useQuery({
    queryKey: ['start-process-models'],
    queryFn: () => listProcessModels('DEPLOYED'),
  });
  const { data: formSchemas = [] } = useQuery({
    queryKey: ['start-form-schemas'],
    queryFn: listFormSchemas,
  });
  const { data: formBindings = [] } = useQuery({
    queryKey: ['start-form-bindings'],
    queryFn: () => listFormBindings(),
  });

  const setProcessContext = React.useCallback(
    (processDefinitionKey?: string) => {
      const model = deployedModels.find((item) => item.modelKey === processDefinitionKey);
      form.setFieldsValue({
        processModelId: model?.id,
        processDefinitionId: model?.flowableDefinitionId,
        startFormSchemaId: findStartSchemaId(model, formBindings),
        formValues: {},
      });
    },
    [deployedModels, form, formBindings],
  );

  React.useEffect(() => {
    const processDefinitionKey = form.getFieldValue('processDefinitionKey');
    if (processDefinitionKey === 'purchaseApproval' && !form.getFieldValue('businessKey')) {
      form.setFieldsValue(purchaseDefaultValues());
      return;
    }
    if (processDefinitionKey && !form.getFieldValue('processModelId')) {
      setProcessContext(processDefinitionKey);
    }
  }, [form, setProcessContext]);

  return (
    <>
      <ProFormSelect
        name="processDefinitionKey"
        label="流程"
        rules={[{ required: true, message: '请选择流程' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: (value) => {
            if (value === 'purchaseApproval') {
              form.setFieldsValue(purchaseDefaultValues());
              return;
            }
            setProcessContext(String(value));
          },
        }}
        options={deployedModels.map((item) => ({
          label: `${processDisplayName(item.modelKey, item.modelName)}（${item.modelKey}）`,
          value: item.modelKey,
        }))}
      />
      <ProFormText
        name="businessKey"
        label="业务标识"
        rules={[{ required: true, message: '请输入业务标识' }]}
      />
      <ProFormDependency name={['processDefinitionKey']}>
        {({ processDefinitionKey }) =>
          processDefinitionKey === 'purchaseApproval' ? (
            <>
              <Alert
                showIcon
                type="info"
                title="采购申请会同时生成部门审批和财务审批两个待办。"
                style={{ marginBottom: 16 }}
              />
              <ProFormText
                name="applicant"
                label="申请人"
                rules={[{ required: true, message: '请输入申请人' }]}
              />
              <ProFormText
                name="department"
                label="申请部门"
                rules={[{ required: true, message: '请输入申请部门' }]}
              />
              <ProFormText
                name="itemName"
                label="采购事项"
                rules={[{ required: true, message: '请输入采购事项' }]}
              />
              <ProFormDigit
                name="amount"
                label="采购金额"
                min={0.01}
                fieldProps={{ precision: 2, suffix: '元' }}
                rules={[{ required: true, message: '请输入采购金额' }]}
              />
              <ProFormTextArea
                name="reason"
                label="申请事由"
                fieldProps={{ rows: 3 }}
                rules={[{ required: true, message: '请输入申请事由' }]}
              />
              <ProFormText
                name="managerApprover"
                label="部门审批人"
                rules={[{ required: true, message: '请输入部门审批人' }]}
              />
              <ProFormText
                name="financeApprover"
                label="财务审批人"
                rules={[{ required: true, message: '请输入财务审批人' }]}
              />
            </>
          ) : (
            <>
              <Alert
                showIcon
                type="info"
                title="选择启动表单后填写业务字段，字段会作为流程变量提交。"
                style={{ marginBottom: 16 }}
              />
              <ProFormText name="processModelId" hidden />
              <ProFormText name="processDefinitionId" hidden />
              <ProFormSelect
                name="startFormSchemaId"
                label="启动表单"
                rules={[{ required: true, message: '请选择启动表单' }]}
                options={formSchemas.map((item) => ({
                  label: `${item.formName}（${item.formKey} v${item.version}）`,
                  value: item.id,
                }))}
                fieldProps={{
                  showSearch: true,
                  optionFilterProp: 'label',
                  onChange: () => form.setFieldValue('formValues', {}),
                }}
              />
              <ProFormDependency name={['startFormSchemaId']}>
                {({ startFormSchemaId }) => {
                  const formSchema = formSchemas.find((item) => item.id === startFormSchemaId);
                  const fields = schemaToStartFields(formSchema);
                  if (!fields.length) {
                    return (
                      <Alert
                        showIcon
                        type="warning"
                        title="当前表单没有可填写字段"
                        description="请先在表单管理配置字段，再回到这里启动流程。"
                      />
                    );
                  }
                  return (
                    <Flex vertical gap={4}>
                      {fields.map((field) =>
                        field.type === 'number' || field.type === 'integer' ? (
                          <ProFormDigit
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            rules={
                              field.required
                                ? [{ required: true, message: `请输入${field.title}` }]
                                : []
                            }
                          />
                        ) : field.options?.length ? (
                          <ProFormSelect
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            options={field.options}
                            rules={
                              field.required
                                ? [{ required: true, message: `请选择${field.title}` }]
                                : []
                            }
                          />
                        ) : field.format === 'date' ? (
                          <ProFormDatePicker
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            fieldProps={{ format: 'YYYY-MM-DD' }}
                            rules={
                              field.required
                                ? [{ required: true, message: `请选择${field.title}` }]
                                : []
                            }
                          />
                        ) : field.widget === 'textarea' ? (
                          <ProFormTextArea
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            fieldProps={{ rows: 3 }}
                            rules={
                              field.required
                                ? [{ required: true, message: `请输入${field.title}` }]
                                : []
                            }
                          />
                        ) : (
                          <ProFormText
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            rules={
                              field.required
                                ? [{ required: true, message: `请输入${field.title}` }]
                                : []
                            }
                          />
                        ),
                      )}
                    </Flex>
                  );
                }}
              </ProFormDependency>
            </>
          )
        }
      </ProFormDependency>
    </>
  );
};

const ProcessInstances: React.FC = () => {
  const { message } = App.useApp();

  return (
    <PageContainer title="流程实例" content="启动流程并跟踪运行中的实例。">
      <ProTable<OpsProcessInstance>
        rowKey="instanceId"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        scroll={{ x: 1120 }}
        request={async (params) => {
          const result = await listOpsInstances({
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
        toolBarRender={(action) => [
          <ModalForm<StartInstanceForm>
            key="start"
            title="启动流程实例"
            trigger={
              <Button type="primary" icon={<PlayCircleOutlined />}>
                启动流程
              </Button>
            }
            initialValues={{ processDefinitionKey: 'purchaseApproval' }}
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              const instance = await startProcessInstance({
                processDefinitionKey: values.processDefinitionKey,
                businessKey: values.businessKey,
                variables: buildStartVariables(values),
              });
              message.success('已启动');
              action?.reload();
              history.push(`/process-instances/${instance.instanceId}`);
              return true;
            }}
          >
            <StartInstanceFields />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
};

export default ProcessInstances;
