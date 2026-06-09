import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Badge, Button, Empty, Flex, Space, Tabs, Tag } from 'antd';
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
  type SessionContext,
} from '@/services/koravo/session';
import { processDefinitionLabel, taskDefinitionLabel } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

function taskNodeBadge(taskDefinitionKey?: string) {
  if (!taskDefinitionKey) return '-';
  return <Badge status="processing" text={taskDefinitionLabel(taskDefinitionKey)} />;
}

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
    width: 160,
    render: (_, record) => (
      <Space size={4}>
        <Button type="link" onClick={() => history.push(`/tasks/${record.taskId}`)}>
          {record.status === 'COMPLETED' ? '查看任务' : '处理'}
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
  const todoRef = React.useRef<ActionType>(null);
  const doneRef = React.useRef<ActionType>(null);
  const startedRef = React.useRef<ActionType>(null);
  const [session, setSession] = React.useState<SessionContext>(() => getSessionContext());
  const [activeTab, setActiveTab] = React.useState('todo');

  const reloadTables = React.useCallback(() => {
    setSession(getSessionContext());
    todoRef.current?.reload();
    doneRef.current?.reload();
    startedRef.current?.reload();
  }, []);

  return (
    <PageContainer title="我的待办" content="处理当前账号的待办，查看经办记录和我发起的流程。">
      <Alert
        showIcon
        type="info"
        title={
          <Space wrap size={8}>
            <span>当前账号</span>
            <Tag color="processing">{session.userId}</Tag>
            <span>租户</span>
            <Tag>{session.tenantId}</Tag>
          </Space>
        }
        description={
          <Flex vertical gap={8}>
            <span>
              待办按当前登录上下文加载。需要调整用户、部门或角色时，请进入组织权限维护。
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
        onChange={setActiveTab}
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
                      <Button onClick={() => setActiveTab('started')}>
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
                    <Button onClick={() => setActiveTab('todo')}>
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
                    '当前用户暂无发起记录',
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
    </PageContainer>
  );
};

export default Tasks;
