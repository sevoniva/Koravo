import {
  ModalForm,
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Flex,
  Popconfirm,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import React, { useMemo } from 'react';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  createOrganizationMember,
  disableOrganizationMember,
  enableOrganizationMember,
  getSystemHealth,
  listOrganizationMembers,
  resetOrganizationMemberPassword,
  type SystemHealthItem,
  updateOrganizationMember,
} from '@/services/koravo/api';
import {
  getOrganizationMembers,
  isPlatformIdentitySynced,
  normalizeOrganizationMembers,
  type OrganizationMember,
  organizationMemberName,
  organizationRoleLabel,
  setOrganizationMembers,
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
  operator: string;
}

interface OrganizationMemberFormValues {
  userId: string;
  name: string;
  department: string;
  role: SessionRole;
  status?: 'ACTIVE' | 'DISABLED';
  password?: string;
}

interface ResetPasswordFormValues {
  password: string;
}

const roleOptions: RoleOption[] = [
  {
    label: '管理员',
    value: 'admin',
    description: '维护流程、表单、组织权限、集成动作和系统策略。',
  },
  {
    label: '发起人',
    value: 'applicant',
    description: '发起业务流程并跟踪实例进度。',
  },
  {
    label: '审批人',
    value: 'manager',
    description: '处理分配给自己的审批和协同待办。',
  },
  {
    label: '复核人',
    value: 'finance',
    description: '处理分配给自己的复核和会签待办。',
  },
  {
    label: '运维审计人',
    value: 'operator',
    description: '查看运行监控、审计日志和异常追踪。',
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
    operator: '不可见',
  },
  {
    key: 'start',
    scope: '发起流程实例',
    admin: '允许',
    applicant: '允许',
    manager: '不可操作',
    finance: '不可操作',
    operator: '不可操作',
  },
  {
    key: 'task',
    scope: '办理待办任务',
    admin: '允许',
    applicant: '不可操作',
    manager: '允许',
    finance: '允许',
    operator: '不可操作',
  },
  {
    key: 'ops',
    scope: '运维处置',
    admin: '不可操作',
    applicant: '不可见',
    manager: '不可见',
    finance: '不可见',
    operator: '允许',
  },
  {
    key: 'system',
    scope: '组织、集成、系统设置',
    admin: '维护',
    applicant: '不可见',
    manager: '不可见',
    finance: '不可见',
    operator: '只读健康状态',
  },
];

const permissionColumns: ProColumns<PermissionMatrixItem>[] = [
  { title: '权限域', dataIndex: 'scope', width: 200 },
  { title: '管理员', dataIndex: 'admin', width: 96 },
  { title: '发起人', dataIndex: 'applicant', width: 96 },
  { title: '审批人', dataIndex: 'manager', width: 112 },
  { title: '复核人', dataIndex: 'finance', width: 112 },
  { title: '运维审计人', dataIndex: 'operator', width: 112 },
];

function roleLabel(role: SessionRole) {
  return organizationRoleLabel(role);
}

