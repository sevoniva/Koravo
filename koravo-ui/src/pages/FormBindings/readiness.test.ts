import { describe, expect, it, vi } from 'vitest';
import type {
  BpmnTaskDefinition,
  FormBindingItem,
  FormSchemaItem,
  ProcessModelItem,
} from '@/services/koravo/api';
import {
  type BindingTableItem,
  bindingOverviewStatus,
  buildBindingReadiness,
  resolveBindingCompletionState,
  shouldShowBindingRow,
  summarizeBindingOverview,
} from './index';

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

  it('routes inactive form bindings to repair before creating new bindings', () => {
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
      [schema({ status: 'DISABLED' })],
      [task],
    );
    const completion = resolveBindingCompletionState(
      published,
      readiness,
      true,
    );

    expect(readiness.invalidBindingCount).toBe(2);
    expect(readiness.readyToStart).toBe(false);
    expect(completion.nextAction).toBe('repairBinding');
    expect(completion.primaryText).toBe('修复绑定');
  });

  it('ignores bindings for removed task nodes when judging current readiness', () => {
    const published = model({
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:1:pd',
    });
    const readiness = buildBindingReadiness(
      published,
      [
        binding({ taskDefinitionKey: '__START__' }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
        binding({
          taskDefinitionKey: 'removedTask',
          formSchemaId: 'disabled-form',
        }),
      ],
      [schema(), schema({ id: 'disabled-form', status: 'DISABLED' })],
      [task],
    );
    const completion = resolveBindingCompletionState(
      published,
      readiness,
      true,
    );

    expect(readiness.invalidBindingCount).toBe(0);
    expect(readiness.readyToStart).toBe(true);
    expect(completion.nextAction).toBe('start');
  });

  it('keeps scoped repair rows visible even when the binding is outdated', () => {
    const row = {
      ...binding({ taskDefinitionKey: 'jointApprovalTask' }),
      processModel: model({
        status: 'DEPLOYED',
        flowableDefinitionId: 'collaborativeApproval:1:pd',
      }),
      formSchema: schema({ version: 2 }),
      hasStartBinding: true,
      taskDefinitionExists: true,
      missingTaskNames: [],
      readyToStart: false,
    } as BindingTableItem;

    expect(shouldShowBindingRow(row, 'current', false)).toBe(false);
    expect(shouldShowBindingRow(row, 'current', true)).toBe(true);
  });

  it('summarizes workflow binding gaps for the page overview', () => {
    const published = model({
      id: 'model-ready',
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:1:pd',
    });
    const draft = model({ id: 'model-draft' });
    const outdated = model({
      id: 'model-outdated',
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:2:pd',
    });
    const missingTask = model({
      id: 'model-missing-task',
      status: 'DEPLOYED',
      flowableDefinitionId: 'collaborativeApproval:3:pd',
    });
    const ready = buildBindingReadiness(
      published,
      [
        binding({ processModelId: 'model-ready', taskDefinitionKey: '__START__' }),
        binding({
          processModelId: 'model-ready',
          taskDefinitionKey: 'jointApprovalTask',
        }),
      ],
      [schema()],
      [task],
    );
    const needsPublish = buildBindingReadiness(
      draft,
      [],
      [schema()],
      [task],
    );
    const needsSync = buildBindingReadiness(
      outdated,
      [
        binding({
          processModelId: 'model-outdated',
          taskDefinitionKey: '__START__',
        }),
        binding({
          processModelId: 'model-outdated',
          taskDefinitionKey: 'jointApprovalTask',
        }),
      ],
      [schema({ version: 2 })],
      [task],
    );
    const needsTaskBinding = buildBindingReadiness(
      missingTask,
      [
        binding({
          processModelId: 'model-missing-task',
          taskDefinitionKey: '__START__',
        }),
      ],
      [schema()],
      [task],
    );

    expect(bindingOverviewStatus(published, ready)).toBe('可发起');
    expect(bindingOverviewStatus(draft, needsPublish)).toBe('待发布');
    expect(bindingOverviewStatus(outdated, needsSync)).toBe('待同步版本');
    expect(bindingOverviewStatus(missingTask, needsTaskBinding)).toBe(
      '缺任务表单',
    );
    expect(
      summarizeBindingOverview([
        { model: published, readiness: ready },
        { model: draft, readiness: needsPublish },
        { model: outdated, readiness: needsSync },
        { model: missingTask, readiness: needsTaskBinding },
      ]),
    ).toMatchObject({
      total: 4,
      ready: 1,
      needDeploy: 1,
      needTaskBinding: 1,
      needVersionSync: 1,
    });
  });
});
