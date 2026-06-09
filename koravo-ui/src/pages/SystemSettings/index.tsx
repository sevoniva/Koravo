import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import { Alert, Button, Flex, Space, Statistic, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import { getSystemHealth, type SystemHealthItem } from '@/services/koravo/api';
import {
  getOrganizationMembers,
  isPlatformIdentitySynced,
  type OrganizationMember,
  organizationMemberName,
  organizationRoleLabel,
  tenantDisplayName,
} from '@/services/koravo/organization';
import {
  getSessionContext,
  type SessionContext,
  type SessionRole,
} from '@/services/koravo/session';
import { buildVersionLabel, productCopy } from '@/utils/display';
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
    description: '维护流程、表单、连接器和异常任务。',
  },
  {
    label: '发起人',
    value: 'applicant',
    description: '发起业务流程并跟踪实例进度。',
  },
  {
    label: '业务处理人',
    value: 'manager',
    description: '处理业务验收、复核和协同待办。',
  },
  {
    label: '财务复核人',
    value: 'finance',
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
  { title: '管理员', dataIndex: 'admin', width: 96 },
  { title: '发起人', dataIndex: 'applicant', width: 96 },
  { title: '业务处理人', dataIndex: 'manager', width: 112 },
  { title: '财务复核人', dataIndex: 'finance', width: 112 },
];

function roleLabel(role: SessionRole) {
  return organizationRoleLabel(role);
}

const SystemSettings: React.FC = () => {
  const location = useLocation();
  const isOrganizationPage = location.pathname === '/organization-permissions';
  const session = getSessionContext();
  const members = getOrganizationMembers();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    enabled: !isOrganizationPage,
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

  const identitySynced = isPlatformIdentitySynced(session.userId);
  const currentPermissionProfile = identitySynced
    ? roleOptions.find((item) => item.value === session.role)
    : undefined;
  const sessionRoleLabel = identitySynced ? roleLabel(session.role) : '待平台同步';
  const systemOperatorName = (userId?: string) =>
    organizationMemberName(userId && userId !== 'anonymous' ? userId : session.userId);

  const memberColumns: ProColumns<OrganizationMember>[] = [
    {
      title: '成员',
      dataIndex: 'name',
      width: 160,
      ellipsis: true,
      render: (_, record) => (
        <Typography.Text ellipsis={{ tooltip: record.name }}>
          {record.name}
        </Typography.Text>
      ),
    },
    {
      title: '成员账号',
      dataIndex: 'userId',
      width: 120,
      renderText: (value) => value || '-',
    },
    { title: '部门', dataIndex: 'department', width: 120, ellipsis: true },
    {
      title: '角色',
      dataIndex: 'role',
      width: 112,
      render: (_, record) => (
        <Tag color="processing">{roleLabel(record.role)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => (
        <Tag color={record.status === '启用' ? 'success' : 'default'}>
          {record.status}
        </Tag>
      ),
    },
  ];

  const organizationPermissionsContent = (
    <>
      <Alert
        showIcon
        type="info"
        title="组织档案由平台身份源同步"
        description="成员、部门和职责会影响待办分配。发起表单、审批人选择、待办列表和审计记录都会按成员名称展示。"
        style={{ marginBottom: 16 }}
      />
      <ProCard title="组织权限" split="vertical" gutter={16} wrap>
        <ProCard title="成员清单" colSpan={{ xs: 24, xl: 12 }}>
          <ProTable<OrganizationMember>
            rowKey="key"
            columns={memberColumns}
            dataSource={members}
            search={false}
            pagination={false}
            options={false}
            scroll={{ x: 592 }}
            size="small"
          />
        </ProCard>
        <ProCard title="权限矩阵" colSpan={{ xs: 24, xl: 12 }}>
          <ProTable<PermissionMatrixItem>
            rowKey="key"
            columns={permissionColumns}
            dataSource={permissionMatrix}
            search={false}
            pagination={false}
            options={false}
            scroll={{ x: 616 }}
            size="small"
          />
        </ProCard>
      </ProCard>
    </>
  );

  if (isOrganizationPage) {
    return (
      <PageContainer
        title="组织权限"
        content="查看平台同步的成员、部门、职责和流程办理权限。"
      >
        {organizationPermissionsContent}
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="系统状态"
      content="查看组织身份、依赖状态和系统策略。"
    >
      <ProCard
        gutter={16}
        wrap
        loading={isLoading}
        style={{ marginBottom: 16 }}
      >
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="服务状态" value={data?.status || '-'} />
          <KoravoStatusTag status={data?.status} />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic
            title="构建状态"
            value={buildVersionLabel(data?.version)}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 8 }}>
          <Statistic title="系统时间" value={formatDateTime(data?.time)} />
        </ProCard>
      </ProCard>

      <Alert
        showIcon
        type={identitySynced ? 'info' : 'warning'}
        title={identitySynced ? '组织权限范围' : '平台身份未同步'}
        description={
          <Flex vertical gap={8}>
            <span>
              {identitySynced
                ? '待办、发起和运维操作会按平台身份源加载权限范围。成员、部门和岗位职责由组织档案同步。'
                : '当前会话还没有拿到平台身份源中的成员档案，页面只展示同步状态，不会默认展示为管理员。'}
            </span>
            <Space wrap>
              <Tag color="processing">
                当前成员：{organizationMemberName(session.userId)}
              </Tag>
              <Tag color={identitySynced ? 'blue' : 'warning'}>
                岗位职责：{sessionRoleLabel}
              </Tag>
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
        <ProCard title="权限档案" colSpan={{ xs: 24, xl: 10 }}>
          {currentPermissionProfile ? (
            <Alert
              showIcon
              type="success"
              title={currentPermissionProfile.label}
              description={currentPermissionProfile.description}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <ProDescriptions<SessionContext>
            column={1}
            dataSource={session}
            columns={[
              {
                title: '组织',
                dataIndex: 'tenantId',
                renderText: tenantDisplayName,
              },
              {
                title: '成员',
                dataIndex: 'userId',
                renderText: organizationMemberName,
              },
              {
                title: '岗位职责',
                dataIndex: 'role',
                renderText: () => sessionRoleLabel,
              },
            ]}
          />
        </ProCard>
        <ProCard title="系统运行" colSpan={{ xs: 24, xl: 14 }}>
          <ProDescriptions
            column={1}
            dataSource={data}
            columns={[
              {
                title: '组织',
                dataIndex: 'tenantId',
                renderText: tenantDisplayName,
              },
              {
                title: '当前成员',
                dataIndex: 'userId',
                renderText: systemOperatorName,
              },
              {
                title: '岗位职责',
                dataIndex: 'role',
                renderText: () => sessionRoleLabel,
              },
              {
                title: '构建状态',
                dataIndex: 'version',
                renderText: buildVersionLabel,
              },
              { title: '时间', dataIndex: 'time', renderText: formatDateTime },
            ]}
            extra={
              <Space wrap>
                <Button onClick={() => refetch()}>刷新</Button>
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
