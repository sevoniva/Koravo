import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Drawer, Empty, Modal, Space, Statistic, Tabs, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  deleteDeadLetterJob,
  deleteFailedJob,
  getDeadLetterJob,
  getFailedJob,
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

type JobKind = 'failed' | 'dead-letter';

interface SelectedJob {
  kind: JobKind;
  id: string;
}

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
    title: '业务编号',
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
    width: 160,
    render: (_, record) => (
      <Space size={4}>
        <Button
          type="link"
          onClick={() => history.push(`/process-instances/${record.instanceId}`)}
        >
          查看实例
        </Button>
        <Button
          type="link"
          onClick={() =>
            history.push(
              `/audit-logs?resourceId=${encodeURIComponent(record.instanceId)}`,
            )
          }
        >
          审计日志
        </Button>
      </Space>
    ),
  },
];

function jobColumns(
  retryJob: (id: string) => Promise<unknown>,
  deleteJob: (id: string) => Promise<unknown>,
  actionRef: React.RefObject<ActionType | null>,
  modal: ReturnType<typeof Modal.useModal>[0],
  message: ReturnType<typeof App.useApp>['message'],
  openDetail: (job: SelectedJob) => void,
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
      render: (_, record) =>
        record.processInstanceId ? (
          <Space wrap>
            <CopyableText value={record.processInstanceId} />
            <Button
              type="link"
              onClick={() => history.push(`/process-instances/${record.processInstanceId}`)}
            >
              查看实例
            </Button>
          </Space>
        ) : (
          '-'
        ),
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
      width: 176,
      render: (_, record) => [
        <Button
          key="detail"
          type="link"
          onClick={() =>
            openDetail({
              id: record.id,
              kind: record.type === 'DEAD_LETTER' ? 'dead-letter' : 'failed',
            })
          }
        >
          详情
        </Button>,
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

function jobEmpty(description: string) {
  return (
    <Empty
      description={description}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    >
      <Button onClick={() => history.push('/audit-logs')}>
        查看审计日志
      </Button>
    </Empty>
  );
}

const Ops: React.FC = () => {
  const failedRef = useRef<ActionType>(null);
  const deadLetterRef = useRef<ActionType>(null);
  const [selectedJob, setSelectedJob] = useState<SelectedJob>();
  const [activeTab, setActiveTab] = useState('instances');
  const [modal, contextHolder] = Modal.useModal();
  const { message } = App.useApp();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['ops-summary'],
    queryFn: getOpsSummary,
  });
  const { data: jobDetail, isLoading: jobDetailLoading } = useQuery({
    queryKey: ['ops-job-detail', selectedJob?.kind, selectedJob?.id],
    queryFn: () =>
      selectedJob?.kind === 'dead-letter'
        ? getDeadLetterJob(selectedJob.id)
        : getFailedJob(selectedJob?.id || ''),
    enabled: Boolean(selectedJob?.id),
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
      {(summary?.failedJobCount || 0) + (summary?.deadLetterJobCount || 0) > 0 ? (
        <Alert
          showIcon
          type="warning"
          title="存在待处理的异常任务"
          description="建议先查看失败任务和死信任务，确认是否需要重试、删除或回到流程实例排查上下文。"
          action={
            <Space wrap>
              {summary?.failedJobCount ? (
                <Button size="small" onClick={() => setActiveTab('failed')}>
                  查看失败任务
                </Button>
              ) : null}
              {summary?.deadLetterJobCount ? (
                <Button size="small" onClick={() => setActiveTab('dead-letter')}>
                  查看死信任务
                </Button>
              ) : null}
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
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
                locale={{ emptyText: jobEmpty('暂无失败任务') }}
                columns={jobColumns(
                  retryFailedJob,
                  deleteFailedJob,
                  failedRef,
                  modal,
                  message,
                  setSelectedJob,
                )}
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
                locale={{ emptyText: jobEmpty('暂无死信任务') }}
                columns={jobColumns(
                  retryDeadLetterJob,
                  deleteDeadLetterJob,
                  deadLetterRef,
                  modal,
                  message,
                  setSelectedJob,
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
      <Drawer
        title="异常任务详情"
        size={720}
        open={Boolean(selectedJob)}
        loading={jobDetailLoading}
        onClose={() => setSelectedJob(undefined)}
        extra={
          jobDetail?.processInstanceId ? (
            <Space wrap>
              <Button
                type="link"
                onClick={() => history.push(`/process-instances/${jobDetail.processInstanceId}`)}
              >
                查看流程实例
              </Button>
              <Button
                type="link"
                onClick={() =>
                  history.push(
                    `/audit-logs?resourceId=${encodeURIComponent(jobDetail.processInstanceId || '')}`,
                  )
                }
              >
                审计日志
              </Button>
            </Space>
          ) : null
        }
      >
        {jobDetail ? (
          <Space vertical size={16} style={{ width: '100%' }}>
            {jobDetail.exceptionMessage ? (
              <Alert
                showIcon
                type="error"
                title="异常信息"
                description={jobDetail.exceptionMessage}
              />
            ) : null}
            <ProDescriptions<OpsJobItem>
              column={1}
              dataSource={jobDetail}
              columns={[
                { title: '任务编号', dataIndex: 'id', copyable: true },
                { title: '类型', dataIndex: 'type' },
                {
                  title: '流程实例',
                  dataIndex: 'processInstanceId',
                  render: (_, record) =>
                    record.processInstanceId ? (
                      <Space wrap>
                        <CopyableText value={record.processInstanceId} />
                        <Button
                          type="link"
                          onClick={() =>
                            history.push(`/process-instances/${record.processInstanceId}`)
                          }
                        >
                          查看实例
                        </Button>
                      </Space>
                    ) : (
                      '-'
                    ),
                },
                {
                  title: '流程定义',
                  dataIndex: 'processDefinitionId',
                  renderText: processDefinitionLabel,
                },
                { title: '执行编号', dataIndex: 'executionId', copyable: true },
                { title: '节点编号', dataIndex: 'elementId' },
                { title: '节点名称', dataIndex: 'elementName' },
                { title: '处理器', dataIndex: 'handlerType' },
                { title: '重试次数', dataIndex: 'retries' },
                { title: '创建时间', dataIndex: 'createTime', renderText: formatDateTime },
                { title: '到期时间', dataIndex: 'dueDate', renderText: formatDateTime },
              ]}
            />
            <Typography.Title level={5}>异常堆栈</Typography.Title>
            {jobDetail.exceptionStacktrace ? (
              <Typography.Paragraph
                copyable
                style={{
                  marginBottom: 0,
                  maxHeight: 360,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {jobDetail.exceptionStacktrace}
              </Typography.Paragraph>
            ) : (
              <Empty description="暂无异常堆栈" />
            )}
          </Space>
        ) : (
          <Empty description="暂无任务详情" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default Ops;
