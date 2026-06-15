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
  Alert,
  App,
  Badge,
  Button,
  Empty,
  Flex,
  Form,
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
  organizationAssigneeFieldValue,
  organizationMemberName,
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
import { formatDateTime, parseJsonSafe } from '@/utils/format';
import {
  type TaskHandlingState,
  taskActionAccess,
  taskHandlingSummary,
} from '@/utils/taskAccess';
import {
  filterWorkflowFormValues,
  isWorkflowFieldVisible,
  parseWorkflowFormFields,
  visibleWorkflowFormFields,
  type WorkflowFormField,
  workflowFieldRules,
  workflowNumberFieldProps,
} from '@/utils/workflowForm';
import {
  completionAssigneeDisplayLabels,
  completionFieldReadOnly,
} from './completionFieldState';
import {
  buildTaskCompletionOutcome,
  type TaskCompletionOutcome,
} from './completionOutcome';
import {
  reviewSnapshotValues,
  shouldShowTaskComments,
  shouldShowTaskSnapshots,
  taskCompleted,
  taskSnapshotForReview,
} from './taskReviewContext';

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

const taskHandlingBadgeStatus: Record<
  TaskHandlingState,
  'success' | 'processing' | 'default' | 'error' | 'warning'
> = {
  loading: 'default',
  done: 'success',
  ready: 'processing',
  blocked: 'warning',
  claimable: 'warning',
  unassigned: 'default',
  waiting: 'default',
};

const taskHandlingAlertType: Record<
  TaskHandlingState,
  'success' | 'info' | 'warning' | 'error'
