import { describe, expect, it } from 'vitest';
import {
  auditActionLabel,
  auditResourceLabel,
  assetOriginColor,
  assetOriginLabel,
  buildVersionLabel,
  businessFieldLabel,
  businessKeyLabel,
  connectionAddressLabel,
  isBusinessProcessModel,
  processDescriptionLabel,
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

  it('keeps stored process descriptions unchanged instead of masking legacy copy', () => {
    expect(
      processDescriptionLabel({
        modelKey: 'expenseApproval',
        description: 'Imported demo model',
      }),
    ).toBe('Imported demo model');
    expect(
      processDescriptionLabel({
        modelKey: 'collaborativeApproval',
        description: '',
      }),
    ).toBe('协同审批流程');
  });

  it('uses business labels for operation diagnostics fields', () => {
    expect(businessFieldLabel('handlerConfiguration')).toBe('处理器配置');
    expect(businessFieldLabel('executionId')).toBe('执行编号');
    expect(businessFieldLabel('delegateExpression')).toBe('执行表达式');
    expect(businessFieldLabel('X-Koravo-User-Role')).toBe('职责');
  });

  it('uses product labels for authentication audit records', () => {
    expect(auditActionLabel('AUTH_LOGIN')).toBe('登录系统');
    expect(auditActionLabel('AUTH_LOGOUT')).toBe('退出登录');
    expect(auditResourceLabel('LOGIN_SESSION')).toBe('登录会话');
  });

  it('labels workflow asset origins for governance surfaces', () => {
    expect(assetOriginLabel('SYSTEM_TEMPLATE')).toBe('系统模板');
    expect(assetOriginLabel('USER_FLOW')).toBe('用户流程');
    expect(assetOriginLabel('LEGACY_DEMO')).toBe('历史演示');
    expect(assetOriginColor('LEGACY_DEMO')).toBe('warning');
    expect(assetOriginColor(undefined)).toBe('default');
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
