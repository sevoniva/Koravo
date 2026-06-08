import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Button, Flex, Modal, message } from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  activateProcessInstance,
  getOpsInstance,
  getProcessTrace,
  suspendProcessInstance,
  terminateProcessInstance,
  type AuditLogItem,
  type ProcessTraceNode,
  type TaskItem,
} from '@/services/koravo/api';
import {
  auditActionLabel,
  auditResourceLabel,
  processDefinitionLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

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
];

const ProcessInstanceDetail: React.FC = () => {
  const params = useParams();
  const instanceId = params.instanceId || '';
  const [modal, contextHolder] = Modal.useModal();
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

  return (
    <PageContainer
      title="流程实例详情"
      content="查看实例状态、当前任务、执行轨迹和审计记录。"
      extra={[
        <Button key="refresh" onClick={() => refetch()}>
          刷新
        </Button>,
        <Button
          key="suspend"
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
        </Button>,
        <Button
          key="activate"
          onClick={async () => {
            await activateProcessInstance(instanceId);
            message.success('已激活');
            await refetch();
          }}
        >
          激活
        </Button>,
        <Button
          key="terminate"
          danger
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
        </Button>,
      ]}
    >
      {contextHolder}
      <ProCard loading={isLoading} style={{ marginBottom: 16 }}>
        <ProDescriptions
          column={2}
          dataSource={instance}
          columns={[
            { title: '实例编号', dataIndex: 'instanceId', copyable: true },
            {
              title: '流程定义',
              dataIndex: 'processDefinitionId',
              renderText: processDefinitionLabel,
            },
            { title: '业务标识', dataIndex: 'businessKey', copyable: true },
            { title: '发起人', dataIndex: 'startUserId' },
            { title: '开始时间', dataIndex: 'startTime', renderText: formatDateTime },
            { title: '结束时间', dataIndex: 'endTime', renderText: formatDateTime },
            { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} /> },
          ]}
        />
      </ProCard>

      <Flex vertical gap={16}>
        <ProCard title="当前任务">
          <ProTable<TaskItem>
            rowKey="taskId"
            columns={taskColumns}
            dataSource={instance?.currentTasks || []}
            search={false}
            pagination={false}
            options={false}
          />
        </ProCard>
        <ProCard title="执行轨迹">
          <ProTable<ProcessTraceNode>
            rowKey="activityId"
            columns={traceColumns}
            dataSource={trace?.timeline || []}
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
            scroll={{ x: 1000 }}
          />
        </ProCard>
      </Flex>
    </PageContainer>
  );
};

export default ProcessInstanceDetail;
