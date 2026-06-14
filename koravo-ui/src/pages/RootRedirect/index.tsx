import { history, useModel } from '@umijs/max';
import React from 'react';
import { defaultRouteForRole } from '@/services/koravo/session';

const RootRedirect: React.FC = () => {
  const { initialState } = useModel('@@initialState');

  React.useEffect(() => {
    if (!initialState?.currentUser) {
      history.replace('/login');
      return;
    }
    history.replace(defaultRouteForRole(initialState.currentUser.access));
  }, [initialState?.currentUser]);

  return null;
};

export default RootRedirect;
