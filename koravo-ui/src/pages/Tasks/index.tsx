import { DeploymentUnitOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  ProCard,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import { App, Button, Empty, Space, Tabs, Tag } from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import KoravoDrawer from '@/components/KoravoDrawer';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import ProcessContextSummary from '@/components/ProcessContextSummary';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import {
  getProcessTrace,
  handleTaskAction,
  listCandidateTasks,
  listDoneTasks,
  listStartedInstances,
  listTasks,
  type OpsProcessInstance,
  type TaskItem,
  type TaskListParams,
} from '@/services/koravo/api';
import {
  isPlatformIdentitySynced,
  organizationGroupOptions,
  organizationMemberName,
  organizationRoleLabel,
  tenantDisplayName,
} from '@/services/koravo/organization';
import { getSessionContext } from '@/services/koravo/session';
import {
  businessKeyLabel,
  processDefinitionLabel,
  shortTraceLabel,
  taskDefinitionLabel,
  taskNameLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';
import { processInstanceDetailPath } from '@/utils/processStartNotice';
import {
  resolveTaskTab,
  type TaskTabKey,
  tabFromPath,
  taskTabMeta,
  taskTabRoutes,
  visibleTaskTabs,
} from './taskTabs';

type ProcessPreviewTarget = {
  instanceId: string;
  title: string;
  activeTask?: TaskItem;
  currentTasks?: TaskItem[];
};

function taskBusinessObject(
  task: Pick<TaskItem, 'businessKey' | 'processInstanceId'>,
) {
  return task.businessKey
    ? businessKeyLabel(task.businessKey)
    : shortTraceLabel(task.processInstanceId);
}

function instanceBusinessObject(
  instance: Pick<OpsProcessInstance, 'businessKey' | 'instanceId'>,
) {
  return instance.businessKey
    ? businessKeyLabel(instance.businessKey)
    : shortTraceLabel(instance.instanceId);
}

function buildTaskColumns(
  onPreview: (task: TaskItem) => void,
): ProColumns<TaskItem>[] {
  return [
    {
      title: '任务名称',
      dataIndex: 'name',
      width: 180,
      renderText: (_, record) => taskNameLabel(record),
    },
    {
      title: '业务对象',
      dataIndex: 'businessKey',
      width: 220,
      render: (_, record) => (
        <CopyableText
          value={record.businessKey || record.processInstanceId}
          displayValue={taskBusinessObject(record)}
        />
      ),
    },
    {
      title: '流程',
      dataIndex: 'processDefinitionId',
      width: 220,
      ellipsis: true,
      search: false,
      renderText: (value) => processDefinitionLabel(value),
    },
    {
      title: '流程位置',
      dataIndex: 'taskDefinitionKey',
      width: 260,
      search: false,
      render: (_, record) => (
        <ProcessContextSummary tasks={[record]} activeTask={record} />
      ),
    },
    {
      title: '处理人',
      dataIndex: 'assignee',
      width: 120,
      search: false,
      renderText: organizationMemberName,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 170,
      search: false,
      renderText: (value) => formatDateTime(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      search: false,
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 210,
      search: false,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => history.push(`/tasks/${record.taskId}`)}
          >
            {record.status === 'COMPLETED' ? '查看任务' : '处理'}
          </Button>
          <Button
            type="link"
            icon={<DeploymentUnitOutlined />}
            onClick={() => onPreview(record)}
          >
            流程
          </Button>
          <Button
            type="link"
            onClick={() =>
              history.push(
                processInstanceDetailPath(record.processInstanceId, {
                  taskId: record.taskId,
                }),
              )
            }
          >
            查看实例
          </Button>
        </Space>
      ),
    },
  ];
}

function buildInstanceColumns(
  onPreview: (instance: OpsProcessInstance) => void,
): ProColumns<OpsProcessInstance>[] {
  return [
    {
      title: '业务对象',
      dataIndex: 'businessKey',
      width: 220,
      render: (_, record) => (
        <CopyableText
          value={record.businessKey || record.instanceId}
          displayValue={instanceBusinessObject(record)}
        />
      ),
    },
    {
      title: '流程',
      dataIndex: 'processDefinitionId',
      width: 220,
      ellipsis: true,
      renderText: (value) => processDefinitionLabel(value),
    },
    {
      title: '发起人',
      dataIndex: 'startUserId',
      width: 120,
      search: false,
      renderText: organizationMemberName,
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 170,
      search: false,
      renderText: (value) => formatDateTime(value),
    },
    {
      title: '流程位置',
      dataIndex: 'currentTasks',
      width: 260,
      search: false,
      render: (_, record) => (
        <ProcessContextSummary
          tasks={record.currentTasks}
          instanceStatus={record.status}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      search: false,
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      search: false,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            icon={<DeploymentUnitOutlined />}
            onClick={() => onPreview(record)}
          >
            流程
          </Button>
          <Button
            type="link"
            onClick={() =>
              history.push(`/process-instances/${record.instanceId}`)
            }
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];
}

function taskParams(params: Record<string, unknown>): TaskListParams {
  const keyword = String(
    params.keyword || params.name || params.businessKey || '',
  ).trim();
  return {
    page: Number(params.current || 1),
    pageSize: Number(params.pageSize || 10),
    candidateGroup: String(params.candidateGroup || '').trim() || undefined,
    keyword: keyword || undefined,
  };
}

function taskEmpty(description: string, action: React.ReactNode) {
  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
      {action}
    </Empty>
  );
}

const Tasks: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const todoRef = React.useRef<ActionType>(null);
  const candidateRef = React.useRef<ActionType>(null);
  const doneRef = React.useRef<ActionType>(null);
  const startedRef = React.useRef<ActionType>(null);
  const session = getSessionContext();
  const identitySynced = isPlatformIdentitySynced(session.userId);
  const [previewTarget, setPreviewTarget] =
    React.useState<ProcessPreviewTarget>();
  const requestedTab = tabFromPath(location.pathname);
  const candidateGroupOptions = React.useMemo(
    () => organizationGroupOptions(),
    [],
  );
  const previewTrace = useQuery({
    queryKey: ['task-list-process-trace', previewTarget?.instanceId],
    queryFn: () => getProcessTrace(previewTarget?.instanceId || ''),
    enabled: Boolean(previewTarget?.instanceId),
  });
  const canClaimTask =
    session.permissions?.canClaimTask ??
    (session.role === 'manager' || session.role === 'finance');
  const canHandleTask =
    session.permissions?.canHandleTask ??
    (session.role === 'manager' || session.role === 'finance');
  const canStartProcess =
    session.permissions?.canStartProcess ?? session.role === 'applicant';
  const visibleTabs = visibleTaskTabs({
    canHandleTask,
    canClaimTask,
    canStartProcess,
  });
  const activeTab = resolveTaskTab(requestedTab, visibleTabs);
  const pageMeta = taskTabMeta[activeTab];

  const reloadTables = React.useCallback(() => {
    todoRef.current?.reload();
    candidateRef.current?.reload();
    doneRef.current?.reload();
    startedRef.current?.reload();
  }, []);

  const openTaskPreview = React.useCallback((task: TaskItem) => {
    setPreviewTarget({
      instanceId: task.processInstanceId,
      title: `${taskDefinitionLabel(task.taskDefinitionKey)} · ${
        task.businessKey
          ? businessKeyLabel(task.businessKey)
          : task.processInstanceId
      }`,
      activeTask: task,
      currentTasks: [task],
    });
  }, []);

  const openInstancePreview = React.useCallback(
    (instance: OpsProcessInstance) => {
      setPreviewTarget({
        instanceId: instance.instanceId,
        title: `${processDefinitionLabel(instance.processDefinitionId)} · ${
          instance.businessKey
            ? businessKeyLabel(instance.businessKey)
            : instance.instanceId
        }`,
        currentTasks: instance.currentTasks,
      });
    },
    [],
  );

  const taskColumns = React.useMemo(
    () => buildTaskColumns(openTaskPreview),
    [openTaskPreview],
  );

  const claimTask = React.useCallback(
    async (task: TaskItem) => {
      await handleTaskAction(task.taskId, {
        action: 'CLAIM',
        comment: '从待认领列表认领',
      });
      message.success('已认领任务');
      candidateRef.current?.reload();
      todoRef.current?.reload();
      history.push(`/tasks/${task.taskId}`);
    },
    [message],
  );

  const candidateColumns = React.useMemo<ProColumns<TaskItem>[]>(() => {
    const columns = taskColumns.map((column) => {
      if (column.valueType !== 'option') return column;
      return {
        ...column,
        width: 180,
        render: (_: unknown, record: TaskItem) => (
          <Space size={4}>
            <Button type="link" onClick={() => claimTask(record)}>
              认领
            </Button>
            <Button
              type="link"
              icon={<DeploymentUnitOutlined />}
              onClick={() => openTaskPreview(record)}
            >
              流程
            </Button>
            <Button
              type="link"
              onClick={() =>
                history.push(
                  processInstanceDetailPath(record.processInstanceId, {
                    taskId: record.taskId,
                  }),
                )
              }
            >
              查看实例
            </Button>
          </Space>
        ),
      };
    });
    return [
      {
        title: '流程候选组',
        dataIndex: 'candidateGroup',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          allowClear: true,
          showSearch: true,
          placeholder: '默认按当前岗位职责',
          optionFilterProp: 'label',
          options: candidateGroupOptions,
        },
      },
      ...columns,
    ];
  }, [candidateGroupOptions, claimTask, openTaskPreview, taskColumns]);

  const instanceColumns = React.useMemo(
    () => buildInstanceColumns(openInstancePreview),
    [openInstancePreview],
  );

  const switchTab = React.useCallback(
    (key: string) => {
      const path = taskTabRoutes[key as TaskTabKey] || taskTabRoutes.todo;
      if (path !== location.pathname) {
        history.push(path);
      }
    },
    [location.pathname],
  );

  React.useEffect(() => {
    if (!visibleTabs.length) return;
    const path = taskTabRoutes[activeTab];
    if (path !== location.pathname) {
      history.replace(path);
    }
  }, [activeTab, location.pathname, visibleTabs.length]);

  if (!visibleTabs.length) {
    return (
      <PageContainer title="工作台">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无可用入口"
        />
      </PageContainer>
    );
  }

  const tabItems: NonNullable<React.ComponentProps<typeof Tabs>['items']> = [
    ...(visibleTabs.includes('todo')
      ? [
          {
            key: 'todo',
            label: '待办',
            children: (
              <ProTable<TaskItem>
                actionRef={todoRef}
                rowKey="taskId"
                columns={taskColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1040 }}
                locale={{
                  emptyText: taskEmpty(
                    '暂无你的待办任务',
                    <Space wrap>
                      {canStartProcess ? (
                        <Button
                          type="primary"
                          onClick={() => history.push('/process-start')}
                        >
                          发起流程
                        </Button>
                      ) : null}
                      {visibleTabs.includes('started') ? (
                        <Button onClick={() => switchTab('started')}>
                          查看我的申请
                        </Button>
                      ) : null}
                    </Space>,
                  ),
                }}
                request={async (params) => {
                  const result = await listTasks(taskParams(params));
                  return {
                    data: result.items,
                    total: result.total,
                    success: true,
                  };
                }}
              />
            ),
          },
        ]
      : []),
    ...(visibleTabs.includes('candidate')
      ? [
          {
            key: 'candidate',
            label: '待认领',
            children: (
              <ProTable<TaskItem>
                actionRef={candidateRef}
                rowKey="taskId"
                columns={candidateColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1040 }}
                locale={{
                  emptyText: taskEmpty(
                    '暂无可认领任务',
                    <Space wrap>
                      <Button onClick={() => switchTab('todo')}>
                        查看待办
                      </Button>
                      <Button onClick={() => switchTab('done')}>
                        查看已办
                      </Button>
                    </Space>,
                  ),
                }}
                request={async (params) => {
                  const result = await listCandidateTasks(taskParams(params));
                  return {
                    data: result.items,
                    total: result.total,
                    success: true,
                  };
                }}
              />
            ),
          },
        ]
      : []),
    ...(visibleTabs.includes('done')
      ? [
          {
            key: 'done',
            label: '已办',
            children: (
              <ProTable<TaskItem>
                actionRef={doneRef}
                rowKey="taskId"
                columns={taskColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1040 }}
                locale={{
                  emptyText: taskEmpty(
                    '暂无你的已办记录',
                    <Button onClick={() => switchTab('todo')}>查看待办</Button>,
                  ),
                }}
                request={async (params) => {
                  const result = await listDoneTasks(taskParams(params));
                  return {
                    data: result.items,
                    total: result.total,
                    success: true,
                  };
                }}
              />
            ),
          },
        ]
      : []),
    ...(visibleTabs.includes('started')
      ? [
          {
            key: 'started',
            label: '我的申请',
            children: (
              <ProTable<OpsProcessInstance>
                actionRef={startedRef}
                rowKey="instanceId"
                columns={instanceColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1000 }}
                locale={{
                  emptyText: taskEmpty(
                    '暂无申请记录',
                    canStartProcess ? (
                      <Button
                        type="primary"
                        onClick={() => history.push('/process-start')}
                      >
                        发起流程
                      </Button>
                    ) : null,
                  ),
                }}
                request={async (params) => {
                  const result = await listStartedInstances(taskParams(params));
                  return {
                    data: result.items,
                    total: result.total,
                    success: true,
                  };
                }}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer title={pageMeta.title}>
      <ProCard
        size="small"
        title="工作身份"
        extra={
          <Button size="small" onClick={reloadTables}>
            刷新
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Space wrap size={8}>
          <Tag color="processing">{organizationMemberName(session.userId)}</Tag>
          <Tag color={identitySynced ? 'blue' : 'warning'}>
            {identitySynced
              ? organizationRoleLabel(session.role)
              : '身份未同步'}
          </Tag>
          <Tag>{tenantDisplayName(session.tenantId)}</Tag>
        </Space>
      </ProCard>
      <Tabs activeKey={activeTab} onChange={switchTab} items={tabItems} />
      <KoravoDrawer
        title={previewTarget?.title || '流程预览'}
        size={980}
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(undefined)}
      >
        <ProcessProgressCard
          loading={previewTrace.isFetching}
          trace={previewTrace.data}
          activeTask={previewTarget?.activeTask}
          currentUserId={session.userId}
          currentTasks={
            previewTrace.data?.currentTasks?.length
              ? previewTrace.data.currentTasks
              : previewTarget?.currentTasks
          }
        />
      </KoravoDrawer>
    </PageContainer>
  );
};

export default Tasks;
