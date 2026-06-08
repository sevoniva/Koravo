import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Typography } from 'antd';
import React from 'react';
import { shortTraceLabel } from '@/utils/display';

export const CopyableText: React.FC<{
  value?: string | number | null;
  displayValue?: string;
}> = ({ value, displayValue }) => {
  const { message } = App.useApp();

  if (value === undefined || value === null || value === '') return <>-</>;
  const text = String(value);

  return (
    <Typography.Text>
      {displayValue || shortTraceLabel(text)}
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          message.success('已复制');
        }}
      />
    </Typography.Text>
  );
};
