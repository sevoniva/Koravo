import { DeploymentUnitOutlined, PlayCircleOutlined } from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProForm,
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
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Empty,
  Flex,
  Form,
  Space,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import KoravoDrawer from '@/components/KoravoDrawer';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import OrganizationProfileFormItem from '@/components/OrganizationProfileFormItem';
import ProcessContextSummary from '@/components/ProcessContextSummary';
import ProcessDiagramViewer from '@/components/ProcessDiagramViewer';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import {
  type FormSchemaItem,
  getOpsProcessTrace,
  type JsonRecord,
  listOpsInstances,
  listStartableWorkflows,
  type OpsProcessInstance,
  type StartableWorkflowItem,
  startProcessInstance,
  type TaskItem,
} from '@/services/koravo/api';
import {
  applyOrganizationProfileValues,
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
  businessKeyLabel,
  formSchemaOptionLabel,
  processDefinitionLabel,
  shortTraceLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';
import {
  filterWorkflowFormValues,
  isWorkflowFieldVisible,
  parseWorkflowFormFields,
  visibleWorkflowFormFields,
  type WorkflowFormField,
  workflowFieldRules,
  workflowNumberFieldProps,
} from '@/utils/workflowForm';

interface StartInstanceForm {
  processDefinitionKey: string;
  businessKey: string;
  processModelId?: string;
  processDefinitionId?: string;
  startFormSchemaId?: string;
  formValues?: JsonRecord;
}

type StartFormField = WorkflowFormField;

interface ProcessPreviewTarget {
  instanceId: string;
  title: string;
  currentTasks?: TaskItem[];
}

interface StartEntryNotice {
  title: string;
  actionText?: string;
  actionPath?: string;
}

const useStyles = createStyles(({ css, token }) => ({
  startGrid: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
    gap: 24px;
    align-items: start;

    @media (max-width: 1080px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  startMain: css`
    min-width: 0;
    max-width: 760px;
  `,
  startAside: css`
    position: sticky;
    top: 16px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-left: 20px;
    border-left: 1px solid ${token.colorBorderSecondary};

    @media (max-width: 1080px) {
      position: static;
      padding-left: 0;
      border-left: 0;
    }
  `,
  startPreview: css`
    min-width: 0;
  `,
}));

const taskDecisionFieldKeys = new Set([
  'accepted',
  'approved',
  'reviewComment',
  'approvalComment',
  'decision',
]);

function nextBusinessKey(prefix = 'REQ') {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `${prefix}-${date}-${time}`;
}

function businessKeyPrefix(modelKey?: string) {
  if (!modelKey) return 'REQ';
  if (modelKey === 'collaborativeApproval') return 'REQ';
  const normalized = modelKey
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return normalized || 'REQ';
}

function schemaToStartFields(formSchema?: FormSchemaItem): StartFormField[] {
  return parseWorkflowFormFields(
    formSchema?.schemaJson,
    formSchema?.uiSchemaJson,
    {
      excludeKeys: taskDecisionFieldKeys,
    },
  );
}

function isStartProfileField(field: StartFormField) {
  return (
    field.widget === 'organizationProfile' ||
    isOrganizationProfileField(field.fieldKey, field.title)
  );
}

function isStartAssigneeField(field: StartFormField) {
  return (
    field.widget === 'organizationMember' ||
    isOrganizationAssigneeField(field.fieldKey, field.title)
  );
}

function isStartAssigneeMultiField(field: StartFormField) {
  return (
    field.widget === 'organizationMemberMulti' ||
    (field.type === 'array' &&
      isOrganizationAssigneeField(field.fieldKey, field.title))
  );
}

function defaultApprovalUsers(field: StartFormField) {
  if (!isStartAssigneeMultiField(field)) return undefined;
  const values = [
    organizationAssigneeFieldValue('managerApprover', undefined, '第一审批人'),
    organizationAssigneeFieldValue('financeApprover', undefined, '第二审批人'),
  ].filter(Boolean);
  return Array.from(new Set(values));
}

function approvalUserRules(field: StartFormField) {
  const rules: Array<{
    required?: boolean;
    message?: string;
    validator?: (_: unknown, value: unknown) => Promise<void>;
  }> = [];
  if (field.required) {
    rules.push({ required: true, message: `请选择${field.title}` });
  }
  if (field.fieldKey === 'approvalUsers') {
    rules.push({
      validator: async (_: unknown, value: unknown) => {
        const selected = Array.isArray(value) ? value.filter(Boolean) : [];
        if (selected.length >= 2) return;
        throw new Error('请选择至少两名审批人');
      },
    });
  }
  return rules;
}

function approvalFieldValues(field: StartFormField, values?: JsonRecord) {
  const rawValue = values?.[field.fieldKey];
  if (Array.isArray(rawValue)) return rawValue.map(String).filter(Boolean);
  if (typeof rawValue === 'string' && rawValue.trim()) return [rawValue.trim()];
  if (isStartAssigneeMultiField(field)) {
    return defaultApprovalUsers(field) || [];
  }
  const value = organizationAssigneeFieldValue(
    field.fieldKey,
    undefined,
    field.title,
  );
  return value ? [value] : [];
}

function selectedApprovalUsers(fields: StartFormField[], values?: JsonRecord) {
  const userIds = fields
    .filter(
      (field) =>
        isStartAssigneeField(field) || isStartAssigneeMultiField(field),
    )
    .flatMap((field) => approvalFieldValues(field, values));
  return Array.from(new Set(userIds));
}

const StartApprovalSummary: React.FC<{ fields: StartFormField[] }> = ({
  fields,
}) => {
  const approvalFields = fields.filter(
    (field) => isStartAssigneeField(field) || isStartAssigneeMultiField(field),
  );
  if (!approvalFields.length) return null;

  return (
    <ProFormDependency name={['formValues']}>
      {({ formValues }) => {
        const users = selectedApprovalUsers(
          approvalFields,
          formValues as JsonRecord,
        );
        if (!users.length) return null;
        return (
          <Alert
            showIcon
            type="info"
            title={users.length > 1 ? `并行审批 ${users.length} 人` : '审批人'}
            description={
              <Space size={[0, 6]} wrap>
                {users.map((userId) => (
                  <Tag key={userId} color="processing">
                    {organizationMemberName(userId)}
                  </Tag>
                ))}
              </Space>
            }
          />
        );
      }}
    </ProFormDependency>
  );
};

function formSchemaLabel(schema?: FormSchemaItem, version?: number) {
  if (!schema) return version ? `表单版本 v${version}` : '已绑定表单';
  return formSchemaOptionLabel(schema, version)
    .replace('（', ' ')
    .replace('）', '');
}

export function resolveStartEntryNotice(
  initialProcessModelId: string | undefined,
  startableWorkflows: StartableWorkflowItem[],
  canConfigureWorkflow: boolean,
): StartEntryNotice | undefined {
  const requestedWorkflowFound = initialProcessModelId
    ? startableWorkflows.some(
        (workflow) => workflow.processModelId === initialProcessModelId,
      )
    : true;

  if (startableWorkflows.length && requestedWorkflowFound) return undefined;

  return {
    title: initialProcessModelId ? '该流程暂不可发起' : '暂无可发起流程',
    actionText: canConfigureWorkflow ? '查看配置' : undefined,
    actionPath: canConfigureWorkflow ? '/process-models' : undefined,
  };
}

function useQueryProcessModelId() {
  const location = useLocation();
  return React.useMemo(() => {
    return (
      new URLSearchParams(location.search).get('processModelId') || undefined
    );
  }, [location.search]);
}

function normalizeStartVariables(values?: JsonRecord): JsonRecord {
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

const ProcessStartReadiness: React.FC<{
  workflow?: StartableWorkflowItem;
}> = ({ workflow }) => {
  const { styles } = useStyles();
  if (!workflow) return null;

  return (
    <Flex vertical gap={8} className={styles.startPreview}>
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Typography.Text strong>流程预览</Typography.Text>
        <Tag color="success" variant="outlined">
          业务表单：
          {formSchemaLabel(
            workflow.startFormSchema,
            workflow.startFormSchema.version,
          )}
        </Tag>
      </Flex>
      {workflow.bpmnXml ? (
        <ProcessDiagramViewer bpmnXml={workflow.bpmnXml} height={260} />
      ) : (
        <Empty description="暂无流程图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Flex>
  );
};

function renderCurrentTasks(record: OpsProcessInstance) {
  return (
    <ProcessContextSummary
      tasks={record.currentTasks}
      instanceStatus={record.status}
      emptyText="无待办"
    />
  );
}

function buildColumns(
  openPreview: (instance: OpsProcessInstance) => void,
): ProColumns<OpsProcessInstance>[] {
  return [
    {
      title: '业务对象',
      dataIndex: 'businessKey',
      width: 180,
      render: (_, record) => (
        <CopyableText
          value={record.businessKey || record.instanceId}
          displayValue={
            record.businessKey
              ? businessKeyLabel(record.businessKey)
              : shortTraceLabel(record.instanceId)
          }
        />
      ),
    },
    {
      title: '流程',
      dataIndex: 'processDefinitionId',
      ellipsis: true,
      renderText: (value) => processDefinitionLabel(value),
    },
    {
      title: '实例追踪',
      dataIndex: 'instanceId',
      width: 140,
      search: false,
      render: (_, record) => (
        <CopyableText
          value={record.instanceId}
          displayValue={shortTraceLabel(record.instanceId)}
        />
      ),
    },
    {
      title: '发起人',
      dataIndex: 'startUserId',
      width: 120,
      search: false,
      renderText: organizationMemberName,
    },
    {
      title: '流程位置',
      dataIndex: 'currentTasks',
      width: 260,
      search: false,
      render: (_, record) => renderCurrentTasks(record),
    },
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
      valueType: 'select',
      valueEnum: {
        RUNNING: { text: '运行中' },
        COMPLETED: { text: '已完成' },
        SUSPENDED: { text: '已挂起' },
        TERMINATED: { text: '已终止' },
      },
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      search: false,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            icon={<DeploymentUnitOutlined />}
            onClick={() => openPreview(record)}
          >
            流程
          </Button>
          <Button
            type="link"
            onClick={() =>
              history.push(`/process-instances/${record.instanceId}`)
            }
          >
            查看实例
          </Button>
        </Space>
      ),
    },
  ];
}

function buildStartVariables(
  values: StartInstanceForm,
  formSchema?: FormSchemaItem,
): JsonRecord {
  const formValues = normalizeStartVariables(values.formValues);
  const schemaFields = schemaToStartFields(formSchema);
  if (!schemaFields.length) return formValues;
  const valuesWithProfile = applyOrganizationProfileValues(
    schemaFields,
    formValues,
  ) as JsonRecord;
  const visibleFields = visibleWorkflowFormFields(
    schemaFields,
    valuesWithProfile,
  );
  return filterWorkflowFormValues(visibleFields, valuesWithProfile);
}

function startFieldRules(field: StartFormField, messagePrefix = '请输入') {
  return workflowFieldRules(field, messagePrefix);
}

function renderStartField(field: StartFormField, values?: JsonRecord) {
  if (!isWorkflowFieldVisible(field, values)) return null;

  const name = ['formValues', field.fieldKey];
  const readOnly = field.permission === 'readonly';
  const formItemProps = { preserve: false };

  if (isStartAssigneeMultiField(field)) {
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={defaultApprovalUsers(field)}
        options={organizationApprovalMemberSelectOptions()}
        placeholder="请选择一个或多个审批人"
        disabled={readOnly}
        fieldProps={{
          mode: 'multiple',
          showSearch: true,
          optionFilterProp: 'label',
        }}
        formItemProps={formItemProps}
        rules={approvalUserRules(field)}
      />
    );
  }

  if (isStartAssigneeField(field)) {
    return (
      <ProFormSelect
        key={field.fieldKey}
        name={name}
        label={field.title}
        initialValue={organizationAssigneeFieldValue(
          field.fieldKey,
          undefined,
          field.title,
        )}
        options={organizationMemberSelectOptions(
          organizationAssigneeRole(field.fieldKey, field.title),
        )}
        placeholder="请选择组织成员"
        disabled={readOnly}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
        }}
        formItemProps={formItemProps}
        rules={startFieldRules(field, '请选择')}
      />
    );
  }

  if (isStartProfileField(field)) {
    return (
      <OrganizationProfileFormItem
        key={field.fieldKey}
        name={name}
        label={field.title}
        value={organizationProfileFieldValue(
          field.fieldKey,
          undefined,
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
        placeholder={field.placeholder}
        fieldProps={{ disabled: readOnly, ...workflowNumberFieldProps(field) }}
        formItemProps={formItemProps}
        rules={startFieldRules(field)}
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
        disabled={readOnly}
        formItemProps={formItemProps}
        rules={startFieldRules(field, '请选择')}
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
        fieldProps={{ format: 'YYYY-MM-DD', disabled: readOnly }}
        formItemProps={formItemProps}
        rules={startFieldRules(field, '请选择')}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <ProFormSwitch
        key={field.fieldKey}
        name={name}
        label={field.title}
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
        placeholder={field.placeholder}
        fieldProps={{ rows: 3, disabled: readOnly }}
        formItemProps={formItemProps}
        rules={startFieldRules(field)}
      />
    );
  }

  return (
    <ProFormText
      key={field.fieldKey}
      name={name}
      label={field.title}
      placeholder={field.placeholder}
      fieldProps={{ disabled: readOnly }}
      formItemProps={formItemProps}
      rules={startFieldRules(field)}
    />
  );
}

const StartInstanceFields: React.FC<{
  initialProcessModelId?: string;
  startableWorkflows: StartableWorkflowItem[];
  canConfigureWorkflow?: boolean;
}> = ({ initialProcessModelId, startableWorkflows, canConfigureWorkflow }) => {
  const { styles } = useStyles();
  const form = Form.useFormInstance();
  const startEntryNotice = resolveStartEntryNotice(
    initialProcessModelId,
    startableWorkflows,
    Boolean(canConfigureWorkflow),
  );

  const setProcessContext = React.useCallback(
    (processDefinitionKey?: string, processModelId?: string) => {
      const workflow = startableWorkflows.find(
        (item) =>
          item.processDefinitionKey === processDefinitionKey ||
          item.processModelId === processModelId,
      );
      form.setFieldsValue({
        processDefinitionKey:
          workflow?.processDefinitionKey || processDefinitionKey,
        businessKey: nextBusinessKey(
          businessKeyPrefix(workflow?.processDefinitionKey),
        ),
        processModelId: workflow?.processModelId,
        processDefinitionId: workflow?.processDefinitionId,
        startFormSchemaId: workflow?.startFormSchema.id,
        formValues: {},
      });
    },
    [form, startableWorkflows],
  );

  React.useEffect(() => {
    if (initialProcessModelId && startableWorkflows.length) {
      const workflow = startableWorkflows.find(
        (item) => item.processModelId === initialProcessModelId,
      );
      if (workflow) {
        setProcessContext(
          workflow.processDefinitionKey,
          workflow.processModelId,
        );
        return;
      }
    }
    const processDefinitionKey = form.getFieldValue('processDefinitionKey');
    if (!processDefinitionKey && startableWorkflows.length === 1) {
      const workflow = startableWorkflows[0];
      setProcessContext(workflow.processDefinitionKey, workflow.processModelId);
      return;
    }
    if (processDefinitionKey && !form.getFieldValue('processModelId')) {
      setProcessContext(processDefinitionKey);
    }
  }, [form, initialProcessModelId, setProcessContext, startableWorkflows]);

  return (
    <>
      {startEntryNotice ? (
        <Alert
          showIcon
          type="warning"
          title={startEntryNotice.title}
          action={
            startEntryNotice.actionPath ? (
              <Button
                size="small"
                onClick={() => history.push(startEntryNotice.actionPath || '')}
              >
                {startEntryNotice.actionText}
              </Button>
            ) : undefined
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <div className={styles.startGrid}>
        <div className={styles.startMain}>
          <ProFormSelect
            name="processDefinitionKey"
            label="流程"
            disabled={!startableWorkflows.length}
            rules={[{ required: true, message: '请选择流程' }]}
            fieldProps={{
              showSearch: true,
              optionFilterProp: 'label',
              onChange: (value) => {
                setProcessContext(String(value));
              },
            }}
            options={startableWorkflows.map((item) => ({
              label: item.processName,
              value: item.processDefinitionKey,
            }))}
          />
          <ProFormText
            name="businessKey"
            label="业务编号"
            fieldProps={{ readOnly: true, allowClear: false }}
            rules={[{ required: true, message: '请输入业务编号' }]}
          />
          <ProFormText name="processModelId" hidden />
          <ProFormText name="processDefinitionId" hidden />
          <ProFormText name="startFormSchemaId" hidden />
          <ProFormDependency name={['processDefinitionKey']}>
            {({ processDefinitionKey }) => {
              if (!processDefinitionKey) {
                return <Alert showIcon type="info" title="选择流程" />;
              }

              return (
                <ProFormDependency name={['startFormSchemaId']}>
                  {({ startFormSchemaId }) => {
                    const formSchema = startableWorkflows.find(
                      (item) => item.startFormSchema.id === startFormSchemaId,
                    )?.startFormSchema;
                    const fields = schemaToStartFields(formSchema);
                    if (!fields.length) {
                      return (
                        <Alert
                          showIcon
                          type="warning"
                          title="当前表单没有可填写字段"
                        />
                      );
                    }
                    return (
                      <Flex vertical gap={4}>
                        {fields.map((field) => (
                          <ProFormDependency
                            key={field.fieldKey}
                            name={['formValues']}
                          >
                            {({ formValues }) =>
                              renderStartField(field, formValues as JsonRecord)
                            }
                          </ProFormDependency>
                        ))}
                      </Flex>
                    );
                  }}
                </ProFormDependency>
              );
            }}
          </ProFormDependency>
        </div>
        <div className={styles.startAside}>
          <ProFormDependency name={['processModelId', 'startFormSchemaId']}>
            {({ processModelId, startFormSchemaId }) => {
              const selectedWorkflow = startableWorkflows.find(
                (item) =>
                  item.processModelId === processModelId ||
                  item.startFormSchema.id === startFormSchemaId,
              );
              const fields = schemaToStartFields(
                selectedWorkflow?.startFormSchema,
              );
              return (
                <>
                  <ProcessStartReadiness workflow={selectedWorkflow} />
                  <StartApprovalSummary fields={fields} />
                </>
              );
            }}
          </ProFormDependency>
        </div>
      </div>
    </>
  );
};

const ProcessInstances: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const queryProcessModelId = useQueryProcessModelId();
  const isStartEntry = location.pathname === '/process-start';
  const session = getSessionContext();
  const canStartProcess =
    session.permissions?.canStartProcess ?? session.role === 'applicant';
  const canConfigureWorkflow =
    session.permissions?.canConfigureWorkflow ?? session.role === 'admin';
  const { data: startableWorkflows = [] } = useQuery({
    queryKey: ['startable-workflows'],
    queryFn: listStartableWorkflows,
    enabled: isStartEntry || Boolean(queryProcessModelId),
  });

  const [previewTarget, setPreviewTarget] =
    React.useState<ProcessPreviewTarget>();
  const previewTrace = useQuery({
    queryKey: ['process-instance-list-trace', previewTarget?.instanceId],
    queryFn: () => getOpsProcessTrace(previewTarget?.instanceId || ''),
    enabled: Boolean(previewTarget?.instanceId),
  });
  const openPreview = React.useCallback((instance: OpsProcessInstance) => {
    setPreviewTarget({
      instanceId: instance.instanceId,
      title: instance.businessKey
        ? businessKeyLabel(instance.businessKey)
        : shortTraceLabel(instance.instanceId),
      currentTasks: instance.currentTasks,
    });
  }, []);

  const columns = React.useMemo(() => buildColumns(openPreview), [openPreview]);
  const emptyActions = [
    canStartProcess ? (
      <Button
        key="start"
        type="primary"
        icon={<PlayCircleOutlined />}
        onClick={() => history.push('/process-start')}
      >
        发起流程
      </Button>
    ) : null,
    canConfigureWorkflow ? (
      <Button
        key="create-model"
        onClick={() => history.push('/process-models')}
      >
        创建流程模型
      </Button>
    ) : null,
  ].filter(Boolean);

  if (isStartEntry || queryProcessModelId) {
    return (
      <PageContainer title="发起流程">
        <ProCard>
          <ProForm<StartInstanceForm>
            submitter={{
              searchConfig: {
                submitText: '提交发起',
                resetText: '重置',
              },
            }}
            onFinish={async (values) => {
              if (!values.startFormSchemaId) {
                message.warning('当前流程暂不可发起');
                return false;
              }
              const startFormSchema = startableWorkflows.find(
                (item) =>
                  item.startFormSchema.id === values.startFormSchemaId ||
                  item.processModelId === values.processModelId ||
                  item.processDefinitionKey === values.processDefinitionKey,
              )?.startFormSchema;
              const formData = buildStartVariables(values, startFormSchema);
              const instance = await startProcessInstance({
                processDefinitionKey: values.processDefinitionKey,
                businessKey: values.businessKey,
                variables: formData,
                formSchemaId: values.startFormSchemaId,
                formSchemaVersion: startFormSchema?.version,
                formData,
              });
              message.success('已发起');
              history.push(`/process-instances/${instance.instanceId}`);
              return true;
            }}
          >
            <StartInstanceFields
              initialProcessModelId={queryProcessModelId}
              startableWorkflows={startableWorkflows}
              canConfigureWorkflow={canConfigureWorkflow}
            />
          </ProForm>
        </ProCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="流程实例">
      <ProTable<OpsProcessInstance>
        rowKey="instanceId"
        columns={columns}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        scroll={{ x: 1120 }}
        request={async (params) => {
          const keyword = String(
            params.instanceId ||
              params.processDefinitionId ||
              params.businessKey ||
              params.startUserId ||
              '',
          ).trim();
          const result = await listOpsInstances({
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
            keyword: keyword || undefined,
            status: String(params.status || '').trim() || undefined,
          });
          return { data: result.items, total: result.total, success: true };
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无流程实例"
            >
              <Flex gap={8} justify="center" wrap>
                {emptyActions}
              </Flex>
            </Empty>
          ),
        }}
        toolBarRender={() =>
          canStartProcess
            ? [
                <Button
                  key="start"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => history.push('/process-start')}
                >
                  发起流程
                </Button>,
              ]
            : []
        }
      />
      <KoravoDrawer
        title={previewTarget?.title || '流程预览'}
        size={980}
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(undefined)}
      >
        <ProcessProgressCard
          loading={previewTrace.isFetching}
          trace={previewTrace.data}
          currentUserId={session.userId}
          currentTasks={
            previewTrace.data?.currentTasks?.length
              ? previewTrace.data.currentTasks
              : previewTarget?.currentTasks
          }
        />
      </KoravoDrawer>
    </PageContainer>
  );
};

export default ProcessInstances;
