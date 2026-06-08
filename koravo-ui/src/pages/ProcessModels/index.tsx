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
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, Modal, Space, message } from 'antd';
import React, { useRef } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  archiveProcessModel,
  createProcessModel,
  deployProcessModelDraft,
  disableProcessModel,
  exportProcessModel,
  listProcessModels,
  validateProcessModel,
  type ProcessModelItem,
} from '@/services/koravo/api';
import {
  processDescriptionLabel,
  processDisplayName,
  processStatusLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface ProcessModelForm {
  modelKey: string;
  modelName: string;
  description?: string;
  bpmnXml?: string;
}

function downloadModelFile(record: ProcessModelItem, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.modelKey || record.id}.bpmn20.xml`;
  link.click();
  URL.revokeObjectURL(url);
}

const ProcessModels: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [modal, contextHolder] = Modal.useModal();

  const columns: ProColumns<ProcessModelItem>[] = [
    {
      title: '模型名称',
      dataIndex: 'modelName',
      render: (_, record) => processDisplayName(record.modelKey, record.modelName),
    },
    {
      title: '模型标识',
      dataIndex: 'modelKey',
      width: 180,
      render: (_, record) => <CopyableText value={record.modelKey} />,
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
      render: (_, record) => <CopyableText value={record.flowableDefinitionId} />,
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
      width: 280,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => history.push(`/process-designer?modelId=${record.id}`)}
          >
            设计
          </Button>
          <Button
            type="link"
            onClick={async () => {
              await validateProcessModel(record.id);
              message.success('校验通过');
            }}
          >
            校验
          </Button>
          <Button
            type="link"
            onClick={async () => {
              await deployProcessModelDraft(record.id);
              message.success('已部署');
              actionRef.current?.reload();
            }}
          >
            部署
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
    <PageContainer title="流程模型" content="维护流程草稿、部署版本和运行定义。">
      {contextHolder}
      <ProTable<ProcessModelItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1280 }}
        request={async (params) => {
          const data = await listProcessModels(params.status as string | undefined);
          const keyword = String(params.modelName || params.modelKey || '').trim();
          return {
            data: keyword
              ? data.filter((item) =>
                  [item.modelName, item.modelKey, item.description]
                    .filter(Boolean)
                    .some((value) => String(value).includes(keyword)),
                )
              : data,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        options={{ density: true, fullScreen: true, reload: true, setting: true }}
        toolBarRender={() => [
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => actionRef.current?.reload()}
          >
            刷新
          </Button>,
          <ModalForm<ProcessModelForm>
            key="create"
            title="新建流程模型"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建模型
              </Button>
            }
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await createProcessModel(values);
              message.success('已创建');
              actionRef.current?.reload();
              return true;
            }}
          >
            <ProFormText
              name="modelKey"
              label="模型标识"
              rules={[{ required: true, message: '请输入模型标识' }]}
            />
            <ProFormText
              name="modelName"
              label="模型名称"
              rules={[{ required: true, message: '请输入模型名称' }]}
            />
            <ProFormTextArea name="description" label="说明" />
            <ProFormTextArea
              name="bpmnXml"
              label="BPMN XML"
              fieldProps={{ rows: 8 }}
            />
          </ModalForm>,
          <Button
            key="import"
            icon={<CloudUploadOutlined />}
            onClick={() => history.push('/process-designer')}
          >
            导入设计
          </Button>,
        ]}
      />
    </PageContainer>
  );
};

export default ProcessModels;
