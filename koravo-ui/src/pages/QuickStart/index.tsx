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
  startProcessInstance,
  type WorkflowEnablementStepStatus,
} from '@/services/koravo/api';
import { processDisplayName, productCopy } from '@/utils/display';

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
    render: (_, record) => productCopy(record.status?.message) || '-',
  },
  {
    title: '数量',
    dataIndex: 'count',
    width: 100,
    render: (_, record) => record.status?.count ?? 0,
  },
];

const QuickStart: React.FC = () => {
  const { message } = App.useApp();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workflow-enablement'],
    queryFn: getWorkflowEnablementStatus,
  });

  const initializeMutation = useMutation({
    mutationFn: initializeWorkflowAssets,
    onSuccess: async () => {
      message.success('流程配置已初始化');
      await refetch();
    },
  });

  const startMutation = useMutation({
    mutationFn: () =>
      startProcessInstance({
        processDefinitionKey: data?.processDefinitionKey || 'leaveApproval',
        businessKey: `LEAVE-${Date.now()}`,
        variables: data?.defaultStartVariables || {
          applicant: 'admin',
          approver: 'admin',
          days: 1,
          reason: '流程启用验证',
        },
      }),
    onSuccess: (instance) => {
      message.success('流程已启动');
      history.push(`/process-instances/${instance.instanceId}`);
    },
  });

  const rows = useMemo<StepRow[]>(
    () => [
      { key: 'process', name: '流程模型', status: data?.process },
      { key: 'form', name: '表单配置', status: data?.form },
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
      title="流程启用"
      content="初始化请假审批配置，并完成首个流程流转。"
      extra={[
        <Button key="reload" icon={<ReloadOutlined />} onClick={() => refetch()}>
          刷新
        </Button>,
        <Button
          key="init"
          icon={<ThunderboltOutlined />}
          loading={initializeMutation.isPending}
          onClick={() => initializeMutation.mutate()}
        >
          初始化配置
        </Button>,
        <Button
          key="start"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={startMutation.isPending}
          disabled={!data?.process?.ready}
          onClick={() => startMutation.mutate()}
        >
          启动流程
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
        <ProCard title="配置状态" colSpan={{ xs: 24, xl: 16 }}>
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
              renderText={(value) => processDisplayName(value)}
            />
            <ProDescriptions.Item label="初始化">
              <KoravoStatusTag status={Boolean(data?.initialized)} />
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};

export default QuickStart;
