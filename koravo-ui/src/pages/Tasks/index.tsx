import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, Tabs } from 'antd';
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
import { processDefinitionLabel, taskDefinitionLabel } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

const taskColumns: ProColumns<TaskItem>[] = [
  { title: '任务名称', dataIndex: 'name' },
  {
    title: '业务标识',
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
  return (
    <PageContainer title="我的任务" content="处理待办，查看已完成任务和发起记录。">
      <Tabs
        items={[
          {
            key: 'todo',
            label: '待办',
            children: (
              <ProTable<TaskItem>
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
