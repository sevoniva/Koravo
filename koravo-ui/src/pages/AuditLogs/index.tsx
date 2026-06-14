import {
  PageContainer,
  type ProColumns,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import { Alert, Button, Empty, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import KoravoDrawer from '@/components/KoravoDrawer';
import ProcessProgressCard from '@/components/ProcessProgressCard';
import StructuredDetailTable from '@/components/StructuredDetailTable';
import {
  type AuditLogItem,
  getProcessTrace,
  listAuditLogs,
} from '@/services/koravo/api';
import {
  organizationMemberName,
  organizationMemberSelectOptions,
  tenantDisplayName,
} from '@/services/koravo/organization';
import {
  getSessionContext,
  type SessionContext,
} from '@/services/koravo/session';
import {
  auditActionLabel,
  auditResourceLabel,
  businessKeyLabel,
  processNameLabel,
  shortTraceLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

export const actionOptions = {
  AUTH_LOGIN: { text: '登录系统' },
  AUTH_LOGOUT: { text: '退出登录' },
  ACCESS_DENIED: { text: '拦截接口访问' },
  WORKFLOW_ENABLEMENT_INIT: { text: '维护流程配置' },
  PROCESS_MODEL_CREATE: { text: '创建流程模型' },
  PROCESS_MODEL_IMPORT: { text: '导入流程模型' },
  PROCESS_MODEL_UPDATE: { text: '更新流程模型' },
  PROCESS_MODEL_DEPLOY: { text: '发布流程模型' },
  PROCESS_MODEL_DISABLE: { text: '停用流程模型' },
  PROCESS_MODEL_ARCHIVE: { text: '归档流程模型' },
  PROCESS_INSTANCE_START: { text: '发起流程实例' },
  PROCESS_INSTANCE_SUSPEND: { text: '挂起流程实例' },
  PROCESS_INSTANCE_ACTIVATE: { text: '激活流程实例' },
  PROCESS_INSTANCE_TERMINATE: { text: '终止流程实例' },
  TASK_COMPLETE: { text: '完成任务' },
  TASK_TRANSFER: { text: '转交任务' },
  TASK_DELEGATE: { text: '委托任务' },
  TASK_CLAIM: { text: '认领任务' },
  FORM_SCHEMA_CREATE: { text: '创建表单' },
  FORM_SCHEMA_UPDATE: { text: '更新表单' },
  FORM_SCHEMA_RESTORE_VERSION: { text: '恢复表单版本' },
  FORM_SCHEMA_ACTIVATE: { text: '启用表单' },
  FORM_SCHEMA_DISABLE: { text: '停用表单' },
  FORM_BIND: { text: '绑定表单' },
  FORM_BIND_UPDATE: { text: '更新表单绑定' },
  FORM_BIND_DELETE: { text: '删除表单绑定' },
  ORG_MEMBER_CREATE: { text: '创建成员' },
  ORG_MEMBER_UPDATE: { text: '更新成员' },
  ORG_MEMBER_ENABLE: { text: '启用成员' },
  ORG_MEMBER_DISABLE: { text: '停用成员' },
  ORG_MEMBER_PASSWORD_RESET: { text: '重置成员密码' },
  DATASOURCE_CREATE: { text: '创建数据源' },
  DATASOURCE_UPDATE: { text: '更新数据源' },
  DATASOURCE_DELETE: { text: '删除数据源' },
  DATASOURCE_TEST: { text: '检测数据源连接' },
  FAILED_JOB_RETRY: { text: '重试失败任务' },
  FAILED_JOB_DELETE: { text: '删除失败任务' },
  DEAD_LETTER_JOB_RETRY: { text: '重试死信任务' },
  DEAD_LETTER_JOB_DELETE: { text: '删除死信任务' },
  CONNECTOR_EXECUTE: { text: '执行连接器' },
  CONNECTOR_RETRY: { text: '重试连接器' },
};

const resourceOptions = {
  LOGIN_SESSION: { text: '登录会话' },
  API_ENDPOINT: { text: '接口' },
  WORKFLOW_ENABLEMENT: { text: '流程配置' },
  PROCESS_MODEL: { text: '流程模型' },
  PROCESS_INSTANCE: { text: '流程实例' },
  TASK: { text: '任务' },
  FORM_SCHEMA: { text: '表单' },
  FORM_BINDING: { text: '表单绑定' },
  ORGANIZATION_MEMBER: { text: '组织成员' },
  DATASOURCE: { text: '数据源' },
  DATASOURCE_TEST_LOG: { text: '数据源检测记录' },
  FAILED_JOB: { text: '失败任务' },
  DEAD_LETTER_JOB: { text: '死信任务' },
  CONNECTOR_EXECUTION: { text: '连接器执行' },
};

function auditDetailRecord(log?: AuditLogItem) {
  return maskSecret(
    parseJsonSafe<Record<string, unknown>>(log?.detailJson, {}),
  ) as Record<string, unknown>;
}

export function auditProcessInstanceId(log?: AuditLogItem) {
  const detail = auditDetailRecord(log);
  if (typeof detail.processInstanceId === 'string')
    return detail.processInstanceId;
  if (log?.resourceType === 'PROCESS_INSTANCE') return log.resourceId;
  return undefined;
}

function auditProcessModelId(log?: AuditLogItem) {
  const detail = auditDetailRecord(log);
  if (typeof detail.processModelId === 'string') return detail.processModelId;
  if (log?.resourceType === 'PROCESS_MODEL') return log.resourceId;
  return undefined;
}

function auditResourceName(value: unknown) {
  if (typeof value !== 'string') return '';
  const text = processNameLabel(businessKeyLabel(value));
  if (/^[a-f0-9]{16,}$/i.test(text) || /^[0-9a-f-]{24,}$/i.test(text)) {
    return '';
  }
  return text;
}

interface AuditRelatedAccess {
  canOpenProcessInstance: boolean;
  canConfigureWorkflow: boolean;
  canManageIntegration: boolean;
  canOperateSystem: boolean;
}

export function auditCanOpenProcessContext(
  session: Pick<SessionContext, 'role' | 'permissions'>,
) {
  if (session.permissions) {
    return Boolean(
      session.permissions.canViewProcessContext ||
        session.permissions.canViewAudit ||
        session.permissions.canConfigureWorkflow ||
        session.permissions.canOperateSystem ||
        session.permissions.canAdmin,
    );
  }
  return ['applicant', 'manager', 'finance', 'operator'].includes(session.role);
}

function auditRelatedAccess(): AuditRelatedAccess {
  const session = getSessionContext();
  return {
    canOpenProcessInstance: auditCanOpenProcessContext(session),
    canConfigureWorkflow:
      session.permissions?.canConfigureWorkflow ?? session.role === 'admin',
    canManageIntegration:
      session.permissions?.canManageIntegration ?? session.role === 'admin',
    canOperateSystem:
      session.permissions?.canOperateSystem ?? session.role === 'operator',
  };
}

function auditRelatedButtons(
  log?: AuditLogItem,
  access = auditRelatedAccess(),
) {
  const processInstanceId = auditProcessInstanceId(log);
  const processModelId = auditProcessModelId(log);
  const actions: React.ReactNode[] = [];

  if (processInstanceId && access.canOpenProcessInstance) {
    actions.push(
      <Button
        key="instance"
        type="link"
        onClick={() => history.push(`/process-instances/${processInstanceId}`)}
      >
        查看流程实例
      </Button>,
    );
  }
  if (processModelId && access.canConfigureWorkflow) {
    actions.push(
      <Button
        key="model"
        type="link"
        onClick={() =>
          history.push(`/process-designer?modelId=${processModelId}`)
        }
      >
        查看流程设计
      </Button>,
    );
  }
  if (log?.resourceType === 'FORM_SCHEMA' && access.canConfigureWorkflow) {
    actions.push(
      <Button key="form" type="link" onClick={() => history.push('/forms')}>
        查看表单
      </Button>,
    );
  }
  if (log?.resourceType === 'FORM_BINDING' && access.canConfigureWorkflow) {
    actions.push(
      <Button
        key="binding"
        type="link"
        onClick={() =>
          history.push(
            processModelId
              ? `/form-bindings?processModelId=${processModelId}`
              : '/form-bindings',
          )
        }
      >
        查看表单绑定
      </Button>,
    );
  }
  if (log?.resourceType === 'DATASOURCE' && access.canManageIntegration) {
    actions.push(
      <Button
        key="datasource"
        type="link"
        onClick={() => history.push('/datasources')}
      >
        查看数据源
      </Button>,
    );
  }
  if (
    log?.resourceType === 'CONNECTOR_EXECUTION' &&
    access.canManageIntegration
  ) {
    actions.push(
      <Button
        key="connector"
        type="link"
        onClick={() =>
          history.push(
            log.resourceId
              ? `/ops?tab=connector-failures&connectorLogId=${encodeURIComponent(log.resourceId)}`
              : log.requestId
                ? `/http-connector?requestId=${encodeURIComponent(log.requestId)}`
                : '/http-connector',
          )
        }
      >
        查看连接器记录
      </Button>,
    );
  }
  if (
    log?.resourceType === 'FAILED_JOB' &&
    log.resourceId &&
    access.canOperateSystem
  ) {
    const jobId = log.resourceId;
    actions.push(
      <Button
        key="failed-job"
        type="link"
        onClick={() =>
          history.push(
            `/ops?tab=failed&jobKind=failed&jobId=${encodeURIComponent(jobId)}`,
          )
        }
      >
        查看异常任务
      </Button>,
    );
  }
  if (
    log?.resourceType === 'DEAD_LETTER_JOB' &&
    log.resourceId &&
    access.canOperateSystem
  ) {
    const jobId = log.resourceId;
    actions.push(
      <Button
        key="dead-letter-job"
        type="link"
        onClick={() =>
          history.push(
            `/ops?tab=dead-letter&jobKind=dead-letter&jobId=${encodeURIComponent(jobId)}`,
          )
        }
      >
        查看异常任务
      </Button>,
    );
  }

  return actions;
}

function auditResourceText(log?: AuditLogItem) {
  if (!log?.resourceId) return '-';
  const detail = auditDetailRecord(log);
  const resourceType = String(log.resourceType || '');
  const nameCandidates = [
    detail.modelName,
    detail.formName,
    detail.name,
    typeof detail.businessKey === 'string'
      ? businessKeyLabel(detail.businessKey)
      : undefined,
    detail.taskName,
  ]
    .map(auditResourceName)
    .filter(Boolean);
  const resourceName = nameCandidates[0];
  const prefix = auditResourceLabel(resourceType);
  return resourceName
    ? `${prefix}：${resourceName}`
    : `${prefix}：${auditResourceName(log.resourceId) || shortTraceLabel(log.resourceId)}`;
}

const AuditRelatedActions: React.FC<{ log?: AuditLogItem }> = ({ log }) => {
  const actions = auditRelatedButtons(log);

  if (!actions.length) return null;

  return <Space wrap>{actions}</Space>;
};

const AuditProcessContext: React.FC<{ log?: AuditLogItem }> = ({ log }) => {
  const processInstanceId = auditProcessInstanceId(log);
  const access = auditRelatedAccess();
  const session = getSessionContext();
  const trace = useQuery({
    queryKey: ['audit-process-trace', processInstanceId],
    queryFn: () => getProcessTrace(processInstanceId || ''),
    enabled: Boolean(processInstanceId && access.canOpenProcessInstance),
  });

  if (!processInstanceId || !access.canOpenProcessInstance) return null;

  if (trace.isError) {
    return (
      <Alert
        showIcon
        type="warning"
        title="流程上下文读取失败"
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <ProcessProgressCard
      trace={trace.data}
      loading={trace.isLoading}
      currentUserId={session.userId}
    />
  );
};

const AuditLogs: React.FC = () => {
  const [detail, setDetail] = useState<AuditLogItem>();
  const location = useLocation();
  const query = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return {
      requestId: searchParams.get('requestId') || undefined,
      resourceId: searchParams.get('resourceId') || undefined,
    };
  }, [location.search]);
  const contextFilterDescription = query.requestId
    ? `追踪号：${shortTraceLabel(query.requestId)}`
    : `业务对象：${shortTraceLabel(query.resourceId)}`;

  const columns: ProColumns<AuditLogItem>[] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      search: false,
      renderText: (value) => formatDateTime(value),
    },
    {
      title: '操作人',
      dataIndex: 'userId',
      width: 120,
      valueType: 'select',
      fieldProps: {
        options: organizationMemberSelectOptions(),
        showSearch: true,
        optionFilterProp: 'label',
      },
      renderText: organizationMemberName,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 150,
      valueType: 'select',
      valueEnum: actionOptions,
      renderText: (value) => auditActionLabel(value),
    },
    {
      title: '对象类型',
      dataIndex: 'resourceType',
      width: 150,
      valueType: 'select',
      valueEnum: resourceOptions,
      renderText: (value) => auditResourceLabel(value),
    },
    {
      title: '业务对象',
      dataIndex: 'resourceId',
      ellipsis: true,
      render: (_, record) => (
        <Space wrap>
          <CopyableText
            value={record.resourceId}
            displayValue={auditResourceText(record)}
          />
          <AuditRelatedActions log={record} />
        </Space>
      ),
    },
    {
      title: '业务追踪号',
      dataIndex: 'requestId',
      width: 170,
      render: (_, record) => (
        <CopyableText
          value={record.requestId}
          displayValue={shortTraceLabel(record.requestId)}
        />
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 96,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" onClick={() => setDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <PageContainer title="审计日志">
      {query.requestId || query.resourceId ? (
        <Alert
          showIcon
          type="info"
          title="已筛选"
          description={contextFilterDescription}
          action={
            <Button size="small" onClick={() => history.push('/audit-logs')}>
              清除筛选
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProTable<AuditLogItem>
        rowKey="id"
        columns={columns}
        scroll={{ x: 1200 }}
        search={{ labelWidth: 88, span: 6, defaultCollapsed: false }}
        locale={{
          emptyText: (
            <Empty
              description="暂无审计记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        params={{ requestId: query.requestId, resourceId: query.resourceId }}
        request={async (params) => {
          const result = await listAuditLogs({
            userId: params.userId as string | undefined,
            action: params.action as string | undefined,
            resourceType: params.resourceType as string | undefined,
            resourceId:
              (params.resourceId as string | undefined) || query.resourceId,
            requestId:
              (params.requestId as string | undefined) || query.requestId,
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
      />

      <KoravoDrawer
        title="审计详情"
        size={720}
        extra={<AuditRelatedActions log={detail} />}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
      >
        <AuditProcessContext log={detail} />
        <ProDescriptions<AuditLogItem>
          column={1}
          dataSource={detail}
          columns={[
            {
              title: '组织',
              dataIndex: 'tenantId',
              renderText: tenantDisplayName,
            },
            {
              title: '操作人',
              dataIndex: 'userId',
              renderText: organizationMemberName,
            },
            {
              title: '操作类型',
              dataIndex: 'action',
              renderText: auditActionLabel,
            },
            {
              title: '对象类型',
              dataIndex: 'resourceType',
              renderText: auditResourceLabel,
            },
            {
              title: '业务对象',
              dataIndex: 'resourceId',
              render: (_, record) => (
                <CopyableText
                  value={record.resourceId}
                  displayValue={auditResourceText(record)}
                />
              ),
            },
            {
              title: '业务追踪号',
              dataIndex: 'requestId',
              render: (_, record) => (
                <CopyableText
                  value={record.requestId}
                  displayValue={shortTraceLabel(record.requestId)}
                />
              ),
            },
            { title: '客户端 IP', dataIndex: 'clientIp' },
            {
              title: '时间',
              dataIndex: 'createdAt',
              renderText: formatDateTime,
            },
          ]}
        />
        <Typography.Title level={5}>操作明细</Typography.Title>
        <StructuredDetailTable
          value={auditDetailRecord(detail)}
          emptyText="暂无操作明细"
        />
      </KoravoDrawer>
    </PageContainer>
  );
};

export default AuditLogs;
