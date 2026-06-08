import {
  CloudUploadOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, App, Button, Empty, Flex, Modal, Segmented, Space, type UploadFile } from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  archiveProcessModel,
  createProcessModel,
  deployProcessModel,
  deployProcessModelDraft,
  disableProcessModel,
  exportProcessModel,
  listProcessModels,
  validateProcessModel,
  type ProcessModelItem,
} from '@/services/koravo/api';
import {
  processDescriptionLabel,
  processDefinitionLabel,
  processDisplayName,
  processModelKeyLabel,
  processStatusLabel,
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

const hiddenBusinessModelKeys = new Set(['httpConnectorDemo', 'leaveApproval']);
const nonBusinessModelPattern = /示例|演示|验证|调试|测试/i;

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

function isBusinessModel(record: ProcessModelItem) {
  if (hiddenBusinessModelKeys.has(record.modelKey)) return false;
  return ![record.modelName, record.description, record.modelKey].some((value) =>
    nonBusinessModelPattern.test(String(value || '')),
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
      message.error('请选择 BPMN 文件');
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
            {processDisplayName(record.modelKey, record.modelName)} 已部署为
            {' '}
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
                history.push(`/process-instances?processModelId=${record.id}`)
              }
            >
              发起实例
            </Button>
          </Space>
        </Flex>
      ),
    });
  };

  const columns: ProColumns<ProcessModelItem>[] = [
    {
      title: '模型名称',
      dataIndex: 'modelName',
      render: (_, record) =>
        processDisplayName(record.modelKey, record.modelName),
    },
    {
      title: '模型标识',
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
      title: '流程定义',
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
              await validateProcessModel(record.id);
              message.success('校验通过');
            }}
          >
            校验
          </Button>
          <Button
            type="link"
            disabled={record.status === 'ARCHIVED'}
            onClick={async () => {
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
            disabled={record.status !== 'DEPLOYED'}
            onClick={() =>
              history.push(`/process-instances?processModelId=${record.id}`)
            }
          >
            发起实例
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
      <ProTable<ProcessModelItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1280 }}
        params={{ viewMode }}
        request={async (params) => {
          const data = await listProcessModels(
            params.status as string | undefined,
          );
          const visibleData =
            viewMode === 'business' ? data.filter(isBusinessModel) : data;
          const keyword = String(
            params.modelName || params.modelKey || '',
          ).trim();
          return {
            data: keyword
              ? visibleData.filter((item) =>
                  [item.modelName, item.modelKey, item.description]
                    .filter(Boolean)
                    .some((value) => String(value).includes(keyword)),
                )
              : visibleData,
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
                  导入 BPMN
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
            导入 BPMN
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
          label="模型标识"
          rules={[
            { required: true, message: '请输入模型标识' },
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
        title="导入 BPMN"
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
          description="请确认 BPMN 内的流程标识稳定，后续表单绑定和实例发起都会使用该标识。"
          style={{ marginBottom: 16 }}
        />
        <ProFormText
          name="modelName"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
        />
        <ProFormUploadButton
          name="file"
          label="BPMN 文件"
          title="选择文件"
          max={1}
          fieldProps={{
            accept: '.bpmn,.bpmn20.xml,.xml',
            beforeUpload: () => false,
            maxCount: 1,
          }}
          rules={[{ required: true, message: '请选择 BPMN 文件' }]}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default ProcessModels;
