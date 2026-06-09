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
  deployProcessModel,
  deployProcessModelDraft,
  disableProcessModel,
  exportProcessModel,
  type FormBindingItem,
  listFormBindings,
  listProcessModels,
  listProcessModelTaskDefinitions,
  type ProcessModelItem,
  validateProcessModel,
} from '@/services/koravo/api';
import {
  isBusinessProcessModel,
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
interface ModelReadiness {
  hasStartBinding: boolean;
  taskCount: number;
  boundTaskCount: number;
  missingTaskKeys: string[];
  variableExpressions: string[];
  deployReady: boolean;
  canStart: boolean;
  statusText: string;
  description: string;
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

function buildModelReadiness(
  record: ProcessModelItem,
  bindings: FormBindingItem[],
  tasks: BpmnTaskDefinition[],
): ModelReadiness {
  const hasStartBinding = bindings.some(
    (binding) => binding.taskDefinitionKey === START_FORM_TASK_KEY,
  );
  const taskBindings = bindings.filter(
    (binding) => binding.taskDefinitionKey !== START_FORM_TASK_KEY,
  );
  const missingTaskKeys = tasks
    .filter(
      (task) =>
        !taskBindings.some(
          (binding) => binding.taskDefinitionKey === task.taskDefinitionKey,
        ),
    )
    .map((task) => taskDefinitionLabel(task.taskDefinitionKey, task));
  const boundTaskCount = tasks.length - missingTaskKeys.length;
  const deployReady = hasStartBinding && missingTaskKeys.length === 0;
  const canStart = record.status === 'DEPLOYED' && deployReady;
  let statusText = '待配置';
  let description = hasStartBinding ? '补齐任务表单后可发起' : '先绑定启动表单';

  if (record.status === 'ARCHIVED') {
    statusText = '已归档';
    description = '已归档流程不再发起';
  } else if (record.status === 'DISABLED') {
    statusText = '已停用';
    description = '恢复后才可继续使用';
  } else if (record.status !== 'DEPLOYED' || !record.flowableDefinitionId) {
    statusText = '草稿';
    description = deployReady ? '发布检查通过后可部署' : '部署前需完成发布检查';
  } else if (canStart) {
    statusText = '可发起';
    description = `启动表单和 ${tasks.length} 个任务表单已就绪`;
  } else if (missingTaskKeys.length > 0) {
    description = `缺 ${missingTaskKeys.length} 个任务表单`;
  }

  return {
    hasStartBinding,
    taskCount: tasks.length,
    boundTaskCount,
    missingTaskKeys,
    variableExpressions: extractVariableExpressions(record.bpmnXml),
    deployReady,
    canStart,
    statusText,
    description,
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

const ProcessModels: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modal, contextHolder] = Modal.useModal();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ModelViewMode>('business');

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
    const deployment = await deployProcessModel(values.modelName, file);
    message.success('已导入并部署');
    setImportOpen(false);
    actionRef.current?.reload();
    history.push(`/process-designer?modelId=${deployment.platformModelId}`);
    return true;
  };

  const showDeploySuccess = (record: ProcessModelItem) => {
    modal.success({
      title: '流程已部署',
      width: 520,
      okText: '留在列表',
      content: (
        <Flex vertical gap={12}>
          <span>
            {processDisplayName(record.modelKey, record.modelName)} 已部署为{' '}
            {deployedDefinitionText(record)}
          </span>
          <Space wrap>
            <Button
              type="primary"
              onClick={() =>
                history.push(`/form-bindings?processModelId=${record.id}`)
              }
            >
              绑定表单
            </Button>
            <Button
              onClick={() =>
                history.push(`/process-start?processModelId=${record.id}`)
              }
            >
              发起流程
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
    const content = (
      <Flex vertical gap={12}>
        <Alert
          showIcon
          type={releaseReady ? 'success' : 'warning'}
          title={releaseReady ? '发布检查通过' : '发布检查未通过'}
          description={
            releaseReady
              ? '该流程已具备发布和发起所需的基础配置。'
              : '请处理未通过项后再部署，避免实例发起后卡在缺表单或缺办理人的节点。'
          }
        />
        {renderCheckItem(
          '流程结构',
          validation.valid ? 'success' : 'error',
          validation.valid
            ? '流程结构可解析'
            : `发现 ${validation.errors.length} 个错误`,
        )}
        {renderCheckItem(
          '办理人配置',
          assigneeErrors.length ? 'error' : 'success',
          assigneeErrors.length
            ? `还有 ${assigneeErrors.length} 个用户任务缺少办理人`
            : '用户任务已配置办理人',
        )}
        {renderCheckItem(
          '启动表单',
          record.readiness.hasStartBinding ? 'success' : 'error',
          record.readiness.hasStartBinding
            ? '发起流程时会采集并保存启动快照'
            : '缺少启动表单绑定',
        )}
        {renderCheckItem(
          '任务表单',
          record.readiness.missingTaskKeys.length ? 'error' : 'success',
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
          '变量表达式',
          record.readiness.variableExpressions.length ? 'warning' : 'success',
          record.readiness.variableExpressions.length
            ? `需确认表单会提供：${record.readiness.variableExpressions.join('、')}`
            : '未发现需要额外确认的表达式',
        )}
        {validation.warnings.length > 0 && (
          <Typography.Text type="secondary">
            流程文件提醒：
            {validation.warnings.map((item) => item.message).join('；')}
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
        DEPLOYED: { text: '已部署' },
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
      title: '配置状态',
      dataIndex: 'formBindingCount',
      width: 180,
      search: false,
      render: (_, record) => renderConfigurationStatus(record),
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
            disabled={record.status === 'ARCHIVED'}
            onClick={async () => {
              const validation = await validateProcessModel(record.id);
              if (!validation.valid || !record.readiness.deployReady) {
                showReleaseCheck(record, validation);
                return;
              }
              const result = await deployProcessModelDraft(record.id);
              showDeploySuccess(result.model);
              actionRef.current?.reload();
            }}
          >
            部署
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
            disabled={!record.readiness.canStart}
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
    <PageContainer
      title="流程模型"
      content="维护流程草稿、部署版本和运行定义。"
    >
      {contextHolder}
      <ProTable<ProcessModelTableItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1280 }}
        params={{ viewMode }}
        request={async (params) => {
          const [models, bindings] = await Promise.all([
            listProcessModels(params.status as string | undefined),
            listFormBindings(),
          ]);
          const visibleModels =
            viewMode === 'business'
              ? models.filter(isBusinessProcessModel)
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
                readiness: buildModelReadiness(model, modelBindings, tasks),
              };
            }),
          );
          return {
            data,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
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
          title="导入后会立即部署为可运行流程"
          description="请确认流程文件内的流程标识稳定，后续表单绑定和实例发起都会使用该标识。"
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
