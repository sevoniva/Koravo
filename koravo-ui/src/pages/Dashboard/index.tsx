import {
  CheckCircleOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  FormOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Flex, Statistic, Steps } from 'antd';
import React, { useMemo } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getDashboardSummary,
  type AuditLogItem,
} from '@/services/koravo/api';
import {
  organizationMemberName,
  tenantDisplayName,
} from '@/services/koravo/organization';
import {
  auditActionLabel,
  auditResourceLabel,
  shortTraceLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface WorkloadRow {
  key: string;
  name: string;
  total: number;
  status: string;
  path: string;
}

interface WorkflowStep {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

const workflowSteps: WorkflowStep[] = [
  {
    title: '创建流程模型',
    description: '新建模型、导入 BPMN、设计审批节点',
    path: '/process-designer',
    icon: <EditOutlined />,
  },
  {
    title: '配置业务表单',
    description: '维护业务字段和控件',
    path: '/forms',
    icon: <FormOutlined />,
  },
  {
    title: '绑定任务节点',
    description: '把表单绑定到审批任务',
    path: '/form-bindings',
    icon: <LinkOutlined />,
  },
  {
    title: '校验并部署',
    description: '确认流程和表单后发布定义',
    path: '/process-models',
    icon: <DeploymentUnitOutlined />,
  },
  {
    title: '发起实例',
    description: '提交业务单据并跟踪处理',
    path: '/process-instances',
    icon: <PlayCircleOutlined />,
  },
];

const workloadColumns: ProColumns<WorkloadRow>[] = [
  { title: '队列类型', dataIndex: 'name' },
  { title: '数量', dataIndex: 'total', width: 120, search: false },
  {
    title: '状态',
    dataIndex: 'status',
    width: 120,
    search: false,
    render: (_, record) => <KoravoStatusTag status={record.status} />,
  },
  {
    title: '操作',
    valueType: 'option',
    width: 96,
    render: (_, record) => (
      <Button type="link" onClick={() => history.push(record.path)}>
        查看
      </Button>
    ),
  },
];

const auditColumns: ProColumns<AuditLogItem>[] = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    width: 160,
    renderText: (value) => formatDateTime(value),
  },
  {
    title: '操作人',
    dataIndex: 'userId',
    width: 120,
    renderText: organizationMemberName,
  },
  {
    title: '操作类型',
    dataIndex: 'action',
    width: 140,
    renderText: (value) => auditActionLabel(value),
  },
  {
    title: '对象类型',
    dataIndex: 'resourceType',
    width: 140,
    renderText: (value) => auditResourceLabel(value),
  },
  {
    title: '追踪号',
    dataIndex: 'requestId',
    width: 160,
    render: (_, record) => (
      <CopyableText
        value={record.requestId}
        displayValue={shortTraceLabel(record.requestId)}
      />
    ),
  },
];

const Dashboard: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  const workloadRows = useMemo<WorkloadRow[]>(
    () => [
      {
        key: 'todo',
        name: '我的待办',
        total: data?.myTodoCount ?? 0,
        status: (data?.myTodoCount ?? 0) > 0 ? 'PENDING' : 'READY',
        path: '/tasks',
      },
      {
        key: 'running',
        name: '运行实例',
        total: data?.runningInstanceCount ?? 0,
        status: (data?.runningInstanceCount ?? 0) > 0 ? 'RUNNING' : 'READY',
        path: '/process-instances',
      },
      {
        key: 'failed',
        name: '失败任务',
        total: (data?.failedJobCount ?? 0) + (data?.deadLetterJobCount ?? 0),
        status:
          (data?.failedJobCount ?? 0) + (data?.deadLetterJobCount ?? 0) > 0
            ? 'FAILED'
            : 'READY',
        path: '/ops',
      },
      {
        key: 'connector',
        name: '连接器失败',
        total: data?.connectorFailedCount ?? 0,
        status: (data?.connectorFailedCount ?? 0) > 0 ? 'FAILED' : 'READY',
        path: '/http-connector',
      },
    ],
    [data],
  );

  return (
    <PageContainer
      title="总览"
      content="流程模型、运行实例、待办任务和异常状态。"
      extra={
        <Flex wrap gap={8}>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => history.push('/process-designer')}
          >
            创建流程
          </Button>
          <Button
            icon={<DeploymentUnitOutlined />}
            onClick={() => history.push('/process-models')}
          >
            流程模型
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => history.push('/process-instances')}
          >
            发起实例
          </Button>
        </Flex>
      }
    >
      {isError && (
        <Alert
          type="warning"
          showIcon
          title="摘要加载失败"
          description="请确认 koravo-server 已启动，并检查当前组织和办理人上下文。"
          style={{ marginBottom: 16 }}
        />
      )}

      <ProCard
        title="流程搭建路径"
        extra={
          <Flex wrap gap={8}>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => history.push('/process-designer')}
            >
              创建流程模型
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => history.push('/tasks')}
            >
              处理待办
            </Button>
          </Flex>
        }
        style={{ marginBottom: 16 }}
      >
        <Steps
          responsive
          items={workflowSteps.map((step) => ({
            title: step.title,
            content: step.description,
            icon: step.icon,
          }))}
          onChange={(current) => history.push(workflowSteps[current].path)}
        />
      </ProCard>

      <ProCard gutter={16} loading={isLoading} wrap>
        <ProCard colSpan={{ xs: 24, sm: 12, xl: 6 }}>
          <Statistic title="服务状态" value={data?.healthStatus || '-'} />
          <KoravoStatusTag status={data?.healthStatus} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, xl: 6 }}>
          <Statistic title="流程模型" value={data?.processModelCount ?? 0} />
          <span>已部署 {data?.deployedProcessModelCount ?? 0}</span>
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, xl: 6 }}>
          <Statistic title="运行实例" value={data?.runningInstanceCount ?? 0} />
          <span>{tenantDisplayName(data?.tenantId)}</span>
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, xl: 6 }}>
          <Statistic
            title="HTTP 调用"
            value={data?.connectorSuccessCount ?? 0}
          />
          <span>失败 {data?.connectorFailedCount ?? 0}</span>
        </ProCard>
      </ProCard>

      <ProCard gutter={16} style={{ marginTop: 16 }} wrap>
        <ProCard title="任务与运行" colSpan={{ xs: 24, xl: 16 }}>
          <ProTable<WorkloadRow>
            rowKey="key"
            search={false}
            options={false}
            pagination={false}
            columns={workloadColumns}
            dataSource={workloadRows}
          />
        </ProCard>
        <ProCard title="运行概览" colSpan={{ xs: 24, xl: 8 }}>
          <Flex vertical gap={12}>
            <span>平台版本：{data?.version || '-'}</span>
            <span>组织：{tenantDisplayName(data?.tenantId)}</span>
            <span>办理人：{organizationMemberName(data?.userId)}</span>
            <span>系统时间：{formatDateTime(data?.time)}</span>
            <span>
              连接器成功率：
              {data?.connectorSummary?.total
                ? `${Math.round(
                    ((data.connectorSummary.success || 0) /
                      data.connectorSummary.total) *
                      100,
                  )}%`
                : '-'}
            </span>
          </Flex>
        </ProCard>
      </ProCard>

      <ProCard title="最近操作" style={{ marginTop: 16 }}>
        <ProTable<AuditLogItem>
          rowKey="id"
          search={false}
          options={false}
          pagination={false}
          columns={auditColumns}
          dataSource={data?.recentAuditLogs || []}
        />
      </ProCard>
    </PageContainer>
  );
};

export default Dashboard;
