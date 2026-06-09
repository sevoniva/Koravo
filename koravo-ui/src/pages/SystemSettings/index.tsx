import {
  ModalForm,
  PageContainer,
  ProCard,
  ProDescriptions,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Space, Statistic, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getSystemHealth,
  type SystemHealthItem,
} from '@/services/koravo/api';
import {
  getSessionContext,
  type SessionContext,
  type SessionRole,
} from '@/services/koravo/session';
import {
  getOrganizationMembers,
  organizationMemberName,
  organizationRoleLabel,
  saveOrganizationMembers,
  tenantDisplayName,
  type OrganizationMember,
} from '@/services/koravo/organization';
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

interface RoleOption {
  label: string;
  value: SessionRole;
  userId: string;
  department: string;
  description: string;
}

interface PermissionMatrixItem {
  key: string;
  scope: string;
  admin: string;
  applicant: string;
  manager: string;
  finance: string;
}

const roleOptions: RoleOption[] = [
  {
    label: '管理员',
    value: 'admin',
    userId: 'admin',
    department: '流程平台组',
    description: '维护流程、表单、连接器和异常任务。',
  },
  {
    label: '发起人',
    value: 'applicant',
    userId: 'applicant',
    department: '业务部门',
    description: '发起业务流程并跟踪实例进度。',
  },
  {
    label: '业务处理人',
    value: 'manager',
    userId: 'manager',
    department: '业务部门',
    description: '处理业务验收、复核和协同待办。',
  },
  {
    label: '财务复核人',
    value: 'finance',
    userId: 'finance',
    department: '财务部门',
    description: '处理财务验收和金额复核待办。',
  },
];

const permissionMatrix: PermissionMatrixItem[] = [
  {
    key: 'configuration',
    scope: '流程、表单、绑定配置',
    admin: '维护',
    applicant: '只读',
    manager: '只读',
    finance: '只读',
  },
  {
    key: 'start',
    scope: '发起流程实例',
    admin: '允许',
    applicant: '允许',
    manager: '不可操作',
    finance: '不可操作',
  },
  {
    key: 'task',
    scope: '办理待办任务',
    admin: '允许',
    applicant: '不可操作',
    manager: '允许',
    finance: '允许',
  },
  {
    key: 'ops',
    scope: '运维处置',
    admin: '允许',
    applicant: '只读',
    manager: '只读',
    finance: '只读',
  },
];

const permissionColumns: ProColumns<PermissionMatrixItem>[] = [
  { title: '权限域', dataIndex: 'scope', width: 200 },
  { title: '管理员', dataIndex: 'admin' },
  { title: '发起人', dataIndex: 'applicant' },
  { title: '业务处理人', dataIndex: 'manager' },
  { title: '财务复核人', dataIndex: 'finance' },
];

function roleLabel(role: SessionRole) {
  return organizationRoleLabel(role);
}

