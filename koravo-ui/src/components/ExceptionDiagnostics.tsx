import { Collapse, Empty, Space, Typography } from 'antd';
import React from 'react';
import { summarizeExceptionStacktrace } from '@/utils/exceptionDiagnostics';
import StructuredDetailTable from './StructuredDetailTable';

interface ExceptionDiagnosticsProps {
  value?: string | null;
}

const rawTextStyle: React.CSSProperties = {
  marginBottom: 0,
  maxHeight: 280,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const ExceptionDiagnostics: React.FC<ExceptionDiagnosticsProps> = ({
  value,
}) => {
  const summary = summarizeExceptionStacktrace(value);

  if (!summary.hasRawText) {
    return <Empty description="暂无错误详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Space vertical size={12} style={{ width: '100%' }}>
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
            label: '原始错误文本',
            children: (
              <Typography.Paragraph
                copyable={{ text: summary.rawText }}
                style={rawTextStyle}
              >
                {summary.rawText}
              </Typography.Paragraph>
            ),
          },
        ]}
      />
    </Space>
  );
};

export default ExceptionDiagnostics;
