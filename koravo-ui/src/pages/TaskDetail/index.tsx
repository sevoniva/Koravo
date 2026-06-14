import {
  ModalForm,
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProFormDatePicker,
  ProFormDependency,
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
  App,
  Badge,
  Button,
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
import KoravoDrawer from '@/components/KoravoDrawer';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import OrganizationProfileFormItem from '@/components/OrganizationProfileFormItem';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import {
  type AuditLogItem,
  completeTask,
  type FormSchemaItem,
  type FormSnapshotItem,
  getProcessInstance,
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
  organizationApprovalMemberSelectOptions,
  organizationAssigneeFieldValue,
  organizationAssigneeRole,
  organizationMemberName,
  organizationMemberSelectOptions,
  organizationProfileFieldValue,
} from '@/services/koravo/organization';
import { getSessionContext } from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  businessKeyLabel,
  formSchemaNameLabel,
  formSchemaOptionLabel,
  processDefinitionLabel,
  shortTraceLabel,
  taskDefinitionLabel,
  taskNameLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';
import { taskActionAccess, taskHandlingInstruction } from '@/utils/taskAccess';
import {
  filterWorkflowFormValues,
  isWorkflowFieldVisible,
  parseWorkflowFormFields,
  visibleWorkflowFormFields,
  type WorkflowFormField,
  workflowFieldRules,
  workflowNumberFieldProps,
} from '@/utils/workflowForm';
import { completionFieldReadOnly } from './completionFieldState';

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

type SchemaField = WorkflowFormField;

const taskDecisionFieldKeys = new Set([
  'accepted',
  'approved',
  'reviewComment',
  'approvalComment',
  'decision',
  'decisionText',
  'opinion',
  'comment',
]);

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
];

function nextPendingTask(currentTask: TaskItem, tasks: TaskItem[]) {
  return tasks.find(
    (item) =>
      item.taskId !== currentTask.taskId &&
      item.assignee &&
      item.assignee === currentTask.assignee &&
      item.status !== 'COMPLETED',
  );
}

function remainingPendingTasks(currentTask: TaskItem, tasks: TaskItem[]) {
  return tasks.filter(
    (item) => item.taskId !== currentTask.taskId && item.status !== 'COMPLETED',
  );
}

