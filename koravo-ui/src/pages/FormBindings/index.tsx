import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  PageContainer,
  type ProColumns,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Empty,
  Flex,
  Form,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import {
  type BpmnTaskDefinition,
  createFormBinding,
  deleteFormBinding,
  type FormBindingItem,
  type FormSchemaItem,
  listFormBindings,
  listFormSchemas,
  listProcessModels,
  listProcessModelTaskDefinitions,
  type ProcessModelItem,
  updateFormBinding,
} from '@/services/koravo/api';
import { getSessionContext } from '@/services/koravo/session';
import {
  formSchemaKeyLabel,
  formSchemaNameLabel,
  formSchemaOptionLabel,
  isActiveBusinessProcessModel,
  processDisplayName,
  processModelKeyLabel,
  taskDefinitionLabel,
} from '@/utils/display';

interface BindingForm {
  bindingType?: 'START' | 'TASK';
  processModelId?: string;
  processDefinitionId?: string;
  taskDefinitionKey?: string;
  formSchemaId: string;
  formSchemaVersion: number;
}

export type BindingViewMode = 'current' | 'all';
export type BindingCompletionAction =
  | 'deploy'
  | 'bindStart'
  | 'bindTask'
  | 'repairBinding'
  | 'syncVersion'
  | 'start'
  | 'review'
  | 'none';

export type BindingTableItem = FormBindingItem & {
  processModel?: ProcessModelItem;
  formSchema?: FormSchemaItem;
  hasStartBinding: boolean;
  taskDefinitionExists: boolean;
  missingTaskNames: string[];
  readyToStart: boolean;
};

export interface ProcessBindingReadiness {
  hasStartBinding: boolean;
  missingTaskNames: string[];
  invalidBindingCount: number;
  outdatedBindingCount: number;
  readyToStart: boolean;
}

export interface BindingCompletionState {
  nextAction: BindingCompletionAction;
  description: string;
  primaryText: string;
  primaryPath: string;
  secondaryText?: string;
  secondaryPath?: string;
}

const START_FORM_TASK_KEY = '__START__';

function bindingPayload(values: BindingForm) {
  const taskDefinitionKey =
    values.bindingType === 'START'
      ? START_FORM_TASK_KEY
      : values.taskDefinitionKey || '';
  return {
    processModelId: values.processModelId,
    processDefinitionId: values.processDefinitionId,
    taskDefinitionKey,
    formSchemaId: values.formSchemaId,
    formSchemaVersion: Number(values.formSchemaVersion || 1),
  };
}

function bindingTypeOf(binding?: Pick<FormBindingItem, 'taskDefinitionKey'>) {
  return binding?.taskDefinitionKey === START_FORM_TASK_KEY ? 'START' : 'TASK';
}

function useQueryProcessModelId() {
  const location = useLocation();
  return React.useMemo(() => {
    return (
      new URLSearchParams(location.search).get('processModelId') || undefined
    );
  }, [location.search]);
}

function useQueryFormSchemaId() {
  const location = useLocation();
  return React.useMemo(() => {
    return (
      new URLSearchParams(location.search).get('formSchemaId') || undefined
    );
  }, [location.search]);
}

function modelBindingLabel(record: BindingTableItem) {
  if (!record.processModel) {
    return record.processModelId ? '未匹配流程模型' : '-';
  }

  return (
    <Flex vertical gap={0}>
      <Typography.Text>
        {processDisplayName(
          record.processModel.modelKey,
          record.processModel.modelName,
        )}
      </Typography.Text>
      <CopyableText
        value={record.processModelId}
        displayValue={`流程标识：${processModelKeyLabel(record.processModel.modelKey)}`}
      />
    </Flex>
  );
}

function formBindingLabel(record: BindingTableItem) {
  if (!record.formSchema) {
    return record.formSchemaId ? '未匹配表单' : '-';
  }

  return (
    <Flex vertical gap={0}>
      <Typography.Text>
        {formSchemaNameLabel(record.formSchema.formName)}
      </Typography.Text>
      <CopyableText
        value={record.formSchemaId}
        displayValue={`表单标识：${formSchemaKeyLabel(record.formSchema.formKey)} · v${record.formSchema.version}`}
      />
    </Flex>
  );
}

