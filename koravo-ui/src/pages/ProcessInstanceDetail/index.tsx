import {
  ModalForm,
  PageContainer,
  ProCard,
  ProDescriptions,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useModel, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { App, Badge, Button, Drawer, Empty, Flex, Space, Tag, Typography } from 'antd';
import React from 'react';
import BusinessDataDescriptions from '@/components/BusinessDataDescriptions';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import {
  activateProcessInstance,
  getOpsInstance,
  getProcessTrace,
  listAuditLogs,
  listFormSnapshots,
  suspendProcessInstance,
  terminateProcessInstance,
  type AuditLogItem,
  type FormSnapshotItem,
  type ProcessTraceNode,
  type TaskItem,
} from '@/services/koravo/api';
import {
  getSessionContext,
  roleForUserId,
  setSessionContext,
} from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  processDefinitionLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

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

interface InstanceActionForm {
  reason?: string;
}

interface InstanceActionButtonProps {
  action: 'suspend' | 'activate' | 'terminate';
  disabled: boolean;
  instanceId: string;
  refetch: () => Promise<unknown>;
  refetchTrace: () => Promise<unknown>;
}

const instanceActionCopy = {
  suspend: {
    title: '挂起实例',
    button: '挂起',
    reasonLabel: '挂起原因',
    placeholder: '说明需要暂停该流程的业务原因',
    success: '已挂起',
  },
  activate: {
    title: '激活实例',
    button: '激活',
    reasonLabel: '激活原因',
    placeholder: '说明恢复处理该流程的原因',
    success: '已激活',
  },
  terminate: {
    title: '终止实例',
    button: '终止',
    reasonLabel: '终止原因',
    placeholder: '说明终止该流程的依据和影响范围',
    success: '已终止',
  },
};

const InstanceActionButton: React.FC<InstanceActionButtonProps> = ({
  action,
  disabled,
  instanceId,
  refetch,
  refetchTrace,
}) => {
  const { message } = App.useApp();
  const copy = instanceActionCopy[action];
  const danger = action === 'terminate';

  return (
    <ModalForm<InstanceActionForm>
      title={copy.title}
      trigger={
        <Button danger={danger} disabled={disabled}>
          {copy.button}
        </Button>
      }
      modalProps={{ destroyOnHidden: true }}
      submitter={{
        searchConfig: {
          submitText: copy.button,
          resetText: '取消',
        },
      }}
      onFinish={async (values) => {
        const reason = values.reason?.trim();
        if (action === 'suspend') {
          await suspendProcessInstance(instanceId, reason);
        } else if (action === 'activate') {
          await activateProcessInstance(instanceId, reason);
        } else {
          await terminateProcessInstance(instanceId, reason || '');
        }
        message.success(copy.success);
        await Promise.all([refetch(), refetchTrace()]);
        return true;
      }}
    >
      <ProFormTextArea
        name="reason"
        label={copy.reasonLabel}
        placeholder={copy.placeholder}
        fieldProps={{ rows: 4, maxLength: 200, showCount: true }}
        rules={[
          { required: true, message: `请输入${copy.reasonLabel}` },
          { min: 4, message: `${copy.reasonLabel}至少 4 个字` },
        ]}
      />
    </ModalForm>
  );
};

function activityTypeLabel(activityType?: string) {
  const mapping: Record<string, string> = {
    startEvent: '开始',
    endEvent: '结束',
    userTask: '人工任务',
    serviceTask: '系统任务',
    exclusiveGateway: '条件分支',
    parallelGateway: '并行分支',
    inclusiveGateway: '包容分支',
  };
  return mapping[activityType || ''] || activityType || '-';
}

const traceColumns: ProColumns<ProcessTraceNode>[] = [
  { title: '节点编号', dataIndex: 'activityId', width: 180 },
  { title: '节点名称', dataIndex: 'activityName' },
  { title: '类型', dataIndex: 'activityType', width: 150, renderText: activityTypeLabel },
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

const ProcessInstanceDetail: React.FC = () => {
  const params = useParams();
  const instanceId = params.instanceId || '';
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<FormSnapshotItem>();
  const { message } = App.useApp();
  const { setInitialState } = useModel('@@initialState');
  const {
    data: instance,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['process-instance', instanceId],
    queryFn: () => getOpsInstance(instanceId),
    enabled: Boolean(instanceId),
  });
  const { data: trace, isLoading: traceLoading, refetch: refetchTrace } = useQuery({
    queryKey: ['process-trace', instanceId],
    queryFn: () => getProcessTrace(instanceId),
    enabled: Boolean(instanceId),
  });
  const { data: formSnapshots = [] } = useQuery({
    queryKey: ['process-instance-form-snapshots', instanceId],
    queryFn: () => listFormSnapshots({ processInstanceId: instanceId }),
    enabled: Boolean(instanceId),
  });
  const { data: auditLogs } = useQuery({
    queryKey: ['process-instance-audit-logs', instanceId],
    queryFn: () => listAuditLogs({ resourceId: instanceId, page: 1, pageSize: 20 }),
    enabled: Boolean(instanceId),
  });
  const currentTasks = instance?.currentTasks || [];
  const timeline = trace?.timeline || [];
  const visibleTimeline = timeline.filter((node) => node.activityType !== 'sequenceFlow');
  const instanceAuditLogs = auditLogs?.items || instance?.auditLogs || [];
  const openTaskAsAssignee = React.useCallback(
    (task: TaskItem) => {
      const userId = task.assignee?.trim();
      if (userId) {
        const next = { ...getSessionContext(), userId, role: roleForUserId(userId) };
        setSessionContext(next);
        setInitialState((state) => ({
          ...state,
          session: next,
          currentUser: {
            name: next.userId,
            userid: next.userId,
            access: next.role,
            tenantId: next.tenantId,
          },
        }));
        message.success(`已进入 ${userId} 的办理上下文`);
      }
      history.push(`/tasks/${task.taskId}`);
    },
    [message, setInitialState],
  );
  const currentTaskColumns = React.useMemo<ProColumns<TaskItem>[]>(
    () => [
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
        width: 144,
        render: (_, record) => [
          <Button
            key="complete"
            type="link"
            disabled={!record.assignee}
            onClick={() => openTaskAsAssignee(record)}
          >
            处理
          </Button>,
          <Button
            key="view"
            type="link"
            onClick={() => history.push(`/tasks/${record.taskId}`)}
          >
            查看
          </Button>,
        ],
      },
    ],
    [openTaskAsAssignee],
  );
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
      key: 'summary',
      search: false,
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
          <InstanceActionButton
            action="suspend"
            disabled={instanceActionDisabled(instance?.status, 'suspend')}
            instanceId={instanceId}
            refetch={refetch}
            refetchTrace={refetchTrace}
          />
          <InstanceActionButton
            action="activate"
            disabled={instanceActionDisabled(instance?.status, 'activate')}
            instanceId={instanceId}
            refetch={refetch}
            refetchTrace={refetchTrace}
          />
          <InstanceActionButton
            action="terminate"
            disabled={instanceActionDisabled(instance?.status, 'terminate')}
            instanceId={instanceId}
            refetch={refetch}
            refetchTrace={refetchTrace}
          />
        </Space>
      }
    >
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
        <ProcessProgressCard
          trace={trace}
          currentTasks={currentTasks}
          loading={traceLoading}
        />
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
            columns={currentTaskColumns}
            dataSource={currentTasks}
            search={false}
            pagination={false}
            options={false}
            locale={{
              emptyText: (
                <Empty
                  description={
                    instance?.status === 'COMPLETED'
                      ? '流程已完成，暂无待处理任务'
                      : '当前没有待处理任务'
                  }
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
            dataSource={visibleTimeline.length ? visibleTimeline : timeline}
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
            dataSource={instanceAuditLogs}
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
          <BusinessDataDescriptions
            schemaJson={selectedSnapshot.schemaJson}
            uiSchemaJson={selectedSnapshot.uiSchemaJson}
            values={maskSecret(snapshotData(selectedSnapshot)) as Record<string, unknown>}
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