function parallelTaskStatus(
  task: TaskItem,
  currentTask?: TaskItem,
  currentUserId?: string,
) {
  if (currentTask?.taskId === task.taskId) {
    return task.assignee === currentUserId ? '当前任务' : '当前查看';
  }
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

function taskStepItems(
  task: TaskItem | undefined,
  hasForm?: boolean,
  currentUserId?: string,
) {
  const isDone = task?.status === 'COMPLETED';
  const hasAssignee = Boolean(task?.assignee);
  const canHandle = Boolean(
    hasAssignee && task?.assignee && task.assignee === currentUserId,
  );
  const handleText = canHandle
    ? hasForm
      ? '填写表单'
      : '缺少表单'
    : hasAssignee
      ? '等待处理人'
      : '等待认领';
  return [
    {
      title: hasAssignee ? '已分配' : '待认领',
      content: hasAssignee ? organizationMemberName(task?.assignee) : '未分配',
      status:
        hasAssignee || isDone ? ('finish' as const) : ('process' as const),
    },
    {
      title: isDone ? '已办理' : '办理',
      content: handleText,
      status: isDone
        ? ('finish' as const)
        : canHandle
          ? ('process' as const)
          : ('wait' as const),
    },
    {
      title: isDone ? '已流转' : '流转',
      content: taskStatusLabel(task?.status),
      status: isDone ? ('finish' as const) : ('wait' as const),
    },
  ];
}

const TaskActionTimeline: React.FC<{ logs?: AuditLogItem[] }> = ({
  logs = [],
}) => {
  const actions = latestTaskActions(logs);
  if (!actions.length) return null;
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
  currentUserId?: string;
  logs?: AuditLogItem[];
}> = ({ task, hasForm, currentUserId, logs }) => {
  const isDone = task?.status === 'COMPLETED';
  const hasAssignee = Boolean(task?.assignee);
  const nextInstruction = taskHandlingInstruction({
    task,
    currentUserId,
    hasForm,
  });
  return (
    <ProCard
      title="办理"
      extra={
        <Badge
          status={isDone ? 'success' : hasForm ? 'processing' : 'warning'}
          text={nextInstruction}
        />
      }
      style={{ marginBottom: 16 }}
    >
      <Flex vertical gap={14}>
        <ProDescriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 4 }}
          dataSource={{
            node: taskDefinitionLabel(task?.taskDefinitionKey),
            assignee: task?.assignee
              ? organizationMemberName(task.assignee)
              : '未分配',
            status: taskStatusLabel(task?.status),
            next: nextInstruction,
          }}
          columns={[
            { title: '当前节点', dataIndex: 'node' },
            { title: '处理人', dataIndex: 'assignee' },
            { title: '状态', dataIndex: 'status' },
            { title: '下一步', dataIndex: 'next' },
          ]}
        />
        <Steps
          size="small"
          current={isDone ? 2 : hasAssignee ? 1 : 0}
          status={hasForm || isDone ? 'process' : 'wait'}
          items={taskStepItems(task, hasForm, currentUserId)}
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
  currentUserId?: string,
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
        {pendingTasks.map((task) => {
          const canEnterTask =
            task.taskId !== currentTask.taskId &&
            Boolean(currentUserId) &&
            task.assignee === currentUserId;

          return (
            <Tag
              key={task.taskId}
              color={
                task.taskId === currentTask.taskId ? 'processing' : 'default'
              }
            >
              <Space size={6}>
                <Badge
                  status={
                    task.taskId === currentTask.taskId
                      ? 'processing'
                      : 'warning'
                  }
                  text={`${taskDefinitionLabel(task.taskDefinitionKey)}：${
                    task.assignee
                      ? organizationMemberName(task.assignee)
                      : '未分配'
                  }`}
                />
                <Typography.Text type="secondary">
                  {parallelTaskStatus(task, currentTask, currentUserId)}
                </Typography.Text>
                {canEnterTask ? (
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
          );
        })}
      </Space>
    </ProCard>
  );
}

function schemaToFields(formSchema?: FormSchemaItem): SchemaField[] {
  return parseWorkflowFormFields(
    formSchema?.schemaJson,
    formSchema?.uiSchemaJson,
    {
      excludeKeys: taskDecisionFieldKeys,
    },
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
  const normalizedValues = normalizeFormValues(values.formValues);
  const valuesWithProfile = applyOrganizationProfileValues(
    schemaFields,
    { ...(processValues || {}), ...normalizedValues },
    processValues,
  ) as JsonRecord;
  const visibleFields = visibleWorkflowFormFields(
    schemaFields,
    valuesWithProfile,
  );
  const formValues = schemaFields.length
    ? filterWorkflowFormValues(visibleFields, valuesWithProfile)
    : normalizedValues;
  const comment = values.comment?.trim();
  const formData = {
    ...formValues,
    decision,
    decisionText,
    approved: decision === 'APPROVED',
    ...(comment
      ? {
          opinion: comment,
          reviewComment: comment,
        }
      : {}),
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

function isCompletionProfileField(field: SchemaField) {
  return (
    field.widget === 'organizationProfile' ||
    isOrganizationProfileField(field.fieldKey, field.title)
  );
}

function isCompletionAssigneeField(field: SchemaField) {
  return (
    field.widget === 'organizationMember' ||
    isOrganizationAssigneeField(field.fieldKey, field.title)
  );
}

function isCompletionAssigneeMultiField(field: SchemaField) {
  return (
    field.widget === 'organizationMemberMulti' ||
    (field.type === 'array' &&
      isOrganizationAssigneeField(field.fieldKey, field.title))
  );
}

function completionFieldRules(field: SchemaField, messagePrefix = '请输入') {
  return workflowFieldRules(field, messagePrefix);
}

function completionFieldInitialValue(field: SchemaField, values?: JsonRecord) {
  const rawValue = values?.[field.fieldKey];
  if (isCompletionAssigneeMultiField(field)) {
    if (Array.isArray(rawValue)) return rawValue.map(String).filter(Boolean);
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return [rawValue.trim()];
    }
    return [];
  }
  if (rawValue !== undefined && rawValue !== null) return rawValue;
  if (isCompletionAssigneeField(field)) {
    return organizationAssigneeFieldValue(field.fieldKey, values, field.title);
  }
  return undefined;
}

function renderCompletionField(
  field: SchemaField,
  values?: JsonRecord,
  sourceValues?: JsonRecord,
) {
  if (!isWorkflowFieldVisible(field, values)) return null;

  const name = ['formValues', field.fieldKey];
  const readOnly = completionFieldReadOnly();
  const formItemProps = { preserve: false };
  const initialValue = completionFieldInitialValue(field, sourceValues);

  if (isCompletionAssigneeMultiField(field)) {
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        options={organizationApprovalMemberSelectOptions()}
        disabled
        fieldProps={{ mode: 'multiple', maxTagCount: 'responsive' }}
        formItemProps={formItemProps}
        rules={completionFieldRules(field, '请选择')}
      />
    );
  }

  if (isCompletionAssigneeField(field)) {
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        options={organizationMemberSelectOptions(
          organizationAssigneeRole(field.fieldKey, field.title),
        )}
        disabled
        formItemProps={formItemProps}
        rules={completionFieldRules(field, '请选择')}
      />
    );
  }

  if (isCompletionProfileField(field)) {
    return (
      <OrganizationProfileFormItem
        key={field.fieldKey}
        name={name}
        label={field.title}
        value={organizationProfileFieldValue(
          field.fieldKey,
          sourceValues,
          undefined,
          field.title,
        )}
        required={field.required}
        preserve={false}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <ProFormDigit
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        placeholder={field.placeholder}
        fieldProps={{
          precision: 2,
          disabled: readOnly,
          ...workflowNumberFieldProps(field),
        }}
        formItemProps={formItemProps}
        rules={completionFieldRules(field)}
      />
    );
  }

  if (field.options?.length) {
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        options={field.options}
        placeholder={field.placeholder}
        disabled={readOnly}
        formItemProps={formItemProps}
        rules={completionFieldRules(field, '请选择')}
      />
    );
  }

  if (field.format === 'date') {
    return (
      <ProFormDatePicker
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        placeholder={field.placeholder}
        fieldProps={{ format: 'YYYY-MM-DD', disabled: readOnly }}
        formItemProps={formItemProps}
        rules={completionFieldRules(field, '请选择')}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <ProFormSwitch
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        fieldProps={{ disabled: readOnly }}
        formItemProps={formItemProps}
      />
    );
  }

  if (field.widget === 'textarea') {
    return (
      <ProFormTextArea
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={initialValue}
        placeholder={field.placeholder}
        fieldProps={{ rows: 3, disabled: readOnly }}
        formItemProps={formItemProps}
        rules={completionFieldRules(field)}
      />
    );
  }

  return (
    <ProFormText
      key={field.fieldKey}
      name={name}
      label={field.title}
      initialValue={initialValue}
      placeholder={field.placeholder}
      fieldProps={{ disabled: readOnly }}
      formItemProps={formItemProps}
      rules={completionFieldRules(field)}
    />
  );
}

