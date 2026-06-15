import {
  ModalForm,
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation, useParams } from '@umijs/max';
import { Alert, App, Badge, Button, Empty, Flex, Space, Tag, Typography } from 'antd';
import React from 'react';
import BusinessDataDescriptions from '@/components/BusinessDataDescriptions';
import { CopyableText } from '@/components/CopyableText';
import KoravoDrawer from '@/components/KoravoDrawer';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import ProcessContextSummary from '@/components/ProcessContextSummary';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import {
  type AuditLogItem,
  activateProcessInstance,
  type FormSnapshotItem,
  getOpsInstance,
  getOpsProcessTrace,
  getProcessInstance,
  getProcessTrace,
  listAuditLogs,
  listFormSnapshots,
  suspendProcessInstance,
  type TaskItem,
  terminateProcessInstance,
} from '@/services/koravo/api';
import { organizationMemberName } from '@/services/koravo/organization';
import { getSessionContext } from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  businessKeyLabel,
  formSchemaOptionLabel,
  processDefinitionLabel,
  processStatusLabel,
  shortTraceLabel,
  taskDefinitionLabel,
  taskNameLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';
import {
  type ProcessTraceNodeRow,
  withProcessTraceRowKeys,
} from '@/utils/processTraceRows';
import {
  isStartSuccessRedirect,
  startSuccessDescription,
} from '@/utils/processStartNotice';

function snapshotData(record: FormSnapshotItem) {
  return parseJsonSafe(record.dataJson, {}) as Record<string, unknown>;
}

function snapshotTaskLabel(record: FormSnapshotItem) {
  const data = snapshotData(record);
  const taskDefinitionKey = String(data.taskDefinitionKey || '');
  if (taskDefinitionKey) return taskDefinitionLabel(taskDefinitionKey);
  return record.taskId ? '任务表单' : '发起表单';
}

function snapshotFormLabel(record: FormSnapshotItem) {
  if (record.formName) {
    return formSchemaOptionLabel({
      formKey: record.formKey,
      formName: record.formName,
      version: record.formSchemaVersion,
    });
  }
  return `表单 v${record.formSchemaVersion || 1}`;
}

function snapshotSummary(record: FormSnapshotItem) {
  const data = snapshotData(record);
  const approved = data.approved;
  const opinion = [data.opinion, data.reviewComment, data.approvalComment].find(
    (value) => typeof value === 'string' && value.trim(),
  );

  if (approved === undefined && !opinion) {
    return Object.keys(data).length
      ? `${Object.keys(data).length} 个字段`
      : '暂无字段';
  }

  return (
    <Flex gap={8} align="center" wrap>
      {approved !== undefined ? (
        <Tag color={approved ? 'success' : 'error'}>
          {approved ? '同意' : '不同意'}
        </Tag>
      ) : null}
      {opinion ? (
        <Typography.Text type="secondary">{String(opinion)}</Typography.Text>
      ) : null}
    </Flex>
  );
}

function taskContextStatus(
  taskId: string | undefined,
  currentTask?: TaskItem,
  snapshot?: FormSnapshotItem,
) {
  if (!taskId) return undefined;
  if (currentTask) return `当前任务：${taskNameLabel(currentTask)}`;
  if (snapshot) return `已匹配${snapshotTaskLabel(snapshot)}`;
  return '未匹配快照，查看执行轨迹和审计记录';
}

function tasksOnSameNode(tasks: TaskItem[], activeTask: TaskItem) {
  const activeKey = activeTask.taskDefinitionKey || activeTask.taskId;
  const sameNodeTasks = tasks.filter(
    (task) => (task.taskDefinitionKey || task.taskId) === activeKey,
  );
  return sameNodeTasks.length ? sameNodeTasks : [activeTask];
}

function instanceActionDisabled(
  status: string | undefined,
  action: 'suspend' | 'activate' | 'terminate',
) {
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

const traceColumns: ProColumns<ProcessTraceNodeRow>[] = [
  {
    title: '节点',
    dataIndex: 'activityId',
    width: 180,
    renderText: (value, record) =>
      taskDefinitionLabel(value, { name: record.activityName }),
  },
  {
    title: '类型',
    dataIndex: 'activityType',
    width: 150,
    renderText: activityTypeLabel,
  },
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
    render: (_, record) => (
      <KoravoStatusTag
        status={record.status}
        text={processStatusLabel(record.status)}
      />
    ),
  },
];

const auditColumns: ProColumns<AuditLogItem>[] = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    width: 170,
    renderText: formatDateTime,
  },
  {
    title: '操作人',
    dataIndex: 'userId',
    width: 120,
    renderText: organizationMemberName,
  },
  { title: '操作类型', dataIndex: 'action', renderText: auditActionLabel },
  {
    title: '对象类型',
    dataIndex: 'resourceType',
    renderText: auditResourceLabel,
  },
  {
    title: '业务追踪号',
    dataIndex: 'requestId',
    width: 170,
    render: (_, record) => <CopyableText value={record.requestId} />,
  },
];

