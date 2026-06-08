import {
  ModalForm,
  PageContainer,
  ProCard,
  ProDescriptions,
  ProFormDatePicker,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Drawer, Flex, Modal, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import StructuredDetailTable from '@/components/StructuredDetailTable';
import {
  completeTask,
  getTaskDetail,
  type AuditLogItem,
  type FormSchemaItem,
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
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

const PURCHASE_APPROVAL_TASKS = new Set([
  'managerApprovalTask',
  'financeApprovalTask',
]);

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
];

function parseJsonObject(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    return JSON.parse(value) as JsonRecord;
  } catch {
    return {};
  }
}

function isPurchaseApprovalTask(task?: TaskItem) {
  return PURCHASE_APPROVAL_TASKS.has(task?.taskDefinitionKey || '');
}

function approvalVariableKey(taskDefinitionKey: string, suffix: string) {
  return `${taskDefinitionKey}${suffix}`;
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
  task: TaskItem,
  formSchemaId: string | undefined,
  values: CompleteTaskForm,
) {
  if (!isPurchaseApprovalTask(task)) {
    const formData = normalizeFormValues(values.formValues);
    return {
      variables: formData,
      formData,
      formSchemaId,
      comment: values.comment,
    };
  }

  const approved = values.approved !== false;
  const opinion = values.approvalComment?.trim() || (approved ? '同意' : '不同意');
  const taskLabel = taskDefinitionLabel(task.taskDefinitionKey);
  const formData = {
    taskDefinitionKey: task.taskDefinitionKey,
    taskName: taskLabel,
    businessKey: task.businessKey,
    approver: task.assignee,
    approved,
    opinion,
  };

  return {
    variables: {
      [approvalVariableKey(task.taskDefinitionKey, 'Approved')]: approved,
      [approvalVariableKey(task.taskDefinitionKey, 'Opinion')]: opinion,
    },
    formData,
    formSchemaId,
    comment: `${taskLabel}：${opinion}`,
  };
}

function snapshotSummary(record: FormSnapshotItem) {
  const data = parseJsonSafe<JsonRecord>(record.dataJson, {}) as JsonRecord;
  const approved = data.approved;
  const opinion = typeof data.opinion === 'string' ? data.opinion : '';
  const taskName = typeof data.taskName === 'string' ? data.taskName : '';

  if (approved === undefined && !opinion && !taskName) {
    return '-';
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
            rules={rules}
          />
        );
      })}
    </>
  );
};

const CompleteTaskFields: React.FC<{
  task?: TaskItem;
  formSchema?: FormSchemaItem;
}> = ({ task, formSchema }) => {
  if (isPurchaseApprovalTask(task)) {
    return (
      <>
        <ProFormRadio.Group
          name="approved"
          label="审批结论"
          initialValue={true}
          radioType="button"
          options={[
            { label: '同意', value: true },
            { label: '不同意', value: false },
          ]}
          rules={[{ required: true, message: '请选择审批结论' }]}
        />
        <ProFormTextArea
          name="approvalComment"
          label="审批意见"
          fieldProps={{ rows: 4 }}
          placeholder="请填写处理意见"
          rules={[{ required: true, message: '请输入审批意见' }]}
        />
      </>
    );
  }

  return (
    <>
      <SchemaDrivenFields formSchema={formSchema} />
      <ProFormTextArea name="comment" label="处理意见" fieldProps={{ rows: 4 }} />
    </>
  );
};

const TaskDetail: React.FC = () => {
  const params = useParams();
  const taskId = params.taskId || '';
  const [snapshot, setSnapshot] = useState<FormSnapshotItem>();
  const [modal, contextHolder] = Modal.useModal();
  const { message } = App.useApp();
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
  const canCompleteTask = Boolean(
    task &&
      task.status !== 'COMPLETED' &&
      (isPurchaseApprovalTask(task) || data?.formSchema),
  );
  const snapshotData = maskSecret(parseJsonSafe(snapshot?.dataJson, {}));

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
              <Button type="primary" disabled={!canCompleteTask}>
                完成任务
              </Button>
            }
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await completeTask(
                task.taskId,
                buildCompletePayload(task, data?.formSchema?.id, values),
              );
              message.success('已完成');
              await refetch();
              modal.success({
                title: '任务已完成',
                width: 520,
                okText: '留在当前页',
                content: (
                  <Flex vertical gap={12}>
                    <span>
                      {taskDefinitionLabel(task.taskDefinitionKey)} 已处理完成，可回到实例查看当前进度、表单快照和审计记录。
                    </span>
                    <Flex gap={8} wrap>
                      <Button
                        type="primary"
                        onClick={() =>
                          history.push(`/process-instances/${task.processInstanceId}`)
                        }
                      >
                        查看实例进度
                      </Button>
                      <Button onClick={() => history.push('/tasks')}>
                        返回任务中心
                      </Button>
                    </Flex>
                  </Flex>
                ),
              });
              return true;
            }}
          >
            <CompleteTaskFields task={task} formSchema={data?.formSchema} />
          </ModalForm>
        ),
      ].filter(Boolean)}
    >
      {contextHolder}
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
        <StructuredDetailTable value={snapshotData} emptyText="暂无快照数据" />
      </Drawer>
    </PageContainer>
  );
};

export default TaskDetail;
