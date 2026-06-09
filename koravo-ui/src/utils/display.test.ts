import { describe, expect, it } from 'vitest';
import {
  buildVersionLabel,
  businessFieldLabel,
  connectionAddressLabel,
  isBusinessProcessModel,
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
    expect(
      connectionAddressLabel('jdbc:postgresql://127.0.0.1:5432/koravo'),
    ).toBe('本地数据源连接');
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

  it('uses business labels for operation diagnostics fields', () => {
    expect(businessFieldLabel('handlerConfiguration')).toBe('处理器配置');
    expect(businessFieldLabel('executionId')).toBe('执行编号');
    expect(businessFieldLabel('delegateExpression')).toBe('执行表达式');
  });

  it('filters non-business process models consistently', () => {
    expect(
      isBusinessProcessModel({
        modelKey: 'designerDeployCheck',
        modelName: '流程发布检查',
        description: '验证设计器部署入口',
      }),
    ).toBe(false);
    expect(
      isBusinessProcessModel({
        modelKey: 'koravoProcessmq5amzdq',
        modelName: '新12313流程123',
        description: '',
      }),
    ).toBe(false);
    expect(
      isBusinessProcessModel({
        modelKey: 'multiAcceptance',
        modelName: '多人验收流程',
        description: '验收申请提交后并行处理。',
      }),
    ).toBe(true);
  });
});
