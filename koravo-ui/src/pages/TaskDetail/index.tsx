import {
  ModalForm,
  PageContainer,
  ProCard,
  ProDescriptions,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useModel, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Badge, Button, Drawer, Empty, Flex, Modal, Space, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import BusinessDataDescriptions from '@/components/BusinessDataDescriptions';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  completeTask,
  getOpsInstance,
  getTaskDetail,
  type AuditLogItem,
  type FormSchemaItem,
  type FormSnapshotItem,
  type JsonRecord,
  type TaskCommentItem,
  type TaskItem,
} from '@/services/koravo/api';
import {
  getSessionContext,
  setSessionContext,
} from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  processDefinitionLabel,
  taskDefinitionLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

interface CompleteTaskForm {
  comment?: string;
  approved?: boolean;
  approvalComment?: string;
  formValues?: JsonRecord;
}

interface SchemaField {
  fieldKey: string;
  title: string;
  type: 'string' | 'number' | 'boolean';
  format?: string;
  widget?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
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
  {
    title: '处理摘要',
    dataIndex: 'dataJson',
    ellipsis: true,
    render: (_, record) => snapshotSummary(record),
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
  {
    title: '操作',
    valueType: 'option',
    width: 96,
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

function parseJsonObject(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    return JSON.parse(value) as JsonRecord;
  } catch {
    return {};
  }
}

function nextPendingTask(currentTask: TaskItem, tasks: TaskItem[]) {
  return tasks.find(
    (item) =>
      item.taskId !== currentTask.taskId &&
      item.assignee &&
      item.status !== 'COMPLETED',
  );
}

function parallelTaskStatus(task: TaskItem, currentTask?: TaskItem) {
  if (currentTask?.taskId === task.taskId) return '当前任务';
  if (task.status === 'COMPLETED') return '已处理';
  return '待处理';
}

function renderParallelTasks(
  currentTask: TaskItem,
  tasks: TaskItem[],
  openTaskAsAssignee: (task: TaskItem) => void,
) {
  const pendingTasks = tasks.filter((item) => item.status !== 'COMPLETED');
  if (pendingTasks.length <= 1) return null;

  return (
    <ProCard
      title="当前并行任务"
      extra={
        <Button
          type="link"
          onClick={() => history.push(`/process-instances/${currentTask.processInstanceId}`)}
        >
          查看实例进度
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      <Space size={[8, 8]} wrap>
        {pendingTasks.map((task) => (
          <Tag
            key={task.taskId}
            color={task.taskId === currentTask.taskId ? 'processing' : 'default'}
          >
            <Space size={6}>
              <Badge
                status={task.taskId === currentTask.taskId ? 'processing' : 'warning'}
                text={`${taskDefinitionLabel(task.taskDefinitionKey)}：${task.assignee || '未分配'}`}
              />
              <Typography.Text type="secondary">
                {parallelTaskStatus(task, currentTask)}
              </Typography.Text>
              {task.taskId !== currentTask.taskId ? (
                <Button type="link" size="small" onClick={() => openTaskAsAssignee(task)}>
                  切换处理
                </Button>
              ) : null}
            </Space>
          </Tag>
        ))}
      </Space>
    </ProCard>
  );
}

function normalizeSchemaType(type?: string): SchemaField['type'] {
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

function schemaToFields(formSchema?: FormSchemaItem): SchemaField[] {
  const schema = parseJsonObject(formSchema?.schemaJson);
  const uiSchema = parseJsonObject(formSchema?.uiSchemaJson);
  const properties = schema.properties as Record<string, JsonRecord> | undefined;
  if (!properties || typeof properties !== 'object') return [];
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];

  return Object.entries(properties).map(([fieldKey, property]) => {
    const type = normalizeSchemaType(String(property.type || 'string'));
    const uiField = uiSchema[fieldKey] as JsonRecord | undefined;
    const placeholder =
      uiField?.['ui:placeholder'] ||
      uiField?.placeholder ||
      property['ui:placeholder'];
    return {
      fieldKey,
      title: String(property.title || fieldKey),
      type,
      format: typeof property.format === 'string' ? property.format : undefined,
      widget: String(
        property['ui:widget'] ||
          uiField?.['ui:widget'] ||
          uiField?.widget ||
          '',
      ),
      placeholder: typeof placeholder === 'string' ? placeholder : undefined,
      required: required.includes(fieldKey),
      options: Array.isArray(property.enum)
        ? property.enum.map((item) => ({ label: String(item), value: String(item) }))
        : undefined,
    };
  });
}

function normalizeFormValues(values?: JsonRecord): JsonRecord {
  return Object.entries(values || {}).reduce<JsonRecord>((result, [key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      'format' in value &&
      typeof (value as { format?: unknown }).format === 'function'
    ) {
      result[key] = (value as { format: (template: string) => string }).format('YYYY-MM-DD');
      return result;
    }
    result[key] = value;
    return result;
  }, {});
}

function buildCompletePayload(
  formSchemaId: string | undefined,
  values: CompleteTaskForm,
) {
  const formData = normalizeFormValues(values.formValues);
  return {
    variables: formData,
    formData,
    formSchemaId,
    comment: values.comment,
  };
}

function snapshotSummary(record: FormSnapshotItem) {
  const data = parseJsonSafe<JsonRecord>(record.dataJson, {}) as JsonRecord;
  const approved = data.approved;
  const opinion = typeof data.opinion === 'string' ? data.opinion : '';
  const taskName = typeof data.taskName === 'string' ? data.taskName : '';

  if (approved === undefined && !opinion && !taskName) {
    const fieldCount = Object.keys(data).length;
    return fieldCount ? `${fieldCount} 个字段` : '-';
  }

  return (
    <Flex gap={8} align="center" wrap>
      {taskName ? <Typography.Text>{taskName}</Typography.Text> : null}
      {approved !== undefined ? (
        <Tag color={approved ? 'success' : 'error'}>
          {approved ? '同意' : '不同意'}
        </Tag>
      ) : null}
      {opinion ? <Typography.Text type="secondary">{opinion}</Typography.Text> : null}
    </Flex>
  );
}

const SchemaDrivenFields: React.FC<{ formSchema?: FormSchemaItem }> = ({ formSchema }) => {
  const fields = schemaToFields(formSchema);

  if (!fields.length) {
    return (
      <Alert
        showIcon
        type="warning"
        title="当前任务没有可填写表单"
        description="请先在表单绑定中为该任务节点配置表单，再回到这里处理任务。"
        action={
          <Button size="small" onClick={() => history.push('/form-bindings')}>
            去绑定表单
          </Button>
        }
      />
    );
  }

  return (
    <>
      {fields.map((field) => {
        const rules = field.required
          ? [{ required: true, message: `请输入${field.title}` }]
          : undefined;
        const name = ['formValues', field.fieldKey];
        if (field.type === 'number') {
          return (
            <ProFormDigit
              key={field.fieldKey}
              name={name}
              label={field.title}
              placeholder={field.placeholder}
              fieldProps={{ precision: 2 }}
              rules={rules}
            />
          );
        }
        if (field.options?.length) {
          return (
            <ProFormSelect
              key={field.fieldKey}
              name={name}
              label={field.title}
              options={field.options}
              placeholder={field.placeholder}
              rules={
                field.required
                  ? [{ required: true, message: `请选择${field.title}` }]
                  : undefined
              }
            />
          );
        }
        if (field.format === 'date') {
          return (
            <ProFormDatePicker
              key={field.fieldKey}
              name={name}
              label={field.title}
              placeholder={field.placeholder}
              fieldProps={{ format: 'YYYY-MM-DD' }}
              rules={
                field.required
                  ? [{ required: true, message: `请选择${field.title}` }]
                  : undefined
              }
            />
          );
        }
        if (field.type === 'boolean') {
          return (
            <ProFormSwitch
              key={field.fieldKey}
              name={name}
              label={field.title}
            />
          );
        }
        if (field.widget === 'textarea') {
          return (
            <ProFormTextArea
              key={field.fieldKey}
              name={name}
              label={field.title}
              placeholder={field.placeholder}
              fieldProps={{ rows: 4 }}
              rules={rules}
            />
          );
        }
        return (
          <ProFormText
            key={field.fieldKey}
            name={name}
            label={field.title}
            placeholder={field.placeholder}
            rules={rules}
          />
        );
      })}
    </>
  );
};

const CompleteTaskFields: React.FC<{ formSchema?: FormSchemaItem }> = ({ formSchema }) => (
  <>
    <SchemaDrivenFields formSchema={formSchema} />
    <ProFormTextArea name="comment" label="处理意见" fieldProps={{ rows: 4 }} />
  </>
);

const TaskDetail: React.FC = () => {
  const params = useParams();
  const taskId = params.taskId || '';
  const [snapshot, setSnapshot] = useState<FormSnapshotItem>();
  const [modal, contextHolder] = Modal.useModal();
  const { message } = App.useApp();
  const { setInitialState } = useModel('@@initialState');
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
  const { data: instance } = useQuery({
    queryKey: ['task-instance-context', task?.processInstanceId],
    queryFn: () => getOpsInstance(task?.processInstanceId || ''),
    enabled: Boolean(task?.processInstanceId),
  });
  const canCompleteTask = Boolean(
    task &&
      task.status !== 'COMPLETED' &&
      data?.formSchema,
  );
  const snapshotData = maskSecret(parseJsonSafe(snapshot?.dataJson, {}));
  const openTaskAsAssignee = React.useCallback(
    (nextTask: TaskItem) => {
      const userId = nextTask.assignee?.trim();
      if (userId) {
        const next = { ...getSessionContext(), userId };
        setSessionContext(next);
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
      }
      history.push(`/tasks/${nextTask.taskId}`);
    },
    [message, setInitialState],
  );

  return (
    <PageContainer
      title="任务详情"
      content="查看任务上下文、表单快照、处理意见和审计记录。"
      extra={
        <Space wrap>
          <Button onClick={() => history.push('/tasks')}>
            返回列表
          </Button>
          {task && canCompleteTask ? (
          <ModalForm<CompleteTaskForm>
            title="完成任务"
            trigger={
              <Button type="primary">
                完成任务
              </Button>
            }
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await completeTask(
                task.taskId,
                buildCompletePayload(data?.formSchema?.id, values),
              );
              const instance = await getOpsInstance(task.processInstanceId);
              const nextTask = nextPendingTask(
                task,
                instance.currentTasks || [],
              );
              message.success('已完成');
              await refetch();
              let taskCompleteModal: { destroy: () => void } | undefined;
              taskCompleteModal = modal.success({
                title: '任务已完成',
                width: 520,
                okText: '留在当前页',
                content: (
                  <Flex vertical gap={12}>
                    <span>
                      {nextTask
                        ? `${taskDefinitionLabel(task.taskDefinitionKey)} 已处理完成，当前实例还有 ${taskDefinitionLabel(nextTask.taskDefinitionKey)} 待处理。`
                        : `${taskDefinitionLabel(task.taskDefinitionKey)} 已处理完成，可回到实例查看当前进度、表单快照和审计记录。`}
                    </span>
                    <Flex gap={8} wrap>
                      {nextTask ? (
                        <Button
                          type="primary"
                          onClick={() => {
                            taskCompleteModal?.destroy();
                            Modal.destroyAll();
                            openTaskAsAssignee(nextTask);
                          }}
                        >
                          继续处理{taskDefinitionLabel(nextTask.taskDefinitionKey)}
                        </Button>
                      ) : null}
                      <Button
                        type={nextTask ? 'default' : 'primary'}
                        onClick={() => {
                          taskCompleteModal?.destroy();
                          Modal.destroyAll();
                          history.push(`/process-instances/${task.processInstanceId}`);
                        }}
                      >
                        查看实例进度
                      </Button>
                      <Button
                        onClick={() => {
                          taskCompleteModal?.destroy();
                          Modal.destroyAll();
                          history.push('/tasks');
                        }}
                      >
                        返回任务中心
                      </Button>
                    </Flex>
                  </Flex>
                ),
              });
              return true;
            }}
          >
            <CompleteTaskFields formSchema={data?.formSchema} />
          </ModalForm>
          ) : null}
        </Space>
      }
    >
      {contextHolder}
      {task && instance?.currentTasks
        ? renderParallelTasks(
            task,
            instance.currentTasks,
            openTaskAsAssignee,
          )
        : null}
      <ProCard title="业务数据" style={{ marginBottom: 16 }}>
        <BusinessDataDescriptions
          schemaJson={data?.formSchema?.schemaJson}
          uiSchemaJson={data?.formSchema?.uiSchemaJson}
          values={data?.processVariables}
        />
      </ProCard>
      <ProCard loading={isLoading} style={{ marginBottom: 16 }}>
        <ProDescriptions<TaskItem>
          column={{ xs: 1, sm: 1, md: 2 }}
          dataSource={task}
          columns={[
            { title: '任务编号', dataIndex: 'taskId', copyable: true },
            { title: '任务名称', dataIndex: 'name' },
            {
              title: '流程定义',
              dataIndex: 'processDefinitionId',
              renderText: processDefinitionLabel,
            },
            {
              title: '流程实例',
              dataIndex: 'processInstanceId',
              render: (_, record) => (
                <Flex align="center" gap={8} wrap>
                  <CopyableText value={record.processInstanceId} />
                  <Button
                    type="link"
                    onClick={() =>
                      history.push(`/process-instances/${record.processInstanceId}`)
                    }
                  >
                    查看实例
                  </Button>
                </Flex>
              ),
            },
            { title: '业务编号', dataIndex: 'businessKey', copyable: true },
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
            column={{ xs: 1, sm: 1, md: 2 }}
            dataSource={data?.formSchema}
            columns={[
              { title: '表单名称', dataIndex: 'formName' },
              { title: '表单编码', dataIndex: 'formKey' },
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
            locale={{
              emptyText: (
                <Empty
                  description="暂无表单快照"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  {task ? (
                    <Button onClick={() => history.push(`/process-instances/${task.processInstanceId}`)}>
                      查看实例进度
                    </Button>
                  ) : null}
                </Empty>
              ),
            }}
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
            locale={{
              emptyText: (
                <Empty
                  description="暂无处理意见"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
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
            locale={{
              emptyText: (
                <Empty
                  description="暂无内嵌审计记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  {task ? (
                    <Button
                      onClick={() =>
                        history.push(
                          `/audit-logs?resourceId=${encodeURIComponent(task.taskId)}`,
                        )
                      }
                    >
                      查看审计日志
                    </Button>
                  ) : null}
                </Empty>
              ),
            }}
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
        <BusinessDataDescriptions
          emptyText="暂无快照数据"
          schemaJson={snapshot?.schemaJson}
          uiSchemaJson={snapshot?.uiSchemaJson}
          values={snapshotData as JsonRecord}
        />
      </Drawer>
    </PageContainer>
  );
};

export default TaskDetail;
