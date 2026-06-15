import { describe, expect, it } from 'vitest';
import {
  connectorExecutionResultSummary,
  connectorExecutionStatusTitle,
  connectorExecutionTitle,
  connectorMethodDisplay,
  connectorMethodOptions,
  connectorRequestDisplay,
  connectorTraceDisplay,
} from './connectorExecution';

describe('connector execution display helpers', () => {
  it('formats connector execution title with business address labels', () => {
    expect(
      connectorExecutionTitle({
        connectorType: 'http',
        url: 'http://localhost:8080/actuator/health',
      }),
    ).toBe('HTTP · 本地服务健康检查');
  });

  it('formats result summary without leaking request payload text', () => {
    expect(
      connectorExecutionResultSummary({
        connectorType: 'http',
        elapsedMillis: 120,
        status: 'FAILED',
        statusCode: 500,
        url: 'https://api.example.com/workflow',
      }),
    ).toBe('状态码 500，耗时 120 ms');
  });

  it('formats connector request methods as product labels', () => {
    expect(connectorMethodDisplay('POST')).toBe('提交');
    expect(connectorMethodOptions).toContainEqual({
      label: '读取',
      value: 'GET',
    });
    expect(
      connectorRequestDisplay({
        method: 'GET',
        url: 'http://localhost:8080/actuator/health',
      }),
    ).toBe('读取 本地服务健康检查');
  });

  it('formats status and trace labels', () => {
    expect(connectorExecutionStatusTitle('SUCCESS')).toBe('连接器调用成功');
    expect(connectorExecutionStatusTitle('FAILED')).toBe('连接器调用失败');
    expect(connectorTraceDisplay('request-20260614-abcdef')).toBe('request-');
  });
});
