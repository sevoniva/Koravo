import { DownOutlined, PlayCircleOutlined } from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProForm,
  ProFormDatePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  Dropdown,
  Empty,
  Flex,
  Form,
  Space,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import OrganizationProfileFormItem from '@/components/OrganizationProfileFormItem';
import {
  type BpmnTaskDefinition,
  type FormBindingItem,
  type FormSchemaItem,
  type JsonRecord,
  listFormBindings,
  listFormSchemas,
  listOpsInstances,
  listProcessModels,
  listProcessModelTaskDefinitions,
  type OpsProcessInstance,
  type ProcessModelItem,
  startProcessInstance,
  type TaskItem,
} from '@/services/koravo/api';
import {
  applyOrganizationProfileValues,
  isOrganizationAssigneeField,
  isOrganizationProfileField,
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationMemberName,
  organizationMemberSelectOptions,
  organizationProfileFieldValue,
} from '@/services/koravo/organization';
import {
  businessKeyLabel,
  formSchemaOptionLabel,
  isBusinessProcessModel,
  processDefinitionLabel,
  processDisplayName,
  productCopy,
  shortTraceLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface StartInstanceForm {
  processDefinitionKey: string;
  businessKey: string;
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
  placeholder?: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
}

interface JsonSchemaProperty {
  title?: string;
  type?: string;
  format?: string;
  widget?: string;
  enum?: string[];
  'ui:placeholder'?: string;
  'ui:widget'?: string;
}

const START_FORM_TASK_KEY = '__START__';
const taskDecisionFieldKeys = new Set([
  'accepted',
  'approved',
  'reviewComment',
  'approvalComment',
  'decision',
]);

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
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function schemaToStartFields(formSchema?: FormSchemaItem): StartFormField[] {
  const schema = parseJsonObject(formSchema?.schemaJson);
  const uiSchema = parseJsonObject(formSchema?.uiSchemaJson);
  const properties = schema.properties as
    | Record<string, JsonSchemaProperty>
    | undefined;
  const required = Array.isArray(schema.required)
    ? schema.required.map(String)
    : [];

  return Object.entries(properties || {})
    .filter(([fieldKey]) => !taskDecisionFieldKeys.has(fieldKey))
    .map(([fieldKey, property]) => {
      const uiField = uiSchema[fieldKey] as JsonRecord | undefined;
      const widget =
        uiField?.['ui:widget'] ||
        uiField?.widget ||
        property['ui:widget'] ||
        property.widget;
      const placeholder =
        uiField?.['ui:placeholder'] ||
        uiField?.placeholder ||
        property['ui:placeholder'];
      return {
        fieldKey,
        title: productCopy(property.title) || fieldKey,
        type: property.type || 'string',
        format: property.format,
        widget: String(widget || ''),
        placeholder: typeof placeholder === 'string' ? placeholder : undefined,
        required: required.includes(fieldKey),
        options: Array.isArray(property.enum)
          ? property.enum.map((value) => ({
              label: String(value),
              value: String(value),
            }))
          : undefined,
      };
    });
}

function findStartBinding(
  model: ProcessModelItem | undefined,
  bindings: FormBindingItem[],
) {
  if (!model) return undefined;
  return bindings.find(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY &&
      (binding.processDefinitionId === model.flowableDefinitionId ||
        binding.processModelId === model.id),
  );
}

function findTaskBinding(
  model: ProcessModelItem,
  task: BpmnTaskDefinition,
  bindings: FormBindingItem[],
) {
  return bindings.find(
    (binding) =>
      binding.taskDefinitionKey === task.taskDefinitionKey &&
      (binding.processDefinitionId === model.flowableDefinitionId ||
        binding.processModelId === model.id),
  );
}

function formSchemaLabel(schema?: FormSchemaItem, version?: number) {
  if (!schema) return version ? `表单版本 v${version}` : '已绑定表单';
  return formSchemaOptionLabel(schema, version)
    .replace('（', ' ')
    .replace('）', '');
}

function useQueryProcessModelId() {
  const location = useLocation();
  return React.useMemo(() => {
    return (
      new URLSearchParams(location.search).get('processModelId') || undefined
    );
  }, [location.search]);
}

function normalizeStartVariables(values?: JsonRecord): JsonRecord {
  return Object.entries(values || {}).reduce<JsonRecord>(
    (result, [key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        'format' in value &&
        typeof (value as { format?: unknown }).format === 'function'
      ) {
        result[key] = (
          value as { format: (template: string) => string }
        ).format('YYYY-MM-DD');
        return result;
      }
      result[key] = value;
      return result;
    },
    {},
  );
}

const ProcessStartReadiness: React.FC<{
  model?: ProcessModelItem;
  bindings: FormBindingItem[];
  formSchemas: FormSchemaItem[];
}> = ({ model, bindings, formSchemas }) => {
  const { data: tasks = [] } = useQuery({
    queryKey: ['process-model-task-definitions', model?.id],
    queryFn: () => listProcessModelTaskDefinitions(model?.id || ''),
    enabled: Boolean(model?.id),
  });

  if (!model) return null;

  const missingTasks = tasks.filter(
    (task) => !findTaskBinding(model, task, bindings),
  );
  const startBinding = findStartBinding(model, bindings);

  return (
    <Alert
      showIcon
      type={!startBinding || missingTasks.length ? 'warning' : 'success'}
      title={
        !startBinding || missingTasks.length
          ? '流程表单配置不完整'
          : '流程表单已就绪'
      }
      description={
        <Flex vertical gap={8}>
          <Typography.Text type="secondary">
            发起表单和任务表单都会保存快照，实例详情可追踪完整提交记录。
          </Typography.Text>
          <Space size={[0, 6]} wrap>
            <Tag
              color={startBinding ? 'success' : 'warning'}
              variant="outlined"
            >
              启动表单：
              {startBinding
                ? formSchemaLabel(
                    formSchemas.find(
                      (item) => item.id === startBinding.formSchemaId,
                    ),
                    startBinding.formSchemaVersion,
                  )
                : '未绑定'}
            </Tag>
            {tasks.map((task) => {
              const binding = findTaskBinding(model, task, bindings);
              const schema = formSchemas.find(
                (item) => item.id === binding?.formSchemaId,
              );
              return (
                <Tag
                  key={task.taskDefinitionKey}
                  color={binding ? 'success' : 'warning'}
                  variant="outlined"
                >
                  {taskDefinitionLabel(task.taskDefinitionKey)}：
                  {binding
                    ? formSchemaLabel(schema, binding.formSchemaVersion)
                    : '未绑定'}
                </Tag>
              );
            })}
          </Space>
        </Flex>
      }
      action={
        !startBinding || missingTasks.length ? (
          <Button
            size="small"
            onClick={() =>
              history.push(`/form-bindings?processModelId=${model.id}`)
            }
          >
            去绑定表单
          </Button>
        ) : undefined
      }
      style={{ marginBottom: 16 }}
    />
  );
};

function renderCurrentTasks(record: OpsProcessInstance) {
  if (!record.currentTasks?.length) {
    return <Typography.Text type="secondary">无待办</Typography.Text>;
  }

  return (
    <Space size={[0, 4]} wrap>
      {record.currentTasks.map((task) => (
        <Tag key={task.taskId} color="processing">
          <Badge
            status="processing"
            text={`${taskDefinitionLabel(task.taskDefinitionKey)}：${
              task.assignee ? organizationMemberName(task.assignee) : '未分配'
            }`}
          />
        </Tag>
      ))}
    </Space>
  );
}

function buildColumns(
  openTask: (task: TaskItem) => void,
): ProColumns<OpsProcessInstance>[] {
  return [
    {
      title: '业务对象',
      dataIndex: 'businessKey',
      width: 180,
      render: (_, record) => (
        <CopyableText
          value={record.businessKey || record.instanceId}
          displayValue={
            record.businessKey
              ? businessKeyLabel(record.businessKey)
              : shortTraceLabel(record.instanceId)
          }
        />
      ),
    },
    {
      title: '流程',
      dataIndex: 'processDefinitionId',
      ellipsis: true,
      renderText: (value) => processDefinitionLabel(value),
    },
    {
      title: '实例追踪',
      dataIndex: 'instanceId',
      width: 140,
      search: false,
      render: (_, record) => (
        <CopyableText
          value={record.instanceId}
          displayValue={shortTraceLabel(record.instanceId)}
        />
      ),
    },
    {
      title: '发起人',
      dataIndex: 'startUserId',
      width: 120,
      renderText: organizationMemberName,
    },
    {
      title: '当前任务',
      dataIndex: 'currentTasks',
      width: 260,
      search: false,
      render: (_, record) => renderCurrentTasks(record),
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
      valueType: 'select',
      valueEnum: {
        RUNNING: { text: '运行中' },
        COMPLETED: { text: '已完成' },
        SUSPENDED: { text: '已挂起' },
        TERMINATED: { text: '已终止' },
      },
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, record) => {
        const tasks = record.currentTasks || [];
        return (
          <Space size={4}>
            {tasks.length === 1 ? (
              <Button type="link" onClick={() => openTask(tasks[0])}>
                处理任务
              </Button>
            ) : null}
            {tasks.length > 1 ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: tasks.map((task) => ({
                    key: task.taskId,
                    label: `${taskDefinitionLabel(task.taskDefinitionKey)}：${
                      task.assignee
                        ? organizationMemberName(task.assignee)
                        : '未分配'
                    }`,
                  })),
                  onClick: ({ key }) => {
                    const task = tasks.find((item) => item.taskId === key);
                    if (task) openTask(task);
                  },
                }}
              >
                <Button type="link">
                  处理任务 <DownOutlined />
                </Button>
              </Dropdown>
            ) : null}
            <Button
              type="link"
              onClick={() =>
                history.push(`/process-instances/${record.instanceId}`)
              }
            >
              查看实例
            </Button>
          </Space>
        );
      },
    },
  ];
}

