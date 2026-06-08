import {
  KORAVO_PRIMARY_COLOR,
  koravoPrimaryPalette,
  koravoSurfaceColors,
} from '@root/config/theme';

if (typeof document !== 'undefined') {
  const root = document.documentElement;
  root.style.setProperty('--koravo-primary', KORAVO_PRIMARY_COLOR);
  root.style.setProperty('--koravo-primary-1', koravoPrimaryPalette[0]);
  root.style.setProperty('--koravo-primary-2', koravoPrimaryPalette[1]);
  root.style.setProperty('--koravo-primary-3', koravoPrimaryPalette[2]);
  root.style.setProperty('--koravo-primary-5', koravoPrimaryPalette[4]);
  root.style.setProperty('--koravo-primary-7', koravoPrimaryPalette[6]);
  root.style.setProperty('--koravo-page-bg', koravoSurfaceColors.pageBg);
  root.style.setProperty(
    '--koravo-page-header-bg',
    koravoSurfaceColors.pageHeaderBg,
  );
  root.style.setProperty('--koravo-container-bg', koravoSurfaceColors.containerBg);
  root.style.setProperty('--koravo-border', koravoSurfaceColors.border);
  root.style.setProperty(
    '--koravo-table-header-bg',
    koravoSurfaceColors.tableHeaderBg,
  );
  root.style.setProperty('--koravo-text', koravoSurfaceColors.text);
}
