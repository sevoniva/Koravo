import {
  ModalForm,
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useParams } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  Drawer,
  Empty,
  Flex,
  Modal,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import BusinessDataDescriptions from '@/components/BusinessDataDescriptions';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import OrganizationProfileFormItem from '@/components/OrganizationProfileFormItem';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import {
  type AuditLogItem,
  completeTask,
  type FormSchemaItem,
  type FormSnapshotItem,
  getOpsInstance,
  getProcessTrace,
  getTaskDetail,
  handleTaskAction,
  type JsonRecord,
  type TaskCommentItem,
  type TaskItem,
} from '@/services/koravo/api';
import {
  applyOrganizationProfileValues,
  getOrganizationMembers,
  isOrganizationAssigneeField,
  isOrganizationProfileField,
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationMemberName,
  organizationMemberSelectOptions,
  organizationProfileFieldValue,
} from '@/services/koravo/organization';
import {
  auditActionLabel,
  auditResourceLabel,
  businessKeyLabel,
  formSchemaNameLabel,
  processDefinitionLabel,
  productCopy,
  shortTraceLabel,
  taskDefinitionLabel,
  taskNameLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

interface CompleteTaskForm {
  decision?: 'APPROVED' | 'REJECTED' | 'RETURNED';
  comment?: string;
  approved?: boolean;
  approvalComment?: string;
  formValues?: JsonRecord;
}

interface TaskActionForm {
  targetUserId?: string;
  comment?: string;
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
  {
    title: '处理人',
    dataIndex: 'userId',
    width: 140,
    renderText: organizationMemberName,
  },
  { title: '意见', dataIndex: 'message' },
  { title: '时间', dataIndex: 'time', width: 170, renderText: formatDateTime },
];

const snapshotColumns: ProColumns<FormSnapshotItem>[] = [
  {
    title: '快照',
    dataIndex: 'id',
    width: 140,
    render: (_, record) => (
      <CopyableText
        value={record.id}
        displayValue={shortTraceLabel(record.id)}
      />
    ),
  },
  {
    title: '表单',
    dataIndex: 'formSchemaId',
    width: 220,
    render: (_, record) => (
      <CopyableText
        value={record.formSchemaId}
        displayValue={shortTraceLabel(record.formSchemaId)}
      />
    ),
  },
  {
    title: '版本',
    dataIndex: 'formSchemaVersion',
    width: 90,
    renderText: (value) => `v${value || 1}`,
  },
  {
    title: '处理摘要',
    key: 'summary',
    ellipsis: true,
    search: false,
    render: (_, record) => snapshotSummary(record),
  },
  {
    title: '时间',
    dataIndex: 'createdAt',
    width: 170,
    renderText: formatDateTime,
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

function taskStatusLabel(status?: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return '已完成';
  if (normalized === 'RUNNING' || normalized === 'ACTIVE') return '待处理';
  if (normalized === 'CLAIMABLE') return '待认领';
  return status || '-';
}

function taskActionVerb(action?: string) {
  const normalized = String(action || '').toUpperCase();
  const mapping: Record<string, string> = {
    TASK_COMPLETE: '完成审批',
    TASK_TRANSFER: '转交任务',
    TASK_DELEGATE: '委托任务',
    TASK_CLAIM: '认领任务',
  };
  return mapping[normalized] || auditActionLabel(action);
}

function taskActionSummary(log: AuditLogItem) {
  const detail = parseJsonSafe<JsonRecord>(log.detailJson, {}) as JsonRecord;
  const node = taskDefinitionLabel(String(detail.taskDefinitionKey || ''));
  const comment =
    typeof detail.comment === 'string'
      ? detail.comment
      : typeof detail.reason === 'string'
        ? detail.reason
        : '';
  return {
    key: log.id || `${log.createdAt}-${log.action}-${log.userId}`,
    time: formatDateTime(log.createdAt),
    text: `${log.userId ? organizationMemberName(log.userId) : '系统'} ${taskActionVerb(log.action)}${node ? `「${node}」` : ''}`,
    comment,
  };
}

function latestTaskActions(logs: AuditLogItem[] = []) {
  return logs
    .filter((log) => String(log.action || '').startsWith('TASK_'))
    .slice(0, 3)
    .map(taskActionSummary);
}

function nextTaskInstruction(task?: TaskItem, hasForm?: boolean) {
  if (!task) return '加载任务信息后继续处理。';
  if (task.status === 'COMPLETED') {
    return '当前任务已完成，可查看表单快照、处理意见和实例进度。';
  }
  if (!task.assignee) {
    return '当前任务还没有处理人，请先认领后再填写表单并提交处理意见。';
  }
  if (!hasForm) {
    return '当前节点还没有绑定表单，请先完成节点表单绑定，再回到这里处理。';
  }
  return '核对业务数据，填写本节点表单和处理意见，然后提交审批结果。';
}

const TaskActionTimeline: React.FC<{ logs?: AuditLogItem[] }> = ({
  logs = [],
}) => {
  const actions = latestTaskActions(logs);
  if (!actions.length) {
    return (
      <Empty description="暂无已办动作" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  }
  return (
    <Flex vertical gap={8}>
      {actions.map((action) => (
        <Flex key={action.key} vertical gap={2}>
          <Typography.Text>{action.text}</Typography.Text>
          <Typography.Text type="secondary">
            {action.time}
            {action.comment ? `，${action.comment}` : ''}
          </Typography.Text>
        </Flex>
      ))}
    </Flex>
  );
};

const TaskHandlingContext: React.FC<{
  task?: TaskItem;
  hasForm?: boolean;
  logs?: AuditLogItem[];
}> = ({ task, hasForm, logs }) => {
  const isDone = task?.status === 'COMPLETED';
  const hasAssignee = Boolean(task?.assignee);
  return (
    <ProCard title="办理信息" style={{ marginBottom: 16 }}>
      <Flex vertical gap={16}>
        <Alert
          showIcon
          type={isDone ? 'success' : hasForm ? 'info' : 'warning'}
          title={
            task
              ? `当前节点：${taskDefinitionLabel(task.taskDefinitionKey)}`
              : '正在加载任务信息'
          }
          description={nextTaskInstruction(task, hasForm)}
        />
        <Steps
          size="small"
          current={isDone ? 2 : hasAssignee ? 1 : 0}
          status={hasForm || isDone ? 'process' : 'wait'}
          items={[
            {
              title: hasAssignee ? '已确定处理人' : '等待认领',
              description: hasAssignee
                ? organizationMemberName(task?.assignee)
                : '暂无处理人',
            },
            {
              title: isDone ? '已提交处理意见' : '填写节点表单',
              description: hasForm ? '按当前节点表单处理' : '未绑定表单',
            },
            {
              title: isDone ? '已进入后续流转' : '提交审批结果',
              description: taskStatusLabel(task?.status),
            },
          ]}
        />
        <ProDescriptions
          size="small"
          column={{ xs: 1, sm: 1, md: 3 }}
          dataSource={{
            assignee: task?.assignee
              ? organizationMemberName(task.assignee)
              : '未分配',
            status: taskStatusLabel(task?.status),
            node: taskDefinitionLabel(task?.taskDefinitionKey),
          }}
          columns={[
            { title: '处理人', dataIndex: 'assignee' },
            { title: '任务状态', dataIndex: 'status' },
            { title: '当前节点', dataIndex: 'node' },
          ]}
        />
        <TaskActionTimeline logs={logs} />
      </Flex>
    </ProCard>
  );
};

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
          onClick={() =>
            history.push(`/process-instances/${currentTask.processInstanceId}`)
          }
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
            color={
              task.taskId === currentTask.taskId ? 'processing' : 'default'
            }
          >
            <Space size={6}>
              <Badge
                status={
                  task.taskId === currentTask.taskId ? 'processing' : 'warning'
                }
                text={`${taskDefinitionLabel(task.taskDefinitionKey)}：${
                  task.assignee
                    ? organizationMemberName(task.assignee)
                    : '未分配'
                }`}
              />
              <Typography.Text type="secondary">
                {parallelTaskStatus(task, currentTask)}
              </Typography.Text>
              {task.taskId !== currentTask.taskId ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => openTaskAsAssignee(task)}
                >
                  进入办理
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
  const properties = schema.properties as
    | Record<string, JsonRecord>
    | undefined;
  if (!properties || typeof properties !== 'object') return [];
  const required = Array.isArray(schema.required)
    ? schema.required.map(String)
    : [];

  return Object.entries(properties).map(([fieldKey, property]) => {
    const type = normalizeSchemaType(String(property.type || 'string'));
    const uiField = uiSchema[fieldKey] as JsonRecord | undefined;
    const placeholder =
      uiField?.['ui:placeholder'] ||
      uiField?.placeholder ||
      property['ui:placeholder'];
    return {
      fieldKey,
      title: productCopy(String(property.title || '')) || fieldKey,
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
        ? property.enum.map((item) => ({
            label: String(item),
            value: String(item),
          }))
        : undefined,
    };
  });
}

function isTaskProfileField(field: SchemaField) {
  return (
    field.widget === 'organizationProfile' ||
    isOrganizationProfileField(field.fieldKey, field.title)
  );
}

function isTaskAssigneeField(field: SchemaField) {
  return (
    field.widget === 'organizationMember' ||
    isOrganizationAssigneeField(field.fieldKey, field.title)
  );
}

function normalizeFormValues(values?: JsonRecord): JsonRecord {
  return Object.entries(values || {}).reduce<JsonRecord>(
    (result, [key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        'format' in value &&
        typeof (value as { format?: unknown }).format === 'function'
      ) {
        result[key] = (
          value as { format: (template: string) => string }
        ).format('YYYY-MM-DD');
        return result;
      }
      result[key] = value;
      return result;
    },
    {},
  );
}

function buildCompletePayload(
  formSchema: FormSchemaItem | undefined,
  values: CompleteTaskForm,
  processValues?: JsonRecord,
) {
  const decision = values.decision || 'APPROVED';
  const decisionText =
    decision === 'APPROVED'
      ? '同意'
      : decision === 'REJECTED'
        ? '不同意'
        : '退回补充';
  const schemaFields = schemaToFields(formSchema);
  const formValues = applyOrganizationProfileValues(
    schemaFields,
    normalizeFormValues(values.formValues),
    processValues,
  );
  const formData = {
    ...formValues,
    decision,
    decisionText,
    approved: decision === 'APPROVED',
  };
  return {
    variables: formData,
    formData,
    formSchemaId: formSchema?.id,
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
      {opinion ? (
        <Typography.Text type="secondary">{opinion}</Typography.Text>
      ) : null}
    </Flex>
  );
}

const SchemaDrivenFields: React.FC<{
  formSchema?: FormSchemaItem;
  values?: JsonRecord;
}> = ({ formSchema, values }) => {
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
        if (isTaskAssigneeField(field)) {
          return (
            <ProFormSelect
              key={field.fieldKey}
              name={name}
              label={field.title}
              initialValue={organizationAssigneeFieldValue(
                field.fieldKey,
                values,
                field.title,
              )}
              options={organizationMemberSelectOptions(
                organizationAssigneeRole(field.fieldKey, field.title),
              )}
              tooltip="由发起环节选择的组织成员带出。"
              disabled
              rules={
                field.required
                  ? [{ required: true, message: `${field.title}会自动带出` }]
                  : undefined
              }
            />
          );
        }
        if (isTaskProfileField(field)) {
          return (
            <OrganizationProfileFormItem
              key={field.fieldKey}
              name={name}
              label={field.title}
              value={organizationProfileFieldValue(
                field.fieldKey,
                values,
                undefined,
                field.title,
              )}
              required={field.required}
              sourceText="流程档案"
            />
          );
        }
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

const CompleteTaskFields: React.FC<{
  formSchema?: FormSchemaItem;
  values?: JsonRecord;
}> = ({ formSchema, values }) => (
  <>
    <ProFormSelect
      name="decision"
      label="处理结论"
      initialValue="APPROVED"
      options={[
        { label: '同意', value: 'APPROVED' },
        { label: '不同意', value: 'REJECTED' },
        { label: '退回补充', value: 'RETURNED' },
      ]}
      rules={[{ required: true, message: '请选择处理结论' }]}
    />
    <SchemaDrivenFields formSchema={formSchema} values={values} />
    <ProFormTextArea name="comment" label="处理意见" fieldProps={{ rows: 4 }} />
  </>
);

function taskActionTargetOptions() {
  return getOrganizationMembers()
    .filter((member) => member.status === '启用')
    .map((member) => ({
      label: `${member.name}（${member.department}）`,
      value: member.userId,
    }));
}

const TaskActionModal: React.FC<{
  task: TaskItem;
  action: 'TRANSFER' | 'DELEGATE' | 'CLAIM';
  label: string;
  refetch: () => Promise<unknown>;
}> = ({ task, action, label, refetch }) => {
  const { message } = App.useApp();
  const needsTarget = action !== 'CLAIM';
  const targetOptions = React.useMemo(() => taskActionTargetOptions(), []);

  return (
    <ModalForm<TaskActionForm>
      title={label}
      trigger={<Button>{label}</Button>}
      modalProps={{ destroyOnHidden: true }}
      onFinish={async (values) => {
        await handleTaskAction(task.taskId, {
          action,
          targetUserId: values.targetUserId,
          comment: values.comment,
        });
        message.success(`已${label}`);
        await refetch();
        return true;
      }}
    >
      {needsTarget ? (
        <ProFormSelect
          name="targetUserId"
          label="目标处理人"
          options={targetOptions}
          rules={[{ required: true, message: '请选择目标处理人' }]}
        />
      ) : null}
      <ProFormTextArea
        name="comment"
        label="处理说明"
        fieldProps={{ rows: 3 }}
        placeholder={needsTarget ? '说明转交或委托原因' : '说明认领原因'}
      />
    </ModalForm>
  );
};

const TaskDetail: React.FC = () => {
  const params = useParams();
  const taskId = params.taskId || '';
  const [snapshot, setSnapshot] = useState<FormSnapshotItem>();
  const [modal, contextHolder] = Modal.useModal();
  const { message } = App.useApp();
  const { data, isLoading, refetch } = useQuery({
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
  const { data: trace, isLoading: traceLoading } = useQuery({
    queryKey: ['task-process-trace', task?.processInstanceId],
    queryFn: () => getProcessTrace(task?.processInstanceId || ''),
    enabled: Boolean(task?.processInstanceId),
  });
  const canCompleteTask = Boolean(
    task && task.status !== 'COMPLETED' && data?.formSchema,
  );
  const snapshotData = maskSecret(parseJsonSafe(snapshot?.dataJson, {}));
  const openTaskAsAssignee = React.useCallback((nextTask: TaskItem) => {
    history.push(`/tasks/${nextTask.taskId}`);
  }, []);

  return (
    <PageContainer
      title="任务详情"
      content="查看任务状态、表单快照、处理意见和审计记录。"
      extra={
        <Space wrap>
          <Button onClick={() => history.push('/tasks')}>返回列表</Button>
          {task && canCompleteTask ? (
            <ModalForm<CompleteTaskForm>
              title="完成任务"
              trigger={<Button type="primary">完成任务</Button>}
              modalProps={{ destroyOnHidden: true }}
              onFinish={async (values) => {
                await completeTask(
                  task.taskId,
                  buildCompletePayload(
                    data?.formSchema,
                    values,
                    data?.processVariables,
                  ),
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
                            继续处理
                            {taskDefinitionLabel(nextTask.taskDefinitionKey)}
                          </Button>
                        ) : null}
                        <Button
                          type={nextTask ? 'default' : 'primary'}
                          onClick={() => {
                            taskCompleteModal?.destroy();
                            Modal.destroyAll();
                            history.push(
                              `/process-instances/${task.processInstanceId}`,
                            );
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
                          返回我的待办
                        </Button>
                      </Flex>
                    </Flex>
                  ),
                });
                return true;
              }}
            >
              <CompleteTaskFields
                formSchema={data?.formSchema}
                values={data?.processVariables}
              />
            </ModalForm>
          ) : null}
          {task && task.status !== 'COMPLETED' ? (
            <>
              <TaskActionModal
                task={task}
                action="TRANSFER"
                label="转交"
                refetch={refetch}
              />
              <TaskActionModal
                task={task}
                action="DELEGATE"
                label="委托"
                refetch={refetch}
              />
              <TaskActionModal
                task={task}
                action="CLAIM"
                label="认领"
                refetch={refetch}
              />
            </>
          ) : null}
        </Space>
      }
    >
      {contextHolder}
      {task && instance?.currentTasks
        ? renderParallelTasks(task, instance.currentTasks, openTaskAsAssignee)
        : null}
      <TaskHandlingContext
        task={task}
        hasForm={Boolean(data?.formSchema)}
        logs={data?.auditLogs}
      />
      <ProcessProgressCard
        trace={trace}
        currentTasks={instance?.currentTasks || (task ? [task] : [])}
        activeTask={task}
        loading={traceLoading}
      />
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
            {
              title: '任务追踪',
              dataIndex: 'taskId',
              render: (_, record) => (
                <CopyableText
                  value={record.taskId}
                  displayValue={shortTraceLabel(record.taskId)}
                />
              ),
            },
            {
              title: '任务名称',
              dataIndex: 'name',
              renderText: (_, record) => taskNameLabel(record),
            },
            {
              title: '流程',
              dataIndex: 'processDefinitionId',
              renderText: processDefinitionLabel,
            },
            {
              title: '实例追踪',
              dataIndex: 'processInstanceId',
              render: (_, record) => (
                <Flex align="center" gap={8} wrap>
                  <CopyableText
                    value={record.processInstanceId}
                    displayValue={shortTraceLabel(record.processInstanceId)}
                  />
                  <Button
                    type="link"
                    onClick={() =>
                      history.push(
                        `/process-instances/${record.processInstanceId}`,
                      )
                    }
                  >
                    查看实例
                  </Button>
                </Flex>
              ),
            },
            {
              title: '业务对象',
              dataIndex: 'businessKey',
              render: (_, record) => (
                <CopyableText
                  value={record.businessKey || record.processInstanceId}
                  displayValue={
                    record.businessKey
                      ? businessKeyLabel(record.businessKey)
                      : shortTraceLabel(record.processInstanceId)
                  }
                />
              ),
            },
            {
              title: '当前节点',
              dataIndex: 'taskDefinitionKey',
              renderText: taskDefinitionLabel,
            },
            {
              title: '处理人',
              dataIndex: 'assignee',
              renderText: organizationMemberName,
            },
            {
              title: '创建时间',
              dataIndex: 'createTime',
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
        <ProCard title="表单">
          <ProDescriptions
            column={{ xs: 1, sm: 1, md: 2 }}
            dataSource={data?.formSchema}
            columns={[
              {
                title: '表单名称',
                dataIndex: 'formName',
                renderText: (value) => formSchemaNameLabel(value),
              },
              { title: '表单标识', dataIndex: 'formKey' },
              {
                title: '版本',
                dataIndex: 'version',
                renderText: (value) => `v${value || 1}`,
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (_, record) => (
                  <KoravoStatusTag status={record.status} />
                ),
              },
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
                    <Button
                      onClick={() =>
                        history.push(
                          `/process-instances/${task.processInstanceId}`,
                        )
                      }
                    >
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
