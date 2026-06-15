import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExceptionDiagnostics from './ExceptionDiagnostics';

vi.mock('@ant-design/pro-components', async () => {
  const React = await import('react');
  return {
    ProTable: ({
      columns,
      dataSource,
    }: {
      columns: any[];
      dataSource: any[];
    }) =>
      React.createElement(
        'table',
        {},
        React.createElement(
          'tbody',
          {},
          dataSource.map((record) =>
            React.createElement(
              'tr',
              { key: record.key },
              columns.map((column) =>
                React.createElement(
                  'td',
                  { key: column.dataIndex || column.title },
                  record[column.dataIndex],
                ),
              ),
            ),
          ),
        ),
      ),
  };
});

describe('ExceptionDiagnostics', () => {
  it('shows a diagnosis summary before raw stack text', () => {
    render(
      <ExceptionDiagnostics
        value={`java.lang.IllegalStateException: connector timeout
at io.koravo.ops.service.ProcessOpsService.retry(ProcessOpsService.java:42)`}
      />,
    );

    expect(screen.getByText('异常类型')).toBeInTheDocument();
    expect(screen.getByText('IllegalStateException')).toBeInTheDocument();
    expect(screen.getByText('异常信息')).toBeInTheDocument();
    expect(screen.getByText('connector timeout')).toBeInTheDocument();
    expect(screen.getByText('发生位置')).toBeInTheDocument();
    expect(screen.getByText('原始错误文本')).toBeInTheDocument();
    expect(screen.queryByText(/io\.koravo\.ops\.service/)).not.toBeInTheDocument();
  });

  it('renders an empty state when no stack trace is available', () => {
    render(<ExceptionDiagnostics />);

    expect(screen.getByText('暂无错误详情')).toBeInTheDocument();
  });
});
