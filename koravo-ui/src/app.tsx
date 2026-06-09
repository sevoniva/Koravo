import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { App as AntdApp, Button, Tooltip } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import { ErrorBoundary, Footer, OfflineBanner } from '@/components';
import { setFeedbackApis } from '@/services/koravo/feedback';
import {
  sessionActorLabel,
  sessionScopeLabel,
} from '@/services/koravo/organization';
import {
  getSessionContext,
  type SessionContext,
  type SessionRole,
} from '@/services/koravo/session';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

dayjs.extend(relativeTime);

export interface KoravoCurrentUser {
  name: string;
  userid: string;
  access: SessionRole;
  tenantId: string;
}

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: KoravoCurrentUser;
  session: SessionContext;
}> {
  const session = getSessionContext();
  return {
    currentUser: {
      name: sessionActorLabel(session),
      userid: session.userId,
      access: session.role,
      tenantId: session.tenantId,
    },
    session,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  const session = initialState?.session ?? getSessionContext();

  return {
    menuItemRender: (item, dom) => {
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {dom}
          </Link>
        );
      }
      return dom;
    },
    actionsRender: () => [
      <Tooltip title="系统设置" key="settings">
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={() => history.push('/system-settings')}
        />
      </Tooltip>,
    ],
    avatarProps: {
      icon: <UserOutlined />,
      title: sessionScopeLabel(session),
    },
    footerRender: () => <Footer />,
    ErrorBoundary,
    menuHeaderRender: undefined,
    ...initialState?.settings,
  };
};

export const request: RequestConfig = {
  baseURL: '',
  ...errorConfig,
};

const FeedbackBridge: React.FC = () => {
  const { message, notification } = AntdApp.useApp();

  React.useEffect(() => {
    setFeedbackApis({ message, notification });
  }, [message, notification]);

  return null;
};

export function rootContainer(container: React.ReactNode) {
  return (
    <AntdApp>
      <FeedbackBridge />
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </AntdApp>
  );
}
