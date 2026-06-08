import {
  PageContainer,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, Drawer, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
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
  PROCESS_MODEL_CREATE: { text: '创建流程模型' },
  PROCESS_MODEL_DEPLOY: { text: '部署流程模型' },
  PROCESS_INSTANCE_START: { text: '启动流程实例' },
  TASK_COMPLETE: { text: '完成任务' },
  FORM_SCHEMA_CREATE: { text: '创建表单' },
  FORM_BIND: { text: '绑定表单' },
  DATASOURCE_TEST: { text: '测试数据源' },
  CONNECTOR_EXECUTE: { text: '执行连接器' },
};

const resourceOptions = {
  PROCESS_MODEL: { text: '流程模型' },
  PROCESS_INSTANCE: { text: '流程实例' },
  TASK: { text: '任务' },
  FORM_SCHEMA: { text: '表单' },
  FORM_BINDING: { text: '表单绑定' },
  DATASOURCE: { text: '数据源' },
  CONNECTOR_EXECUTION: { text: '连接器执行' },
};

const AuditLogs: React.FC = () => {
  const [detail, setDetail] = useState<AuditLogItem>();

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
      render: (_, record) => <CopyableText value={record.resourceId} />,
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
      render: (_, record) => (
        <Button type="link" onClick={() => setDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  const detailJson = JSON.stringify(
    maskSecret(parseJsonSafe(detail?.detailJson, {})),
    null,
    2,
  );

  return (
    <PageContainer title="审计日志" content="查询关键操作记录和请求追踪信息。">
      <ProTable<AuditLogItem>
        rowKey="id"
        columns={columns}
        scroll={{ x: 1200 }}
        search={{ labelWidth: 'auto' }}
        request={async (params) => {
          const result = await listAuditLogs({
            userId: params.userId as string | undefined,
            action: params.action as string | undefined,
            resourceType: params.resourceType as string | undefined,
            resourceId: params.resourceId as string | undefined,
            requestId: params.requestId as string | undefined,
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
      />

      <Drawer
        title="审计详情"
        size={720}
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
        <Typography.Title level={5}>详情</Typography.Title>
        <Typography.Paragraph>
          <pre>{detailJson}</pre>
        </Typography.Paragraph>
      </Drawer>
    </PageContainer>
  );
};

export default AuditLogs;