const CompleteTaskFields: React.FC<{
  formSchema?: FormSchemaItem;
  values?: JsonRecord;
}> = ({ formSchema, values }) => {
  const fields = schemaToFields(formSchema);
  return (
    <>
      {fields.map((field) => (
        <ProFormDependency key={field.fieldKey} name={['formValues']}>
          {({ formValues }) =>
            renderCompletionField(
              field,
              { ...(values || {}), ...((formValues as JsonRecord) || {}) },
              values,
            )
          }
        </ProFormDependency>
      ))}
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
      <ProFormTextArea
        name="comment"
        label="处理意见"
        fieldProps={{ rows: 4 }}
      />
    </>
  );
};

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
  const { data: instance, refetch: refetchInstance } = useQuery({
    queryKey: ['task-instance-context', task?.processInstanceId],
    queryFn: () => getProcessInstance(task?.processInstanceId || ''),
    enabled: Boolean(task?.processInstanceId),
  });
  const {
    data: trace,
    isLoading: traceLoading,
    refetch: refetchTrace,
  } = useQuery({
    queryKey: ['task-process-trace', task?.processInstanceId],
    queryFn: () => getProcessTrace(task?.processInstanceId || ''),
    enabled: Boolean(task?.processInstanceId),
  });
  const session = getSessionContext();
  const canClaimTask =
    session.permissions?.canClaimTask ??
    ['manager', 'finance'].includes(session.role);
  const canViewOperationalContext = session.permissions
    ? Boolean(
        session.permissions.canOperateSystem ||
          session.permissions.canViewAudit ||
          session.permissions.canConfigureWorkflow,
      )
    : session.role === 'admin' || session.role === 'operator';
  const { canCompleteTask, canManageAssignedTask, canClaimDetailTask } =
    taskActionAccess({
      task,
      currentUserId: session.userId,
      hasForm: Boolean(data?.formSchema),
      canClaimTask,
    });
  const snapshotData = maskSecret(parseJsonSafe(snapshot?.dataJson, {}));
  const showComments =
    canViewOperationalContext || Boolean(data?.comments?.length);
  const openTaskAsAssignee = React.useCallback((nextTask: TaskItem) => {
    history.push(`/tasks/${nextTask.taskId}`);
  }, []);

  return (
    <PageContainer
      title="任务详情"
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
                const updatedInstance = await getProcessInstance(
                  task.processInstanceId,
                );
                const remainingTasks = remainingPendingTasks(
                  task,
                  updatedInstance.currentTasks || [],
                );
                const nextTask = nextPendingTask(
                  task,
                  updatedInstance.currentTasks || [],
                );
                message.success('已完成');
                await Promise.all([
                  refetch(),
                  refetchInstance(),
                  refetchTrace(),
                ]);
                let taskCompleteModal: { destroy: () => void } | undefined;
                taskCompleteModal = modal.success({
                  title: '任务已完成',
                  width: 520,
                  okText: '留在当前页',
                  content: (
                    <Flex vertical gap={12}>
                      <span>
                        {nextTask
                          ? `下一节点：${taskDefinitionLabel(nextTask.taskDefinitionKey)}`
                          : remainingTasks.length
                            ? `仍有 ${remainingTasks.length} 个并行任务待处理。`
                            : '流程已无当前待办。'}
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
          {task && canManageAssignedTask ? (
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
            </>
          ) : null}
          {task && canClaimDetailTask ? (
            <TaskActionModal
              task={task}
              action="CLAIM"
              label="认领"
              refetch={refetch}
            />
          ) : null}
        </Space>
      }
    >
      {contextHolder}
      <ProcessProgressCard
        trace={trace}
        currentTasks={instance?.currentTasks || (task ? [task] : [])}
        activeTask={task}
        currentUserId={session.userId}
        loading={traceLoading}
      />
      <TaskHandlingContext
        task={task}
        hasForm={Boolean(data?.formSchema)}
        currentUserId={session.userId}
        logs={data?.auditLogs}
      />
      {task && instance?.currentTasks
        ? renderParallelTasks(
            task,
            instance.currentTasks,
            openTaskAsAssignee,
            session.userId,
          )
        : null}
      <ProCard title="业务数据" style={{ marginBottom: 16 }}>
        <BusinessDataDescriptions
          schemaJson={data?.formSchema?.schemaJson}
          uiSchemaJson={data?.formSchema?.uiSchemaJson}
          values={data?.processVariables}
        />
      </ProCard>
      {canViewOperationalContext ? (
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
                render: (_, record) => (
                  <KoravoStatusTag status={record.status} />
                ),
              },
            ]}
          />
        </ProCard>
      ) : null}

      {canViewOperationalContext || showComments ? (
        <Flex vertical gap={16}>
          {canViewOperationalContext ? (
            <>
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
            </>
          ) : null}
          {showComments ? (
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
          ) : null}
          {canViewOperationalContext ? (
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
                      description="暂无审计记录"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ),
                }}
                scroll={{ x: 1000 }}
              />
            </ProCard>
          ) : null}
        </Flex>
      ) : null}

      <KoravoDrawer
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
      </KoravoDrawer>
    </PageContainer>
  );
};

export default TaskDetail;