const ProcessInstanceDetail: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const instanceId = params.instanceId || '';
  const startedFromCreate = isStartSuccessRedirect(location.search);
  const focusedTaskId = React.useMemo(() => {
    const value = new URLSearchParams(location.search).get('taskId')?.trim();
    return value || undefined;
  }, [location.search]);
  const session = getSessionContext();
  const canOperateInstance =
    session.permissions?.canOperateSystem ?? session.role === 'operator';
  const canOpenTaskDetail =
    session.permissions?.canViewOwnWork ??
    ['applicant', 'manager', 'finance'].includes(session.role);
  const [selectedSnapshot, setSelectedSnapshot] =
    React.useState<FormSnapshotItem>();
  const {
    data: instance,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'process-instance',
      canOperateInstance ? 'ops' : 'workflow',
      instanceId,
    ],
    queryFn: () =>
      canOperateInstance
        ? getOpsInstance(instanceId)
        : getProcessInstance(instanceId),
    enabled: Boolean(instanceId),
  });
  const {
    data: trace,
    isLoading: traceLoading,
    refetch: refetchTrace,
  } = useQuery({
    queryKey: [
      'process-trace',
      canOperateInstance ? 'ops' : 'workflow',
      instanceId,
    ],
    queryFn: () =>
      canOperateInstance
        ? getOpsProcessTrace(instanceId)
        : getProcessTrace(instanceId),
    enabled: Boolean(instanceId),
  });
  const { data: formSnapshots = [] } = useQuery({
    queryKey: ['process-instance-form-snapshots', instanceId],
    queryFn: () => listFormSnapshots({ processInstanceId: instanceId }),
    enabled: Boolean(instanceId),
  });
  const primarySnapshot = React.useMemo(
    () =>
      formSnapshots.find((snapshot) => !snapshot.taskId) || formSnapshots[0],
    [formSnapshots],
  );
  const { data: auditLogs } = useQuery({
    queryKey: ['process-instance-audit-logs', instanceId],
    queryFn: () =>
      listAuditLogs({ resourceId: instanceId, page: 1, pageSize: 20 }),
    enabled: canOperateInstance && Boolean(instanceId),
  });
  const currentTasks = instance?.currentTasks || [];
  const focusedTask = React.useMemo(
    () => currentTasks.find((task) => task.taskId === focusedTaskId),
    [currentTasks, focusedTaskId],
  );
  const focusedSnapshot = React.useMemo(
    () => formSnapshots.find((snapshot) => snapshot.taskId === focusedTaskId),
    [focusedTaskId, formSnapshots],
  );
  const focusedTaskStatus = taskContextStatus(
    focusedTaskId,
    focusedTask,
    focusedSnapshot,
  );
  const timeline = trace?.timeline || [];
  const traceRows = React.useMemo(() => {
    const visibleTimeline = timeline.filter(
      (node) => node.activityType !== 'sequenceFlow',
    );
    return withProcessTraceRowKeys(
      visibleTimeline.length ? visibleTimeline : timeline,
    );
  }, [timeline]);
  const instanceAuditLogs = auditLogs?.items || instance?.auditLogs || [];
  const openTaskAsAssignee = React.useCallback((task: TaskItem) => {
    history.push(`/tasks/${task.taskId}`);
  }, []);
  const currentTaskColumns = React.useMemo<ProColumns<TaskItem>[]>(
    () => [
      {
        title: '任务名称',
        dataIndex: 'name',
        render: (_, record) => (
          <Space wrap size={4}>
            <span>{taskNameLabel(record)}</span>
            {record.taskId === focusedTaskId ? (
              <Tag color="processing">关联任务</Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: '流程位置',
        dataIndex: 'taskDefinitionKey',
        width: 300,
        render: (_, record) => (
          <ProcessContextSummary
            tasks={tasksOnSameNode(currentTasks, record)}
            activeTask={record}
            instanceStatus={instance?.status}
          />
        ),
      },
      {
        title: '当前处理人',
        dataIndex: 'assignee',
        width: 120,
        renderText: organizationMemberName,
      },
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
        render: (_, record) => {
          const canHandleCurrentTask =
            canOpenTaskDetail && record.assignee === session.userId;
          return canHandleCurrentTask
            ? [
                <Button
                  key="complete"
                  type="link"
                  onClick={() => openTaskAsAssignee(record)}
                >
                  处理
                </Button>,
              ]
            : [];
        },
      },
    ],
    [
      canOpenTaskDetail,
      currentTasks,
      focusedTaskId,
      instance?.status,
      openTaskAsAssignee,
      session.userId,
    ],
  );
  const snapshotColumns: ProColumns<FormSnapshotItem>[] = [
    {
      title: '表单',
      dataIndex: 'formSchemaId',
      width: 220,
      render: (_, record) => snapshotFormLabel(record),
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
      render: (_, record) => (
        <Space wrap size={4}>
          <span>{snapshotTaskLabel(record)}</span>
          {record.taskId && record.taskId === focusedTaskId ? (
            <Tag color="processing">关联任务</Tag>
          ) : null}
        </Space>
      ),
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
      extra={
        <Space wrap>
          <Button onClick={() => refetch()}>刷新</Button>
          {canOperateInstance ? (
            <Button
              onClick={() =>
                history.push(
                  `/audit-logs?resourceId=${encodeURIComponent(instanceId)}`,
                )
              }
            >
              审计日志
            </Button>
          ) : null}
          {canOperateInstance ? (
            <>
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
            </>
          ) : null}
        </Space>
      }
    >
      {startedFromCreate ? (
        <Alert
          showIcon
          type="success"
          title="已发起"
          description={startSuccessDescription(currentTasks)}
          action={
            <Button size="small" onClick={() => history.push('/started-instances')}>
              我的申请
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {focusedTaskId ? (
        <Alert
          showIcon
          type="info"
          title={`关联任务：${shortTraceLabel(focusedTaskId)}`}
          description={focusedTaskStatus}
          action={
            canOperateInstance ? (
              <Button
                size="small"
                onClick={() =>
                  history.push(
                    `/audit-logs?resourceId=${encodeURIComponent(focusedTaskId)}`,
                  )
                }
              >
                任务审计
              </Button>
            ) : null
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProCard loading={isLoading} style={{ marginBottom: 16 }}>
        <ProDescriptions
          column={{ xs: 1, sm: 1, md: 2 }}
          dataSource={instance}
          columns={[
            {
              title: '业务对象',
              dataIndex: 'businessKey',
              render: (_, record) => (
                <CopyableText
                  value={record.businessKey || record.instanceId}
                  displayValue={
                    record.businessKey
                      ? businessKeyLabel(record.businessKey)
                      : shortTraceLabel(record.instanceId)
                  }
                />
              ),
            },
            {
              title: '流程',
              dataIndex: 'processDefinitionId',
              renderText: processDefinitionLabel,
            },
            {
              title: '流程追踪号',
              dataIndex: 'instanceId',
              render: (_, record) => (
                <CopyableText
                  value={record.instanceId}
                  displayValue={shortTraceLabel(record.instanceId)}
                />
              ),
            },
            {
              title: '发起人',
              dataIndex: 'startUserId',
              renderText: organizationMemberName,
            },
            {
              title: '开始时间',
              dataIndex: 'startTime',
              renderText: formatDateTime,
            },
            {
              title: '结束时间',
              dataIndex: 'endTime',
              renderText: formatDateTime,
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_, record) => <KoravoStatusTag status={record.status} />,
            },
          ]}
        />
      </ProCard>

      <Flex vertical gap={16}>
        <ProcessProgressCard
          trace={trace}
          currentTasks={currentTasks}
          currentUserId={session.userId}
          loading={traceLoading}
        />
        <ProCard title="业务数据">
          {primarySnapshot ? (
            <BusinessDataDescriptions
              schemaJson={primarySnapshot.schemaJson}
              uiSchemaJson={primarySnapshot.uiSchemaJson}
              values={
                maskSecret(snapshotData(primarySnapshot)) as Record<
                  string,
                  unknown
                >
              }
              emptyText="暂无业务数据"
            />
          ) : (
            <Empty
              description="暂无业务数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </ProCard>
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
                  {canOperateInstance ? (
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
                  ) : null}
                </Empty>
              ),
            }}
          />
        </ProCard>
        <ProCard title="执行轨迹">
          <ProTable<ProcessTraceNodeRow>
            rowKey="rowKey"
            columns={traceColumns}
            dataSource={traceRows}
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
                  description="暂无审计记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  {canOperateInstance ? (
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
                  ) : null}
                </Empty>
              ),
            }}
            scroll={{ x: 1100 }}
          />
        </ProCard>
      </Flex>
      <KoravoDrawer
        title="表单快照"
        size={720}
        open={Boolean(selectedSnapshot)}
        onClose={() => setSelectedSnapshot(undefined)}
      >
        {selectedSnapshot ? (
          <BusinessDataDescriptions
            schemaJson={selectedSnapshot.schemaJson}
            uiSchemaJson={selectedSnapshot.uiSchemaJson}
            values={
              maskSecret(snapshotData(selectedSnapshot)) as Record<
                string,
                unknown
              >
            }
            emptyText="暂无快照数据"
          />
        ) : (
          <Empty description="暂无快照数据" />
        )}
      </KoravoDrawer>
    </PageContainer>
  );
};

export default ProcessInstanceDetail;
