import { DeploymentUnitOutlined } from '@ant-design/icons';
import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Alert, App, Badge, Button, Drawer, Empty, Flex, Space, Tabs, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
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
  getSessionContext,
  type SessionContext,
} from '@/services/koravo/session';
import {
  organizationMemberName,
  organizationRoleLabel,
  tenantDisplayName,
} from '@/services/koravo/organization';
import {
  businessKeyLabel,
  processDefinitionLabel,
  taskDefinitionLabel,
  taskNameLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

type TaskTabKey = 'todo' | 'candidate' | 'done' | 'started';

type ProcessPreviewTarget = {
  instanceId: string;
  title: string;
  activeTask?: TaskItem;
  currentTasks?: TaskItem[];
};

const taskTabRoutes: Record<TaskTabKey, string> = {
  todo: '/tasks',
  candidate: '/task-claims',
  done: '/done-tasks',
  started: '/started-instances',
};

const taskTabMeta: Record<TaskTabKey, { title: string; content: string }> = {
  todo: {
    title: '我的待办',
    content: '处理已经分配给当前办理人的审批任务。',
  },
  candidate: {
    title: '待认领',
    content: '认领当前办理人或职责可处理的候选任务。',
  },
  done: {
    title: '已办任务',
    content: '查看当前办理人已处理过的任务和办理记录。',
  },
  started: {
    title: '我发起的',
    content: '查看当前办理人发起的流程实例和处理进度。',
  },
};

function tabFromPath(pathname: string): TaskTabKey {
  if (pathname === taskTabRoutes.candidate) return 'candidate';
  if (pathname === taskTabRoutes.done) return 'done';
  if (pathname === taskTabRoutes.started) return 'started';
  return 'todo';
}

function taskNodeBadge(taskDefinitionKey?: string) {
  if (!taskDefinitionKey) return '-';
  return <Badge status="processing" text={taskDefinitionLabel(taskDefinitionKey)} />;
}

function buildTaskColumns(
  onPreview: (task: TaskItem) => void,
): ProColumns<TaskItem>[] {
  return [
  { title: '任务名称', dataIndex: 'name', renderText: (_, record) => taskNameLabel(record) },
  {
    title: '业务编号',
    dataIndex: 'businessKey',
    width: 180,
    render: (_, record) => (
      <CopyableText
        value={record.businessKey}
        displayValue={businessKeyLabel(record.businessKey)}
      />
    ),
  },
  {
    title: '流程定义',
    dataIndex: 'processDefinitionId',
    ellipsis: true,
    renderText: (value) => processDefinitionLabel(value),
  },
  {
    title: '节点',
    dataIndex: 'taskDefinitionKey',
    width: 140,
    renderText: (value) => taskDefinitionLabel(value),
  },
  {
    title: '节点标签',
    dataIndex: 'taskDefinitionKey',
    width: 120,
    search: false,
    render: (_, record) => taskNodeBadge(record.taskDefinitionKey),
  },
  { title: '处理人', dataIndex: 'assignee', width: 120 },
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
    render: (_, record) => <KoravoStatusTag status={record.status} />,
  },
  {
    title: '操作',
    valueType: 'option',
    width: 210,
    render: (_, record) => (
      <Space size={4}>
        <Button type="link" onClick={() => history.push(`/tasks/${record.taskId}`)}>
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
            history.push(`/process-instances/${record.processInstanceId}`)
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
    title: '实例编号',
    dataIndex: 'instanceId',
    width: 220,
    render: (_, record) => <CopyableText value={record.instanceId} />,
  },
  {
    title: '流程定义',
    dataIndex: 'processDefinitionId',
    ellipsis: true,
    renderText: (value) => processDefinitionLabel(value),
  },
  {
    title: '业务编号',
    dataIndex: 'businessKey',
    width: 180,
    render: (_, record) => (
      <CopyableText
        value={record.businessKey}
        displayValue={businessKeyLabel(record.businessKey)}
      />
    ),
  },
  { title: '发起人', dataIndex: 'startUserId', width: 120 },
  {
    title: '开始时间',
    dataIndex: 'startTime',
    width: 170,
    search: false,
    renderText: (value) => formatDateTime(value),
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
          icon={<DeploymentUnitOutlined />}
          onClick={() => onPreview(record)}
        >
          流程
        </Button>
        <Button
          type="link"
          onClick={() => history.push(`/process-instances/${record.instanceId}`)}
        >
          查看
        </Button>
      </Space>
    ),
  },
  ];
}

function taskParams(params: Record<string, unknown>): TaskListParams {
  return {
    page: Number(params.current || 1),
    pageSize: Number(params.pageSize || 10),
    keyword: String(params.keyword || '').trim() || undefined,
  };
}

