import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Empty } from 'antd';
import React from 'react';

const PlaceholderPage: React.FC<{
  title?: string;
  description?: string;
}> = ({ title = '页面建设中', description = '该模块将在下一批迁移中接入业务数据。' }) => (
  <PageContainer title={title} content={description}>
    <ProCard>
      <Empty description="功能迁移中" />
    </ProCard>
  </PageContainer>
);

export default PlaceholderPage;