const passwordPolicyRules = [
  { min: 8, message: '密码至少 8 位' },
  { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码需包含字母和数字' },
];

const MemberFormFields: React.FC<{ passwordRequired?: boolean }> = ({
  passwordRequired,
}) => (
  <>
    <ProFormText
      name="userId"
      label="成员账号"
      rules={[{ required: true, message: '请输入成员账号' }]}
      fieldProps={{ maxLength: 64 }}
    />
    <ProFormText
      name="name"
      label="成员姓名"
      rules={[{ required: true, message: '请输入成员姓名' }]}
      fieldProps={{ maxLength: 80 }}
    />
    <ProFormText
      name="department"
      label="所属部门"
      rules={[{ required: true, message: '请输入所属部门' }]}
      fieldProps={{ maxLength: 80 }}
    />
    <ProFormSelect
      name="role"
      label="岗位职责"
      options={roleOptions.map((item) => ({
        label: item.label,
        value: item.value,
      }))}
      rules={[{ required: true, message: '请选择岗位职责' }]}
    />
    <ProFormSelect
      name="status"
      label="状态"
      options={[
        { label: '启用', value: 'ACTIVE' },
        { label: '停用', value: 'DISABLED' },
      ]}
      rules={[{ required: true, message: '请选择成员状态' }]}
    />
    <ProFormText.Password
      name="password"
      label={passwordRequired ? '初始密码' : '新密码'}
      fieldProps={{ autoComplete: 'new-password' }}
      rules={
        passwordRequired
          ? [
              { required: true, message: '请输入初始密码' },
              ...passwordPolicyRules,
            ]
          : passwordPolicyRules
      }
    />
  </>
);

const SystemSettings: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const isOrganizationPage = location.pathname === '/organization-permissions';
  const session = getSessionContext();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    enabled: !isOrganizationPage,
  });
  const { data: organizationMembers, refetch: refetchOrganizationMembers } =
    useQuery({
      queryKey: ['organization-members'],
      queryFn: listOrganizationMembers,
      enabled: isOrganizationPage,
    });

  React.useEffect(() => {
    if (organizationMembers) {
      setOrganizationMembers(organizationMembers);
    }
  }, [organizationMembers]);
  const members = useMemo(
    () =>
      organizationMembers
        ? normalizeOrganizationMembers(organizationMembers)
        : getOrganizationMembers(),
    [organizationMembers],
  );

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
  const sessionRoleLabel = identitySynced
    ? roleLabel(session.role)
    : '待平台同步';
  const systemOperatorName = (userId?: string) =>
    organizationMemberName(
      userId && userId !== 'anonymous' ? userId : session.userId,
    );

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
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      width: 170,
      renderText: formatDateTime,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <ModalForm<OrganizationMemberFormValues>
            title="编辑成员"
            trigger={<Button type="link">编辑</Button>}
            initialValues={{
              userId: record.userId,
              name: record.name,
              department: record.department,
              role: record.role,
              status: record.status === '启用' ? 'ACTIVE' : 'DISABLED',
            }}
            modalProps={{ destroyOnHidden: true }}
            submitter={{
              searchConfig: { submitText: '保存', resetText: '取消' },
            }}
            onFinish={async (values) => {
              await updateOrganizationMember(record.key, values);
              message.success('成员已更新');
              await refetchOrganizationMembers();
              return true;
            }}
          >
            <MemberFormFields />
          </ModalForm>
          <ModalForm<ResetPasswordFormValues>
            title="重置密码"
            trigger={<Button type="link">重置密码</Button>}
            modalProps={{ destroyOnHidden: true }}
            submitter={{
              searchConfig: { submitText: '确认重置', resetText: '取消' },
            }}
            onFinish={async (values) => {
              await resetOrganizationMemberPassword(
                record.key,
                values.password,
              );
              message.success('密码已重置');
              await refetchOrganizationMembers();
              return true;
            }}
          >
            <ProFormText.Password
              name="password"
              label="新密码"
              fieldProps={{ autoComplete: 'new-password' }}
              rules={[
                { required: true, message: '请输入新密码' },
                ...passwordPolicyRules,
              ]}
            />
          </ModalForm>
          {record.status === '启用' ? (
            <Popconfirm
              title="停用成员"
              description="停用后该成员不能登录，也不能继续处理待办。"
              okText="停用"
              cancelText="取消"
              onConfirm={async () => {
                await disableOrganizationMember(record.key);
                message.success('成员已停用');
                await refetchOrganizationMembers();
              }}
            >
              <Button type="link" danger>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              onClick={async () => {
                await enableOrganizationMember(record.key);
                message.success('成员已启用');
                await refetchOrganizationMembers();
              }}
            >
              启用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const organizationPermissionsContent = (
    <>
      <Alert
        showIcon
        type="info"
        title="组织成员是审批身份源"
        description="成员、部门和岗位职责会影响登录权限、待办分配、审批人选择和审计记录。"
        style={{ marginBottom: 16 }}
      />
      <ProCard title="组织权限" split="vertical" gutter={16} wrap>
        <ProCard
          title="成员清单"
          colSpan={{ xs: 24, xl: 14 }}
          extra={
            <ModalForm<OrganizationMemberFormValues>
              title="新增成员"
              trigger={<Button type="primary">新增成员</Button>}
              initialValues={{ status: 'ACTIVE', role: 'applicant' }}
              modalProps={{ destroyOnHidden: true }}
              submitter={{
                searchConfig: { submitText: '创建', resetText: '取消' },
              }}
              onFinish={async (values) => {
                await createOrganizationMember(values);
                message.success('成员已创建');
                await refetchOrganizationMembers();
                return true;
              }}
            >
              <MemberFormFields passwordRequired />
            </ModalForm>
          }
        >
          <ProTable<OrganizationMember>
            rowKey="key"
            columns={memberColumns}
            dataSource={members}
            search={false}
            pagination={false}
            options={false}
            scroll={{ x: 1040 }}
            size="small"
          />
        </ProCard>
        <ProCard title="权限矩阵" colSpan={{ xs: 24, xl: 10 }}>
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
      <PageContainer title="组织权限">
        {organizationPermissionsContent}
      </PageContainer>
    );
  }

  return (
    <PageContainer title="系统状态">
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
