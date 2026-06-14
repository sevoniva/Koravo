import {
  CloudUploadOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  PageContainer,
  type ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  Empty,
  Flex,
  Modal,
  Segmented,
  Space,
  Steps,
  Tag,
  Typography,
  type UploadFile,
} from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  archiveProcessModel,
  type BpmnTaskDefinition,
  type BpmnValidationResult,
  createProcessModel,
  deployProcessModelDraft,
  disableProcessModel,
  exportProcessModel,
  type FormBindingItem,
  type FormSchemaItem,
  importProcessModel,
  listFormBindings,
  listFormSchemas,
  listProcessModels,
  listProcessModelTaskDefinitions,
  type ProcessModelItem,
  validateProcessModel,
} from '@/services/koravo/api';
import { getSessionContext } from '@/services/koravo/session';
import {
  ASSET_ORIGIN_LABELS,
  assetOriginColor,
  assetOriginLabel,
  bpmnValidationIssueText,
  isActiveBusinessProcessModel,
  processDefinitionLabel,
  processDescriptionLabel,
  processDisplayName,
  processModelKeyLabel,
  processStatusLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface ProcessModelForm {
  modelKey: string;
  modelName: string;
  description?: string;
}

interface ImportProcessModelForm {
  modelName: string;
  file: UploadFile[];
}

type ModelViewMode = 'business' | 'all';
type ModelNextAction = 'design' | 'bind' | 'deploy' | 'start' | 'none';
export interface ModelReadiness {
  hasStartBinding: boolean;
  taskCount: number;
  boundTaskCount: number;
  missingTaskKeys: string[];
  variableExpressions: string[];
  invalidBindingCount: number;
  outdatedBindingCount: number;
  bindingReady: boolean;
  deployReady: boolean;
  canStart: boolean;
  statusText: string;
  description: string;
  nextAction: ModelNextAction;
  nextActionText: string;
  nextActionDescription: string;
}
type ProcessModelTableItem = ProcessModelItem & {
  formBindingCount: number;
  readiness: ModelReadiness;
};

const START_FORM_TASK_KEY = '__START__';
const assigneeRequiredCode = 'BPMN_USER_TASK_ASSIGNEE_REQUIRED';

function downloadModelFile(record: ProcessModelItem, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.modelKey ? processModelKeyLabel(record.modelKey) : record.id}.bpmn20.xml`;
  link.click();
  URL.revokeObjectURL(url);
}

function deployedDefinitionText(record: ProcessModelItem) {
  return processDefinitionLabel(record.flowableDefinitionId || record.modelKey);
}

function getModelBindings(
  record: ProcessModelItem,
  bindings: FormBindingItem[],
) {
  return bindings.filter(
    (binding) =>
      binding.processModelId === record.id ||
      Boolean(
        record.flowableDefinitionId &&
          binding.processDefinitionId === record.flowableDefinitionId,
      ),
  );
}

function extractVariableExpressions(bpmnXml?: string) {
  const matches = bpmnXml?.matchAll(/\$\{([^}]+)\}/g) || [];
  return Array.from(new Set(Array.from(matches, (match) => match[1].trim())))
    .filter(Boolean)
    .slice(0, 8);
}

export function resolveModelNextAction(
  record: ProcessModelItem,
  hasStartBinding: boolean,
  missingTaskKeys: string[],
  deployReady: boolean,
  canStart: boolean,
): Pick<
  ModelReadiness,
  'nextAction' | 'nextActionText' | 'nextActionDescription'
> {
  if (record.status === 'ARCHIVED') {
    return {
      nextAction: 'none',
      nextActionText: '已归档',
      nextActionDescription: '不可发起',
    };
  }
  if (record.status === 'DISABLED') {
    return {
      nextAction: 'none',
      nextActionText: '已停用',
      nextActionDescription: '恢复后可用',
    };
  }
  const published =
    record.status === 'DEPLOYED' && Boolean(record.flowableDefinitionId);
  if (!published) {
    return deployReady
      ? {
          nextAction: 'deploy',
          nextActionText: '校验发布',
          nextActionDescription: '发布后绑定表单',
        }
      : {
          nextAction: 'design',
          nextActionText: '完善设计',
          nextActionDescription: '保存后再校验',
        };
  }
  if (!hasStartBinding) {
    return {
      nextAction: 'bind',
      nextActionText: '绑定发起表单',
      nextActionDescription: '发起前必需',
    };
  }
  if (missingTaskKeys.length > 0) {
    return {
      nextAction: 'bind',
      nextActionText: '绑定任务表单',
      nextActionDescription: `剩 ${missingTaskKeys.length} 个节点`,
    };
  }
  if (canStart) {
    return {
      nextAction: 'start',
      nextActionText: '发起流程',
      nextActionDescription: '发起后追踪',
    };
  }
  return {
    nextAction: 'bind',
    nextActionText: '检查表单',
    nextActionDescription: '确认绑定状态',
  };
}

export function buildModelReadiness(
  record: ProcessModelItem,
  bindings: FormBindingItem[],
  tasks: BpmnTaskDefinition[],
  schemas: FormSchemaItem[],
): ModelReadiness {
  const schemaMap = new Map(schemas.map((schema) => [schema.id, schema]));
  const taskKeys = new Set(tasks.map((task) => task.taskDefinitionKey));
  const relevantBindings = bindings.filter(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY ||
      taskKeys.has(binding.taskDefinitionKey),
  );
  const hasActiveSchema = (binding: FormBindingItem) =>
    schemaMap.get(binding.formSchemaId)?.status === 'ACTIVE';
  const hasStartBinding = relevantBindings.some(
    (binding) =>
      binding.taskDefinitionKey === START_FORM_TASK_KEY &&
      hasActiveSchema(binding),
  );
  const taskBindings = relevantBindings.filter(
    (binding) =>
      binding.taskDefinitionKey !== START_FORM_TASK_KEY &&
      hasActiveSchema(binding),
  );
  const invalidBindingCount = relevantBindings.filter(
    (binding) => !hasActiveSchema(binding),
  ).length;
  const outdatedBindingCount = relevantBindings.filter((binding) => {
    const schema = schemaMap.get(binding.formSchemaId);
    return (
      schema?.status === 'ACTIVE' &&
      binding.formSchemaVersion !== schema.version
    );
  }).length;
  const missingTaskKeys = tasks
    .filter(
      (task) =>
        !taskBindings.some(
          (binding) => binding.taskDefinitionKey === task.taskDefinitionKey,
        ),
    )
    .map((task) => taskDefinitionLabel(task.taskDefinitionKey, task));
  const boundTaskCount = tasks.length - missingTaskKeys.length;
  const bindingReady =
    hasStartBinding &&
    missingTaskKeys.length === 0 &&
    invalidBindingCount === 0;
  const deployReady = Boolean(record.bpmnXml);
  const canStart = record.status === 'DEPLOYED' && bindingReady;
  let statusText = '待配置';
  let description = hasStartBinding ? '完善任务表单后可发起' : '先发布流程';
  const nextAction = resolveModelNextAction(
    record,
    hasStartBinding,
    missingTaskKeys,
    deployReady,
    canStart,
  );

  if (record.status === 'ARCHIVED') {
    statusText = '已归档';
    description = '已归档流程不再发起';
  } else if (record.status === 'DISABLED') {
    statusText = '已停用';
    description = '恢复后才可继续使用';
  } else if (record.status !== 'DEPLOYED' || !record.flowableDefinitionId) {
    statusText = '草稿';
    description = deployReady ? '可校验发布' : '先完善流程设计';
  } else if (canStart) {
    statusText = '可发起';
    description = outdatedBindingCount
      ? `有 ${outdatedBindingCount} 个绑定版本待同步`
      : `发起表单和 ${tasks.length} 个任务表单已就绪`;
  } else if (invalidBindingCount > 0) {
    statusText = '待配置';
    description = `有 ${invalidBindingCount} 个表单绑定失效`;
  } else if (!hasStartBinding) {
    statusText = '待配置';
    description = '缺少发起表单';
  } else if (missingTaskKeys.length > 0) {
    statusText = '待配置';
    description = `缺 ${missingTaskKeys.length} 个任务表单`;
  }

  return {
    hasStartBinding,
    taskCount: tasks.length,
    boundTaskCount,
    missingTaskKeys,
    variableExpressions: extractVariableExpressions(record.bpmnXml),
    invalidBindingCount,
    outdatedBindingCount,
    bindingReady,
    deployReady,
    canStart,
    statusText,
    description,
    ...nextAction,
  };
}

function readinessBadgeStatus(statusText: string) {
  if (statusText === '可发起') return 'success';
  if (statusText === '待配置' || statusText === '草稿') return 'warning';
  return 'default';
}

function renderConfigurationStatus(record: ProcessModelTableItem) {
  return (
    <Flex vertical gap={2}>
      <Badge
        status={readinessBadgeStatus(record.readiness.statusText)}
        text={record.readiness.statusText}
      />
      <Typography.Text type="secondary">
        {record.readiness.description}
      </Typography.Text>
    </Flex>
  );
}

function renderCheckItem(
  label: string,
  state: 'success' | 'warning' | 'error',
  description: React.ReactNode,
) {
  return (
    <Flex key={label} vertical gap={2}>
      <Badge
        status={
          state === 'success'
            ? 'success'
            : state === 'warning'
              ? 'warning'
              : 'error'
        }
        text={label}
      />
      <Typography.Text type="secondary">{description}</Typography.Text>
    </Flex>
  );
}

function stepStatus(done: boolean, active: boolean, blocked: boolean) {
  if (blocked) return 'error' as const;
  if (active) return 'process' as const;
  return done ? ('finish' as const) : ('wait' as const);
}

function renderReadinessSteps(record: ProcessModelTableItem) {
  const readiness = record.readiness;
  const published =
    record.status === 'DEPLOYED' && Boolean(record.flowableDefinitionId);
  const retired = record.status === 'ARCHIVED' || record.status === 'DISABLED';
  const bindingBlocked =
    published &&
    (readiness.invalidBindingCount > 0 ||
      readiness.missingTaskKeys.length > 0 ||
      !readiness.hasStartBinding);
  const current = published
    ? readiness.bindingReady
      ? 3
      : 2
    : readiness.deployReady
      ? 1
      : 0;

  return (
    <div style={{ minWidth: 430, overflowX: 'auto', paddingBlock: 2 }}>
      <Steps
        current={current}
        items={[
          {
            title: '设计',
            status: stepStatus(
              Boolean(record.bpmnXml),
              readiness.nextAction === 'design',
              false,
            ),
          },
          {
            title: '发布',
            status: stepStatus(
              published,
              readiness.nextAction === 'deploy',
              retired,
            ),
          },
          {
            title: '表单',
            status: stepStatus(
              readiness.bindingReady,
              readiness.nextAction === 'bind',
              bindingBlocked,
            ),
          },
          {
            title: '发起',
            status: stepStatus(
              readiness.canStart,
              readiness.nextAction === 'start',
              false,
            ),
          },
          {
            title: '追踪',
            status: 'wait',
          },
        ]}
        responsive={false}
        size="small"
        type="dot"
      />
    </div>
  );
}

const ProcessModels: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modal, contextHolder] = Modal.useModal();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ModelViewMode>('business');
  const session = getSessionContext();
  const canStartProcess =
    session.permissions?.canStartProcess ?? session.role === 'applicant';

  const saveProcessModel = async (values: ProcessModelForm) => {
    const model = await createProcessModel(values);
    message.success('已创建');
    setCreateOpen(false);
    actionRef.current?.reload();
    history.push(`/process-designer?modelId=${model.id}`);
    return true;
  };

  const importModel = async (values: ImportProcessModelForm) => {
    const file = values.file?.[0]?.originFileObj;
    if (!file) {
      message.error('请选择流程文件');
      return false;
    }
    const model = await importProcessModel({
      modelName: values.modelName,
      bpmnXml: await file.text(),
    });
    message.success('已导入草稿');
    setImportOpen(false);
    actionRef.current?.reload();
    history.push(`/process-designer?modelId=${model.id}`);
    return true;
  };

  const showDeploySuccess = (record: ProcessModelItem) => {
    modal.success({
      title: '流程已发布',
      width: 520,
      okText: '留在列表',
      content: (
        <Flex vertical gap={12}>
          <span>
            {processDisplayName(record.modelKey, record.modelName)} 已发布为{' '}
            {deployedDefinitionText(record)}
          </span>
          <Typography.Text type="secondary">
            完成表单绑定后可发起并追踪。
          </Typography.Text>
          <Space wrap>
            <Button
              type="primary"
              onClick={() =>
                history.push(`/form-bindings?processModelId=${record.id}`)
              }
            >
              绑定表单
            </Button>
          </Space>
        </Flex>
      ),
    });
  };

  const showReleaseCheck = (
    record: ProcessModelTableItem,
    validation: BpmnValidationResult,
  ) => {
    const assigneeErrors = validation.errors.filter(
      (issue) => issue.code === assigneeRequiredCode,
    );
    const releaseReady = validation.valid && record.readiness.deployReady;
    const published =
      record.status === 'DEPLOYED' && Boolean(record.flowableDefinitionId);
    const content = (
      <Flex vertical gap={12}>
        <Alert
          showIcon
          type={releaseReady ? 'success' : 'warning'}
          title={releaseReady ? '发布检查通过' : '发布检查未通过'}
          description={
            releaseReady
              ? '可发布，发布后绑定表单再发起。'
              : '处理未通过项后再发布。'
          }
        />
        {renderCheckItem(
          '流程结构',
          validation.valid ? 'success' : 'error',
          validation.valid
            ? '流程结构可解析'
            : `发现 ${validation.errors.length} 个错误`,
        )}
        {validation.errors.length > 0 && (
          <Typography.Text type="secondary">
            {validation.errors.map(bpmnValidationIssueText).join('；')}
          </Typography.Text>
        )}
        {renderCheckItem(
          '办理人配置',
          assigneeErrors.length ? 'error' : 'success',
          assigneeErrors.length
            ? `还有 ${assigneeErrors.length} 个用户任务缺少办理人`
            : '用户任务已配置办理人',
        )}
        {renderCheckItem(
          '发起表单',
          record.readiness.hasStartBinding
            ? 'success'
            : published
              ? 'error'
              : 'warning',
          record.readiness.hasStartBinding
            ? '发起时会保存业务快照'
            : published
              ? '缺少发起表单绑定'
              : '发布后绑定发起表单',
        )}
        {renderCheckItem(
          '任务表单',
          record.readiness.missingTaskKeys.length
            ? published
              ? 'error'
              : 'warning'
            : 'success',
          record.readiness.taskCount
            ? `已绑定 ${record.readiness.boundTaskCount}/${record.readiness.taskCount} 个任务节点`
            : '当前流程没有用户任务',
        )}
        {record.readiness.missingTaskKeys.length > 0 && (
          <Typography.Text type="secondary">
            未绑定节点：{record.readiness.missingTaskKeys.join('、')}
          </Typography.Text>
        )}
        {renderCheckItem(
          '表单状态',
          record.readiness.invalidBindingCount
            ? published
              ? 'error'
              : 'warning'
            : record.readiness.outdatedBindingCount
              ? 'warning'
              : 'success',
          record.readiness.invalidBindingCount
            ? `有 ${record.readiness.invalidBindingCount} 个绑定表单不可用`
            : record.readiness.outdatedBindingCount
              ? `有 ${record.readiness.outdatedBindingCount} 个绑定版本待同步`
              : '绑定表单均可用',
        )}
        {renderCheckItem(
          '变量表达式',
          record.readiness.variableExpressions.length ? 'warning' : 'success',
          record.readiness.variableExpressions.length
            ? `需确认表单会提供：${record.readiness.variableExpressions.join('、')}`
            : '未发现需要额外确认的表达式',
        )}
        {validation.warnings.length > 0 && (
          <Typography.Text type="secondary">
            流程文件提醒：
            {validation.warnings.map(bpmnValidationIssueText).join('；')}
          </Typography.Text>
        )}
      </Flex>
    );

    const options = {
      title: `${processDisplayName(record.modelKey, record.modelName)} · 发布检查`,
      width: 620,
      okText: '知道了',
      content,
    };

    if (releaseReady) {
      modal.success(options);
      return;
    }
    modal.warning(options);
  };

  const deployDraft = async (record: ProcessModelTableItem) => {
    const validation = await validateProcessModel(record.id);
    if (!validation.valid || !record.readiness.deployReady) {
      showReleaseCheck(record, validation);
      return;
    }
    const result = await deployProcessModelDraft(record.id);
    showDeploySuccess(result.model);
    actionRef.current?.reload();
  };

  const openNextStep = async (record: ProcessModelTableItem) => {
    if (record.readiness.nextAction === 'design') {
      history.push(`/process-designer?modelId=${record.id}`);
      return;
    }
    if (record.readiness.nextAction === 'bind') {
      history.push(`/form-bindings?processModelId=${record.id}`);
      return;
    }
    if (record.readiness.nextAction === 'deploy') {
      await deployDraft(record);
      return;
    }
    if (record.readiness.nextAction === 'start') {
      history.push(`/process-start?processModelId=${record.id}`);
    }
  };

  const columns: ProColumns<ProcessModelTableItem>[] = [
    {
      title: '模型名称',
      dataIndex: 'modelName',
      width: 220,
      ellipsis: true,
      render: (_, record) => (
        <Typography.Text ellipsis={{ tooltip: true }}>
          {processDisplayName(record.modelKey, record.modelName)}
        </Typography.Text>
      ),
    },
    {
      title: '流程标识',
      dataIndex: 'modelKey',
      width: 180,
      render: (_, record) => (
        <CopyableText
          value={record.modelKey}
          displayValue={processModelKeyLabel(record.modelKey)}
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
      width: 120,
      valueType: 'select',
      valueEnum: {
        DRAFT: { text: '草稿' },
        DEPLOYED: { text: '已发布' },
        DISABLED: { text: '已停用' },
        ARCHIVED: { text: '已归档' },
      },
      render: (_, record) => (
        <KoravoStatusTag
          status={record.status}
          text={processStatusLabel(record.status)}
        />
      ),
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
      title: '配置状态',
      dataIndex: 'formBindingCount',
      width: 180,
      search: false,
      render: (_, record) => renderConfigurationStatus(record),
    },
    {
      title: '配置路径',
      key: 'readinessPath',
      width: 460,
      search: false,
      render: (_, record) => renderReadinessSteps(record),
    },
    {
      title: '下一步',
      key: 'nextAction',
      width: 150,
      search: false,
      render: (_, record) => (
        <Flex vertical gap={4}>
          <Button
            size="small"
            type={
              record.readiness.nextAction === 'start' ? 'primary' : 'default'
            }
            disabled={
              record.readiness.nextAction === 'none' ||
              (record.readiness.nextAction === 'start' && !canStartProcess)
            }
            onClick={() => {
              void openNextStep(record);
            }}
          >
            {record.readiness.nextActionText}
          </Button>
          <Typography.Text type="secondary">
            {record.readiness.nextAction === 'start' && !canStartProcess
              ? '发起人可用'
              : record.readiness.nextActionDescription}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: '运行版本',
      dataIndex: 'flowableDefinitionId',
      width: 220,
      search: false,
      ellipsis: true,
      render: (_, record) => (
        <CopyableText
          value={record.flowableDefinitionId}
          displayValue={processDefinitionLabel(record.flowableDefinitionId)}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      search: false,
      ellipsis: true,
      renderText: (_, record) => processDescriptionLabel(record),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      search: false,
      renderText: (value) => formatDateTime(value),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 340,
      search: false,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() =>
              history.push(`/process-designer?modelId=${record.id}`)
            }
          >
            设计
          </Button>
          <Button
            type="link"
            disabled={record.status === 'ARCHIVED'}
            onClick={async () => {
              const validation = await validateProcessModel(record.id);
              showReleaseCheck(record, validation);
            }}
          >
            校验
          </Button>
          <Button
            type="link"
            disabled={record.status !== 'DRAFT'}
            onClick={() => {
              void deployDraft(record);
            }}
          >
            发布
          </Button>
          <Button
            type="link"
            disabled={record.status === 'ARCHIVED'}
            onClick={() =>
              history.push(`/form-bindings?processModelId=${record.id}`)
            }
          >
            绑定表单
          </Button>
          <Button
            type="link"
            disabled={!record.readiness.canStart || !canStartProcess}
            onClick={() =>
              history.push(`/process-start?processModelId=${record.id}`)
            }
          >
            发起流程
          </Button>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={async () => {
              downloadModelFile(record, await exportProcessModel(record.id));
            }}
          >
            导出
          </Button>
          <Button
            type="link"
            danger
            disabled={record.status !== 'DEPLOYED'}
            onClick={() => {
              modal.confirm({
                title: '停用流程模型',
                content: `确认停用「${processDisplayName(record.modelKey, record.modelName)}」？`,
                okText: '停用',
                cancelText: '取消',
                onOk: async () => {
                  await disableProcessModel(record.id);
                  message.success('已停用');
                  actionRef.current?.reload();
                },
              });
            }}
          >
            停用
          </Button>
          <Button
            type="link"
            danger
            disabled={record.status === 'ARCHIVED'}
            onClick={() => {
              modal.confirm({
                title: '归档流程模型',
                content: `确认归档「${processDisplayName(record.modelKey, record.modelName)}」？`,
                okText: '归档',
                cancelText: '取消',
                onOk: async () => {
                  await archiveProcessModel(record.id);
                  message.success('已归档');
                  actionRef.current?.reload();
                },
              });
            }}
          >
            归档
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="流程模型">
      {contextHolder}
      <ProTable<ProcessModelTableItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1440 }}
        params={{ viewMode }}
        request={async (params) => {
          const [models, bindings, schemas] = await Promise.all([
            listProcessModels(params.status as string | undefined),
            listFormBindings(),
            listFormSchemas(),
          ]);
          const visibleModels =
            viewMode === 'business'
              ? models.filter(isActiveBusinessProcessModel)
              : models;
          const keyword = String(
            params.modelName || params.modelKey || '',
          ).trim();
          const filteredModels = keyword
            ? visibleModels.filter((item) =>
                [item.modelName, item.modelKey, item.description]
                  .filter(Boolean)
                  .some((value) => String(value).includes(keyword)),
              )
            : visibleModels;
          const data = await Promise.all(
            filteredModels.map(async (model) => {
              const modelBindings = getModelBindings(model, bindings);
              let tasks: BpmnTaskDefinition[] = [];
              try {
                tasks = await listProcessModelTaskDefinitions(model.id);
              } catch {
                tasks = [];
              }
              return {
                ...model,
                formBindingCount: modelBindings.length,
                readiness: buildModelReadiness(
                  model,
                  modelBindings,
                  tasks,
                  schemas,
                ),
              };
            }),
          );
          return {
            data,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        options={{
          density: true,
          fullScreen: true,
          reload: true,
          setting: true,
        }}
        locale={{
          emptyText: (
            <Empty
              description="暂无流程模型"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateOpen(true)}
                >
                  新建模型
                </Button>
                <Button
                  icon={<CloudUploadOutlined />}
                  onClick={() => setImportOpen(true)}
                >
                  导入流程文件
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
              { label: '业务流程', value: 'business' },
              { label: '全部模型', value: 'all' },
            ]}
            onChange={(value) => setViewMode(value as ModelViewMode)}
          />,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => actionRef.current?.reload()}
          >
            刷新
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建模型
          </Button>,
          <Button
            key="import"
            icon={<CloudUploadOutlined />}
            onClick={() => setImportOpen(true)}
          >
            导入流程文件
          </Button>,
        ]}
      />

      <ModalForm<ProcessModelForm>
        title="新建流程模型"
        open={createOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setCreateOpen(false),
        }}
        onOpenChange={setCreateOpen}
        onFinish={saveProcessModel}
      >
        <ProFormText
          name="modelKey"
          label="流程标识"
          rules={[
            { required: true, message: '请输入流程标识' },
            {
              pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
              message: '仅支持字母、数字、下划线，且不能以数字开头',
            },
          ]}
        />
        <ProFormText
          name="modelName"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
        />
        <ProFormTextArea name="description" label="说明" />
      </ModalForm>

      <ModalForm<ImportProcessModelForm>
        title="导入流程文件"
        open={importOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setImportOpen(false),
        }}
        onOpenChange={setImportOpen}
        onFinish={importModel}
      >
        <Alert
          showIcon
          type="info"
          title="导入为草稿"
          style={{ marginBottom: 16 }}
        />
        <ProFormText
          name="modelName"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
        />
        <ProFormUploadButton
          name="file"
          label="流程文件"
          title="选择文件"
          max={1}
          fieldProps={{
            accept: '.bpmn,.bpmn20.xml,.xml',
            beforeUpload: () => false,
            maxCount: 1,
          }}
          rules={[{ required: true, message: '请选择流程文件' }]}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default ProcessModels;