const SystemSettings: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const isOrganizationPage = location.pathname === '/organization-permissions';
  const [session] = useState<SessionContext>(() => getSessionContext());
  const [members, setMembers] = useState<OrganizationMember[]>(() => getOrganizationMembers());
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
  });

  const policy = useMemo(
    () => [
      {
        key: 'initialization',
        name: '流程配置完整性',
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

  const currentRole = roleOptions.find((item) => item.value === session.role);

  const updateMembers = (nextMembers: OrganizationMember[]) => {
    setMembers(nextMembers);
    saveOrganizationMembers(nextMembers);
  };

  const memberColumns: ProColumns<OrganizationMember>[] = [
    { title: '成员', dataIndex: 'name' },
    {
      title: '账号',
      dataIndex: 'userId',
      render: (_, record) => organizationMemberName(record.userId),
    },
    { title: '部门', dataIndex: 'department' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (_, record) => <Tag color="processing">{roleLabel(record.role)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => (
        <Tag color={record.status === '启用' ? 'success' : 'default'}>{record.status}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 96,
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            updateMembers(
              members.map((item) =>
                item.key === record.key
                  ? { ...item, status: item.status === '启用' ? '停用' : '启用' }
                  : item,
              ),
            );
          }}
        >
          {record.status === '启用' ? '停用' : '启用'}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer
      title={isOrganizationPage ? '组织权限' : '系统设置'}
      content={
        isOrganizationPage
          ? '维护用户、部门、角色和流程办理权限。'
          : '查看登录成员、依赖状态和系统策略。'
      }
    >
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
        title="我的权限范围"
        description={
          <Flex vertical gap={8}>
            <span>
              待办、发起和运维操作会按登录成员加载权限范围。成员、部门和职责统一在组织权限中维护。
            </span>
            <Space wrap>
              <Tag color="processing">登录成员：{organizationMemberName(session.userId)}</Tag>
              <Tag color="blue">职责：{roleLabel(session.role)}</Tag>
              <Tag>组织：{tenantDisplayName(session.tenantId)}</Tag>
            </Space>
            <Space wrap>
              <Button onClick={() => history.push('/process-start')}>
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
        <ProCard title="我的权限" colSpan={{ xs: 24, xl: 10 }}>
          {currentRole ? (
            <Alert
              showIcon
              type="success"
              title={currentRole.label}
              description={currentRole.description}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <ProDescriptions<SessionContext>
            column={1}
            dataSource={session}
            columns={[
              { title: '组织', dataIndex: 'tenantId', renderText: tenantDisplayName },
              { title: '成员', dataIndex: 'userId', renderText: organizationMemberName },
              { title: '职责', dataIndex: 'role', renderText: () => roleLabel(session.role) },
            ]}
          />
        </ProCard>
        <ProCard title="系统运行" colSpan={{ xs: 24, xl: 14 }}>
          <ProDescriptions
            column={1}
            dataSource={data}
            columns={[
            { title: '组织', dataIndex: 'tenantId', renderText: tenantDisplayName },
            { title: '登录成员', dataIndex: 'userId', renderText: organizationMemberName },
            { title: '职责', dataIndex: 'role', renderText: () => roleLabel(session.role) },
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
                  查看关联审计
                </Button>
              </Space>
            }
          />
        </ProCard>
      </ProCard>

      <ProCard title="组织权限" split="vertical" gutter={16} wrap style={{ marginTop: 16 }}>
        <ProCard title="成员清单" colSpan={{ xs: 24, xl: 10 }}>
          <ProTable<OrganizationMember>
            rowKey="key"
            columns={memberColumns}
            dataSource={members}
            search={false}
            pagination={false}
            options={false}
            size="small"
            toolBarRender={() => [
              <ModalForm<OrganizationMember>
                key="create-member"
                title="新增成员"
                trigger={<Button type="primary">新增成员</Button>}
                modalProps={{ destroyOnHidden: true }}
                onFinish={async (values) => {
                  const userId = values.userId.trim();
                  const next = {
                    ...values,
                    key: userId,
                    userId,
                    status: '启用',
                  };
                  updateMembers([
                    ...members.filter((item) => item.userId !== userId),
                    next,
                  ]);
                  message.success('成员已保存');
                  return true;
                }}
              >
                <ProFormText
                  name="name"
                  label="成员名称"
                  rules={[{ required: true, message: '请输入成员名称' }]}
                />
                <ProFormText
                  name="userId"
                  label="账号"
                  tooltip="账号用于待办分配和审计追踪，保存后业务页面显示成员名称。"
                  rules={[{ required: true, message: '请输入账号' }]}
                />
                <ProFormText
                  name="department"
                  label="部门"
                  rules={[{ required: true, message: '请输入部门' }]}
                />
                <ProFormSelect
                  name="role"
                  label="角色"
                  options={roleOptions.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                  rules={[{ required: true, message: '请选择角色' }]}
                />
              </ModalForm>,
            ]}
          />
        </ProCard>
        <ProCard title="权限矩阵" colSpan={{ xs: 24, xl: 14 }}>
          <ProTable<PermissionMatrixItem>
            rowKey="key"
            columns={permissionColumns}
            dataSource={permissionMatrix}
            search={false}
            pagination={false}
            options={false}
            size="small"
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
