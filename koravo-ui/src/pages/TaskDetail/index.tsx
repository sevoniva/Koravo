import {
  ModalForm,
  PageContainer,
  ProCard,
  ProDescriptions,
  ProFormDigit,
  ProFormList,
  ProFormRadio,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Drawer, Empty, Flex, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
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
  fieldValues?: Array<{ fieldKey?: string; value?: string }>;
}

interface SnapshotDetailRow {
  key: string;
  field: string;
  value: React.ReactNode;
}

interface SchemaField {
  fieldKey: string;
  title: string;
  type: 'string' | 'number' | 'boolean';
  widget?: string;
  required?: boolean;
}

const PURCHASE_APPROVAL_TASKS = new Set([
  'managerApprovalTask',
  'financeApprovalTask',
]);

const snapshotFieldLabels: Record<string, string> = {
  taskDefinitionKey: '任务节点',
  taskName: '任务名称',
  businessKey: '业务标识',
  approver: '处理人',
  approved: '审批结论',
  opinion: '处理意见',
  applicant: '申请人',
  department: '申请部门',
  itemName: '采购事项',
  amount: '采购金额',
  reason: '申请事由',
  managerApprover: '部门审批人',
  financeApprover: '财务审批人',
};

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
      widget: String(
        property['ui:widget'] ||
          uiField?.['ui:widget'] ||
          uiField?.widget ||
          '',
      ),
      required: required.includes(fieldKey),
    };
  });
}

function fieldListToRecord(values?: Array<{ fieldKey?: string; value?: string }>) {
  return (values || []).reduce<JsonRecord>((result, item) => {
    const key = item.fieldKey?.trim();
    if (!key) return result;
    result[key] = item.value || '';
    return result;
  }, {});
}

function formatSnapshotField(field: string) {
  return snapshotFieldLabels[field] || field;
}

function formatSnapshotValue(value: unknown): React.ReactNode {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') {
    return value ? <Tag color="success">同意</Tag> : <Tag color="error">不同意</Tag>;
  }
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    if (!value.length) return '无';
    return value.map((item) => String(item)).join('、');
  }
  return String(value);
}

function buildSnapshotRows(value: unknown, parentKey?: string): SnapshotDetailRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as JsonRecord).flatMap(([key, item]) => {
    const rowKey = parentKey ? `${parentKey}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return buildSnapshotRows(item, rowKey);
    }
    return [
      {
        key: rowKey,
        field: formatSnapshotField(key),
        value: formatSnapshotValue(item),
      },
    ];
  });
}

function buildCompletePayload(
  task: TaskItem,
  formSchemaId: string | undefined,
  values: CompleteTaskForm,
) {
  if (!isPurchaseApprovalTask(task)) {
    const formData = Object.keys(values.formValues || {}).length
      ? values.formValues || {}
      : fieldListToRecord(values.fieldValues);
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
      <ProFormList
        name="fieldValues"
        label="处理字段"
        initialValue={[{}]}
        min={1}
        creatorButtonProps={{ creatorButtonText: '添加字段' }}
      >
        <Flex gap={12} wrap>
          <ProFormText
            name="fieldKey"
            label="字段标识"
            width="sm"
            rules={[{ required: true, message: '请输入字段标识' }]}
          />
          <ProFormText
            name="value"
            label="字段值"
            width="md"
            rules={[{ required: true, message: '请输入字段值' }]}
          />
        </Flex>
      </ProFormList>
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
  const snapshotRows = buildSnapshotRows(
    maskSecret(parseJsonSafe(snapshot?.dataJson, {})),
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
              await completeTask(
                task.taskId,
                buildCompletePayload(task, data?.formSchema?.id, values),
              );
              message.success('已完成');
              await refetch();
              return true;
            }}
          >
            <CompleteTaskFields task={task} formSchema={data?.formSchema} />
          </ModalForm>
        ),
      ].filter(Boolean)}
    >
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
            column={{ xs: 1, sm: 1, md: 2 }}
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
        {snapshotRows.length ? (
          <ProTable<SnapshotDetailRow>
            rowKey="key"
            columns={[
              { title: '字段', dataIndex: 'field', width: 180 },
              { title: '内容', dataIndex: 'value' },
            ]}
            dataSource={snapshotRows}
            search={false}
            pagination={false}
            options={false}
          />
        ) : (
          <Empty description="暂无快照数据" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default TaskDetail;