function taskEmpty(
  description: string,
  action: React.ReactNode,
) {
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
  const [session, setSession] = React.useState<SessionContext>(() => getSessionContext());
  const [previewTarget, setPreviewTarget] = React.useState<ProcessPreviewTarget>();
  const activeTab = tabFromPath(location.pathname);
  const pageMeta = taskTabMeta[activeTab];
  const previewTrace = useQuery({
    queryKey: ['task-list-process-trace', previewTarget?.instanceId],
    queryFn: () => getProcessTrace(previewTarget?.instanceId || ''),
    enabled: Boolean(previewTarget?.instanceId),
  });

  const reloadTables = React.useCallback(() => {
    setSession(getSessionContext());
    todoRef.current?.reload();
    candidateRef.current?.reload();
    doneRef.current?.reload();
    startedRef.current?.reload();
  }, []);

  const openTaskPreview = React.useCallback((task: TaskItem) => {
    setPreviewTarget({
      instanceId: task.processInstanceId,
      title: `${taskDefinitionLabel(task.taskDefinitionKey)} · ${
        task.businessKey ? businessKeyLabel(task.businessKey) : task.processInstanceId
      }`,
      activeTask: task,
      currentTasks: [task],
    });
  }, []);

  const openInstancePreview = React.useCallback((instance: OpsProcessInstance) => {
    setPreviewTarget({
      instanceId: instance.instanceId,
      title: `${processDefinitionLabel(instance.processDefinitionId)} · ${
        instance.businessKey ? businessKeyLabel(instance.businessKey) : instance.instanceId
      }`,
      currentTasks: instance.currentTasks,
    });
  }, []);

  const taskColumns = React.useMemo(() => buildTaskColumns(openTaskPreview), [openTaskPreview]);

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

  const candidateColumns = React.useMemo<ProColumns<TaskItem>[]>(
    () =>
      taskColumns.map((column) => {
        if (column.valueType !== 'option') return column;
        return {
          ...column,
          width: 180,
          render: (_, record) => (
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
                  history.push(`/process-instances/${record.processInstanceId}`)
                }
              >
                查看实例
              </Button>
            </Space>
          ),
        };
      }),
    [claimTask, openTaskPreview, taskColumns],
  );

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

  return (
    <PageContainer title={pageMeta.title} content={pageMeta.content}>
      <Alert
        showIcon
        type="info"
        title={
          <Space wrap size={8}>
            <span>办理人</span>
            <Tag color="processing">{organizationMemberName(session.userId)}</Tag>
            <span>职责</span>
            <Tag color="blue">{organizationRoleLabel(session.role)}</Tag>
            <span>组织</span>
            <Tag>{tenantDisplayName(session.tenantId)}</Tag>
          </Space>
        }
        description={
          <Flex vertical gap={8}>
            <span>
              待办按当前办理人和职责加载。需要调整成员、部门或职责时，请进入组织权限维护。
            </span>
            <Space wrap>
              <Button size="small" onClick={reloadTables}>
                刷新待办
              </Button>
              <Button size="small" onClick={() => history.push('/organization-permissions')}>
                组织权限
              </Button>
            </Space>
          </Flex>
        }
        style={{ marginBottom: 16 }}
      />
      <Tabs
        activeKey={activeTab}
        onChange={switchTab}
        items={[
          {
            key: 'todo',
            label: '待办',
            children: (
              <ProTable<TaskItem>
                actionRef={todoRef}
                rowKey="taskId"
                columns={taskColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1100 }}
                locale={{
                  emptyText: taskEmpty(
                    '当前处理人暂无待办任务',
                    <Space wrap>
                      <Button
                        type="primary"
                        onClick={() => history.push('/process-instances')}
                      >
                        发起流程
                      </Button>
                      <Button onClick={() => switchTab('started')}>
                        查看我发起的
                      </Button>
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
          {
            key: 'candidate',
            label: '待认领',
            children: (
              <ProTable<TaskItem>
                actionRef={candidateRef}
                rowKey="taskId"
                columns={candidateColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1100 }}
                locale={{
                  emptyText: taskEmpty(
                    '当前办理人暂无可认领任务',
                    <Space wrap>
                      <Button onClick={() => switchTab('todo')}>
                        查看待办
                      </Button>
                      <Button onClick={() => history.push('/process-instances')}>
                        查看流程实例
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
          {
            key: 'done',
            label: '已办',
            children: (
              <ProTable<TaskItem>
                actionRef={doneRef}
                rowKey="taskId"
                columns={taskColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1100 }}
                locale={{
                  emptyText: taskEmpty(
                    '当前处理人暂无已办记录',
                    <Button onClick={() => switchTab('todo')}>
                      查看待办
                    </Button>,
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
          {
            key: 'started',
            label: '我发起的',
            children: (
              <ProTable<OpsProcessInstance>
                actionRef={startedRef}
                rowKey="instanceId"
                columns={instanceColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1100 }}
                locale={{
                  emptyText: taskEmpty(
                    '当前办理人暂无发起记录',
                    <Button
                      type="primary"
                      onClick={() => history.push('/process-instances')}
                    >
                      发起流程
                    </Button>,
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
        ]}
      />
      <Drawer
        title={previewTarget?.title || '流程预览'}
        size="980px"
        open={Boolean(previewTarget)}
        destroyOnHidden
        onClose={() => setPreviewTarget(undefined)}
      >
        <ProcessProgressCard
          loading={previewTrace.isFetching}
          trace={previewTrace.data}
          activeTask={previewTarget?.activeTask}
          currentTasks={
            previewTrace.data?.currentTasks?.length
              ? previewTrace.data.currentTasks
              : previewTarget?.currentTasks
          }
        />
      </Drawer>
    </PageContainer>
  );
};

export default Tasks;
