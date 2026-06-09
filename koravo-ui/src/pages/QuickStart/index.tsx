import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { useMutation, useQuery } from '@tanstack/react-query';
import { App, Button, Steps } from 'antd';
import React, { useMemo } from 'react';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getWorkflowEnablementStatus,
  initializeWorkflowAssets,
  type WorkflowEnablementStepStatus,
} from '@/services/koravo/api';
import { processKindLabel } from '@/utils/display';

interface StepRow {
  key: string;
  name: string;
  status?: WorkflowEnablementStepStatus;
}

const columns: ProColumns<StepRow>[] = [
  { title: '配置项', dataIndex: 'name' },
  {
    title: '状态',
    dataIndex: 'status',
    width: 120,
    render: (_, record) => (
      <KoravoStatusTag status={Boolean(record.status?.ready)} />
    ),
  },
  {
    title: '说明',
    dataIndex: 'message',
    renderText: (_, record) => stepMessage(record),
  },
  {
    title: '数量',
    dataIndex: 'count',
    width: 100,
    render: (_, record) => record.status?.count ?? 0,
  },
];

function stepMessage(record: StepRow) {
  if (!record.status?.ready) return `${record.name}待补齐`;
  const readyMessages: Record<string, string> = {
    process: '流程模型已部署',
    form: '业务表单可用',
    binding: '任务节点已绑定表单',
    todo: record.status.count ? '当前用户有待办任务' : '暂无待办任务',
    audit: '已有审计记录',
  };
  return readyMessages[record.key] || '配置已就绪';
}

const QuickStart: React.FC = () => {
  const { message } = App.useApp();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workflow-enablement'],
    queryFn: getWorkflowEnablementStatus,
  });

  const initializeMutation = useMutation({
    mutationFn: initializeWorkflowAssets,
    onSuccess: async () => {
      message.success('流程资产已补齐');
      await refetch();
    },
  });

  const rows = useMemo<StepRow[]>(
    () => [
      { key: 'process', name: '流程模型', status: data?.process },
      { key: 'form', name: '业务表单', status: data?.form },
      { key: 'binding', name: '任务绑定', status: data?.binding },
      { key: 'todo', name: '待办任务', status: data?.todo },
      { key: 'audit', name: '审计记录', status: data?.audit },
    ],
    [data],
  );

  const current = rows.findIndex((item) => !item.status?.ready);
  const activeStep = current === -1 ? rows.length : current;

  return (
    <PageContainer
      title="流程资产检查"
      content="检查流程模型、业务表单、任务绑定和待办链路；缺失时可补齐流程资产。"
      extra={[
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
        >
          刷新
        </Button>,
        <Button
          key="init"
          icon={<ThunderboltOutlined />}
          loading={initializeMutation.isPending}
          onClick={() => initializeMutation.mutate()}
        >
          补齐流程资产
        </Button>,
        <Button
          key="start"
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={!data?.process?.ready}
          onClick={() =>
            history.push(
              data?.processModelId
                ? `/process-instances?processModelId=${data.processModelId}`
                : '/process-instances',
            )
          }
        >
          发起流程
        </Button>,
      ]}
    >
      <ProCard loading={isLoading}>
        <Steps
          current={activeStep}
          items={rows.map((item) => ({
            title: item.name,
            status: item.status?.ready ? 'finish' : 'wait',
            icon: item.status?.ready ? <CheckCircleOutlined /> : undefined,
          }))}
        />
      </ProCard>

      <ProCard gutter={16} style={{ marginTop: 16 }} wrap>
        <ProCard title="资产状态" colSpan={{ xs: 24, xl: 16 }}>
          <ProTable<StepRow>
            rowKey="key"
            search={false}
            options={false}
            pagination={false}
            columns={columns}
            dataSource={rows}
          />
        </ProCard>
        <ProCard title="当前上下文" colSpan={{ xs: 24, xl: 8 }}>
          <ProDescriptions column={1} dataSource={data || {}}>
            <ProDescriptions.Item label="租户" dataIndex="tenantId" />
            <ProDescriptions.Item label="用户" dataIndex="userId" />
            <ProDescriptions.Item
              label="流程"
              dataIndex="processDefinitionKey"
              renderText={(value) =>
                processKindLabel(String(value || '').split(':')[0])
              }
            />
            <ProDescriptions.Item label="资产状态">
              <KoravoStatusTag status={Boolean(data?.initialized)} />
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};

export default QuickStart;
