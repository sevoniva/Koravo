import { describe, expect, it } from 'vitest';
import { connectionAddressLabel, processModelKeyLabel, shortTraceLabel } from './display';

describe('display helpers', () => {
  it('hides legacy demo identifiers from visible process model labels', () => {
    expect(processModelKeyLabel('httpConnectorDemo')).toBe('httpHealthCheck');
  });

  it('hides legacy demo markers from visible trace labels', () => {
    expect(shortTraceLabel('demo-http-connector')).not.toContain('demo');
    expect(shortTraceLabel('demo-http-connector')).toMatch(/^TRACE-/);
  });

  it('hides local development addresses from primary labels', () => {
    expect(connectionAddressLabel('http://localhost:8080/api/v1/health')).toBe(
      '本地服务健康检查',
    );
    expect(connectionAddressLabel('jdbc:postgresql://127.0.0.1:5432/koravo')).toBe(
      '本地数据源连接',
    );
  });
});
