import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Flex, Statistic, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import StructuredDetailTable from '@/components/StructuredDetailTable';
import {
  getConnectorExecutionSummary,
  listConnectorExecutionLogs,
  type ConnectorExecutionLogItem,
} from '@/services/koravo/api';
import { connectionAddressLabel, connectorTypeLabel, shortTraceLabel } from '@/utils/display';
import { formatDateTime, formatDuration } from '@/utils/format';

function openAuditByRequestId(requestId?: string) {
  if (!requestId) return;
  history.push(`/audit-logs?requestId=${encodeURIComponent(requestId)}`);
}

function connectorTraceDisplay(requestId?: string) {
  if (!requestId) return '';
  return shortTraceLabel(requestId);
}

function useQueryRequestId() {
  const location = useLocation();
  return React.useMemo(() => {
    return new URLSearchParams(location.search).get('requestId') || undefined;
  }, [location.search]);
}

const DetailBlock: React.FC<{ title: string; value?: string | null }> = ({
  title,
  value,
}) => (
  <>
    <Typography.Title level={5}>{title}</Typography.Title>
    <StructuredDetailTable value={value} emptyText="无" />
  </>
);

const HttpConnector: React.FC = () => {
  const [detail, setDetail] = useState<ConnectorExecutionLogItem>();
  const queryRequestId = useQueryRequestId();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['connector-summary', 'http'],
    queryFn: () => getConnectorExecutionSummary('http'),
  });

  const columns: ProColumns<ConnectorExecutionLogItem>[] = [
    {
      title: '连接器',
      dataIndex: 'connectorType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        http: { text: 'HTTP' },
        jdbc: { text: 'JDBC' },
      },
      renderText: (value) => connectorTypeLabel(value),
    },
    { title: '方法', dataIndex: 'method', width: 96 },
    {
      title: '地址',
      dataIndex: 'url',
      ellipsis: true,
      search: false,
      render: (_, record) => (
        <CopyableText
          value={record.url}
          displayValue={connectionAddressLabel(record.url)}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'select',
      valueEnum: {
        SUCCESS: { text: '成功' },
        FAILED: { text: '失败' },
      },
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    { title: '状态码', dataIndex: 'statusCode', width: 100, search: false },
    {
      title: '耗时',
      dataIndex: 'elapsedMillis',
      width: 110,
      search: false,
      renderText: (value) => formatDuration(value),
    },
    {
      title: '业务追踪号',
      dataIndex: 'requestId',
      width: 170,
      render: (_, record) => (
        <CopyableText
          value={record.requestId}
          displayValue={connectorTraceDisplay(record.requestId)}
        />
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      search: false,
      renderText: (value) => formatDateTime(value),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 144,
      render: (_, record) => [
        <Button key="detail" type="link" onClick={() => setDetail(record)}>
          查看
        </Button>,
        <Button
          key="audit"
          type="link"
          disabled={!record.requestId}
          onClick={() => openAuditByRequestId(record.requestId)}
        >
          审计
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer title="集成动作">
      <ProCard gutter={16} wrap loading={isLoading} style={{ marginBottom: 16 }}>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="调用总数" value={summary?.total ?? 0} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="成功" value={summary?.success ?? 0} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="失败" value={summary?.failed ?? 0} />
        </ProCard>
      </ProCard>

      <ProTable<ConnectorExecutionLogItem>
        rowKey="id"
        columns={columns}
        scroll={{ x: 1280 }}
        search={{ labelWidth: 'auto' }}
        params={{ requestId: queryRequestId }}
        request={async (params) => {
          const result = await listConnectorExecutionLogs({
            connectorType: params.connectorType as string | undefined,
            status: params.status as string | undefined,
            requestId: (params.requestId as string | undefined) || queryRequestId,
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
      />

      <Drawer
        title="执行详情"
        size={720}
        extra={
          <Button
            type="link"
            disabled={!detail?.requestId}
            onClick={() => openAuditByRequestId(detail?.requestId)}
          >
            查看审计日志
          </Button>
        }
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
      >
        <Flex vertical gap={16}>
          {detail ? (
            <Alert
              showIcon
              type={detail.status === 'SUCCESS' ? 'success' : 'error'}
              title={
                detail.status === 'SUCCESS'
                  ? '连接器调用成功'
                  : '连接器调用失败'
              }
              description={
                detail.statusCode
                  ? `状态码 ${detail.statusCode}，耗时 ${formatDuration(detail.elapsedMillis)}。`
                  : `耗时 ${formatDuration(detail.elapsedMillis)}。`
              }
            />
          ) : null}
          <ProDescriptions<ConnectorExecutionLogItem>
            column={1}
            dataSource={detail}
            columns={[
              { title: '连接器', dataIndex: 'connectorType', renderText: connectorTypeLabel },
              { title: '方法', dataIndex: 'method' },
              {
                title: '地址',
                dataIndex: 'url',
                render: (_, record) => (
                  <CopyableText
                    value={record.url}
                    displayValue={connectionAddressLabel(record.url)}
                  />
                ),
              },
              { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} /> },
              { title: '状态码', dataIndex: 'statusCode' },
              { title: '耗时', dataIndex: 'elapsedMillis', renderText: formatDuration },
              { title: '业务追踪号', dataIndex: 'requestId', copyable: true },
              { title: '时间', dataIndex: 'createdAt', renderText: formatDateTime },
            ]}
          />
          <DetailBlock title="请求摘要" value={detail?.requestSummary} />
          <DetailBlock title="响应摘要" value={detail?.responseSummary} />
          <DetailBlock title="错误信息" value={detail?.errorMessage} />
        </Flex>
      </Drawer>
    </PageContainer>
  );
};

export default HttpConnector;
