import { describe, expect, it } from 'vitest';
import {
  buildVersionLabel,
  businessFieldLabel,
  businessKeyLabel,
  connectionAddressLabel,
  isBusinessProcessModel,
  processDefinitionLabel,
  processDisplayName,
  processModelKeyLabel,
  processNameLabel,
  productCopy,
  shortTraceLabel,
} from './display';

describe('display helpers', () => {
  it('uses product process identifiers for visible process model labels', () => {
    expect(processModelKeyLabel('collaborativeApproval')).toBe('collaborativeApproval');
    expect(processModelKeyLabel('koravoProcessmq5amzdq')).toBe('koravoProcessmq5amzdq');
  });

  it('normalizes process names and definitions', () => {
    expect(processDisplayName('koravo Processmq5amzdq')).toBe('koravo Processmq5amzdq');
    expect(processDisplayName('collaborativeApproval')).toBe('协同审批流程');
    expect(processDefinitionLabel('collaborativeApproval:1:5fed0551')).toBe('协同审批流程 v1');
    expect(processNameLabel('koravo Processmq5amzdq')).toBe('koravo Processmq5amzdq');
  });

  it('keeps historical business object prefixes visible for data cleanup', () => {
    expect(businessKeyLabel('PO-CONTINUE-20260609-0437')).toBe(
      'PO-CONTINUE-20260609-0437',
    );
    expect(businessKeyLabel('任务：PO-CONTINUE-20260609-0437')).toBe(
      '任务：PO-CONTINUE-20260609-0437',
    );
    expect(businessKeyLabel('HTTP-1780845610965')).toBe('HTTP-1780845610965');
  });

  it('keeps legacy demo markers visible for governance cleanup', () => {
    expect(shortTraceLabel('demo-http-connector')).toBe('demo-htt');
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
    expect(businessFieldLabel('X-Koravo-User-Role')).toBe('职责');
  });

  it('does not hide non-business-looking process models in admin surfaces', () => {
    expect(
      isBusinessProcessModel({
        modelKey: 'designerDeployCheck',
        modelName: '流程发布检查',
        description: '验证设计器部署入口',
      }),
    ).toBe(true);
    expect(
      isBusinessProcessModel({
        modelKey: 'koravoProcessmq5amzdq',
        modelName: '新12313流程123',
        description: '',
      }),
    ).toBe(true);
    expect(
      isBusinessProcessModel({
        modelKey: 'collaborativeApproval',
        modelName: '协同审批流程',
        description: '业务申请提交后并行处理。',
      }),
    ).toBe(true);
  });
});
