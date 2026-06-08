import {
  ModalForm,
  PageContainer,
  ProCard,
  ProDescriptions,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Flex, Typography, message } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  completeTask,
  getTaskDetail,
  type AuditLogItem,
  type FormSnapshotItem,
  type JsonRecord,
  type TaskCommentItem,
  type TaskItem,
} from '@/services/koravo/api';
import {
  auditActionLabel,
  auditResourceLabel,
  processDefinitionLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

interface CompleteTaskForm {
  variables?: string;
  formData?: string;
  comment?: string;
}

const commentColumns: ProColumns<TaskCommentItem>[] = [
  { title: '用户', dataIndex: 'userId', width: 140 },
  { title: '意见', dataIndex: 'message' },
  { title: '时间', dataIndex: 'time', width: 170, renderText: formatDateTime },
];

const snapshotColumns: ProColumns<FormSnapshotItem>[] = [
  {
    title: '快照编号',
    dataIndex: 'id',
    width: 220,
    render: (_, record) => <CopyableText value={record.id} />,
  },
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
  { title: '时间', dataIndex: 'createdAt', width: 170, renderText: formatDateTime },
];

const auditColumns: ProColumns<AuditLogItem>[] = [
  { title: '时间', dataIndex: 'createdAt', width: 170, renderText: formatDateTime },
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

function parseJsonField(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    return JSON.parse(value) as JsonRecord;
  } catch {
    throw new Error('JSON 格式不正确');
  }
}

const TaskDetail: React.FC = () => {
  const params = useParams();
  const taskId = params.taskId || '';
  const [snapshot, setSnapshot] = useState<FormSnapshotItem>();
  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: () => getTaskDetail(taskId),
    enabled: Boolean(taskId),
  });
  const task = data?.task;
  const snapshotJson = JSON.stringify(
    maskSecret(parseJsonSafe(snapshot?.dataJson, {})),
    null,
    2,
  );

  return (
    <PageContainer
      title="任务详情"
      content="查看任务上下文、表单快照、处理意见和审计记录。"
      extra={[
        <Button key="back" onClick={() => history.push('/tasks')}>
          返回列表
        </Button>,
        task && (
          <ModalForm<CompleteTaskForm>
            key="complete"
            title="完成任务"
            trigger={
              <Button type="primary" disabled={task.status === 'COMPLETED'}>
                完成任务
              </Button>
            }
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await completeTask(task.taskId, {
                variables: parseJsonField(values.variables),
                formData: parseJsonField(values.formData),
                formSchemaId: data?.formSchema?.id,
                comment: values.comment,
              });
              message.success('已完成');
              await refetch();
              return true;
            }}
          >
            <ProFormTextArea
              name="variables"
              label="流程变量"
              fieldProps={{ rows: 6 }}
              placeholder='{"approved": true}'
            />
            <ProFormTextArea
              name="formData"
              label="表单数据"
              fieldProps={{ rows: 6 }}
              placeholder='{"comment": "同意"}'
            />
            <ProFormTextArea name="comment" label="处理意见" fieldProps={{ rows: 4 }} />
          </ModalForm>
        ),
      ].filter(Boolean)}
    >
      <ProCard loading={isLoading} style={{ marginBottom: 16 }}>
        <ProDescriptions<TaskItem>
          column={2}
          dataSource={task}
          columns={[
            { title: '任务编号', dataIndex: 'taskId', copyable: true },
            { title: '任务名称', dataIndex: 'name' },
            {
              title: '流程定义',
              dataIndex: 'processDefinitionId',
              renderText: processDefinitionLabel,
            },
            { title: '流程实例', dataIndex: 'processInstanceId', copyable: true },
            { title: '业务标识', dataIndex: 'businessKey', copyable: true },
            { title: '任务节点', dataIndex: 'taskDefinitionKey', renderText: taskDefinitionLabel },
            { title: '处理人', dataIndex: 'assignee' },
            { title: '创建时间', dataIndex: 'createTime', renderText: formatDateTime },
            { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} /> },
          ]}
        />
      </ProCard>

      <Flex vertical gap={16}>
        <ProCard title="表单">
          <ProDescriptions
            column={2}
            dataSource={data?.formSchema}
            columns={[
              { title: '表单名称', dataIndex: 'formName' },
              { title: '表单标识', dataIndex: 'formKey' },
              { title: '版本', dataIndex: 'version', renderText: (value) => `v${value || 1}` },
              { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} /> },
            ]}
          />
        </ProCard>
        <ProCard title="表单快照">
          <ProTable<FormSnapshotItem>
            rowKey="id"
            columns={[
              ...snapshotColumns,
              {
                title: '操作',
                valueType: 'option',
                render: (_, record) => (
                  <Button type="link" onClick={() => setSnapshot(record)}>
                    查看
                  </Button>
                ),
              },
            ]}
            dataSource={data?.formSnapshots || []}
            search={false}
            pagination={false}
            options={false}
            scroll={{ x: 1000 }}
          />
        </ProCard>
        <ProCard title="处理意见">
          <ProTable<TaskCommentItem>
            rowKey="id"
            columns={commentColumns}
            dataSource={data?.comments || []}
            search={false}
            pagination={false}
            options={false}
          />
        </ProCard>
        <ProCard title="审计记录">
          <ProTable<AuditLogItem>
            rowKey="id"
            columns={auditColumns}
            dataSource={data?.auditLogs || []}
            search={false}
            pagination={false}
            options={false}
            scroll={{ x: 1000 }}
          />
        </ProCard>
      </Flex>

      <Drawer
        title="表单快照"
        size={720}
        open={Boolean(snapshot)}
        onClose={() => setSnapshot(undefined)}
      >
        <Typography.Title level={5}>数据</Typography.Title>
        <Typography.Paragraph>
          <pre>{snapshotJson}</pre>
        </Typography.Paragraph>
      </Drawer>
    </PageContainer>
  );
};

export default TaskDetail;