function bindingTargetLabel(
  record: Pick<FormBindingItem, 'taskDefinitionKey'> & {
    taskDefinitionExists?: boolean;
  },
) {
  if (record.taskDefinitionKey === START_FORM_TASK_KEY) {
    return <Tag color="processing">流程发起</Tag>;
  }
  if (record.taskDefinitionExists === false) {
    return (
      <Tag color="error">{taskDefinitionLabel(record.taskDefinitionKey)}</Tag>
    );
  }
  return <Tag>{taskDefinitionLabel(record.taskDefinitionKey)}</Tag>;
}

function bindingModelId(binding: FormBindingItem | BindingForm) {
  return binding.processModelId;
}

function bindingTargetsModel(
  binding: FormBindingItem,
  model?: ProcessModelItem,
) {
  if (!model) return false;
  return (
    binding.processModelId === model.id ||
    Boolean(
      model.flowableDefinitionId &&
        binding.processDefinitionId === model.flowableDefinitionId,
    )
  );
}

export function buildBindingReadiness(
  model: ProcessModelItem,
  bindings: FormBindingItem[],
  schemas: FormSchemaItem[],
  tasks: BpmnTaskDefinition[],
): ProcessBindingReadiness {
  const activeSchemaIds = new Set(
    schemas
      .filter((schema) => schema.status === 'ACTIVE')
      .map((schema) => schema.id),
  );
  const schemaMap = new Map(schemas.map((schema) => [schema.id, schema]));
  const taskKeys = new Set(tasks.map((task) => task.taskDefinitionKey));
  const modelBindings = bindings.filter((binding) =>
    bindingTargetsModel(binding, model),
  );
  const relevantBindings = modelBindings.filter(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY ||
      taskKeys.has(binding.taskDefinitionKey),
  );
  const hasStartBinding = modelBindings.some(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY &&
      activeSchemaIds.has(binding.formSchemaId),
  );
  const boundTaskKeys = new Set(
    relevantBindings
      .filter((binding) => binding.taskDefinitionKey !== START_FORM_TASK_KEY)
      .filter((binding) => activeSchemaIds.has(binding.formSchemaId))
      .map((binding) => binding.taskDefinitionKey),
  );
  const invalidBindingCount = relevantBindings.filter(
    (binding) => !activeSchemaIds.has(binding.formSchemaId),
  ).length;
  const outdatedBindingCount = relevantBindings.filter((binding) => {
    const schema = schemaMap.get(binding.formSchemaId);
    return (
      schema?.status === 'ACTIVE' &&
      binding.formSchemaVersion !== schema.version
    );
  }).length;
  const missingTaskNames = tasks
    .filter((task) => !boundTaskKeys.has(task.taskDefinitionKey))
    .map((task) => taskDefinitionLabel(task.taskDefinitionKey, task));

  const published =
    model.status === 'DEPLOYED' && Boolean(model.flowableDefinitionId);

  return {
    hasStartBinding,
    missingTaskNames,
    invalidBindingCount,
    outdatedBindingCount,
    readyToStart:
      published &&
      hasStartBinding &&
      missingTaskNames.length === 0 &&
      invalidBindingCount === 0 &&
      outdatedBindingCount === 0,
  };
}

