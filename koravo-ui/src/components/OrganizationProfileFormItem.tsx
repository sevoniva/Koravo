import { Form, Input, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo } from 'react';

interface OrganizationProfileFormItemProps {
  name: string | Array<string | number>;
  label: string;
  value?: string;
  required?: boolean;
  sourceText?: string;
  preserve?: boolean;
}

const OrganizationProfileFormItem: React.FC<
  OrganizationProfileFormItemProps
> = ({ name, label, value, required, sourceText = '组织档案', preserve = true }) => {
  const form = Form.useFormInstance();
  const displayValue = value || '-';
  const namePathKey = Array.isArray(name) ? name.join('.') : name;
  const namePath = useMemo(() => name, [namePathKey]);

  useEffect(() => {
    form.setFieldValue(namePath, displayValue);
  }, [displayValue, form, namePath]);

  return (
    <>
      <Form.Item
        name={namePath}
        initialValue={displayValue}
        hidden
        preserve={preserve}
      >
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
