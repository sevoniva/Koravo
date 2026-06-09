import component from './zh-CN/component';
import menu from './zh-CN/menu';
import network from './zh-CN/network';
import pages from './zh-CN/pages';

export default {
  'navBar.lang': '语言',
  'layout.user.link.help': '使用文档',
  'layout.user.link.privacy': '隐私政策',
  'layout.user.link.terms': '服务条款',
  ...pages,
  ...menu,
  ...network,
  ...component,
};
