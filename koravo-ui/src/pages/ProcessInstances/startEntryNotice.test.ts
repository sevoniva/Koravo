import { describe, expect, it, vi } from 'vitest';
import type {
  BpmnTaskDefinition,
  FormBindingItem,
  FormSchemaItem,
  ProcessModelItem,
  StartableWorkflowItem,
} from '@/services/koravo/api';
import { buildStartWorkflowReadiness, resolveStartEntryNotice } from './index';

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProCard: ({ children }: { children?: unknown }) => children,
  ProForm: ({ children }: { children?: unknown }) => children,
  ProFormDatePicker: () => null,
  ProFormDependency: () => null,
  ProFormDigit: () => null,
  ProFormSelect: () => null,
  ProFormSwitch: () => null,
  ProFormText: () => null,
  ProFormTextArea: () => null,
  ProTable: () => null,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
  useLocation: () => ({ pathname: '/process-start', search: '' }),
}));

function workflow(
  overrides: Partial<StartableWorkflowItem> = {},
): StartableWorkflowItem {
  return {
    processModelId: 'model-1',
    processDefinitionId: 'collaborativeApproval:1:pd',
    processDefinitionKey: 'collaborativeApproval',
    processName: '协同审批流程',
    startFormBindingId: 'binding-1',
    startFormSchema: {
      id: 'form-1',
      formKey: 'business-request-form',
      formName: '业务申请表',
      version: 1,
      schemaJson: '{}',
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

const task: BpmnTaskDefinition = {
  taskDefinitionKey: 'jointApprovalTask',
  name: '多人会签',
  type: 'userTask',
};

function model(overrides: Partial<ProcessModelItem> = {}): ProcessModelItem {
  return {
    id: 'model-1',
    tenantId: 'default',
    modelKey: 'collaborativeApproval',
    modelName: '协同审批流程',
    modelType: 'BPMN',
    version: 1,
    status: 'DEPLOYED',
    flowableDefinitionId: 'collaborativeApproval:1:pd',
    bpmnXml:
      '<definitions><process id="collaborativeApproval" /></definitions>',
    ...overrides,
  };
}

function schema(overrides: Partial<FormSchemaItem> = {}): FormSchemaItem {
  return {
    id: 'form-1',
    formKey: 'business-request-form',
    formName: '业务申请表',
    version: 1,
    schemaJson: '{}',
    status: 'ACTIVE',
    ...overrides,
  };
}

function binding(overrides: Partial<FormBindingItem>): FormBindingItem {
  return {
    id: `binding-${overrides.taskDefinitionKey}`,
    processModelId: 'model-1',
    formSchemaId: 'form-1',
    formSchemaVersion: 1,
    ...overrides,
  } as FormBindingItem;
}

describe('resolveStartEntryNotice', () => {
  it('routes configurators to workflow setup when no workflow is startable', () => {
    expect(resolveStartEntryNotice(undefined, [], true)).toEqual({
      title: '暂无可发起流程',
      description: '先发布流程并完成表单绑定。',
      actionText: '查看配置',
      actionPath: '/process-models',
    });
  });

  it('does not show configuration action to applicants', () => {
    expect(resolveStartEntryNotice(undefined, [], false)).toEqual({
      title: '暂无可发起流程',
      description: '先发布流程并完成表单绑定。',
      actionText: undefined,
      actionPath: undefined,
    });
  });

  it('warns while a requested workflow is being checked', () => {
    expect(
      resolveStartEntryNotice('missing-model', [workflow()], true),
    ).toMatchObject({
      title: '该流程暂不可发起',
      description: '正在检查流程发布和表单绑定状态。',
      actionText: '查看模型',
      actionPath: '/process-designer?modelId=missing-model',
    });
  });

  it('routes inactive bindings to repair from the start page', () => {
    const readiness = buildStartWorkflowReadiness(
      model(),
      [
        binding({ taskDefinitionKey: '__START__' }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      [schema({ status: 'DISABLED' })],
      [task],
    );

    expect(resolveStartEntryNotice('model-1', [], true, readiness)).toEqual({
      title: '该流程暂不可发起',
      description: '有 2 个表单绑定失效。',
      actionText: '修复绑定',
      actionPath: '/form-bindings?processModelId=model-1',
    });
  });

  it('keeps missing task form reasons visible to applicants', () => {
    const readiness = buildStartWorkflowReadiness(
      model(),
      [binding({ taskDefinitionKey: '__START__' })],
      [schema()],
      [task],
    );

    expect(resolveStartEntryNotice('model-1', [], false, readiness)).toEqual({
      title: '该流程暂不可发起',
      description: '还有 1 个任务节点未绑定表单。',
      actionText: undefined,
      actionPath: undefined,
    });
  });

  it('stays quiet when the requested workflow can start', () => {
    expect(
      resolveStartEntryNotice('model-1', [workflow()], true),
    ).toBeUndefined();
  });
});
