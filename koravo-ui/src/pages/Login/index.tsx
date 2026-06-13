import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { login } from '@/services/koravo/api';
import {
  loginSuccessRedirectPath,
  type SessionRole,
  setAuthSession,
} from '@/services/koravo/session';
import { passwordPolicyRules } from '@/utils/passwordPolicy';

interface LoginFormValues {
  tenantId?: string;
  userId: string;
  password: string;
}

const useStyles = createStyles(({ token, css }) => ({
  page: css`
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 32px 16px;
    background: ${token.colorBgLayout};
  `,
  panel: css`
    width: min(420px, 100%);
    padding: 32px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  header: css`
    margin-bottom: 24px;
  `,
  title: css`
    margin-bottom: 8px !important;
  `,
  submit: css`
    width: 100%;
  `,
}));

const Login: React.FC = () => {
  const { message } = App.useApp();
  const { styles } = useStyles();
  const [submitting, setSubmitting] = React.useState(false);

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const session = await login({
        tenantId: values.tenantId?.trim() || 'default',
        userId: values.userId.trim(),
        password: values.password,
      });
      setAuthSession({
        token: session.token,
        tenantId: session.tenantId,
        userId: session.userId,
        role: session.role as SessionRole,
        expiresAt: session.expiresAt,
        permissions: session.permissions,
      });
      message.success('登录成功');
      window.location.href = loginSuccessRedirectPath(session.role as SessionRole);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <Typography.Title level={3} className={styles.title}>
            Koravo
          </Typography.Title>
          <Typography.Text type="secondary">
            使用组织成员账号进入工作流平台
          </Typography.Text>
        </div>
        <Form<LoginFormValues>
          layout="vertical"
          requiredMark={false}
          initialValues={{ tenantId: 'default' }}
          onFinish={handleFinish}
        >
          <Form.Item
            label="组织"
            name="tenantId"
            rules={[{ required: true, message: '请输入组织标识' }]}
          >
            <Input
              allowClear
              placeholder="请输入组织标识"
              autoComplete="organization"
            />
          </Form.Item>
          <Form.Item
            label="成员账号"
            name="userId"
            rules={[{ required: true, message: '请输入成员账号' }]}
          >
            <Input
              allowClear
              prefix={<UserOutlined />}
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            label="登录密码"
            name="password"
            rules={[
              { required: true, message: '请输入登录密码' },
              ...passwordPolicyRules,
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            className={styles.submit}
          >
            登录
          </Button>
        </Form>
      </section>
    </div>
  );
};

export default Login;