> = {
  loading: 'info',
  done: 'success',
  ready: 'info',
  blocked: 'warning',
  claimable: 'warning',
  unassigned: 'info',
  waiting: 'info',
};

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
  canClaimTask?: boolean,
) {
  const isDone = task?.status === 'COMPLETED';
  const hasAssignee = Boolean(task?.assignee);
  const canHandle = Boolean(
    hasAssignee && task?.assignee && task.assignee === currentUserId,
  );
  const summary = taskHandlingSummary({
    task,
    currentUserId,
    hasForm,
    canClaimTask,
  });
  const handleText = isDone ? '已提交' : summary.requirement;
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
  canClaimTask?: boolean;
  logs?: AuditLogItem[];
}> = ({ task, hasForm, currentUserId, canClaimTask, logs }) => {
  const isDone = task?.status === 'COMPLETED';
  const hasAssignee = Boolean(task?.assignee);
  const summary = taskHandlingSummary({
    task,
    currentUserId,
    hasForm,
    canClaimTask,
  });
  return (
    <ProCard
      title="当前任务"
      extra={
        <Badge
          status={taskHandlingBadgeStatus[summary.state]}
          text={summary.instruction}
        />
      }
      style={{ marginBottom: 16 }}
    >
      <Flex vertical gap={14}>
        <Alert
          type={taskHandlingAlertType[summary.state]}
          showIcon
          title={
            <Space size={8} wrap>
              <Typography.Text strong>{summary.instruction}</Typography.Text>
              <Tag color={taskHandlingBadgeStatus[summary.state]}>
                {summary.assigneeText}
              </Tag>
            </Space>
          }
          description={summary.requirement}
        />
        <ProDescriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 4 }}
          dataSource={{
            node: taskDefinitionLabel(task?.taskDefinitionKey),
            assignee: summary.assigneeText,
            requirement: summary.requirement,
            next: summary.nextStep,
          }}
          columns={[
            { title: '当前节点', dataIndex: 'node' },
            { title: '处理人', dataIndex: 'assignee' },
            { title: '办理要求', dataIndex: 'requirement' },
            { title: '后续去向', dataIndex: 'next' },
          ]}
        />
        <Steps
          size="small"
          current={isDone ? 2 : hasAssignee ? 1 : 0}
          status={
            summary.state === 'blocked'
              ? 'error'
              : hasForm || isDone || summary.state === 'claimable'
                ? 'process'
                : 'wait'
          }
          items={taskStepItems(task, hasForm, currentUserId, canClaimTask)}
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
    const displayLabels = completionAssigneeDisplayLabels(initialValue);
    return (
      <Form.Item
        key={field.fieldKey}
        label={field.title}
        required={field.required}
      >
        {displayLabels.length ? (
          <Space size={[6, 6]} wrap>
            {displayLabels.map((label) => (
              <Tag key={label} color="processing">
                {label}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未选择</Typography.Text>
        )}
      </Form.Item>
    );
  }

  if (isCompletionAssigneeField(field)) {
    const displayLabels = completionAssigneeDisplayLabels(initialValue);
    return (
      <Form.Item
        key={field.fieldKey}
        label={field.title}
        required={field.required}
      >
        {displayLabels.length ? (
          <Space size={[6, 6]} wrap>
            {displayLabels.map((label) => (
              <Tag key={label} color="processing">
                {label}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未选择</Typography.Text>
        )}
      </Form.Item>
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

const TaskCompletionOutcomeContent: React.FC<{
  outcome: TaskCompletionOutcome;
  onContinue: () => void;
  onViewInstance: () => void;
  onBackToTasks: () => void;
}> = ({ outcome, onContinue, onViewInstance, onBackToTasks }) => {
  const hasRemainingTasks = outcome.remainingTaskSummaries.length > 0;
  return (
    <Flex vertical gap={12}>
      <Alert
        showIcon
        type={outcome.nextTask || !hasRemainingTasks ? 'success' : 'info'}
        title={outcome.title}
        description={outcome.summary}
      />
      <ProDescriptions
        size="small"
        column={1}
        dataSource={{
          nextStep: outcome.nextStep,
          remaining: hasRemainingTasks
            ? `${outcome.remainingTaskSummaries.length} 个待办`
            : '无',
        }}
        columns={[
          { title: '下一步', dataIndex: 'nextStep' },
          { title: '剩余待办', dataIndex: 'remaining' },
        ]}
      />
      {hasRemainingTasks ? (
        <Space size={[6, 6]} wrap>
          {outcome.remainingTaskSummaries.map((item) => (
            <Tag
              key={item.taskId}
              color={item.currentUserTask ? 'processing' : 'default'}
            >
              {item.nodeLabel} · {item.handlerLabel}
            </Tag>
          ))}
        </Space>
      ) : null}
      <Flex gap={8} wrap>
        {outcome.nextTask ? (
          <Button type="primary" onClick={onContinue}>
            继续处理{taskDefinitionLabel(outcome.nextTask.taskDefinitionKey)}
          </Button>
        ) : null}
        <Button
          type={outcome.nextTask ? 'default' : 'primary'}
          onClick={onViewInstance}
        >
          查看实例进度
        </Button>
        <Button onClick={onBackToTasks}>返回我的待办</Button>
      </Flex>
    </Flex>
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
  const formSnapshots = data?.formSnapshots || [];
  const taskDone = taskCompleted(task);
  const reviewSnapshot = taskDone
    ? taskSnapshotForReview(task, formSnapshots)
    : undefined;
  const reviewSnapshotData = reviewSnapshotValues(reviewSnapshot);
  const snapshotData = reviewSnapshotValues(snapshot);
  const showSnapshots = shouldShowTaskSnapshots(
    task,
    formSnapshots,
    canViewOperationalContext,
  );
  const showComments = shouldShowTaskComments(
    task,
    data?.comments || [],
    canViewOperationalContext,
  );
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
                const outcome = buildTaskCompletionOutcome(
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
                  width: 560,
                  okText: '留在当前页',
                  content: (
                    <TaskCompletionOutcomeContent
                      outcome={outcome}
                      onContinue={() => {
                        if (!outcome.nextTask) return;
                        taskCompleteModal?.destroy();
                        Modal.destroyAll();
                        openTaskAsAssignee(outcome.nextTask);
                      }}
                      onViewInstance={() => {
                        taskCompleteModal?.destroy();
                        Modal.destroyAll();
                        history.push(
                          `/process-instances/${task.processInstanceId}`,
                        );
                      }}
                      onBackToTasks={() => {
                        taskCompleteModal?.destroy();
                        Modal.destroyAll();
                        history.push('/tasks');
                      }}
                    />
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
        canClaimTask={canClaimDetailTask}
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
          schemaJson={
            reviewSnapshot?.schemaJson || data?.formSchema?.schemaJson
          }
          uiSchemaJson={
            reviewSnapshot?.uiSchemaJson || data?.formSchema?.uiSchemaJson
          }
          values={reviewSnapshotData || data?.processVariables}
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
                title: '流程追踪号',
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

      {canViewOperationalContext || showSnapshots || showComments ? (
        <Flex vertical gap={16}>
          {canViewOperationalContext ? (
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
          ) : null}
          {showSnapshots ? (
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
                dataSource={formSnapshots}
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
