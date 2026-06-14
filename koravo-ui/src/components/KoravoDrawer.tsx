import { Drawer, type DrawerProps } from 'antd';
import React from 'react';

type DrawerStyleObject = Record<string, React.CSSProperties | undefined>;

const KoravoDrawer: React.FC<DrawerProps> = ({
  destroyOnHidden = true,
  open,
  styles,
  ...props
}) => {
  const styleObject =
    typeof styles === 'function'
      ? undefined
      : (styles as DrawerStyleObject | undefined);
  const stableStyles = open
    ? {
        ...styleObject,
        root: { ...styleObject?.root, pointerEvents: 'auto' as const },
        wrapper: { ...styleObject?.wrapper, transform: 'none' },
      } as DrawerProps['styles']
    : styles;

  return (
    <Drawer
      {...props}
      destroyOnHidden={destroyOnHidden}
      open={open}
      styles={stableStyles}
    />
  );
};

export default KoravoDrawer;
