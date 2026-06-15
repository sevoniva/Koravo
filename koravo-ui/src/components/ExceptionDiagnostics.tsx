import { Alert, Collapse, Empty, Space, Typography } from 'antd';
import React from 'react';
import { summarizeExceptionStacktrace } from '@/utils/exceptionDiagnostics';
import StructuredDetailTable from './StructuredDetailTable';

interface ExceptionDiagnosticsProps {
  value?: string | null;
}

const ExceptionDiagnostics: React.FC<ExceptionDiagnosticsProps> = ({
  value,
}) => {
  const summary = summarizeExceptionStacktrace(value);

  if (!summary.hasRawText) {
    return <Empty description="暂无错误详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Space vertical size={12} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        title="已整理错误摘要"
        description="完整排障信息已保留，可复制后交给维护人员定位。"
      />
      <StructuredDetailTable
        value={{
          exceptionType: summary.exceptionType,
          exceptionMessage: summary.exceptionMessage,
          rootCause: summary.rootCause,
          applicationFrame: summary.applicationFrame,
          stackFrameCount: summary.stackFrameCount,
        }}
        emptyText="暂无错误摘要"
      />
      <Collapse
        destroyOnHidden
        size="small"
        items={[
          {
            key: 'raw',
            label: '排障信息',
            children: (
              <Typography.Text
                copyable={{
                  text: summary.rawText,
                  tooltips: ['复制排障信息', '已复制'],
                }}
              >
                复制完整排障信息
              </Typography.Text>
            ),
          },
        ]}
      />
    </Space>
  );
};

export default ExceptionDiagnostics;
