import { Form, Input, Space, Tag, Typography } from 'antd';
import type React from 'react';

interface OrganizationProfileFormItemProps {
  name: string | Array<string | number>;
  label: string;
  value?: string;
  required?: boolean;
  sourceText?: string;
}

const OrganizationProfileFormItem: React.FC<
  OrganizationProfileFormItemProps
> = ({ name, label, value, required, sourceText = '组织档案' }) => {
  const displayValue = value || '-';

  return (
    <>
      <Form.Item name={name} initialValue={displayValue} hidden>
        <Input type="hidden" />
      </Form.Item>
      <Form.Item label={label} required={required}>
        <Space size={8} wrap>
          <Typography.Text>{displayValue}</Typography.Text>
          <Tag color="processing">{sourceText}自动带出</Tag>
        </Space>
      </Form.Item>
    </>
  );
};

export default OrganizationProfileFormItem;