function buildStartVariables(
  values: StartInstanceForm,
  formSchema?: FormSchemaItem,
): JsonRecord {
  const formValues = normalizeStartVariables(values.formValues);
  const schemaFields = schemaToStartFields(formSchema);
  const fields = schemaFields.length
    ? schemaFields
    : Object.keys(formValues).map((fieldKey) => ({ fieldKey }));
  return applyOrganizationProfileValues(fields, formValues) as JsonRecord;
}

const StartInstanceFields: React.FC<{ initialProcessModelId?: string }> = ({
  initialProcessModelId,
}) => {
  const form = Form.useFormInstance();
  const { data: deployedModels = [] } = useQuery({
    queryKey: ['start-process-models'],
    queryFn: async () => {
      const models = await listProcessModels('DEPLOYED');
      return models.filter(isBusinessProcessModel);
    },
  });
  const { data: formSchemas = [] } = useQuery({
    queryKey: ['start-form-schemas'],
    queryFn: listFormSchemas,
  });
  const { data: formBindings = [] } = useQuery({
    queryKey: ['start-form-bindings'],
    queryFn: () => listFormBindings(),
  });
  const startableModels = React.useMemo(
    () =>
      deployedModels.filter((model) =>
        Boolean(findStartBinding(model, formBindings)),
      ),
    [deployedModels, formBindings],
  );

  const setProcessContext = React.useCallback(
    (processDefinitionKey?: string, processModelId?: string) => {
      const model = startableModels.find(
        (item) =>
          item.modelKey === processDefinitionKey || item.id === processModelId,
      );
      const startFormSchemaId = findStartBinding(
        model,
        formBindings,
      )?.formSchemaId;
      form.setFieldsValue({
        processDefinitionKey: model?.modelKey || processDefinitionKey,
        businessKey: nextBusinessKey(businessKeyPrefix(model?.modelKey)),
        processModelId: model?.id,
        processDefinitionId: model?.flowableDefinitionId,
        startFormSchemaId,
        formValues: {},
      });
    },
    [form, formBindings, startableModels],
  );

  React.useEffect(() => {
    if (initialProcessModelId && startableModels.length) {
      const model = startableModels.find(
        (item) => item.id === initialProcessModelId,
      );
      if (model) {
        setProcessContext(model.modelKey, model.id);
        return;
      }
    }
    const processDefinitionKey = form.getFieldValue('processDefinitionKey');
    if (processDefinitionKey && !form.getFieldValue('processModelId')) {
      setProcessContext(processDefinitionKey);
    }
  }, [form, initialProcessModelId, setProcessContext, startableModels]);

  return (
    <>
      {!deployedModels.length ? (
        <Alert
          showIcon
          type="warning"
          title="还没有可发起的已部署流程"
          description="请先创建流程模型并部署，再回到这里发起业务实例。"
          action={
            <Button
              size="small"
              onClick={() => history.push('/process-models')}
            >
              创建流程模型
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {deployedModels.length && !startableModels.length ? (
        <Alert
          showIcon
          type="warning"
          title="还没有可直接发起的流程"
          description="请先为已部署流程绑定启动表单。发起页只展示能完整提交业务实例的流程。"
          action={
            <Button size="small" onClick={() => history.push('/form-bindings')}>
              去绑定表单
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProFormSelect
        name="processDefinitionKey"
        label="流程"
        disabled={!startableModels.length}
        rules={[{ required: true, message: '请选择流程' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: (value) => {
            setProcessContext(String(value));
          },
        }}
        options={startableModels.map((item) => ({
          label: processDisplayName(item.modelKey, item.modelName),
          value: item.modelKey,
        }))}
      />
      <ProFormText
        name="businessKey"
        label="业务编号"
        rules={[{ required: true, message: '请输入业务编号' }]}
      />
      <ProFormDependency name={['processModelId']}>
        {({ processModelId }) => {
          const selectedModel = deployedModels.find(
            (item) => item.id === processModelId,
          );
          return (
            <ProcessStartReadiness
              model={selectedModel}
              bindings={formBindings}
              formSchemas={formSchemas}
            />
          );
        }}
      </ProFormDependency>
      <ProFormText name="processModelId" hidden />
      <ProFormText name="processDefinitionId" hidden />
      <ProFormDependency name={['processDefinitionKey', 'processModelId']}>
        {({ processDefinitionKey, processModelId }) => {
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

          return (
            <>
              <Alert
                showIcon
                type="info"
                title="填写启动表单后发起流程，字段会作为流程变量提交。"
                style={{ marginBottom: 16 }}
              />
              {(() => {
                const selectedModel = deployedModels.find(
                  (item) => item.id === processModelId,
                );
                const startBinding = findStartBinding(
                  selectedModel,
                  formBindings,
                );
                return selectedModel && !startBinding ? (
                  <Alert
                    showIcon
                    type="warning"
                    title="该流程还没有启动表单"
                    description="请先在表单绑定中为该流程配置启动表单，再发起业务实例。"
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
                ) : null;
              })()}
              {(() => {
                const selectedModel = deployedModels.find(
                  (item) => item.id === processModelId,
                );
                const startBinding = findStartBinding(
                  selectedModel,
                  formBindings,
                );
                const startSchema = formSchemas.find(
                  (item) => item.id === startBinding?.formSchemaId,
                );
                return startBinding ? (
                  <ProFormSelect
                    name="startFormSchemaId"
                    label="启动表单"
                    disabled={!startSchema}
                    rules={[{ required: true, message: '请选择启动表单' }]}
                    options={
                      startSchema
                        ? [
                            {
                              label: formSchemaOptionLabel(
                                startSchema,
                                startBinding.formSchemaVersion,
                              ),
                              value: startSchema.id,
                            },
                          ]
                        : []
                    }
                    fieldProps={{
                      showSearch: true,
                      optionFilterProp: 'label',
                      onChange: () => form.setFieldValue('formValues', {}),
                    }}
                  />
                ) : null;
              })()}
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
              <ProFormDependency name={['startFormSchemaId']}>
                {({ startFormSchemaId }) => {
                  const formSchema = formSchemas.find(
                    (item) => item.id === startFormSchemaId,
                  );
                  const fields = schemaToStartFields(formSchema);
                  if (!fields.length) {
                    return (
                      <Alert
                        showIcon
                        type="warning"
                        title="当前表单没有可填写字段"
                        description="请先在表单管理配置字段，再回到这里发起流程。"
                      />
                    );
                  }
                  return (
                    <Flex vertical gap={4}>
                      {fields.map((field) =>
                        isOrganizationAssigneeField(
                          field.fieldKey,
                          field.title,
                        ) ? (
                          <ProFormSelect
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            initialValue={organizationAssigneeFieldValue(
                              field.fieldKey,
                              undefined,
                              field.title,
                            )}
                            options={organizationMemberSelectOptions(
                              organizationAssigneeRole(
                                field.fieldKey,
                                field.title,
                              ),
                            )}
                            placeholder="请选择组织成员"
                            fieldProps={{
                              showSearch: true,
                              optionFilterProp: 'label',
                            }}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: `请选择${field.title}`,
                                    },
                                  ]
                                : []
                            }
                          />
                        ) : isOrganizationProfileField(
                            field.fieldKey,
                            field.title,
                          ) ? (
                          <OrganizationProfileFormItem
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            value={organizationProfileFieldValue(
                              field.fieldKey,
                              undefined,
                              undefined,
                              field.title,
                            )}
                            required={field.required}
                          />
                        ) : field.type === 'number' ||
                          field.type === 'integer' ? (
                          <ProFormDigit
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            placeholder={field.placeholder}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: `请输入${field.title}`,
                                    },
                                  ]
                                : []
                            }
                          />
                        ) : field.options?.length ? (
                          <ProFormSelect
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            options={field.options}
                            placeholder={field.placeholder}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: `请选择${field.title}`,
                                    },
                                  ]
                                : []
                            }
                          />
                        ) : field.format === 'date' ? (
                          <ProFormDatePicker
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            placeholder={field.placeholder}
                            fieldProps={{ format: 'YYYY-MM-DD' }}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: `请选择${field.title}`,
                                    },
                                  ]
                                : []
                            }
                          />
                        ) : field.widget === 'textarea' ? (
                          <ProFormTextArea
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            placeholder={field.placeholder}
                            fieldProps={{ rows: 3 }}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: `请输入${field.title}`,
                                    },
                                  ]
                                : []
                            }
                          />
                        ) : (
                          <ProFormText
                            key={field.fieldKey}
                            name={['formValues', field.fieldKey]}
                            label={field.title}
                            placeholder={field.placeholder}
                            rules={
                              field.required
                                ? [
                                    {
                                      required: true,
                                      message: `请输入${field.title}`,
                                    },
                                  ]
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
  const location = useLocation();
  const queryProcessModelId = useQueryProcessModelId();
  const isStartEntry = location.pathname === '/process-start';
  const { data: startFormSchemas = [] } = useQuery({
    queryKey: ['start-form-schemas'],
    queryFn: listFormSchemas,
    enabled: isStartEntry || Boolean(queryProcessModelId),
  });

  const openTask = React.useCallback((task: TaskItem) => {
    history.push(`/tasks/${task.taskId}`);
  }, []);

  const columns = React.useMemo(() => buildColumns(openTask), [openTask]);

  if (isStartEntry || queryProcessModelId) {
    return (
      <PageContainer
        title="发起流程"
        content="选择已发布流程，填写启动表单并提交业务实例。"
      >
        <ProCard>
          <ProForm<StartInstanceForm>
            submitter={{
              searchConfig: {
                submitText: '提交发起',
                resetText: '重置',
              },
            }}
            onFinish={async (values) => {
              if (!values.startFormSchemaId) {
                message.warning('请先为流程配置启动表单');
                return false;
              }
              const startFormSchema = startFormSchemas.find(
                (item) => item.id === values.startFormSchemaId,
              );
              const formData = buildStartVariables(values, startFormSchema);
              const instance = await startProcessInstance({
                processDefinitionKey: values.processDefinitionKey,
                businessKey: values.businessKey,
                variables: formData,
                formSchemaId: values.startFormSchemaId,
                formData,
              });
              message.success('已发起');
              history.push(`/process-instances/${instance.instanceId}`);
              return true;
            }}
          >
            <StartInstanceFields initialProcessModelId={queryProcessModelId} />
          </ProForm>
        </ProCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="流程实例"
      content="查看业务实例、当前任务和运行状态。"
    >
      <ProTable<OpsProcessInstance>
        rowKey="instanceId"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        scroll={{ x: 1120 }}
        request={async (params) => {
          const keyword = String(
            params.instanceId ||
              params.processDefinitionId ||
              params.businessKey ||
              params.startUserId ||
              '',
          ).trim();
          const result = await listOpsInstances({
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
            keyword: keyword || undefined,
            status: String(params.status || '').trim() || undefined,
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
                  onClick={() => history.push('/process-start')}
                >
                  发起流程
                </Button>
                <Button onClick={() => history.push('/process-models')}>
                  创建流程模型
                </Button>
              </Flex>
            </Empty>
          ),
        }}
        toolBarRender={() => [
          <Button
            key="start"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => history.push('/process-start')}
          >
            发起流程
          </Button>,
        ]}
      />
    </PageContainer>
  );
};

export default ProcessInstances;