export function resolveBindingCompletionState(
  model: ProcessModelItem | undefined,
  readiness: ProcessBindingReadiness | undefined,
  canStartProcess: boolean,
  fallbackProcessModelId?: string,
): BindingCompletionState {
  const processModelId = model?.id || fallbackProcessModelId;
  const bindingPath = processModelId
    ? `/form-bindings?processModelId=${processModelId}`
    : '/form-bindings';
  const designPath = processModelId
    ? `/process-designer?modelId=${processModelId}`
    : '/process-designer';

  if (!processModelId || !model) {
    return {
      nextAction: 'review',
      description: '检查绑定状态',
      primaryText: '查看绑定',
      primaryPath: bindingPath,
    };
  }

  if (model.status === 'ARCHIVED') {
    return {
      nextAction: 'none',
      description: '流程已归档',
      primaryText: '查看配置',
      primaryPath: '/process-models',
    };
  }

  if (model.status === 'DISABLED') {
    return {
      nextAction: 'none',
      description: '流程已停用',
      primaryText: '查看配置',
      primaryPath: '/process-models',
    };
  }

  const published =
    model.status === 'DEPLOYED' && Boolean(model.flowableDefinitionId);

  if (!published) {
    return {
      nextAction: 'deploy',
      description: '下一步：发布流程',
      primaryText: '去发布',
      primaryPath: '/process-models',
      secondaryText: '查看设计',
      secondaryPath: designPath,
    };
  }

  if (readiness?.invalidBindingCount) {
    return {
      nextAction: 'repairBinding',
      description: `下一步：修复 ${readiness.invalidBindingCount} 个失效绑定`,
      primaryText: '修复绑定',
      primaryPath: bindingPath,
      secondaryText: '查看配置',
      secondaryPath: '/process-models',
    };
  }

  if (!readiness?.hasStartBinding) {
    return {
      nextAction: 'bindStart',
      description: '下一步：绑定发起表单',
      primaryText: '继续绑定',
      primaryPath: bindingPath,
      secondaryText: '查看配置',
      secondaryPath: '/process-models',
    };
  }

  if (readiness.missingTaskNames.length > 0) {
    return {
      nextAction: 'bindTask',
      description: `下一步：补 ${readiness.missingTaskNames.length} 个任务表单`,
      primaryText: '继续绑定',
      primaryPath: bindingPath,
      secondaryText: '查看配置',
      secondaryPath: '/process-models',
    };
  }

  if (readiness.outdatedBindingCount > 0) {
    return {
      nextAction: 'syncVersion',
      description: `下一步：同步 ${readiness.outdatedBindingCount} 个表单版本`,
      primaryText: '同步版本',
      primaryPath: bindingPath,
      secondaryText: '查看配置',
      secondaryPath: '/process-models',
    };
  }

  if (readiness.readyToStart && canStartProcess) {
    return {
      nextAction: 'start',
      description: '流程可发起',
      primaryText: '发起流程',
      primaryPath: `/process-start?processModelId=${processModelId}`,
      secondaryText: '查看配置',
      secondaryPath: '/process-models',
    };
  }

  return {
    nextAction: 'review',
    description: '配置已就绪',
    primaryText: '查看配置',
    primaryPath: '/process-models',
    secondaryText: '查看绑定',
    secondaryPath: bindingPath,
  };
}

function bindingVersionState(record: BindingTableItem) {
  if (!record.formSchema) return 'missing';
  if (record.formSchema.status !== 'ACTIVE') return 'inactive';
  if (record.formSchemaVersion !== record.formSchema.version) return 'outdated';
  return 'current';
}

function renderBindingVersion(record: BindingTableItem) {
  const state = bindingVersionState(record);
  if (state === 'missing') {
    return <Tag color="error">未匹配</Tag>;
  }
  if (state === 'inactive') {
    return (
      <Flex vertical gap={2}>
        <Tag>v{record.formSchemaVersion || 1}</Tag>
        <Typography.Text type="secondary">表单已停用</Typography.Text>
      </Flex>
    );
  }
  if (state === 'outdated') {
    return (
      <Flex vertical gap={2}>
        <Tag color="warning">v{record.formSchemaVersion || 1}</Tag>
        <Typography.Text type="secondary">
          最新 v{record.formSchema?.version || 1}
        </Typography.Text>
      </Flex>
    );
  }
  return <Tag color="success">v{record.formSchemaVersion || 1}</Tag>;
}

function bindingHealth(record: BindingTableItem) {
  if (!record.processModel) {
    return { color: 'error', text: '流程失配' };
  }
  if (!record.formSchema) {
    return { color: 'error', text: '表单失配' };
  }
  if (
    record.taskDefinitionKey !== START_FORM_TASK_KEY &&
    !record.taskDefinitionExists
  ) {
    return { color: 'error', text: '节点失配' };
  }
  const versionState = bindingVersionState(record);
  if (versionState === 'outdated') {
    return { color: 'warning', text: '版本待同步' };
  }
  if (versionState === 'inactive') {
    return { color: 'warning', text: '表单停用' };
  }
  if (!record.hasStartBinding) {
    return { color: 'warning', text: '缺发起表单' };
  }
  if (record.missingTaskNames.length > 0) {
    return {
      color: 'warning',
      text: `缺 ${record.missingTaskNames.length} 个任务表单`,
    };
  }
  if (record.processModel.status === 'ARCHIVED') {
    return { color: 'default', text: '流程归档' };
  }
  if (record.processModel.status === 'DISABLED') {
    return { color: 'default', text: '流程停用' };
  }
  return { color: 'success', text: '已就绪' };
}

