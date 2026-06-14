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
    font-size: ${token.fontSizeSM - 1}px;
  `,
}));

const Footer: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.footer}>
      <div className={styles.meta}>
        <span>Koravo</span>
        <Divider orientation="vertical" />
        <span>流程协作平台</span>
      </div>
    </div>
  );
};

export default Footer;
