import { describe, expect, it, vi } from 'vitest';
import type {
  BpmnTaskDefinition,
  FormBindingItem,
  FormSchemaItem,
  ProcessModelItem,
} from '@/services/koravo/api';
import { buildBindingReadiness, resolveBindingCompletionState } from './index';

vi.mock('@ant-design/pro-components', () => ({
  ModalForm: () => null,
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProFormDependency: () => null,
  ProFormSelect: () => null,
  ProFormText: () => null,
  ProTable: () => null,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
  useLocation: () => ({ search: '' }),
}));

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
    status: 'DRAFT',
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
    schemaJson: '{"type":"object","properties":{"subject":{"type":"string"}}}',
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

describe('FormBindings readiness', () => {
  it('keeps a fully bound draft workflow out of start entry', () => {
    const readiness = buildBindingReadiness(
      model(),
      [
        binding({ taskDefinitionKey: '__START__' }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      [schema()],
      [task],
    );
    const completion = resolveBindingCompletionState(model(), readiness, true);

    expect(readiness.readyToStart).toBe(false);
    expect(completion.nextAction).toBe('deploy');
    expect(completion.primaryText).toBe('去发布');
  });

  it('routes a published workflow with missing task forms back to binding', () => {
    const published = model({
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:1:pd',
    });
    const readiness = buildBindingReadiness(
      published,
      [binding({ taskDefinitionKey: '__START__' })],
      [schema()],
      [task],
    );
    const completion = resolveBindingCompletionState(
      published,
      readiness,
      true,
    );

    expect(readiness.readyToStart).toBe(false);
    expect(readiness.missingTaskNames).toEqual(['多人会签']);
    expect(completion.nextAction).toBe('bindTask');
    expect(completion.primaryPath).toBe(
      '/form-bindings?processModelId=model-1',
    );
  });

  it('opens process start only after published workflow has active start and task forms', () => {
    const published = model({
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:1:pd',
    });
    const readiness = buildBindingReadiness(
      published,
      [
        binding({ taskDefinitionKey: '__START__' }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      [schema()],
      [task],
    );
    const completion = resolveBindingCompletionState(
      published,
      readiness,
      true,
    );

    expect(readiness.readyToStart).toBe(true);
    expect(completion.nextAction).toBe('start');
    expect(completion.primaryPath).toBe(
      '/process-start?processModelId=model-1',
    );
  });

  it('routes outdated bindings to version sync before start', () => {
    const published = model({
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:1:pd',
    });
    const readiness = buildBindingReadiness(
      published,
      [
        binding({ taskDefinitionKey: '__START__' }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      [schema({ version: 2 })],
      [task],
    );
    const completion = resolveBindingCompletionState(
      published,
      readiness,
      true,
    );

    expect(readiness.outdatedBindingCount).toBe(2);
    expect(readiness.readyToStart).toBe(false);
    expect(completion.nextAction).toBe('syncVersion');
    expect(completion.primaryText).toBe('同步版本');
    expect(completion.primaryPath).toBe(
      '/form-bindings?processModelId=model-1',
    );
  });
});
