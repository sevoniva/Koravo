import { describe, expect, it, vi } from 'vitest';
import type { StartableWorkflowItem } from '@/services/koravo/api';
import { resolveStartEntryNotice } from './index';

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

describe('resolveStartEntryNotice', () => {
  it('routes configurators to workflow setup when no workflow is startable', () => {
    expect(resolveStartEntryNotice(undefined, [], true)).toEqual({
      title: '暂无可发起流程',
      actionText: '查看配置',
      actionPath: '/process-models',
    });
  });

  it('does not show configuration action to applicants', () => {
    expect(resolveStartEntryNotice(undefined, [], false)).toEqual({
      title: '暂无可发起流程',
      actionText: undefined,
      actionPath: undefined,
    });
  });

  it('warns when the requested workflow is not startable yet', () => {
    expect(
      resolveStartEntryNotice('missing-model', [workflow()], true),
    ).toMatchObject({
      title: '该流程暂不可发起',
      actionText: '查看配置',
    });
  });

  it('stays quiet when the requested workflow can start', () => {
    expect(
      resolveStartEntryNotice('model-1', [workflow()], true),
    ).toBeUndefined();
  });
});
