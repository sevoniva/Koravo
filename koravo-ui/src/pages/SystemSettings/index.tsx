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
  getWorkflowEnablementStatus,
  initializeWorkflowAssets,
  listOrganizationMembers,
  resetOrganizationMemberPassword,
  type SystemHealthItem,
  updateOrganizationMember,
  type WorkflowEnablementStatus,
  type WorkflowEnablementStepStatus,
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
  type SessionPermissionKey,
  type SessionRole,
} from '@/services/koravo/session';
import { permissionsForRole } from '@/access';
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
  action: string;
  admin: boolean;
  applicant: boolean;
  manager: boolean;
  finance: boolean;
  operator: boolean;
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

interface WorkflowReadinessRow {
  key: keyof Pick<
    WorkflowEnablementStatus,
    'process' | 'form' | 'binding' | 'todo' | 'audit' | 'connector'
  >;
  name: string;
  step?: WorkflowEnablementStepStatus;
  path: string;
  action: string;
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

const permissionScopes: Array<{
  key: string;
  scope: string;
  permission: SessionPermissionKey;
  action: string;
}> = [
  {
    key: 'dashboard',
    scope: '总览与运行数据',
    permission: 'canViewDashboard',
    action: '查看',
  },
  {
    key: 'own-work',
    scope: '个人流程与任务',
    permission: 'canViewOwnWork',
    action: '查看',
  },
  {
    key: 'start',
    scope: '发起流程',
    permission: 'canStartProcess',
    action: '发起',
  },
  {
    key: 'claim',
    scope: '认领候选任务',
    permission: 'canClaimTask',
    action: '认领',
  },
  {
    key: 'task',
    scope: '办理任务',
    permission: 'canHandleTask',
    action: '办理',
  },
  {
    key: 'workflow-config',
    scope: '流程与表单配置',
    permission: 'canConfigureWorkflow',
    action: '维护',
  },
  {
    key: 'organization',
    scope: '组织成员权限',
    permission: 'canManageOrganization',
    action: '维护',
  },
  {
    key: 'integration',
    scope: '集成配置',
    permission: 'canManageIntegration',
    action: '维护',
  },
  {
    key: 'audit',
    scope: '审计日志',
    permission: 'canViewAudit',
    action: '查看',
  },
  {
    key: 'ops',
    scope: '运维处置',
    permission: 'canOperateSystem',
    action: '处置',
  },
];

const permissionMatrix: PermissionMatrixItem[] = permissionScopes.map((item) => ({
  key: item.key,
  scope: item.scope,
  action: item.action,
  admin: permissionsForRole('admin')[item.permission],
  applicant: permissionsForRole('applicant')[item.permission],
  manager: permissionsForRole('manager')[item.permission],
  finance: permissionsForRole('finance')[item.permission],
  operator: permissionsForRole('operator')[item.permission],
}));

const workflowStepMeta: Array<Omit<WorkflowReadinessRow, 'step'>> = [
  { key: 'process', name: '流程发布', path: '/process-models', action: '流程模型' },
  { key: 'form', name: '启动表单', path: '/forms', action: '表单管理' },
  { key: 'binding', name: '表单绑定', path: '/form-bindings', action: '表单绑定' },
  { key: 'todo', name: '待办流转', path: '/tasks', action: '任务中心' },
  { key: 'audit', name: '审计记录', path: '/audit-logs', action: '审计日志' },
  { key: 'connector', name: '集成动作', path: '/http-connector', action: '集成动作' },
];

function permissionTag(allowed: boolean, action: string) {
  return (
    <Tag color={allowed ? 'success' : 'default'}>
      {allowed ? action : '不可用'}
    </Tag>
  );
}

function workflowReadinessRows(
  status?: WorkflowEnablementStatus,
): WorkflowReadinessRow[] {
  return workflowStepMeta.map((item) => ({
    ...item,
    step: status?.[item.key],
  }));
}

const permissionColumns: ProColumns<PermissionMatrixItem>[] = [
  { title: '权限域', dataIndex: 'scope', width: 200 },
  {
    title: '管理员',
    dataIndex: 'admin',
    width: 96,
    render: (_, record) => permissionTag(record.admin, record.action),
  },
  {
    title: '发起人',
    dataIndex: 'applicant',
    width: 96,
    render: (_, record) => permissionTag(record.applicant, record.action),
  },
  {
    title: '审批人',
    dataIndex: 'manager',
    width: 112,
    render: (_, record) => permissionTag(record.manager, record.action),
  },
  {
    title: '复核人',
    dataIndex: 'finance',
    width: 112,
    render: (_, record) => permissionTag(record.finance, record.action),
  },
  {
    title: '运维审计人',
    dataIndex: 'operator',
    width: 112,
    render: (_, record) => permissionTag(record.operator, record.action),
  },
];

function roleLabel(role: SessionRole) {
  return organizationRoleLabel(role);
}

const passwordPolicyRules = [
  { min: 8, message: '密码至少 8 位' },
  { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码需包含字母和数字' },
];

const MemberFormFields: React.FC<{
  passwordRequired?: boolean;
  roleDisabled?: boolean;
  statusDisabled?: boolean;
}> = ({ passwordRequired, roleDisabled, statusDisabled }) => (
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
      fieldProps={{ disabled: roleDisabled }}
      rules={[{ required: true, message: '请选择岗位职责' }]}
    />
    <ProFormSelect
      name="status"
      label="状态"
      options={[
        { label: '启用', value: 'ACTIVE' },
        { label: '停用', value: 'DISABLED' },
      ]}
      fieldProps={{ disabled: statusDisabled }}
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
  const {
    data: workflowStatus,
    isLoading: workflowLoading,
    refetch: refetchWorkflowStatus,
  } = useQuery({
    queryKey: ['workflow-enablement-status'],
    queryFn: getWorkflowEnablementStatus,
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
  const activeAdminCount = useMemo(
    () =>
      members.filter(
        (member) => member.role === 'admin' && member.status === '启用',
      ).length,
    [members],
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
  const isCurrentMember = (record: OrganizationMember) =>
    record.userId === session.userId;
  const isLastActiveAdmin = (record: OrganizationMember) =>
    record.role === 'admin' &&
    record.status === '启用' &&
    activeAdminCount <= 1;
  const memberEditLocked = (record: OrganizationMember) =>
    isCurrentMember(record) || isLastActiveAdmin(record);
  const memberDisableReason = (record: OrganizationMember) => {
    if (isCurrentMember(record)) return '不能停用当前登录成员';
    if (isLastActiveAdmin(record)) return '至少保留一名启用的管理员';
    return undefined;
  };
  const canConfigureWorkflow = permissionsForRole(session.role).canConfigureWorkflow;
  const workflowRows = useMemo(
    () => workflowReadinessRows(workflowStatus),
    [workflowStatus],
  );

  const refreshWorkflowStatus = async () => {
    await Promise.all([refetch(), refetchWorkflowStatus()]);
  };

  const initializeWorkflow = async () => {
    const result = await initializeWorkflowAssets();
    message.success(result.initialized ? '配置已就绪' : '配置已检查');
    await refreshWorkflowStatus();
  };

  const workflowColumns: ProColumns<WorkflowReadinessRow>[] = [
    { title: '检查项', dataIndex: 'name', width: 140 },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <Tag color={record.step?.ready ? 'success' : 'warning'}>
          {record.step?.ready ? '就绪' : '待处理'}
        </Tag>
      ),
    },
    {
      title: '说明',
      key: 'message',
      renderText: (_, record) => productCopy(record.step?.message || '-'),
    },
    {
      title: '数量',
      key: 'count',
      width: 88,
      search: false,
      renderText: (_, record) => record.step?.count ?? '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 112,
      render: (_, record) => (
        <Button type="link" onClick={() => history.push(record.path)}>
          {record.action}
        </Button>
      ),
    },
  ];

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
      title: '密码',
      dataIndex: 'passwordConfigured',
      width: 88,
      render: (_, record) => (
        <Tag color={record.passwordConfigured === false ? 'warning' : 'success'}>
          {record.passwordConfigured === false ? '未设置' : '已设置'}
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
            {memberEditLocked(record) ? (
              <Alert
                showIcon
                type="info"
                title="管理员权限受保护"
                style={{ marginBottom: 16 }}
              />
            ) : null}
            <MemberFormFields
              roleDisabled={memberEditLocked(record)}
              statusDisabled={memberEditLocked(record)}
            />
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
              disabled={Boolean(memberDisableReason(record))}
              okText="停用"
              cancelText="取消"
              onConfirm={async () => {
                await disableOrganizationMember(record.key);
                message.success('成员已停用');
                await refetchOrganizationMembers();
              }}
            >
              <Button
                type="link"
                danger
                disabled={Boolean(memberDisableReason(record))}
                title={memberDisableReason(record)}
              >
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
            scroll={{ x: 1120 }}
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

      <ProCard
        title="工作流就绪度"
        style={{ marginBottom: 16 }}
        extra={
          <Space wrap>
            <Button loading={workflowLoading} onClick={refreshWorkflowStatus}>
              刷新
            </Button>
            <Button
              type={workflowStatus?.initialized ? 'default' : 'primary'}
              disabled={!canConfigureWorkflow}
              onClick={initializeWorkflow}
            >
              补齐配置
            </Button>
            <Button
              type="primary"
              disabled={!workflowStatus?.initialized}
              onClick={() =>
                history.push(
                  workflowStatus?.processModelId
                    ? `/process-start?processModelId=${workflowStatus.processModelId}`
                    : '/process-start',
                )
              }
            >
              发起流程
            </Button>
            <Button onClick={() => history.push('/ops')}>运维中心</Button>
          </Space>
        }
      >
        <Alert
          showIcon
          type={workflowStatus?.initialized ? 'success' : 'warning'}
          title={workflowStatus?.message || '读取工作流状态'}
          description={
            <Space wrap>
              <Tag>流程：{workflowStatus?.processDefinitionKey || '-'}</Tag>
              <Tag>组织：{tenantDisplayName(workflowStatus?.tenantId || session.tenantId)}</Tag>
              <Button
                type="link"
                disabled={!workflowStatus?.processModelId}
                onClick={() =>
                  workflowStatus?.processModelId
                    ? history.push(
                        `/process-designer?modelId=${workflowStatus.processModelId}`,
                      )
                    : undefined
                }
              >
                查看设计
              </Button>
              <Button type="link" onClick={() => history.push('/audit-logs')}>
                查审计
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
        <ProTable<WorkflowReadinessRow>
          rowKey="key"
          columns={workflowColumns}
          dataSource={workflowRows}
          search={false}
          pagination={false}
          options={false}
          size="small"
          scroll={{ x: 720 }}
        />
      </ProCard>

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
