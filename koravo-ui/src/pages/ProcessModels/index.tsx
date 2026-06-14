import {
  CloudUploadOutlined,
  DownloadOutlined,
  HistoryOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
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
  Drawer,
  Dropdown,
  Empty,
  Flex,
  Modal,
  Segmented,
  Space,
  Steps,
  Tag,
  Typography,
  type MenuProps,
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
  listProcessModelVersions,
  listProcessModelTaskDefinitions,
  type ProcessModelItem,
  restoreProcessModelDraft,
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
  modelKey?: string;
  modelName: string;
  description?: string;
}

interface ImportProcessModelForm {
  modelName: string;
  file: UploadFile[];
}

type ModelViewMode = 'business' | 'all';
type ModelNextAction = 'design' | 'bind' | 'deploy' | 'start' | 'none';
export type ProcessModelVersionGroup = ProcessModelItem & {
  latestVersion: number;
  versionCount: number;
  versions: ProcessModelItem[];
  runtimeVersion?: ProcessModelItem;
};
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
type ProcessModelTableItem = ProcessModelVersionGroup & {
  formBindingCount: number;
  readiness: ModelReadiness;
};

const START_FORM_TASK_KEY = '__START__';
const assigneeRequiredCode = 'BPMN_USER_TASK_ASSIGNEE_REQUIRED';

