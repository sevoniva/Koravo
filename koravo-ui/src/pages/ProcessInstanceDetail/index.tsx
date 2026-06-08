import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Badge, Button, Drawer, Empty, Flex, Modal, Space, Steps, Tag, Typography } from 'antd';
import type { StepsProps } from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import StructuredDetailTable from '@/components/StructuredDetailTable';
import {
  activateProcessInstance,
  getOpsInstance,
  getProcessTrace,
  listFormSnapshots,
  suspendProcessInstance,
  terminateProcessInstance,
  type AuditLogItem,
  type FormSnapshotItem,
  type ProcessTraceNode,
  type TaskItem,
} from '@/services/koravo/api';
import {
  auditActionLabel,
  auditResourceLabel,
  processDefinitionLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

type StepStatus = NonNullable<NonNullable<StepsProps['items']>[number]['status']>;

interface PurchaseStep {
  key: string;
  title: string;
}

interface PurchaseApprovalRecord {
  key: string;
  taskDefinitionKey: string;
  taskName: string;
  approver?: string;
  approved?: boolean;
  opinion?: string;
  createdAt?: string;
}

const purchaseApprovalSteps: PurchaseStep[] = [
  { key: 'start', title: '提交申请' },
  { key: 'managerApprovalTask', title: '部门审批' },
  { key: 'financeApprovalTask', title: '财务审批' },
  { key: 'end', title: '流程结束' },
];

function isPurchaseInstance(processDefinitionId?: string) {
  return processDefinitionId?.startsWith('purchaseApproval:') ?? false;
}

function findTraceNode(timeline: ProcessTraceNode[], activityId: string) {
  return timeline.find((item) => item.activityId === activityId);
}

function isTraceCompleted(timeline: ProcessTraceNode[], activityId: string) {
  const node = findTraceNode(timeline, activityId);
  return Boolean(node?.endTime || node?.status === 'COMPLETED');
}

function findCurrentTask(currentTasks: TaskItem[], taskDefinitionKey: string) {
  return currentTasks.find((item) => item.taskDefinitionKey === taskDefinitionKey);
}

function purchaseStepStatus(
  stepKey: string,
  currentTasks: TaskItem[],
  timeline: ProcessTraceNode[],
): StepStatus {
  if (findCurrentTask(currentTasks, stepKey)) return 'process';
  if (isTraceCompleted(timeline, stepKey)) return 'finish';
  return 'wait';
}

function purchaseStepDescription(
  stepKey: string,
  currentTasks: TaskItem[],
  timeline: ProcessTraceNode[],
) {
  const currentTask = findCurrentTask(currentTasks, stepKey);
  if (currentTask) {
    return `待 ${currentTask.assignee || '未分配'} 处理`;
  }

  const traceNode = findTraceNode(timeline, stepKey);
  if (traceNode?.endTime) return `完成于 ${formatDateTime(traceNode.endTime)}`;
  if (traceNode?.startTime) return `开始于 ${formatDateTime(traceNode.startTime)}`;
  return '未到达';
}

function purchaseCurrentStep(
  currentTasks: TaskItem[],
  timeline: ProcessTraceNode[],
  instanceStatus?: string,
) {
  if (instanceStatus === 'COMPLETED') return purchaseApprovalSteps.length - 1;
  const firstProcessingIndex = purchaseApprovalSteps.findIndex(
    (step) => purchaseStepStatus(step.key, currentTasks, timeline) === 'process',
  );
  if (firstProcessingIndex >= 0) return firstProcessingIndex;

  const lastFinishedIndex = purchaseApprovalSteps.reduce((lastIndex, step, index) => {
    return purchaseStepStatus(step.key, currentTasks, timeline) === 'finish'
      ? index
      : lastIndex;
  }, 0);
  return lastFinishedIndex;
}

function purchaseApprovalNodeCount(currentTasks: TaskItem[]) {
  return currentTasks.filter((task) =>
    ['managerApprovalTask', 'financeApprovalTask'].includes(task.taskDefinitionKey),
  ).length;
}

function purchaseProgressBadgeText(status?: string, pendingCount = 0) {
  if (status === 'COMPLETED') return '流程已完成';
  return `待处理 ${pendingCount}`;
}

function purchaseApprovalSnapshotRecords(
  snapshots: FormSnapshotItem[] = [],
): PurchaseApprovalRecord[] {
  return snapshots.flatMap((snapshot) => {
    const data = parseJsonSafe(snapshot.dataJson, {}) as Record<string, unknown>;
    const taskDefinitionKey = String(data.taskDefinitionKey || '');
    if (!['managerApprovalTask', 'financeApprovalTask'].includes(taskDefinitionKey)) {
      return [];
    }
    return [
      {
        key: snapshot.id,
        taskDefinitionKey,
        taskName: String(data.taskName || taskDefinitionLabel(taskDefinitionKey)),
        approver: typeof data.approver === 'string' ? data.approver : undefined,
        approved: typeof data.approved === 'boolean' ? data.approved : undefined,
        opinion: typeof data.opinion === 'string' ? data.opinion : undefined,
        createdAt: snapshot.createdAt,
      },
    ];
  });
}

function snapshotData(record: FormSnapshotItem) {
  return parseJsonSafe(record.dataJson, {}) as Record<string, unknown>;
}

function snapshotTaskLabel(record: FormSnapshotItem) {
  const data = snapshotData(record);
  const taskDefinitionKey = String(data.taskDefinitionKey || '');
  if (taskDefinitionKey) return taskDefinitionLabel(taskDefinitionKey);
  return record.taskId ? '任务表单' : '启动表单';
}

function snapshotSummary(record: FormSnapshotItem) {
  const data = snapshotData(record);
  const approved = data.approved;
  const opinion = typeof data.opinion === 'string' ? data.opinion : '';
  const taskName = typeof data.taskName === 'string' ? data.taskName : snapshotTaskLabel(record);

  if (approved === undefined && !opinion) {
    return (
      <Flex gap={8} align="center" wrap>
        <Typography.Text>{taskName}</Typography.Text>
        <Typography.Text type="secondary">
          {Object.keys(data).length ? `${Object.keys(data).length} 个字段` : '暂无字段'}
        </Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text>{taskName}</Typography.Text>
      {approved !== undefined ? (
        <Tag color={approved ? 'success' : 'error'}>
          {approved ? '同意' : '不同意'}
        </Tag>
      ) : null}
      {opinion ? <Typography.Text type="secondary">{opinion}</Typography.Text> : null}
    </Flex>
  );
}

function instanceActionDisabled(status: string | undefined, action: 'suspend' | 'activate' | 'terminate') {
  if (action === 'suspend') return status !== 'RUNNING';
  if (action === 'activate') return status !== 'SUSPENDED';
  return !['RUNNING', 'SUSPENDED'].includes(status || '');
}

const taskColumns: ProColumns<TaskItem>[] = [
  { title: '任务名称', dataIndex: 'name' },
  {
    title: '节点',
    dataIndex: 'taskDefinitionKey',
    width: 150,
    renderText: taskDefinitionLabel,
  },
  { title: '处理人', dataIndex: 'assignee', width: 120 },
  {
    title: '创建时间',
    dataIndex: 'createTime',
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
      <Button type="link" onClick={() => history.push(`/tasks/${record.taskId}`)}>
        查看
      </Button>
    ),
  },
];

const traceColumns: ProColumns<ProcessTraceNode>[] = [
  { title: '节点编号', dataIndex: 'activityId', width: 180 },
  { title: '节点名称', dataIndex: 'activityName' },
  { title: '类型', dataIndex: 'activityType', width: 150 },
  {
    title: '开始时间',
    dataIndex: 'startTime',
    width: 170,
    renderText: formatDateTime,
  },
  {
    title: '结束时间',
    dataIndex: 'endTime',
    width: 170,
    renderText: formatDateTime,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (_, record) => <KoravoStatusTag status={record.status} />,
  },
];

const auditColumns: ProColumns<AuditLogItem>[] = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    width: 170,
    renderText: formatDateTime,
  },
  { title: '操作人', dataIndex: 'userId', width: 120 },
  { title: '操作类型', dataIndex: 'action', renderText: auditActionLabel },
  { title: '对象类型', dataIndex: 'resourceType', renderText: auditResourceLabel },
  {
    title: '追踪号',
    dataIndex: 'requestId',
    width: 170,
    render: (_, record) => <CopyableText value={record.requestId} />,
  },
  {
    title: '操作',
    valueType: 'option',
    width: 110,
    render: (_, record) =>
      record.requestId ? (
        <Button
          type="link"
          onClick={() =>
            history.push(
              `/audit-logs?requestId=${encodeURIComponent(record.requestId || '')}`,
            )
          }
        >
          查看审计
        </Button>
      ) : (
        '-'
      ),
  },
];

