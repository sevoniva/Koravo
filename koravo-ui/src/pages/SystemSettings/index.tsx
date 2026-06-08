import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProForm,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Button, Statistic, message } from 'antd';
import React, { useMemo } from 'react';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getSystemHealth,
  type SystemHealthItem,
} from '@/services/koravo/api';
import {
  getSessionContext,
  setSessionContext,
  type SessionContext,
} from '@/services/koravo/session';
import { productCopy } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

const dependencyColumns: ProColumns<SystemHealthItem>[] = [
  { title: '依赖', dataIndex: 'name' },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (_, record) => <KoravoStatusTag status={record.status} />,
  },
  { title: '说明', dataIndex: 'message', renderText: productCopy },
];

const SystemSettings: React.FC = () => {
  const session = getSessionContext();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
  });

  const policy = useMemo(
    () => [
      {
        key: 'initialization',
        name: '初始化接口',
        status: data?.demoMode?.enabled ? 'READY' : 'DISABLED',
        message: productCopy(data?.demoMode?.message),
      },
      {
        key: 'url-policy',
        name: '连接器 URL 策略',
        status: data?.urlPolicy?.publicHttpsRequired ? 'READY' : 'WARNING',
        message: productCopy(data?.urlPolicy?.message),
      },
    ],
    [data],
  );

  return (
    <PageContainer title="系统设置" content="查看运行状态并维护本地请求上下文。">
      <ProCard gutter={16} wrap loading={isLoading} style={{ marginBottom: 16 }}>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="服务状态" value={data?.status || '-'} />
          <KoravoStatusTag status={data?.status} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="平台版本" value={data?.version || '-'} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="系统时间" value={formatDateTime(data?.time)} />
        </ProCard>
      </ProCard>

      <ProCard split="vertical" gutter={16} wrap>
        <ProCard title="请求上下文" colSpan={{ xs: 24, xl: 10 }}>
          <ProForm<SessionContext>
            initialValues={session}
            submitter={{
              render: (_, dom) => dom,
            }}
            onFinish={async (values) => {
              setSessionContext(values);
              message.success('已保存上下文');
              await refetch();
              return true;
            }}
          >
            <ProFormText
              name="tenantId"
              label="租户"
              rules={[{ required: true, message: '请输入租户' }]}
            />
            <ProFormText
              name="userId"
              label="用户"
              rules={[{ required: true, message: '请输入用户' }]}
            />
            <ProFormText name="requestId" label="请求追踪号" />
            <ProFormText
              name="lastRequestId"
              label="最近追踪号"
              fieldProps={{ readOnly: true }}
            />
          </ProForm>
        </ProCard>
        <ProCard title="运行信息" colSpan={{ xs: 24, xl: 14 }}>
          <ProDescriptions
            column={1}
            dataSource={data}
            columns={[
              { title: '租户', dataIndex: 'tenantId' },
              { title: '用户', dataIndex: 'userId' },
              { title: '版本', dataIndex: 'version' },
              { title: '时间', dataIndex: 'time', renderText: formatDateTime },
            ]}
            extra={
              <Button onClick={() => refetch()} type="primary">
                刷新
              </Button>
            }
          />
        </ProCard>
      </ProCard>

      <ProCard title="依赖状态" style={{ marginTop: 16 }}>
        <ProTable<SystemHealthItem>
          rowKey="key"
          columns={dependencyColumns}
          dataSource={data?.dependencies || []}
          search={false}
          pagination={false}
          options={false}
        />
      </ProCard>

      <ProCard title="运行策略" style={{ marginTop: 16 }}>
        <ProTable<SystemHealthItem>
          rowKey="key"
          columns={dependencyColumns}
          dataSource={policy}
          search={false}
          pagination={false}
          options={false}
        />
      </ProCard>
    </PageContainer>
  );
};

export default SystemSettings;
