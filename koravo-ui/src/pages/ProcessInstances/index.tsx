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
import { history, useLocation } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Flex, Form } from 'antd';
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

function nextBusinessKey(prefix = 'REQ') {
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
  return `${prefix}-${date}-${time}`;
}

function businessKeyPrefix(modelKey?: string) {
  if (modelKey === 'purchaseApproval') return 'PO';
  if (!modelKey) return 'REQ';
  const normalized = modelKey
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return normalized || 'REQ';
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

function useQueryProcessModelId() {
  const location = useLocation();
  return React.useMemo(() => {
    return new URLSearchParams(location.search).get('processModelId') || undefined;
  }, [location.search]);
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
    title: '业务编号',
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

const StartInstanceFields: React.FC<{ initialProcessModelId?: string }> = ({
  initialProcessModelId,
}) => {
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
    (processDefinitionKey?: string, processModelId?: string) => {
      const model = deployedModels.find(
        (item) =>
          item.modelKey === processDefinitionKey ||
          item.id === processModelId,
      );
      form.setFieldsValue({
        processDefinitionKey: model?.modelKey || processDefinitionKey,
        businessKey: nextBusinessKey(businessKeyPrefix(model?.modelKey)),
        processModelId: model?.id,
        processDefinitionId: model?.flowableDefinitionId,
        startFormSchemaId: findStartSchemaId(model, formBindings),
        formValues: {},
        applicant: undefined,
        department: undefined,
        itemName: undefined,
        amount: undefined,
        reason: undefined,
        managerApprover: undefined,
        financeApprover: undefined,
      });
    },
    [deployedModels, form, formBindings],
  );

  React.useEffect(() => {
    if (initialProcessModelId && deployedModels.length) {
      const model = deployedModels.find((item) => item.id === initialProcessModelId);
      if (model) {
        setProcessContext(model.modelKey, model.id);
        return;
      }
    }
    const processDefinitionKey = form.getFieldValue('processDefinitionKey');
    if (processDefinitionKey && !form.getFieldValue('processModelId')) {
      setProcessContext(processDefinitionKey);
    }
  }, [deployedModels, form, initialProcessModelId, setProcessContext]);

  return (
    <>
      {!deployedModels.length ? (
        <Alert
          showIcon
          type="warning"
          title="还没有可发起的已部署流程"
          description="请先创建流程模型并部署，再回到这里发起业务实例。"
          action={
            <Button size="small" onClick={() => history.push('/process-models')}>
              创建流程模型
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProFormSelect
        name="processDefinitionKey"
        label="流程"
        disabled={!deployedModels.length}
        rules={[{ required: true, message: '请选择流程' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: (value) => {
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
        label="业务编号"
        rules={[{ required: true, message: '请输入业务编号' }]}
      />
      <ProFormDependency name={['processDefinitionKey']}>
        {({ processDefinitionKey }) => {
          if (!processDefinitionKey) {
            return (
              <Alert
                showIcon
                type="info"
                title="请选择要发起的流程"
                description="选择流程后，系统会生成业务编号，并展示对应的业务字段。"
              />
            );
          }

          return processDefinitionKey === 'purchaseApproval' ? (
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
                title="选择启动表单后填写业务字段，字段会随流程提交。"
                style={{ marginBottom: 16 }}
              />
              <ProFormText name="processModelId" hidden />
              <ProFormText name="processDefinitionId" hidden />
              <ProFormDependency name={['processModelId']}>
                {({ processModelId }) => {
                  const selectedModel = deployedModels.find(
                    (item) => item.id === processModelId,
                  );
                  const hasBoundForm = Boolean(
                    selectedModel &&
                      findStartSchemaId(selectedModel, formBindings),
                  );
                  return (
                    <>
                      {selectedModel && !hasBoundForm ? (
                        <Alert
                          showIcon
                          type="warning"
                          title="该流程还没有匹配到已绑定表单"
                          description="可以临时选择一个启动表单发起流程；正式使用前建议先完成任务节点表单绑定。"
                          action={
                            <Button
                              size="small"
                              onClick={() =>
                                history.push(
                                  `/form-bindings?processModelId=${selectedModel.id}`,
                                )
                              }
                            >
                              去绑定表单
                            </Button>
                          }
                          style={{ marginBottom: 16 }}
                        />
                      ) : null}
                      <ProFormSelect
                        name="startFormSchemaId"
                        label="启动表单"
                        disabled={!formSchemas.length}
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
                      {!formSchemas.length ? (
                        <Alert
                          showIcon
                          type="warning"
                          title="还没有可用表单"
                          description="请先在表单管理创建业务表单，再回到这里发起流程。"
                          action={
                            <Button size="small" onClick={() => history.push('/forms')}>
                              创建表单
                            </Button>
                          }
                          style={{ marginBottom: 16 }}
                        />
                      ) : null}
                    </>
                  );
                }}
              </ProFormDependency>
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
          );
        }}
      </ProFormDependency>
    </>
  );
};

const ProcessInstances: React.FC = () => {
  const { message } = App.useApp();
  const queryProcessModelId = useQueryProcessModelId();
  const [startOpen, setStartOpen] = React.useState(Boolean(queryProcessModelId));

  React.useEffect(() => {
    if (queryProcessModelId) setStartOpen(true);
  }, [queryProcessModelId]);

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
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无流程实例"
            >
              <Flex gap={8} justify="center" wrap>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => setStartOpen(true)}
                >
                  启动流程
                </Button>
                <Button onClick={() => history.push('/process-models')}>
                  创建流程模型
                </Button>
              </Flex>
            </Empty>
          ),
        }}
        toolBarRender={(action) => [
          <ModalForm<StartInstanceForm>
            key="start"
            title="启动流程实例"
            open={startOpen}
            onOpenChange={setStartOpen}
            trigger={
              <Button type="primary" icon={<PlayCircleOutlined />}>
                启动流程
              </Button>
            }
            modalProps={{
              destroyOnHidden: true,
              width: 'min(720px, calc(100vw - 16px))',
            }}
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
            <StartInstanceFields initialProcessModelId={queryProcessModelId} />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
};

export default ProcessInstances;
