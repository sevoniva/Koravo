import {
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { Button, Tooltip } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import { ErrorBoundary, Footer, OfflineBanner } from '@/components';
import {
  getSessionContext,
  type SessionContext,
} from '@/services/koravo/session';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

dayjs.extend(relativeTime);

export interface KoravoCurrentUser {
  name: string;
  userid: string;
  access: 'admin';
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
      name: session.userId,
      userid: session.userId,
      access: 'admin',
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
      <Tooltip title="流程启用" key="quick-start">
        <Button
          type="text"
          icon={<ThunderboltOutlined />}
          onClick={() => history.push('/quick-start')}
        />
      </Tooltip>,
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
      title: `${session.tenantId} / ${session.userId}`,
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

export function rootContainer(container: React.ReactNode) {
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </>
  );
}
