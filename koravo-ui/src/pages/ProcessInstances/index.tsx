import { PlayCircleOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, Form, message } from 'antd';
import React from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  listOpsInstances,
  listProcessModels,
  startProcessInstance,
  type JsonRecord,
  type OpsProcessInstance,
} from '@/services/koravo/api';
import { processDefinitionLabel, processDisplayName } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface StartInstanceForm {
  processDefinitionKey: string;
  businessKey: string;
  variables?: string;
  applicant?: string;
  department?: string;
  itemName?: string;
  amount?: number;
  reason?: string;
  managerApprover?: string;
  financeApprover?: string;
}

function nextPurchaseBusinessKey() {
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
  return `PO-${date}-${time}`;
}

function purchaseDefaultValues() {
  return {
    processDefinitionKey: 'purchaseApproval',
    businessKey: nextPurchaseBusinessKey(),
    applicant: '张三',
    department: '研发部',
    itemName: '测试环境服务器',
    amount: 12000,
    reason: '用于流程集成测试和性能验证',
    managerApprover: 'manager',
    financeApprover: 'finance',
  };
}

const columns: ProColumns<OpsProcessInstance>[] = [
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
    title: '当前任务',
    dataIndex: 'currentTasks',
    width: 120,
    search: false,
    renderText: (_, record) => record.currentTasks?.length ?? 0,
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

function parseVariables(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    return JSON.parse(value) as JsonRecord;
  } catch {
    throw new Error('变量必须是合法 JSON');
  }
}

function buildStartVariables(values: StartInstanceForm): JsonRecord {
  if (values.processDefinitionKey !== 'purchaseApproval') {
    return parseVariables(values.variables);
  }

  return {
    applicant: values.applicant,
    department: values.department,
    itemName: values.itemName,
    amount: values.amount,
    reason: values.reason,
    managerApprover: values.managerApprover,
    financeApprover: values.financeApprover,
  };
}

const StartInstanceFields: React.FC = () => {
  const form = Form.useFormInstance();

  React.useEffect(() => {
    if (form.getFieldValue('processDefinitionKey') === 'purchaseApproval') {
      form.setFieldsValue(purchaseDefaultValues());
    }
  }, [form]);

  return (
    <>
      <ProFormSelect
        name="processDefinitionKey"
        label="流程"
        rules={[{ required: true, message: '请选择流程' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: (value) => {
            if (value === 'purchaseApproval') {
              form.setFieldsValue(purchaseDefaultValues());
            }
          },
        }}
        request={async () =>
          (await listProcessModels('DEPLOYED')).map((item) => ({
            label: `${processDisplayName(item.modelKey, item.modelName)}（${item.modelKey}）`,
            value: item.modelKey,
          }))
        }
      />
      <ProFormText
        name="businessKey"
        label="业务标识"
        rules={[{ required: true, message: '请输入业务标识' }]}
      />
      <ProFormDependency name={['processDefinitionKey']}>
        {({ processDefinitionKey }) =>
          processDefinitionKey === 'purchaseApproval' ? (
            <>
              <Alert
                showIcon
                type="info"
                title="采购申请会同时生成部门审批和财务审批两个待办。"
                style={{ marginBottom: 16 }}
              />
              <ProFormText
                name="applicant"
                label="申请人"
                rules={[{ required: true, message: '请输入申请人' }]}
              />
              <ProFormText
                name="department"
                label="申请部门"
                rules={[{ required: true, message: '请输入申请部门' }]}
              />
              <ProFormText
                name="itemName"
                label="采购事项"
                rules={[{ required: true, message: '请输入采购事项' }]}
              />
              <ProFormDigit
                name="amount"
                label="采购金额"
                min={0.01}
                fieldProps={{ precision: 2, suffix: '元' }}
                rules={[{ required: true, message: '请输入采购金额' }]}
              />
              <ProFormTextArea
                name="reason"
                label="申请事由"
                fieldProps={{ rows: 3 }}
                rules={[{ required: true, message: '请输入申请事由' }]}
              />
              <ProFormText
                name="managerApprover"
                label="部门审批人"
                rules={[{ required: true, message: '请输入部门审批人' }]}
              />
              <ProFormText
                name="financeApprover"
                label="财务审批人"
                rules={[{ required: true, message: '请输入财务审批人' }]}
              />
            </>
          ) : (
            <ProFormTextArea
              name="variables"
              label="变量"
              fieldProps={{ rows: 8 }}
              placeholder='{"approver":"admin"}'
            />
          )
        }
      </ProFormDependency>
    </>
  );
};

const ProcessInstances: React.FC = () => {
  return (
    <PageContainer title="流程实例" content="启动流程并跟踪运行中的实例。">
      <ProTable<OpsProcessInstance>
        rowKey="instanceId"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        scroll={{ x: 1120 }}
        request={async (params) => {
          const result = await listOpsInstances({
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
        toolBarRender={(action) => [
          <ModalForm<StartInstanceForm>
            key="start"
            title="启动流程实例"
            trigger={
              <Button type="primary" icon={<PlayCircleOutlined />}>
                启动流程
              </Button>
            }
            initialValues={{ processDefinitionKey: 'purchaseApproval' }}
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              const instance = await startProcessInstance({
                processDefinitionKey: values.processDefinitionKey,
                businessKey: values.businessKey,
                variables: buildStartVariables(values),
              });
              message.success('已启动');
              action?.reload();
              history.push(`/process-instances/${instance.instanceId}`);
              return true;
            }}
          >
            <StartInstanceFields />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
};

export default ProcessInstances;
