import type { ProLayoutProps } from '@ant-design/pro-components';
import { KORAVO_PRIMARY_COLOR, koravoLayoutToken } from './theme';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: KORAVO_PRIMARY_COLOR,
  layout: 'side',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: 'Koravo',
  logo: '/logo.svg',
  iconfontUrl: '',
  token: koravoLayoutToken,
};

export default Settings;