function renderBindingHealth(record: BindingTableItem) {
  const health = bindingHealth(record);
  return <Tag color={health.color}>{health.text}</Tag>;
}

function canStartFromBinding(record: BindingTableItem) {
  return (
    record.readyToStart &&
    record.taskDefinitionExists &&
    bindingVersionState(record) === 'current'
  );
}

function isCurrentBindingRow(record: BindingTableItem) {
  return (
    Boolean(record.processModel) &&
    Boolean(record.formSchema) &&
    record.taskDefinitionExists &&
    bindingVersionState(record) === 'current'
  );
}

export function shouldShowBindingRow(
  record: BindingTableItem,
  viewMode: BindingViewMode,
  scopedRepairMode = false,
) {
  if (viewMode === 'all' || scopedRepairMode) return true;
  return (
    isActiveBusinessProcessModel(record.processModel) &&
    isCurrentBindingRow(record)
  );
}

const BindingFormItems: React.FC<{
  initialProcessModelId?: string;
  initialFormSchemaId?: string;
}> = ({ initialProcessModelId, initialFormSchemaId }) => {
  const form = Form.useFormInstance();

  React.useEffect(() => {
    if (!initialProcessModelId) return;
    const fillProcessDefinition = async () => {
      const models = await listProcessModels();
      const model = models.find((item) => item.id === initialProcessModelId);
      form.setFieldsValue({
        processModelId: initialProcessModelId,
        processDefinitionId: model?.flowableDefinitionId,
      });
    };
    void fillProcessDefinition();
  }, [form, initialProcessModelId]);

  React.useEffect(() => {
    if (!initialFormSchemaId) return;
    const fillFormSchema = async () => {
      const schemas = await listFormSchemas();
      const schema = schemas.find((item) => item.id === initialFormSchemaId);
      form.setFieldsValue({
        formSchemaId: initialFormSchemaId,
        formSchemaVersion: schema?.version || 1,
      });
    };
    void fillFormSchema();
  }, [form, initialFormSchemaId]);

  return (
    <>
      <ProFormSelect
        name="processModelId"
        label="流程模型"
        rules={[{ required: true, message: '请选择流程模型' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: async (value) => {
            form.setFieldValue('taskDefinitionKey', undefined);
            const models = await listProcessModels();
            const model = models.find((item) => item.id === value);
            form.setFieldValue(
              'processDefinitionId',
              model?.flowableDefinitionId,
            );
          },
        }}
        request={async () =>
          (await listProcessModels())
            .filter(isActiveBusinessProcessModel)
            .map((item) => ({
              label: processDisplayName(item.modelKey, item.modelName),
              value: item.id,
            }))
        }
      />
      <ProFormSelect
        name="bindingType"
        label="绑定范围"
        initialValue="TASK"
        rules={[{ required: true, message: '请选择绑定范围' }]}
        options={[
          { label: '任务表单', value: 'TASK' },
          { label: '发起表单', value: 'START' },
        ]}
        fieldProps={{
          onChange: () => form.setFieldValue('taskDefinitionKey', undefined),
        }}
      />
      <ProFormText name="processDefinitionId" hidden />
      <ProFormDependency name={['processModelId', 'bindingType']}>
        {({ processModelId, bindingType }) =>
          bindingType === 'START' ? null : (
            <ProFormSelect
              key={processModelId || 'task-definition'}
              name="taskDefinitionKey"
              label="任务节点"
              disabled={!processModelId}
              rules={[{ required: true, message: '请选择任务节点' }]}
              params={{ processModelId }}
              placeholder={processModelId ? '请选择任务节点' : '先选择流程模型'}
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
              }}
              request={async () => {
                if (!processModelId) return [];
                return (
                  await listProcessModelTaskDefinitions(processModelId)
                ).map((task) => ({
                  label: taskDefinitionLabel(task.taskDefinitionKey, task),
                  value: task.taskDefinitionKey,
                }));
              }}
            />
          )
        }
      </ProFormDependency>
      <ProFormSelect
        name="formSchemaId"
        label="表单"
        rules={[{ required: true, message: '请选择表单' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: async (value) => {
            const schemas = (await listFormSchemas()).filter(
              (item) => item.status === 'ACTIVE',
            );
            const schema = schemas.find((item) => item.id === value);
            form.setFieldValue('formSchemaVersion', schema?.version || 1);
          },
        }}
        request={async () =>
          (await listFormSchemas())
            .filter((item) => item.status === 'ACTIVE')
            .map((item) => ({
              label: formSchemaOptionLabel(item),
              value: item.id,
            }))
        }
      />
      <ProFormText
        name="formSchemaVersion"
        label="表单版本"
        initialValue={1}
        fieldProps={{ readOnly: true }}
        rules={[{ required: true, message: '请输入表单版本' }]}
      />
    </>
  );
};

