import {
  PageContainer,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Alert, Button, Drawer, Empty, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import StructuredDetailTable from '@/components/StructuredDetailTable';
import {
  listAuditLogs,
  type AuditLogItem,
} from '@/services/koravo/api';
import {
  auditActionLabel,
  auditResourceLabel,
  shortTraceLabel,
} from '@/utils/display';
import { formatDateTime, maskSecret, parseJsonSafe } from '@/utils/format';

const actionOptions = {
  WORKFLOW_ENABLEMENT_INIT: { text: '补齐流程资产' },
  PROCESS_MODEL_CREATE: { text: '创建流程模型' },
  PROCESS_MODEL_IMPORT: { text: '导入流程模型' },
  PROCESS_MODEL_UPDATE: { text: '更新流程模型' },
  PROCESS_MODEL_DEPLOY: { text: '部署流程模型' },
  PROCESS_MODEL_DISABLE: { text: '停用流程模型' },
  PROCESS_MODEL_ARCHIVE: { text: '归档流程模型' },
  PROCESS_INSTANCE_START: { text: '启动流程实例' },
  PROCESS_INSTANCE_SUSPEND: { text: '挂起流程实例' },
  PROCESS_INSTANCE_ACTIVATE: { text: '激活流程实例' },
  PROCESS_INSTANCE_TERMINATE: { text: '终止流程实例' },
  TASK_COMPLETE: { text: '完成任务' },
  FORM_SCHEMA_CREATE: { text: '创建表单' },
  FORM_SCHEMA_UPDATE: { text: '更新表单' },
  FORM_BIND: { text: '绑定表单' },
  FORM_BIND_UPDATE: { text: '更新表单绑定' },
  FORM_BIND_DELETE: { text: '删除表单绑定' },
  DATASOURCE_CREATE: { text: '创建数据源' },
  DATASOURCE_UPDATE: { text: '更新数据源' },
  DATASOURCE_DELETE: { text: '删除数据源' },
  DATASOURCE_TEST: { text: '测试数据源' },
  CONNECTOR_EXECUTE: { text: '执行连接器' },
};

const resourceOptions = {
  WORKFLOW_ENABLEMENT: { text: '流程配置' },
  PROCESS_MODEL: { text: '流程模型' },
  PROCESS_INSTANCE: { text: '流程实例' },
  TASK: { text: '任务' },
  FORM_SCHEMA: { text: '表单' },
  FORM_BINDING: { text: '表单绑定' },
  DATASOURCE: { text: '数据源' },
  DATASOURCE_TEST_LOG: { text: '数据源测试' },
  FAILED_JOB: { text: '失败任务' },
  DEAD_LETTER_JOB: { text: '死信任务' },
  CONNECTOR_EXECUTION: { text: '连接器执行' },
};

function auditDetailRecord(log?: AuditLogItem) {
  return maskSecret(parseJsonSafe<Record<string, unknown>>(log?.detailJson, {})) as Record<
    string,
    unknown
  >;
}

function auditProcessInstanceId(log?: AuditLogItem) {
  const detail = auditDetailRecord(log);
  if (typeof detail.processInstanceId === 'string') return detail.processInstanceId;
  if (log?.resourceType === 'PROCESS_INSTANCE') return log.resourceId;
  return undefined;
}

function auditTaskId(log?: AuditLogItem) {
  const detail = auditDetailRecord(log);
  if (typeof detail.taskId === 'string') return detail.taskId;
  if (log?.resourceType === 'TASK') return log.resourceId;
  return undefined;
}

function auditProcessModelId(log?: AuditLogItem) {
  const detail = auditDetailRecord(log);
  if (typeof detail.processModelId === 'string') return detail.processModelId;
  if (log?.resourceType === 'PROCESS_MODEL') return log.resourceId;
  return undefined;
}

function auditRelatedButtons(log?: AuditLogItem) {
  const processInstanceId = auditProcessInstanceId(log);
  const taskId = auditTaskId(log);
  const processModelId = auditProcessModelId(log);
  const actions: React.ReactNode[] = [];

  if (processInstanceId) {
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
  if (taskId) {
    actions.push(
      <Button key="task" type="link" onClick={() => history.push(`/tasks/${taskId}`)}>
        查看任务
      </Button>,
    );
  }
  if (processModelId) {
    actions.push(
      <Button
        key="model"
        type="link"
        onClick={() => history.push(`/process-designer?modelId=${processModelId}`)}
      >
        查看流程设计
      </Button>,
    );
  }
  if (log?.resourceType === 'FORM_SCHEMA') {
    actions.push(
      <Button key="form" type="link" onClick={() => history.push('/forms')}>
        查看表单
      </Button>,
    );
  }
  if (log?.resourceType === 'FORM_BINDING') {
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
  if (log?.resourceType === 'DATASOURCE') {
    actions.push(
      <Button key="datasource" type="link" onClick={() => history.push('/datasources')}>
        查看数据源
      </Button>,
    );
  }
  if (log?.resourceType === 'CONNECTOR_EXECUTION') {
    actions.push(
      <Button
        key="connector"
        type="link"
        onClick={() =>
          history.push(
            log.requestId
              ? `/http-connector?requestId=${encodeURIComponent(log.requestId)}`
              : '/http-connector',
          )
        }
      >
        查看连接器记录
      </Button>,
    );
  }

  return actions;
}

const AuditRelatedActions: React.FC<{ log?: AuditLogItem }> = ({ log }) => {
  const actions = auditRelatedButtons(log);

  if (!actions.length) return null;

  return <Space wrap>{actions}</Space>;
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
    ? `请求追踪号：${query.requestId}`
    : `对象编号：${query.resourceId}，包含该对象及关联任务记录`;

  const columns: ProColumns<AuditLogItem>[] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      search: false,
      renderText: (value) => formatDateTime(value),
    },
    { title: '操作人', dataIndex: 'userId', width: 120 },
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
      title: '对象编号',
      dataIndex: 'resourceId',
      ellipsis: true,
      render: (_, record) => (
        <Space wrap>
          <CopyableText value={record.resourceId} />
          <AuditRelatedActions log={record} />
        </Space>
      ),
    },
    {
      title: '追踪号',
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
    <PageContainer title="审计日志" content="查询关键操作记录和请求追踪信息。">
      {query.requestId || query.resourceId ? (
        <Alert
          showIcon
          type="info"
          title="已按上下文筛选审计记录"
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
        search={{ labelWidth: 'auto' }}
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
            resourceId: (params.resourceId as string | undefined) || query.resourceId,
            requestId: (params.requestId as string | undefined) || query.requestId,
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
      />

      <Drawer
        title="审计详情"
        size={720}
        extra={<AuditRelatedActions log={detail} />}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
      >
        <ProDescriptions<AuditLogItem>
          column={1}
          dataSource={detail}
          columns={[
            { title: '租户', dataIndex: 'tenantId' },
            { title: '操作人', dataIndex: 'userId' },
            { title: '操作类型', dataIndex: 'action', renderText: auditActionLabel },
            { title: '对象类型', dataIndex: 'resourceType', renderText: auditResourceLabel },
            { title: '对象编号', dataIndex: 'resourceId', copyable: true },
            { title: '追踪号', dataIndex: 'requestId', copyable: true },
            { title: '客户端 IP', dataIndex: 'clientIp' },
            { title: '时间', dataIndex: 'createdAt', renderText: formatDateTime },
          ]}
        />
        <Typography.Title level={5}>操作明细</Typography.Title>
        <StructuredDetailTable value={auditDetailRecord(detail)} emptyText="暂无操作明细" />
      </Drawer>
    </PageContainer>
  );
};

export default AuditLogs;
