import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProForm,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Segmented, Space, Statistic, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
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

const roleOptions = [
  {
    label: '管理员',
    value: 'admin',
    description: '维护流程、表单、连接器和异常任务。',
  },
  {
    label: '发起人',
    value: 'applicant',
    description: '发起业务流程并跟踪实例进度。',
  },
  {
    label: '一级处理人',
    value: 'manager',
    description: '处理分配给 manager 的待办任务。',
  },
  {
    label: '二级处理人',
    value: 'finance',
    description: '处理分配给 finance 的待办任务。',
  },
];

const SystemSettings: React.FC = () => {
  const { message } = App.useApp();
  const [session, setSession] = useState<SessionContext>(() => getSessionContext());
  const { setInitialState } = useModel('@@initialState');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
  });

  const policy = useMemo(
    () => [
      {
        key: 'initialization',
        name: '流程资产补齐',
        status: data?.workflowEnablement?.enabled ? 'READY' : 'DISABLED',
        message: productCopy(data?.workflowEnablement?.message),
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

  const currentRole = roleOptions.find((item) => item.value === session.userId);

  const applySession = (values: Partial<SessionContext>, successText: string) => {
    const next = { ...getSessionContext(), ...values };
    setSessionContext(next);
    setSession(next);
    setInitialState((state) => ({
      ...state,
      session: next,
      currentUser: {
        name: next.userId,
        userid: next.userId,
        access: 'admin',
        tenantId: next.tenantId,
      },
    }));
    message.success(successText);
    void refetch();
  };

  return (
    <PageContainer title="系统设置" content="查看系统运行状态，切换当前租户和处理人。">
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

      <Alert
        showIcon
        type="info"
        title="当前身份影响待办"
        description={
          <Flex vertical gap={8}>
            <span>
              流程任务按当前用户查询。发起实例后切换到对应处理人，即可在任务中心查看名下待办。
            </span>
            <Space wrap>
              <Tag color="processing">当前用户：{session.userId}</Tag>
              <Tag>租户：{session.tenantId}</Tag>
              {session.lastRequestId ? <Tag>最近追踪号：{session.lastRequestId}</Tag> : null}
            </Space>
            <Space wrap>
              <Button onClick={() => history.push('/process-instances')}>
                发起流程
              </Button>
              <Button type="primary" onClick={() => history.push('/tasks')}>
                查看任务
              </Button>
            </Space>
          </Flex>
        }
        style={{ marginBottom: 16 }}
      />

      <ProCard split="vertical" gutter={16} wrap>
        <ProCard title="运行上下文" colSpan={{ xs: 24, xl: 10 }}>
          <Segmented
            block
            value={session.userId}
            options={roleOptions.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
            onChange={(value) => {
              const role = roleOptions.find((item) => item.value === value);
              applySession(
                { userId: String(value) },
                role ? `已切换为${role.label}` : '已切换处理人',
              );
            }}
            style={{ marginBottom: 16 }}
          />
          {currentRole ? (
            <Alert
              showIcon
              type="success"
              title={currentRole.label}
              description={currentRole.description}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <ProForm<SessionContext>
            key={`${session.tenantId}-${session.userId}-${session.requestId}-${session.lastRequestId || ''}`}
            initialValues={session}
            submitter={{
              render: (_, dom) => dom,
            }}
            onFinish={async (values) => {
              applySession(values, '已保存运行上下文');
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
              label="当前用户"
              rules={[{ required: true, message: '请输入用户' }]}
            />
            <ProFormText
              name="requestId"
              label="请求追踪号"
              tooltip="仅在排查指定请求时填写；为空时系统会按当前操作生成追踪号。"
            />
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
              <Space wrap>
                <Button onClick={() => refetch()}>
                  刷新
                </Button>
                <Button
                  disabled={!session.lastRequestId}
                  onClick={() =>
                    history.push(
                      `/audit-logs?requestId=${encodeURIComponent(session.lastRequestId || '')}`,
                    )
                  }
                >
                  查看最近审计
                </Button>
              </Space>
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