function createProcessModelKey() {
  return `businessFlow${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

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

function modelGroupKey(model: ProcessModelItem) {
  return model.modelKey || model.id;
}

function modelTimestamp(model: ProcessModelItem) {
  return Date.parse(model.updatedAt || model.createdAt || '') || 0;
}

function statusRank(status?: string) {
  if (status === 'DEPLOYED') return 4;
  if (status === 'DRAFT') return 3;
  if (status === 'DISABLED') return 2;
  if (status === 'ARCHIVED') return 1;
  return 0;
}

export function compareProcessModelVersionsDesc(
  left: ProcessModelItem,
  right: ProcessModelItem,
) {
  const versionDelta = (right.version || 0) - (left.version || 0);
  if (versionDelta !== 0) return versionDelta;
  const updatedDelta = modelTimestamp(right) - modelTimestamp(left);
  if (updatedDelta !== 0) return updatedDelta;
  return statusRank(right.status) - statusRank(left.status);
}

function versionGroupContext(
  current: ProcessModelItem,
  versions: ProcessModelItem[],
): ProcessModelVersionGroup {
  const sortedVersions = [...versions].sort(compareProcessModelVersionsDesc);
  const runtimeVersion =
    sortedVersions.find(
      (item) => item.status === 'DEPLOYED' && item.flowableDefinitionId,
    ) || sortedVersions.find((item) => item.status === 'DEPLOYED');
  return {
    ...current,
    latestVersion: sortedVersions[0]?.version || current.version || 1,
    versionCount: sortedVersions.length,
    versions: sortedVersions,
    runtimeVersion,
  };
}

export function withProcessModelVersionHistory<
  T extends ProcessModelVersionGroup,
>(current: T, versions: ProcessModelItem[]): T {
  const refreshedCurrent =
    versions.find((item) => item.id === current.id) || current;
  return {
    ...current,
    ...versionGroupContext(refreshedCurrent, versions),
  };
}

export function aggregateProcessModelVersions(
  models: ProcessModelItem[],
): ProcessModelVersionGroup[] {
  const groups = new Map<string, ProcessModelItem[]>();
  for (const model of models) {
    const key = modelGroupKey(model);
    groups.set(key, [...(groups.get(key) || []), model]);
  }
  return Array.from(groups.values())
    .map((versions) => {
      const sortedVersions = [...versions].sort(compareProcessModelVersionsDesc);
      return versionGroupContext(sortedVersions[0], sortedVersions);
    })
    .sort(compareProcessModelVersionsDesc);
}

export function selectProcessModelVersionForStatus(
  group: ProcessModelVersionGroup,
  status?: string,
): ProcessModelVersionGroup {
  const targetStatus = String(status || '').trim();
  if (!targetStatus || group.status === targetStatus) return group;
  const matchingVersion = [...group.versions]
    .filter((item) => item.status === targetStatus)
    .sort(compareProcessModelVersionsDesc)[0];
  if (!matchingVersion) return group;
  return versionGroupContext(matchingVersion, group.versions);
}

function isLatestVersion(
  record: ProcessModelItem,
  group?: ProcessModelVersionGroup,
) {
  return group?.versions[0]?.id === record.id;
}

function isRuntimeVersion(
  record: ProcessModelItem,
  group?: ProcessModelVersionGroup,
) {
  return group?.runtimeVersion?.id === record.id;
}

function versionCountText(count: number) {
  return `共 ${count || 1} 版`;
}

function runtimeVersionLabel(record: ProcessModelVersionGroup) {
  const runtimeVersion = record.runtimeVersion;
  if (!runtimeVersion) return undefined;
  const version = runtimeVersion.version || 1;
  return isRuntimeVersion(record, record) ? '运行中' : `运行 v${version}`;
}

function renderRuntimeDefinition(record: ProcessModelTableItem) {
  const runtimeVersion = record.runtimeVersion;
  if (!runtimeVersion) {
    return <Typography.Text type="secondary">暂无运行版本</Typography.Text>;
  }
  return (
    <Flex vertical gap={2}>
      <CopyableText
        value={runtimeVersion.flowableDefinitionId}
        displayValue={processDefinitionLabel(
          runtimeVersion.flowableDefinitionId || runtimeVersion.modelKey,
        )}
      />
      {!isRuntimeVersion(record, record) && (
        <Typography.Text type="secondary">
          来自 v{runtimeVersion.version || 1}
        </Typography.Text>
      )}
    </Flex>
  );
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
  outdatedBindingCount: number,
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
  if (outdatedBindingCount > 0) {
    return {
      nextAction: 'bind',
      nextActionText: '同步表单版本',
      nextActionDescription: `待同步 ${outdatedBindingCount} 个`,
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
    invalidBindingCount === 0 &&
    outdatedBindingCount === 0;
  const deployReady = Boolean(record.bpmnXml);
  const canStart = record.status === 'DEPLOYED' && bindingReady;
  let statusText = '待配置';
  let description = hasStartBinding ? '完善任务表单后可发起' : '先发布流程';
  const nextAction = resolveModelNextAction(
    record,
    hasStartBinding,
    missingTaskKeys,
    outdatedBindingCount,
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
  } else if (outdatedBindingCount > 0) {
    statusText = '待同步';
    description = `有 ${outdatedBindingCount} 个绑定版本待同步`;
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
  if (
    statusText === '待配置' ||
    statusText === '待同步' ||
    statusText === '草稿'
  )
    return 'warning';
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
      readiness.outdatedBindingCount > 0 ||
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
  const [versionPreview, setVersionPreview] =
    useState<ProcessModelTableItem>();
  const [versionLoading, setVersionLoading] = useState(false);
  const session = getSessionContext();
  const canStartProcess =
    session.permissions?.canStartProcess ?? session.role === 'applicant';

  const refreshVersionPreview = async (record: ProcessModelTableItem) => {
    setVersionLoading(true);
    try {
      const versions = await listProcessModelVersions(
        record.id,
        viewMode === 'all',
      );
      setVersionPreview(withProcessModelVersionHistory(record, versions));
    } finally {
      setVersionLoading(false);
    }
  };

  const openVersionPreview = (record: ProcessModelTableItem) => {
    setVersionPreview(record);
    void refreshVersionPreview(record);
  };

  const saveProcessModel = async (values: ProcessModelForm) => {
    const model = await createProcessModel({
      ...values,
      modelKey: values.modelKey || createProcessModelKey(),
    });
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

  const confirmDisableModel = (record: ProcessModelItem) => {
    modal.confirm({
      title: '停用流程模型',
      content: `确认停用「${processDisplayName(record.modelKey, record.modelName)}」？`,
      okText: '停用',
      cancelText: '取消',
      onOk: async () => {
        await disableProcessModel(record.id);
        message.success('已停用');
        setVersionPreview(undefined);
        actionRef.current?.reload();
      },
    });
  };

  const confirmArchiveModel = (record: ProcessModelItem) => {
    modal.confirm({
      title: '归档流程模型',
      content: `确认归档「${processDisplayName(record.modelKey, record.modelName)}」？`,
      okText: '归档',
      cancelText: '取消',
      onOk: async () => {
        await archiveProcessModel(record.id);
        message.success('已归档');
        setVersionPreview(undefined);
        actionRef.current?.reload();
      },
    });
  };

  const restoreDraft = async (record: ProcessModelItem) => {
    const restored = await restoreProcessModelDraft(record.id);
    message.success(`已恢复为 v${restored.version} 草稿`);
    setVersionPreview(undefined);
    actionRef.current?.reload();
    history.push(`/process-designer?modelId=${restored.id}`);
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

  const processActionMenu = (record: ProcessModelTableItem): MenuProps => ({
    items: [
      {
        key: 'check',
        label: '校验',
        disabled: record.status === 'ARCHIVED',
      },
      {
        key: 'start',
        label: '发起流程',
        disabled: !record.readiness.canStart || !canStartProcess,
      },
      { type: 'divider' },
      {
        key: 'export',
        label: '导出',
        icon: <DownloadOutlined />,
      },
      {
        key: 'disable',
        label: '停用',
        disabled: record.status !== 'DEPLOYED',
      },
      {
        key: 'archive',
        label: '归档',
        disabled: record.status === 'ARCHIVED',
        danger: true,
      },
    ],
    onClick: ({ key }) => {
      if (key === 'check') {
        void validateProcessModel(record.id).then((validation) =>
          showReleaseCheck(record, validation),
        );
      }
      if (key === 'start') {
        history.push(`/process-start?processModelId=${record.id}`);
      }
      if (key === 'export') {
        void exportProcessModel(record.id).then((blob) =>
          downloadModelFile(record, blob),
        );
      }
      if (key === 'disable') confirmDisableModel(record);
      if (key === 'archive') confirmArchiveModel(record);
    },
  });

  const versionColumns: ProColumns<ProcessModelItem>[] = [
    {
      title: '版本',
      dataIndex: 'version',
      width: 160,
      render: (_, record) => (
        <Space size={4} wrap>
          <Tag color="blue">v{record.version || 1}</Tag>
          {isLatestVersion(record, versionPreview) ? (
            <Tag color="green">最新</Tag>
          ) : null}
          {isRuntimeVersion(record, versionPreview) ? (
            <Tag color="processing">运行中</Tag>
          ) : null}
          {record.id === versionPreview?.id ? <Tag>列表显示</Tag> : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
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
      width: 100,
      render: (_, record) => (
        <Tag color={assetOriginColor(record.assetOrigin)}>
          {assetOriginLabel(record.assetOrigin)}
        </Tag>
      ),
    },
    {
      title: '运行版本',
      dataIndex: 'flowableDefinitionId',
      width: 200,
      ellipsis: true,
      render: (_, record) => (
        <CopyableText
          value={record.flowableDefinitionId}
          displayValue={processDefinitionLabel(record.flowableDefinitionId)}
        />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 150,
      render: (value) => formatDateTime(value as string),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
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
            onClick={() =>
              history.push(`/form-bindings?processModelId=${record.id}`)
            }
          >
            绑定表单
          </Button>
          <Button
            type="link"
            icon={<RollbackOutlined />}
            disabled={!record.bpmnXml}
            onClick={() => {
              void restoreDraft(record);
            }}
          >
            恢复草稿
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
            onClick={() => confirmDisableModel(record)}
          >
            停用
          </Button>
          <Button
            type="link"
            danger
            disabled={record.status === 'ARCHIVED'}
            onClick={() => confirmArchiveModel(record)}
          >
            归档
          </Button>
        </Space>
      ),
    },
  ];

  const columns: ProColumns<ProcessModelTableItem>[] = [
    {
      title: '模型名称',
      dataIndex: 'modelName',
      width: 260,
      ellipsis: true,
      render: (_, record) => (
        <Typography.Text ellipsis={{ tooltip: true }}>
          {processDisplayName(record.modelKey, record.modelName)}
        </Typography.Text>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 190,
      search: false,
      render: (_, record) => (
        <Flex vertical gap={2}>
          <Space size={4} wrap>
            <Tag color="blue">v{record.version || 1}</Tag>
            {isLatestVersion(record, record) ? (
              <Tag color="green">最新</Tag>
            ) : (
              <Tag>匹配筛选</Tag>
            )}
            {runtimeVersionLabel(record) ? (
              <Tag color="processing">{runtimeVersionLabel(record)}</Tag>
            ) : null}
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => openVersionPreview(record)}
            >
              版本记录
            </Button>
          </Space>
          <Typography.Text type="secondary">
            {versionCountText(record.versionCount)}
          </Typography.Text>
        </Flex>
      ),
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
      render: (_, record) => renderRuntimeDefinition(record),
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
      width: 210,
      search: false,
      render: (_, record) => (
        <Space size={4} wrap>
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
            onClick={() =>
              history.push(`/form-bindings?processModelId=${record.id}`)
            }
          >
            绑定表单
          </Button>
          <Dropdown menu={processActionMenu(record)} trigger={['click']}>
            <Button type="link" icon={<MoreOutlined />}>
              更多
            </Button>
          </Dropdown>
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
        scroll={{ x: 1260 }}
        params={{ viewMode }}
        request={async (params) => {
          const [models, bindings, schemas] = await Promise.all([
            listProcessModels(undefined, viewMode === 'all'),
            listFormBindings(),
            listFormSchemas(),
          ]);
          const visibleModels =
            viewMode === 'business'
              ? models.filter(isActiveBusinessProcessModel)
              : models;
          const versionGroups = aggregateProcessModelVersions(visibleModels);
          const keyword = String(params.modelName || '').trim();
          const filteredModels = keyword
            ? versionGroups.filter((group) =>
                group.versions.some((item) =>
                  [item.modelName, item.description, item.modelKey]
                    .filter(Boolean)
                    .some((value) => String(value).includes(keyword)),
                ),
              )
            : versionGroups;
          const status = String(params.status || '').trim();
          const statusFilteredModels = status
            ? filteredModels.filter((group) =>
                group.versions.some((item) => item.status === status),
              )
            : filteredModels;
          const data = await Promise.all(
            statusFilteredModels.map(async (model) => {
              const displayModel = selectProcessModelVersionForStatus(
                model,
                status,
              );
              const modelBindings = getModelBindings(displayModel, bindings);
              let tasks: BpmnTaskDefinition[] = [];
              try {
                tasks = await listProcessModelTaskDefinitions(displayModel.id);
              } catch {
                tasks = [];
              }
              return {
                ...displayModel,
                formBindingCount: modelBindings.length,
                readiness: buildModelReadiness(
                  displayModel,
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

      <Drawer
        destroyOnHidden
        loading={versionLoading}
        open={Boolean(versionPreview)}
        title={
          versionPreview
            ? `${processDisplayName(versionPreview.modelKey, versionPreview.modelName)} · 版本记录`
            : '版本记录'
        }
        size="min(1120px, calc(100vw - 48px))"
        onClose={() => setVersionPreview(undefined)}
        extra={
          <Button
            icon={<ReloadOutlined />}
            disabled={!versionPreview}
            onClick={() => {
              if (versionPreview) {
                void refreshVersionPreview(versionPreview);
              }
            }}
          >
            刷新
          </Button>
        }
      >
        <ProTable<ProcessModelItem>
          rowKey="id"
          size="small"
          columns={versionColumns}
          dataSource={versionPreview?.versions || []}
          search={false}
          options={false}
          pagination={false}
          scroll={{ x: 920 }}
        />
      </Drawer>

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
