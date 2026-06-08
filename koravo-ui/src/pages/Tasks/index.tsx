import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Alert, App, Button, Flex, Space, Tabs, Tag } from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  listDoneTasks,
  listStartedInstances,
  listTasks,
  type OpsProcessInstance,
  type TaskItem,
  type TaskListParams,
} from '@/services/koravo/api';
import {
  getSessionContext,
  setSessionContext,
  type SessionContext,
} from '@/services/koravo/session';
import { processDefinitionLabel, taskDefinitionLabel } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

const taskUserOptions = [
  { label: '管理员', value: 'admin' },
  { label: '部门审批', value: 'manager' },
  { label: '财务审批', value: 'finance' },
  { label: '申请人', value: 'applicant' },
];

const taskColumns: ProColumns<TaskItem>[] = [
  { title: '任务名称', dataIndex: 'name' },
  {
    title: '业务编号',
    dataIndex: 'businessKey',
    width: 180,
    render: (_, record) => <CopyableText value={record.businessKey} />,
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
    width: 96,
    render: (_, record) => (
      <Button type="link" onClick={() => history.push(`/tasks/${record.taskId}`)}>
        查看
      </Button>
    ),
  },
];

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
    renderText: (value) => processDefinitionLabel(value),
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

function taskParams(params: Record<string, unknown>): TaskListParams {
  return {
    page: Number(params.current || 1),
    pageSize: Number(params.pageSize || 10),
    keyword: String(params.keyword || '').trim() || undefined,
  };
}

const Tasks: React.FC = () => {
  const { message } = App.useApp();
  const todoRef = React.useRef<ActionType>(null);
  const doneRef = React.useRef<ActionType>(null);
  const startedRef = React.useRef<ActionType>(null);
  const [session, setSession] = React.useState<SessionContext>(() => getSessionContext());
  const { setInitialState } = useModel('@@initialState');

  const reloadTables = React.useCallback(() => {
    todoRef.current?.reload();
    doneRef.current?.reload();
    startedRef.current?.reload();
  }, []);

  const switchUser = React.useCallback(
    (userId: string) => {
      const next = { ...getSessionContext(), userId };
      setSessionContext(next);
      setSession(next);
      setInitialState((state) => ({
        ...state,
        session: next,
        currentUser: {
          name: next.userId,
          userid: next.userId,
          access: 'admin',
          tenantId: next.tenantId,
        },
      }));
      message.success(`已切换为 ${userId}`);
      reloadTables();
    },
    [message, reloadTables, setInitialState],
  );

  return (
    <PageContainer title="任务中心" content="处理待办，查看已完成任务和发起记录。">
      <Alert
        showIcon
        type="info"
        title={
          <Space wrap size={8}>
            <span>当前处理人</span>
            <Tag color="processing">{session.userId}</Tag>
            <span>租户</span>
            <Tag>{session.tenantId}</Tag>
          </Space>
        }
        description={
          <Flex vertical gap={8}>
            <span>
              采购申请会生成部门审批和财务审批两个待办。切换处理人后，任务列表会按当前请求上下文重新加载。
            </span>
            <Space wrap>
              {taskUserOptions.map((item) => (
                <Button
                  key={item.value}
                  size="small"
                  type={session.userId === item.value ? 'primary' : 'default'}
                  onClick={() => switchUser(item.value)}
                >
                  {item.label}
                </Button>
              ))}
              <Button size="small" onClick={() => history.push('/system-settings')}>
                更多设置
              </Button>
            </Space>
          </Flex>
        }
        style={{ marginBottom: 16 }}
      />
      <Tabs
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
            key: 'done',
            label: '已办',
            children: (
              <ProTable<TaskItem>
                actionRef={doneRef}
                rowKey="taskId"
                columns={taskColumns}
                search={{ labelWidth: 'auto' }}
                scroll={{ x: 1100 }}
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
    </PageContainer>
  );
};

export default Tasks;
