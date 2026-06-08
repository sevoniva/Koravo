import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Flex, Statistic, Typography } from 'antd';
import React, { useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getConnectorExecutionSummary,
  listConnectorExecutionLogs,
  type ConnectorExecutionLogItem,
} from '@/services/koravo/api';
import { connectorTypeLabel } from '@/utils/display';
import { formatDateTime, formatDuration } from '@/utils/format';

const HttpConnector: React.FC = () => {
  const [detail, setDetail] = useState<ConnectorExecutionLogItem>();
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
    { title: '地址', dataIndex: 'url', ellipsis: true, search: false },
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
      title: '追踪号',
      dataIndex: 'requestId',
      width: 170,
      render: (_, record) => <CopyableText value={record.requestId} />,
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
      width: 96,
      render: (_, record) => (
        <Button type="link" onClick={() => setDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <PageContainer title="HTTP 连接器" content="查看连接器调用质量和执行明细。">
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
        request={async (params) => {
          const result = await listConnectorExecutionLogs({
            connectorType: params.connectorType as string | undefined,
            status: params.status as string | undefined,
            requestId: params.requestId as string | undefined,
            page: Number(params.current || 1),
            pageSize: Number(params.pageSize || 10),
          });
          return { data: result.items, total: result.total, success: true };
        }}
      />

      <Drawer
        title="执行详情"
        size={720}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
      >
        <Flex vertical gap={16}>
          <ProDescriptions<ConnectorExecutionLogItem>
            column={1}
            dataSource={detail}
            columns={[
              { title: '连接器', dataIndex: 'connectorType', renderText: connectorTypeLabel },
              { title: '方法', dataIndex: 'method' },
              { title: '地址', dataIndex: 'url', copyable: true },
              { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} /> },
              { title: '状态码', dataIndex: 'statusCode' },
              { title: '耗时', dataIndex: 'elapsedMillis', renderText: formatDuration },
              { title: '追踪号', dataIndex: 'requestId', copyable: true },
              { title: '时间', dataIndex: 'createdAt', renderText: formatDateTime },
            ]}
          />
          <Typography.Title level={5}>请求摘要</Typography.Title>
          <Typography.Paragraph>{detail?.requestSummary || '-'}</Typography.Paragraph>
          <Typography.Title level={5}>响应摘要</Typography.Title>
          <Typography.Paragraph>{detail?.responseSummary || '-'}</Typography.Paragraph>
          <Typography.Title level={5}>错误信息</Typography.Title>
          <Typography.Paragraph>{detail?.errorMessage || '-'}</Typography.Paragraph>
        </Flex>
      </Drawer>
    </PageContainer>
  );
};

export default HttpConnector;
