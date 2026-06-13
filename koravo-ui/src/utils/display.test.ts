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
  genericStatusLabel,
  isBusinessProcessModel,
  isActiveBusinessProcessModel,
  normalizeBpmnXmlLabels,
  processDescriptionLabel,
  processDefinitionLabel,
  processDisplayName,
  processModelKeyLabel,
  processNameLabel,
  productCopy,
  shortTraceLabel,
  taskDefinitionLabel,
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

  it('keeps historical asset markers visible for governance cleanup', () => {
    expect(shortTraceLabel('legacy-http-connector')).toBe('legacy-h');
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
        description: 'Imported legacy model',
      }),
    ).toBe('Imported legacy model');
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

  it('normalizes generated workflow node names for product surfaces', () => {
    expect(taskDefinitionLabel('businessReviewTask')).toBe('业务审批');
    expect(taskDefinitionLabel('financeReviewTask')).toBe('财务复核');
    expect(taskDefinitionLabel('dept05_approval_01')).toBe('业务五部一审');
    expect(taskDefinitionLabel('dept05_approval_04')).toBe('业务五部四审');
    expect(taskDefinitionLabel('dept_05_sub_process')).toBe('业务五部流程');
    expect(taskDefinitionLabel('dept_05_sub_process_start')).toBe(
      '进入业务五部流程',
    );
    expect(taskDefinitionLabel('dept_05_sub_process_end')).toBe(
      '业务五部流程完成',
    );
    expect(
      taskDefinitionLabel('legacyTask', { name: '部门03审批节点02' }),
    ).toBe('业务三部二审');
    expect(
      taskDefinitionLabel('legacySubProcess', { name: 'dept-07子流程' }),
    ).toBe('业务七部流程');
    expect(taskDefinitionLabel(undefined, { name: 'dept-09子流程' })).toBe(
      '业务九部流程',
    );
  });

  it('normalizes generated labels inside bpmn xml before rendering', () => {
    const normalized = normalizeBpmnXmlLabels(`
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
        <process id="collaborativeApproval">
          <subProcess id="dept_05_sub_process" name="dept-05子流程">
            <startEvent id="dept_05_sub_process_start" name="进入子流程"/>
            <userTask id="dept05_approval_01" name="部门05审批节点01"/>
            <endEvent id="dept_05_sub_process_end" name="子流程完成"/>
          </subProcess>
        </process>
      </definitions>
    `);

    expect(normalized).toContain('name="业务五部流程"');
    expect(normalized).toContain('name="进入业务五部流程"');
    expect(normalized).toContain('name="业务五部一审"');
    expect(normalized).toContain('name="业务五部流程完成"');
    expect(normalized).not.toContain('dept-05子流程');
    expect(normalized).not.toContain('部门05审批节点01');
  });

  it('uses product labels for authentication audit records', () => {
    expect(auditActionLabel('AUTH_LOGIN')).toBe('登录系统');
    expect(auditActionLabel('AUTH_LOGOUT')).toBe('退出登录');
    expect(auditResourceLabel('LOGIN_SESSION')).toBe('登录会话');
  });

  it('uses product labels for production audit actions', () => {
    expect(auditActionLabel('FORM_SCHEMA_RESTORE_VERSION')).toBe('恢复表单版本');
    expect(auditActionLabel('FORM_SCHEMA_ACTIVATE')).toBe('启用表单');
    expect(auditActionLabel('FORM_SCHEMA_DISABLE')).toBe('停用表单');
    expect(auditActionLabel('ORG_MEMBER_PASSWORD_RESET')).toBe('重置成员密码');
    expect(auditActionLabel('FAILED_JOB_RETRY')).toBe('重试失败任务');
    expect(auditActionLabel('DEAD_LETTER_JOB_DELETE')).toBe('删除死信任务');
    expect(auditResourceLabel('ORGANIZATION_MEMBER')).toBe('组织成员');
  });

  it('uses readable labels for audit detail fields and generic statuses', () => {
    expect(businessFieldLabel('deploymentId')).toBe('部署编号');
    expect(businessFieldLabel('jobId')).toBe('任务编号');
    expect(businessFieldLabel('exceptionMessage')).toBe('异常信息');
    expect(businessFieldLabel('exceptionStacktrace')).toBe('异常堆栈');
    expect(businessFieldLabel('fromVersion')).toBe('恢复版本');
    expect(genericStatusLabel('ACTIVE')).toBe('启用');
    expect(genericStatusLabel('DISABLED')).toBe('已停用');
  });

  it('labels workflow asset origins for governance surfaces', () => {
    expect(assetOriginLabel('SYSTEM_TEMPLATE')).toBe('系统模板');
    expect(assetOriginLabel('USER_FLOW')).toBe('用户流程');
    expect(assetOriginLabel('LEGACY_DEMO')).toBe('历史资产');
    expect(assetOriginColor('LEGACY_DEMO')).toBe('warning');
    expect(assetOriginColor(undefined)).toBe('default');
  });

  it('does not hide non-business-looking process models in admin surfaces', () => {
    expect(isBusinessProcessModel(undefined)).toBe(false);
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

  it('keeps archived process models out of default business lists', () => {
    expect(isActiveBusinessProcessModel(undefined)).toBe(false);
    expect(
      isActiveBusinessProcessModel({
        modelKey: 'collaborativeApproval',
        modelName: '协同审批流程',
        description: '业务申请提交后并行处理。',
        status: 'DEPLOYED',
      }),
    ).toBe(true);
    expect(
      isActiveBusinessProcessModel({
        modelKey: 'bindingNext_mq5ilw5vmlw',
        modelName: '绑定后续验证流程',
        description: '验证绑定后续动作',
        status: 'ARCHIVED',
      }),
    ).toBe(false);
  });
});