const FormBindings: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<FormBindingItem>();
  const [modal, contextHolder] = Modal.useModal();
  const queryProcessModelId = useQueryProcessModelId();
  const queryFormSchemaId = useQueryFormSchemaId();
  const scopedRepairMode = Boolean(queryProcessModelId || queryFormSchemaId);
  const [viewMode, setViewMode] = useState<BindingViewMode>(
    scopedRepairMode ? 'all' : 'current',
  );
  const session = getSessionContext();
  const canStartProcess =
    session.permissions?.canStartProcess ?? session.role === 'applicant';

  React.useEffect(() => {
    setViewMode(scopedRepairMode ? 'all' : 'current');
  }, [scopedRepairMode]);

  const loadBindingCompletionState = async (
    processModelId?: string,
  ): Promise<BindingCompletionState> => {
    if (!processModelId) {
      return resolveBindingCompletionState(
        undefined,
        undefined,
        canStartProcess,
      );
    }

    const [models, bindings, schemas] = await Promise.all([
      listProcessModels(),
      listFormBindings(),
      listFormSchemas(),
    ]);
    const model = models.find((item) => item.id === processModelId);
    const tasks = model
      ? await listProcessModelTaskDefinitions(model.id).catch(
          () => [] as BpmnTaskDefinition[],
        )
      : [];
    const readiness = model
      ? buildBindingReadiness(model, bindings, schemas, tasks)
      : undefined;
    return resolveBindingCompletionState(
      model,
      readiness,
      canStartProcess,
      processModelId,
    );
  };

  const showBindingSuccess = async (
    binding: FormBindingItem | BindingForm,
    action: 'created' | 'updated',
  ) => {
    const processModelId = bindingModelId(binding);
    const completion = await loadBindingCompletionState(processModelId);
    const bindingPath = processModelId
      ? `/form-bindings?processModelId=${processModelId}`
      : '/form-bindings';
    const showContinueBinding =
      completion.primaryPath !== bindingPath &&
      completion.secondaryPath !== bindingPath;
    modal.success({
      title: action === 'created' ? '表单绑定已创建' : '表单绑定已保存',
      width: 520,
      okText: '留在列表',
      content: (
        <Flex vertical gap={12}>
          <span>
            {binding.taskDefinitionKey === START_FORM_TASK_KEY
              ? '发起表单已绑定'
              : `任务表单已绑定：${taskDefinitionLabel(binding.taskDefinitionKey || '')}`}
          </span>
          <Typography.Text type="secondary">
            {completion.description}
          </Typography.Text>
          <Space wrap>
            <Button
              type="primary"
              onClick={() => history.push(completion.primaryPath)}
            >
              {completion.primaryText}
            </Button>
            {completion.secondaryPath ? (
              <Button
                onClick={() => history.push(completion.secondaryPath || '')}
              >
                {completion.secondaryText}
              </Button>
            ) : null}
            {showContinueBinding ? (
              <Button onClick={() => history.push(bindingPath)}>
                继续绑定表单
              </Button>
            ) : null}
          </Space>
        </Flex>
      ),
    });
  };

  const syncBindingVersion = async (record: BindingTableItem) => {
    if (!record.formSchema) return;
    await updateFormBinding(record.id, {
      processModelId: record.processModelId,
      processDefinitionId: record.processDefinitionId,
      taskDefinitionKey: record.taskDefinitionKey,
      formSchemaId: record.formSchemaId,
      formSchemaVersion: record.formSchema.version,
    });
    message.success('已同步版本');
    actionRef.current?.reload();
  };

  const columns: ProColumns<BindingTableItem>[] = [
    {
      title: '绑定范围',
      key: 'bindingType',
      dataIndex: 'taskDefinitionKey',
      width: 120,
      search: false,
      valueType: 'select',
      valueEnum: {
        [START_FORM_TASK_KEY]: { text: '发起表单' },
      },
      renderText: (value) =>
        value === START_FORM_TASK_KEY ? '发起表单' : '任务表单',
    },
    {
      title: '流程模型',
      key: 'processModel',
      dataIndex: 'processModelId',
      width: 260,
      ellipsis: true,
      render: (_, record) => modelBindingLabel(record),
    },
    {
      title: '绑定位置',
      key: 'bindingTarget',
      dataIndex: 'taskDefinitionKey',
      width: 180,
      render: (_, record) => bindingTargetLabel(record),
    },
    {
      title: '绑定表单',
      dataIndex: 'formSchemaId',
      ellipsis: true,
      render: (_, record) => formBindingLabel(record),
    },
    {
      title: '表单版本',
      dataIndex: 'formSchemaVersion',
      width: 130,
      search: false,
      render: (_, record) => renderBindingVersion(record),
    },
    {
      title: '配置状态',
      key: 'bindingHealth',
      width: 120,
      search: false,
      render: (_, record) => renderBindingHealth(record),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      search: false,
      render: (_, record) => {
        const canSyncVersion =
          bindingVersionState(record) === 'outdated' &&
          Boolean(record.formSchema);
        return [
          canStartProcess ? (
            <Button
              key="start"
              type="link"
              disabled={!canStartFromBinding(record)}
              onClick={() =>
                history.push(
                  record.processModelId
                    ? `/process-start?processModelId=${record.processModelId}`
                    : '/process-start',
                )
              }
            >
              发起流程
            </Button>
          ) : null,
          canSyncVersion ? (
            <Popconfirm
              key="sync-version"
              title="同步表单版本"
              description={`同步到 v${record.formSchema?.version || 1}，后续发起和办理使用新字段。`}
              okText="同步"
              cancelText="取消"
              onConfirm={() => syncBindingVersion(record)}
            >
              <Button type="link">同步版本</Button>
            </Popconfirm>
          ) : null,
          <Button key="edit" type="link" onClick={() => setEditing(record)}>
            编辑
          </Button>,
          <Button
            key="model"
            type="link"
            disabled={!record.processModelId}
            onClick={() =>
              record.processModelId
                ? history.push(
                    `/process-designer?modelId=${record.processModelId}`,
                  )
                : undefined
            }
          >
            查看模型
          </Button>,
          <Button
            key="delete"
            type="link"
            danger
            onClick={() => {
              modal.confirm({
                title: '删除表单绑定',
                content: '确认删除该任务节点的表单绑定？',
                okText: '删除',
                cancelText: '取消',
                onOk: async () => {
                  await deleteFormBinding(record.id);
                  message.success('已删除');
                  actionRef.current?.reload();
                },
              });
            }}
          >
            删除
          </Button>,
        ].filter(Boolean);
      },
    },
  ];

  return (
    <PageContainer title="表单绑定">
      {contextHolder}
      {queryProcessModelId ? (
        <Alert
          showIcon
          type="info"
          title="指定流程"
          description="已显示该流程的全部绑定，包含待同步版本和失效绑定。"
          action={
            <Button size="small" onClick={() => history.push('/form-bindings')}>
              查看全部
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {queryFormSchemaId ? (
        <Alert
          showIcon
          type="info"
          title="指定表单"
          description="已显示该表单的全部绑定，便于同步版本或调整绑定位置。"
          action={
            <Button size="small" onClick={() => history.push('/form-bindings')}>
              查看全部
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProTable<BindingTableItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1160 }}
        params={{
          processModelId: queryProcessModelId,
          formSchemaId: queryFormSchemaId,
          viewMode,
        }}
        request={async (params) => {
          const [bindings, models, schemas] = await Promise.all([
            listFormBindings(
              queryProcessModelId
                ? { processModelId: queryProcessModelId }
                : undefined,
            ),
            listProcessModels(),
            listFormSchemas(),
          ]);
          const businessModels = models.filter(isActiveBusinessProcessModel);
          const taskEntries = await Promise.all(
            businessModels.map(async (model) => {
              const tasks = await listProcessModelTaskDefinitions(
                model.id,
              ).catch(() => [] as BpmnTaskDefinition[]);
              return [model.id, tasks] as const;
            }),
          );
          const modelMap = new Map(
            businessModels.map((item) => [item.id, item]),
          );
          const schemaMap = new Map(schemas.map((item) => [item.id, item]));
          const taskMap = new Map(taskEntries);
          const readinessMap = new Map(
            businessModels.map((model) => [
              model.id,
              buildBindingReadiness(
                model,
                bindings,
                schemas,
                taskMap.get(model.id) || [],
              ),
            ]),
          );
          const keyword = String(
            params.processModelId || params.taskDefinitionKey || '',
          ).trim();
          const data = bindings.map((item) => {
            const processModel = item.processModelId
              ? modelMap.get(item.processModelId)
              : undefined;
            const readiness = processModel
              ? readinessMap.get(processModel.id)
              : undefined;
            const tasks = processModel
              ? taskMap.get(processModel.id) || []
              : [];
            return {
              ...item,
              processModel,
              formSchema: schemaMap.get(item.formSchemaId),
              hasStartBinding: readiness?.hasStartBinding || false,
              missingTaskNames: readiness?.missingTaskNames || [],
              readyToStart: readiness?.readyToStart || false,
              taskDefinitionExists:
                item.taskDefinitionKey === START_FORM_TASK_KEY ||
                tasks.some(
                  (task) => task.taskDefinitionKey === item.taskDefinitionKey,
                ),
            };
          });
          const businessData = data.filter((item) =>
            shouldShowBindingRow(item, viewMode, scopedRepairMode),
          );
          const scopedData = queryFormSchemaId
            ? businessData.filter(
                (item) => item.formSchemaId === queryFormSchemaId,
              )
            : businessData;
          return {
            data: keyword
              ? scopedData.filter((item) =>
                  [
                    item.processModel?.modelName,
                    item.processModel?.modelKey,
                    item.taskDefinitionKey,
                    formSchemaNameLabel(item.formSchema?.formName),
                    formSchemaKeyLabel(item.formSchema?.formKey),
                  ]
                    .filter(Boolean)
                    .some((value) => String(value).includes(keyword)),
                )
              : scopedData,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        locale={{
          emptyText: (
            <Empty
              description="暂无表单绑定"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => history.push('/forms')}
                >
                  配置表单
                </Button>
                <Button onClick={() => history.push('/process-designer')}>
                  设计流程
                </Button>
              </Space>
            </Empty>
          ),
        }}
        toolBarRender={() => [
          <Segmented
            key="view-mode"
            value={viewMode}
            options={[
              { label: '当前绑定', value: 'current' },
              { label: '全部绑定', value: 'all' },
            ]}
            onChange={(value) => setViewMode(value as BindingViewMode)}
          />,
          <ModalForm<BindingForm>
            key={`create-${queryProcessModelId || 'all'}-${queryFormSchemaId || 'form-all'}`}
            title="新建表单绑定"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建绑定
              </Button>
            }
            initialValues={{
              bindingType: 'TASK',
              processModelId: queryProcessModelId,
              formSchemaId: queryFormSchemaId,
            }}
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              const binding = await createFormBinding(bindingPayload(values));
              await showBindingSuccess(binding, 'created');
              actionRef.current?.reload();
              return true;
            }}
          >
            <BindingFormItems
              initialProcessModelId={queryProcessModelId}
              initialFormSchemaId={queryFormSchemaId}
            />
          </ModalForm>,
        ]}
      />

      <ModalForm<BindingForm>
        key={editing?.id || 'edit-binding'}
        title="编辑表单绑定"
        open={Boolean(editing)}
        initialValues={
          editing
            ? {
                ...editing,
                bindingType: bindingTypeOf(editing),
                taskDefinitionKey:
                  editing.taskDefinitionKey === START_FORM_TASK_KEY
                    ? undefined
                    : editing.taskDefinitionKey,
              }
            : undefined
        }
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setEditing(undefined),
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onFinish={async (values) => {
          if (!editing) return false;
          const binding = await updateFormBinding(
            editing.id,
            bindingPayload(values),
          );
          await showBindingSuccess(binding, 'updated');
          setEditing(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <BindingFormItems initialProcessModelId={editing?.processModelId} />
      </ModalForm>
    </PageContainer>
  );
};

export default FormBindings;
