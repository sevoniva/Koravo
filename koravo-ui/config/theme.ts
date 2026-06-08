import { generate } from '@ant-design/colors';

export const KORAVO_PRIMARY_COLOR = '#1890ff';
export const koravoPrimaryPalette = generate(KORAVO_PRIMARY_COLOR);

export const koravoSurfaceColors = {
  pageBg: '#f3f8ff',
  pageHeaderBg: '#eaf4ff',
  containerBg: '#ffffff',
  border: '#d7e7f8',
  tableHeaderBg: '#f2f8ff',
  text: '#172033',
} as const;

export const koravoLayoutToken = {
  bgLayout: koravoSurfaceColors.pageBg,
  sider: {
    colorMenuBackground: '#fbfdff',
    colorBgMenuItemHover: koravoPrimaryPalette[0],
    colorBgMenuItemSelected: koravoPrimaryPalette[0],
    colorTextMenuSelected: KORAVO_PRIMARY_COLOR,
    colorTextMenuActive: KORAVO_PRIMARY_COLOR,
    colorTextMenuItemHover: KORAVO_PRIMARY_COLOR,
    colorMenuItemDivider: koravoSurfaceColors.border,
  },
  header: {
    colorBgHeader: koravoSurfaceColors.containerBg,
    colorBgScrollHeader: koravoSurfaceColors.containerBg,
    colorBgRightActionsItemHover: koravoPrimaryPalette[0],
    colorTextMenuSelected: KORAVO_PRIMARY_COLOR,
    colorTextMenuActive: KORAVO_PRIMARY_COLOR,
  },
  pageContainer: {
    colorBgPageContainer: koravoSurfaceColors.pageHeaderBg,
    colorBgPageContainerFixed: koravoSurfaceColors.pageHeaderBg,
  },
} as const;

export const koravoAntdTheme = {
  token: {
    colorPrimary: KORAVO_PRIMARY_COLOR,
    colorInfo: KORAVO_PRIMARY_COLOR,
    colorLink: KORAVO_PRIMARY_COLOR,
    colorPrimaryBg: koravoPrimaryPalette[0],
    colorPrimaryBgHover: koravoPrimaryPalette[1],
    colorPrimaryBorder: koravoPrimaryPalette[2],
    colorPrimaryHover: koravoPrimaryPalette[4],
    colorPrimaryActive: koravoPrimaryPalette[6],
    colorBgLayout: koravoSurfaceColors.pageBg,
    colorFillAlter: koravoSurfaceColors.tableHeaderBg,
    colorBorderSecondary: koravoSurfaceColors.border,
    colorText: koravoSurfaceColors.text,
    fontFamily: 'AlibabaSans, sans-serif',
    borderRadius: 6,
    borderRadiusLG: 8,
  },
} as const;
