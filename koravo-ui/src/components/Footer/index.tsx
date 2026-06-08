import packageJson from '@root/package.json';
import { Divider } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

const useStyles = createStyles(({ token, css }) => ({
  footer: css`
    padding: 16px 24px;
    text-align: center;
    color: ${token.colorTextDescription};
    font-size: ${token.fontSizeSM}px;
    line-height: ${token.lineHeight};
    background: transparent;
  `,
  meta: css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-family: ${token.fontFamilyCode};
    font-size: ${token.fontSizeSM - 1}px;
  `,
  label: css`
    color: ${token.colorTextQuaternary};
  `,
}));

const Footer: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.footer}>
      <div className={styles.meta}>
        <span>Koravo Console</span>
        <Divider orientation="vertical" />
        <span>
          <span className={styles.label}>版本 </span>
          {packageJson.version}
        </span>
        <Divider orientation="vertical" />
        <span>
          <span className={styles.label}>Umi </span>
          {__UMI_VERSION__}
        </span>
      </div>
    </div>
  );
};

export default Footer;
