import { history, useLocation } from '@umijs/max';
import { Button, Card, Result, Space } from 'antd';
import React from 'react';
import {
  clearAuthSession,
  getSessionContext,
} from '@/services/koravo/session';
import { accessDeniedHomePath, accessDeniedLoginPath } from './accessDenied';

const Exception403: React.FC = () => {
  const location = useLocation();
  const session = getSessionContext();
  const homePath = accessDeniedHomePath(session.role);

  const switchAccount = () => {
    clearAuthSession();
    history.replace(
      accessDeniedLoginPath({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }),
    );
    window.location.reload();
  };

  return (
    <Card variant="borderless">
      <Result
        status="403"
        title="无权访问"
        subTitle="当前账号没有访问此页面的权限。"
        extra={
          <Space wrap>
            <Button type="primary" onClick={() => history.replace(homePath)}>
              返回可访问首页
            </Button>
            <Button onClick={switchAccount}>切换账号</Button>
          </Space>
        }
      />
    </Card>
  );
};

export default Exception403;
