import { describe, expect, it } from 'vitest';
import {
  buildVersionLabel,
  connectionAddressLabel,
  processModelKeyLabel,
  productCopy,
  shortTraceLabel,
} from './display';

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

  it('hides raw build markers from product copy', () => {
    expect(buildVersionLabel('0.1.0-SNAPSHOT')).toBe('预发布构建');
    expect(productCopy('v0.1 未接入对象存储健康探测')).toBe(
      '对象存储健康探测暂未启用',
    );
    expect(productCopy('允许 localhost；公网地址必须使用 HTTPS')).toBe(
      '允许本地服务地址；公网地址必须使用 HTTPS',
    );
  });
});
