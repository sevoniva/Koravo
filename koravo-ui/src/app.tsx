import { UserOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { App as AntdApp } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import { ErrorBoundary, Footer, OfflineBanner } from '@/components';
import type { OrganizationMemberItem } from '@/services/koravo/api';
import { logout } from '@/services/koravo/api';
import { setFeedbackApis } from '@/services/koravo/feedback';
import {
  sessionActorLabel,
  sessionScopeLabel,
  setOrganizationMembers,
} from '@/services/koravo/organization';
import {
  clearAuthSession,
  defaultRouteForRole,
  getSessionContext,
  hasAuthSession,
  type SessionContext,
  type SessionPermissions,
  type SessionRole,
  sessionRequestHeaders,
  setRuntimeSessionContext,
} from '@/services/koravo/session';
import defaultSettings from '../config/defaultSettings';
import { errorConfig, loginRedirectPath } from './requestErrorConfig';

dayjs.extend(relativeTime);

export interface KoravoCurrentUser {
  name: string;
  userid: string;
  access: SessionRole;
  tenantId: string;
  permissions?: SessionPermissions;
}

interface HealthResponse {
  success?: boolean;
  data?: {
    tenantId?: string;
    userId?: string;
    role?: SessionRole;
    requestId?: string;
    permissions?: SessionPermissions;
  };
  requestId?: string;
}

interface OrganizationMembersResponse {
  success?: boolean;
  data?: OrganizationMemberItem[];
}

async function loadRuntimeSession() {
  if (!hasAuthSession()) return getSessionContext();
  try {
    const response = await fetch('/api/v1/health', {
      headers: sessionRequestHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401) clearAuthSession();
      return getSessionContext();
    }
    const payload = (await response.json()) as HealthResponse;
    if (payload.success === false || !payload.data) return getSessionContext();
    setRuntimeSessionContext({
      tenantId: payload.data.tenantId,
      userId: payload.data.userId,
      role: payload.data.role,
      requestId: payload.requestId || payload.data.requestId,
      permissions: payload.data.permissions,
    });
  } catch {
    return getSessionContext();
  }
  return getSessionContext();
}

async function loadOrganizationDirectory() {
  if (!hasAuthSession()) {
    setOrganizationMembers([]);
    return;
  }
  try {
    const response = await fetch('/api/v1/organization/members', {
      headers: sessionRequestHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401) clearAuthSession();
      setOrganizationMembers([]);
      return;
    }
    const payload = (await response.json()) as OrganizationMembersResponse;
    if (payload.success === false || !Array.isArray(payload.data)) {
      setOrganizationMembers([]);
      return;
    }
    setOrganizationMembers(payload.data);
  } catch {
    setOrganizationMembers([]);
  }
}

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: KoravoCurrentUser;
  session: SessionContext;
}> {
  const session = await loadRuntimeSession();
  await loadOrganizationDirectory();
  return {
    currentUser: session.token
      ? {
          name: sessionActorLabel(session),
          userid: session.userId,
          access: session.role,
          tenantId: session.tenantId,
          permissions: session.permissions,
        }
      : undefined,
    session,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  const session = initialState?.session ?? getSessionContext();

  return {
    onPageChange: () => {
      const { location } = history;
      if (!initialState?.currentUser && location.pathname !== '/login') {
        history.replace(loginRedirectPath(location));
      }
      if (initialState?.currentUser && location.pathname === '/login') {
        history.replace(defaultRouteForRole(initialState.currentUser.access));
      }
    },
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
    avatarProps: {
      icon: <UserOutlined />,
      title: sessionScopeLabel(session),
      menu: {
        items: [{ key: 'logout', label: '退出登录' }],
        onClick: async ({ key }: { key: string }) => {
          if (key !== 'logout') return;
          try {
            await logout();
          } catch {
            // Session cleanup must happen even when the server has already expired it.
          }
          clearAuthSession();
          history.replace('/login');
          window.location.reload();
        },
      },
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
