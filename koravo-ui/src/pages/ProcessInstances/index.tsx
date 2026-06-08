import { PlayCircleOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, message } from 'antd';
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
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await startProcessInstance({
                processDefinitionKey: values.processDefinitionKey,
                businessKey: values.businessKey,
                variables: parseVariables(values.variables),
              });
              message.success('已启动');
              action?.reload();
              return true;
            }}
          >
            <ProFormSelect
              name="processDefinitionKey"
              label="流程"
              rules={[{ required: true, message: '请选择流程' }]}
              request={async () =>
                (await listProcessModels('DEPLOYED')).map((item) => ({
                  label: processDisplayName(item.modelKey, item.modelName),
                  value: item.modelKey,
                }))
              }
            />
            <ProFormText
              name="businessKey"
              label="业务标识"
              rules={[{ required: true, message: '请输入业务标识' }]}
            />
            <ProFormTextArea
              name="variables"
              label="变量"
              fieldProps={{ rows: 8 }}
              placeholder='{"applicant":"张三","department":"研发部","itemName":"测试环境服务器","amount":12000,"reason":"用于流程集成测试和性能验证","managerApprover":"admin","financeApprover":"admin"}'
            />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  );
};

export default ProcessInstances;