const purchaseApprovalColumns: ProColumns<PurchaseApprovalRecord>[] = [
  {
    title: '审批节点',
    dataIndex: 'taskDefinitionKey',
    width: 150,
    renderText: (value) => taskDefinitionLabel(String(value || '')),
  },
  { title: '处理人', dataIndex: 'approver', width: 120 },
  {
    title: '结论',
    dataIndex: 'approved',
    width: 100,
    render: (_, record) =>
      record.approved === undefined ? (
        '-'
      ) : (
        <Typography.Text type={record.approved ? 'success' : 'danger'}>
          {record.approved ? '同意' : '不同意'}
        </Typography.Text>
      ),
  },
  { title: '意见', dataIndex: 'opinion' },
  {
    title: '处理时间',
    dataIndex: 'createdAt',
    width: 170,
    renderText: formatDateTime,
  },
];

const ProcessInstanceDetail: React.FC = () => {
  const params = useParams();
  const instanceId = params.instanceId || '';
  const [modal, contextHolder] = Modal.useModal();
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<FormSnapshotItem>();
  const { message } = App.useApp();
  const {
    data: instance,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['process-instance', instanceId],
    queryFn: () => getOpsInstance(instanceId),
    enabled: Boolean(instanceId),
  });
  const { data: trace } = useQuery({
    queryKey: ['process-trace', instanceId],
    queryFn: () => getProcessTrace(instanceId),
    enabled: Boolean(instanceId),
  });
  const { data: formSnapshots = [] } = useQuery({
    queryKey: ['process-instance-form-snapshots', instanceId],
    queryFn: () => listFormSnapshots({ processInstanceId: instanceId }),
    enabled: Boolean(instanceId),
  });
  const currentTasks = instance?.currentTasks || [];
  const timeline = trace?.timeline || [];
  const isPurchaseApproval = isPurchaseInstance(instance?.processDefinitionId);
  const parallelTaskCount = purchaseApprovalNodeCount(currentTasks);
  const purchaseApprovalRecords = purchaseApprovalSnapshotRecords(formSnapshots);
  const snapshotColumns: ProColumns<FormSnapshotItem>[] = [
    {
      title: '表单编号',
      dataIndex: 'formSchemaId',
      width: 220,
      render: (_, record) => <CopyableText value={record.formSchemaId} />,
    },
    {
      title: '版本',
      dataIndex: 'formSchemaVersion',
      width: 90,
      renderText: (value) => `v${value || 1}`,
    },
    {
      title: '节点',
      dataIndex: 'taskId',
      width: 140,
      render: (_, record) => snapshotTaskLabel(record),
    },
    {
      title: '提交摘要',
      dataIndex: 'dataJson',
      render: (_, record) => snapshotSummary(record),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      renderText: formatDateTime,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 96,
      render: (_, record) => (
        <Button type="link" onClick={() => setSelectedSnapshot(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <PageContainer
      title="流程实例详情"
      content="查看实例状态、当前任务、执行轨迹和审计记录。"
      extra={
        <Space wrap>
          <Button onClick={() => refetch()}>
            刷新
          </Button>
          <Button
            onClick={() =>
              history.push(
                `/audit-logs?resourceId=${encodeURIComponent(instanceId)}`,
              )
            }
          >
            审计日志
          </Button>
          <Button
            disabled={instanceActionDisabled(instance?.status, 'suspend')}
            onClick={() => {
              modal.confirm({
                title: '挂起实例',
                content: '确认挂起该流程实例？',
                okText: '挂起',
                cancelText: '取消',
                onOk: async () => {
                  await suspendProcessInstance(instanceId);
                  message.success('已挂起');
                  await refetch();
                },
              });
            }}
          >
            挂起
          </Button>
          <Button
            disabled={instanceActionDisabled(instance?.status, 'activate')}
            onClick={async () => {
              await activateProcessInstance(instanceId);
              message.success('已激活');
              await refetch();
            }}
          >
            激活
          </Button>
          <Button
            danger
            disabled={instanceActionDisabled(instance?.status, 'terminate')}
            onClick={() => {
              modal.confirm({
                title: '终止实例',
                content: '确认终止该流程实例？',
                okText: '终止',
                cancelText: '取消',
                onOk: async () => {
                  await terminateProcessInstance(instanceId, 'operator terminated');
                  message.success('已终止');
                  await refetch();
                },
              });
            }}
          >
            终止
          </Button>
        </Space>
      }
    >
      {contextHolder}
      <ProCard loading={isLoading} style={{ marginBottom: 16 }}>
        <ProDescriptions
          column={{ xs: 1, sm: 1, md: 2 }}
          dataSource={instance}
          columns={[
            { title: '实例编号', dataIndex: 'instanceId', copyable: true },
            {
              title: '流程定义',
              dataIndex: 'processDefinitionId',
              renderText: processDefinitionLabel,
            },
            { title: '业务编号', dataIndex: 'businessKey', copyable: true },
            { title: '发起人', dataIndex: 'startUserId' },
            { title: '开始时间', dataIndex: 'startTime', renderText: formatDateTime },
            { title: '结束时间', dataIndex: 'endTime', renderText: formatDateTime },
            { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} /> },
          ]}
        />
      </ProCard>

      <Flex vertical gap={16}>
        {isPurchaseApproval ? (
          <ProCard title="审批进度">
            <Flex vertical gap={16}>
              {parallelTaskCount > 1 ? (
                <Alert
                  showIcon
                  type="info"
                  title={`当前有 ${parallelTaskCount} 个并行审批待处理`}
                  description="部门审批和财务审批可以分别处理，全部完成后流程继续流转。"
                />
              ) : null}
              <Steps
                responsive
                current={purchaseCurrentStep(
                  currentTasks,
                  timeline,
                  instance?.status,
                )}
                items={purchaseApprovalSteps.map((step) => ({
                  title: step.title,
                  status: purchaseStepStatus(step.key, currentTasks, timeline),
                  content: purchaseStepDescription(
                    step.key,
                    currentTasks,
                    timeline,
                  ),
                }))}
              />
              <Flex gap={16} wrap>
                <Badge
                  status={parallelTaskCount ? 'processing' : 'success'}
                  text={purchaseProgressBadgeText(instance?.status, parallelTaskCount)}
                />
                <Typography.Text type="secondary">
                  业务编号：{instance?.businessKey || '-'}
                </Typography.Text>
              </Flex>
            </Flex>
          </ProCard>
        ) : null}
        {isPurchaseApproval ? (
          <ProCard
            title={
              <Flex align="center" gap={8}>
                <span>审批意见</span>
                <Badge count={purchaseApprovalRecords.length} showZero />
              </Flex>
            }
          >
            <ProTable<PurchaseApprovalRecord>
              rowKey="key"
              columns={purchaseApprovalColumns}
              dataSource={purchaseApprovalRecords}
              search={false}
              pagination={false}
              options={false}
              locale={{
                emptyText: (
                  <Empty
                    description="暂无审批意见"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Space>
                      <Button type="primary" onClick={() => history.push('/tasks')}>
                        去任务中心处理
                      </Button>
                    </Space>
                  </Empty>
                ),
              }}
              scroll={{ x: 900 }}
            />
          </ProCard>
        ) : null}
        <ProCard
          title={
            <Flex align="center" gap={8}>
              <span>表单快照</span>
              <Badge count={formSnapshots.length} showZero />
            </Flex>
          }
        >
          <ProTable<FormSnapshotItem>
            rowKey="id"
            columns={snapshotColumns}
            dataSource={formSnapshots}
            search={false}
            pagination={false}
            options={false}
            locale={{
              emptyText: (
                <Empty
                  description="暂无表单快照"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            scroll={{ x: 1000 }}
          />
        </ProCard>
        <ProCard
          title={
            <Flex align="center" gap={8}>
              <span>当前任务</span>
              <Badge count={currentTasks.length} showZero />
            </Flex>
          }
        >
          <ProTable<TaskItem>
            rowKey="taskId"
            columns={taskColumns}
            dataSource={currentTasks}
            search={false}
            pagination={false}
            options={false}
            locale={{
              emptyText: (
                <Empty
                  description="当前没有待处理任务"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Space>
                    <Button
                      onClick={() =>
                        history.push(
                          `/audit-logs?resourceId=${encodeURIComponent(instanceId)}`,
                        )
                      }
                    >
                      查看审计日志
                    </Button>
                  </Space>
                </Empty>
              ),
            }}
          />
        </ProCard>
        <ProCard title="执行轨迹">
          <ProTable<ProcessTraceNode>
            rowKey={(record) =>
              `${record.activityId}-${record.activityType}-${record.startTime || 'pending'}-${record.endTime || 'running'}-${record.status}`
            }
            columns={traceColumns}
            dataSource={timeline}
            search={false}
            pagination={false}
            options={false}
            scroll={{ x: 1100 }}
          />
        </ProCard>
        <ProCard title="审计记录">
          <ProTable<AuditLogItem>
            rowKey="id"
            columns={auditColumns}
            dataSource={instance?.auditLogs || []}
            search={false}
            pagination={false}
            options={false}
            locale={{
              emptyText: (
                <Empty
                  description="暂无内嵌审计记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Space>
                    <Button
                      type="primary"
                      onClick={() =>
                        history.push(
                          `/audit-logs?resourceId=${encodeURIComponent(instanceId)}`,
                        )
                      }
                    >
                      查看审计日志
                    </Button>
                  </Space>
                </Empty>
              ),
            }}
            scroll={{ x: 1100 }}
          />
        </ProCard>
      </Flex>
      <Drawer
        title="表单快照"
        size={720}
        open={Boolean(selectedSnapshot)}
        onClose={() => setSelectedSnapshot(undefined)}
      >
        {selectedSnapshot ? (
          <StructuredDetailTable
            value={maskSecret(snapshotData(selectedSnapshot))}
            emptyText="暂无快照数据"
          />
        ) : (
          <Empty description="暂无快照数据" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default ProcessInstanceDetail;
