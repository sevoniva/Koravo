import {
  PageContainer,
  ProCard,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Button, Modal, Statistic, Tabs, message } from 'antd';
import React, { useRef } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  deleteDeadLetterJob,
  deleteFailedJob,
  getOpsSummary,
  listDeadLetterJobs,
  listFailedJobs,
  listOpsCapabilities,
  listOpsInstances,
  retryDeadLetterJob,
  retryFailedJob,
  type OpsCapabilityItem,
  type OpsJobItem,
  type OpsProcessInstance,
} from '@/services/koravo/api';
import { processDefinitionLabel } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

const instanceColumns: ProColumns<OpsProcessInstance>[] = [
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
    renderText: processDefinitionLabel,
  },
  {
    title: '业务标识',
    dataIndex: 'businessKey',
    width: 180,
    render: (_, record) => <CopyableText value={record.businessKey} />,
  },
  { title: '发起人', dataIndex: 'startUserId', width: 120 },
  {
    title: '开始时间',
    dataIndex: 'startTime',
    width: 170,
    renderText: formatDateTime,
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

function jobColumns(
  retryJob: (id: string) => Promise<unknown>,
  deleteJob: (id: string) => Promise<unknown>,
  actionRef: React.RefObject<ActionType | null>,
  modal: ReturnType<typeof Modal.useModal>[0],
): ProColumns<OpsJobItem>[] {
  return [
    {
      title: '任务编号',
      dataIndex: 'id',
      width: 220,
      render: (_, record) => <CopyableText value={record.id} />,
    },
    { title: '类型', dataIndex: 'type', width: 120 },
    {
      title: '流程实例',
      dataIndex: 'processInstanceId',
      width: 220,
      render: (_, record) => <CopyableText value={record.processInstanceId} />,
    },
    { title: '节点', dataIndex: 'elementName', width: 160 },
    { title: '重试次数', dataIndex: 'retries', width: 100 },
    {
      title: '到期时间',
      dataIndex: 'dueDate',
      width: 170,
      renderText: formatDateTime,
    },
    {
      title: '异常信息',
      dataIndex: 'exceptionMessage',
      ellipsis: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 128,
      render: (_, record) => [
        <Button
          key="retry"
          type="link"
          onClick={() => {
            modal.confirm({
              title: '重试任务',
              content: '确认提交重试？',
              okText: '重试',
              cancelText: '取消',
              onOk: async () => {
                await retryJob(record.id);
                message.success('已提交重试');
                actionRef.current?.reload();
              },
            });
          }}
        >
          重试
        </Button>,
        <Button
          key="delete"
          type="link"
          danger
          onClick={() => {
            modal.confirm({
              title: '删除任务',
              content: '确认删除该异常任务？',
              okText: '删除',
              cancelText: '取消',
              onOk: async () => {
                await deleteJob(record.id);
                message.success('已删除');
                actionRef.current?.reload();
              },
            });
          }}
        >
          删除
        </Button>,
      ],
    },
  ];
}

const capabilityColumns: ProColumns<OpsCapabilityItem>[] = [
  { title: '能力', dataIndex: 'name' },
  {
    title: '状态',
    dataIndex: 'status',
    width: 120,
    render: (_, record) => <KoravoStatusTag status={record.status} />,
  },
  { title: '说明', dataIndex: 'description', search: false },
];

const Ops: React.FC = () => {
  const failedRef = useRef<ActionType>(null);
  const deadLetterRef = useRef<ActionType>(null);
  const [modal, contextHolder] = Modal.useModal();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['ops-summary'],
    queryFn: getOpsSummary,
  });

  return (
    <PageContainer title="运维中心" content="查看运行实例、异常任务和平台运维能力。">
      {contextHolder}
      <ProCard gutter={16} wrap loading={isLoading} style={{ marginBottom: 16 }}>
        <ProCard colSpan={{ xs: 24, sm: 6 }}>
          <Statistic title="运行实例" value={summary?.runningInstanceCount ?? 0} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 6 }}>
          <Statistic title="失败任务" value={summary?.failedJobCount ?? 0} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 6 }}>
          <Statistic title="死信任务" value={summary?.deadLetterJobCount ?? 0} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 6 }}>
          <Statistic title="连接器异常" value={summary?.connectorFailureCount ?? 0} />
        </ProCard>
      </ProCard>

      <Tabs
        items={[
          {
            key: 'instances',
            label: '运行实例',
            children: (
              <ProTable<OpsProcessInstance>
                rowKey="instanceId"
                columns={instanceColumns}
                scroll={{ x: 1120 }}
                search={false}
                request={async (params) => {
                  const result = await listOpsInstances({
                    page: Number(params.current || 1),
                    pageSize: Number(params.pageSize || 10),
                  });
                  return { data: result.items, total: result.total, success: true };
                }}
              />
            ),
          },
          {
            key: 'failed',
            label: '失败任务',
            children: (
              <ProTable<OpsJobItem>
                actionRef={failedRef}
                rowKey="id"
                columns={jobColumns(retryFailedJob, deleteFailedJob, failedRef, modal)}
                scroll={{ x: 1280 }}
                search={false}
                request={async (params) => {
                  const result = await listFailedJobs({
                    page: Number(params.current || 1),
                    pageSize: Number(params.pageSize || 10),
                  });
                  return { data: result.items, total: result.total, success: true };
                }}
              />
            ),
          },
          {
            key: 'dead-letter',
            label: '死信任务',
            children: (
              <ProTable<OpsJobItem>
                actionRef={deadLetterRef}
                rowKey="id"
                columns={jobColumns(
                  retryDeadLetterJob,
                  deleteDeadLetterJob,
                  deadLetterRef,
                  modal,
                )}
                scroll={{ x: 1280 }}
                search={false}
                request={async (params) => {
                  const result = await listDeadLetterJobs({
                    page: Number(params.current || 1),
                    pageSize: Number(params.pageSize || 10),
                  });
                  return { data: result.items, total: result.total, success: true };
                }}
              />
            ),
          },
          {
            key: 'capabilities',
            label: '能力边界',
            children: (
              <ProTable<OpsCapabilityItem>
                rowKey="key"
                columns={capabilityColumns}
                search={false}
                pagination={false}
                request={async () => ({
                  data: await listOpsCapabilities(),
                  success: true,
                })}
              />
            ),
          },
        ]}
      />
    </PageContainer>
  );
};

export default Ops;
