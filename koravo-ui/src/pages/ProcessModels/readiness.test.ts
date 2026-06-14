import { describe, expect, it, vi } from 'vitest';
import type {
  BpmnTaskDefinition,
  FormBindingItem,
  FormSchemaItem,
  ProcessModelItem,
} from '@/services/koravo/api';
import {
  aggregateProcessModelVersions,
  buildModelReadiness,
  compareProcessModelVersionsDesc,
  selectProcessModelVersionForStatus,
} from './index';

vi.mock('@ant-design/pro-components', () => ({
  ModalForm: () => null,
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProFormText: () => null,
  ProFormTextArea: () => null,
  ProFormUploadButton: () => null,
  ProTable: () => null,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
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
    formSchemaId: 'form-1',
    formSchemaVersion: 1,
    ...overrides,
  } as FormBindingItem;
}

describe('ProcessModels readiness', () => {
  it('keeps draft workflow publishable before form binding', () => {
    const readiness = buildModelReadiness(model(), [], [task], [schema()]);

    expect(readiness.deployReady).toBe(true);
    expect(readiness.bindingReady).toBe(false);
    expect(readiness.canStart).toBe(false);
    expect(readiness.nextAction).toBe('deploy');
    expect(readiness.nextActionText).toBe('校验发布');
  });

  it('requires form binding after workflow is published', () => {
    const readiness = buildModelReadiness(
      model({
        status: 'DEPLOYED',
        flowableDefinitionId: 'collaborativeApproval:1:pd',
      }),
      [],
      [task],
      [schema()],
    );

    expect(readiness.deployReady).toBe(true);
    expect(readiness.bindingReady).toBe(false);
    expect(readiness.canStart).toBe(false);
    expect(readiness.nextAction).toBe('bind');
    expect(readiness.description).toBe('缺少发起表单');
  });

  it('opens start only after published workflow has active start and task forms', () => {
    const readiness = buildModelReadiness(
      model({
        status: 'DEPLOYED',
        flowableDefinitionId: 'collaborativeApproval:1:pd',
      }),
      [
        binding({ taskDefinitionKey: '__START__', processModelId: 'model-1' }),
        binding({
          taskDefinitionKey: 'jointApprovalTask',
          processModelId: 'model-1',
        }),
      ],
      [task],
      [schema()],
    );

    expect(readiness.bindingReady).toBe(true);
    expect(readiness.canStart).toBe(true);
    expect(readiness.nextAction).toBe('start');
  });

  it('routes outdated form bindings back to version sync before start', () => {
    const readiness = buildModelReadiness(
      model({
        status: 'DEPLOYED',
        flowableDefinitionId: 'collaborativeApproval:1:pd',
      }),
      [
        binding({ taskDefinitionKey: '__START__', processModelId: 'model-1' }),
        binding({
          taskDefinitionKey: 'jointApprovalTask',
          processModelId: 'model-1',
        }),
      ],
      [task],
      [schema({ version: 2 })],
    );

    expect(readiness.outdatedBindingCount).toBe(2);
    expect(readiness.bindingReady).toBe(false);
    expect(readiness.canStart).toBe(false);
    expect(readiness.statusText).toBe('待同步');
    expect(readiness.nextAction).toBe('bind');
    expect(readiness.nextActionText).toBe('同步表单版本');
  });
});

describe('ProcessModels version aggregation', () => {
  it('keeps one row per model key and exposes sorted version history', () => {
    const groups = aggregateProcessModelVersions([
      model({
        id: 'approval-v1',
        modelKey: 'approval',
        version: 1,
        status: 'ARCHIVED',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      model({
        id: 'approval-v5',
        modelKey: 'approval',
        version: 5,
        status: 'DEPLOYED',
        updatedAt: '2026-01-05T00:00:00Z',
      }),
      model({
        id: 'expense-v2',
        modelKey: 'expense',
        version: 2,
        status: 'DRAFT',
        updatedAt: '2026-01-03T00:00:00Z',
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe('approval-v5');
    expect(groups[0].versionCount).toBe(2);
    expect(groups[0].versions.map((item) => item.id)).toEqual([
      'approval-v5',
      'approval-v1',
    ]);
    expect(groups[1].id).toBe('expense-v2');
  });

  it('uses update time when versions are equal', () => {
    const older = model({
      id: 'old',
      version: 2,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const newer = model({
      id: 'new',
      version: 2,
      updatedAt: '2026-01-02T00:00:00Z',
    });

    expect([older, newer].sort(compareProcessModelVersionsDesc)[0].id).toBe(
      'new',
    );
  });

  it('keeps full history when status filters select an older version', () => {
    const [group] = aggregateProcessModelVersions([
      model({
        id: 'approval-v3',
        modelKey: 'approval',
        version: 3,
        status: 'DRAFT',
        updatedAt: '2026-01-03T00:00:00Z',
      }),
      model({
        id: 'approval-v2',
        modelKey: 'approval',
        version: 2,
        status: 'DEPLOYED',
        updatedAt: '2026-01-02T00:00:00Z',
      }),
    ]);

    const selected = selectProcessModelVersionForStatus(group, 'DEPLOYED');

    expect(selected.id).toBe('approval-v2');
    expect(selected.latestVersion).toBe(3);
    expect(selected.versionCount).toBe(2);
    expect(selected.versions.map((item) => item.id)).toEqual([
      'approval-v3',
      'approval-v2',
    ]);
  });

  it('keeps the deployed runtime visible when the latest version is draft', () => {
    const [group] = aggregateProcessModelVersions([
      model({
        id: 'approval-v3',
        modelKey: 'approval',
        version: 3,
        status: 'DRAFT',
        updatedAt: '2026-01-03T00:00:00Z',
      }),
      model({
        id: 'approval-v2',
        modelKey: 'approval',
        version: 2,
        status: 'DEPLOYED',
        flowableDefinitionId: 'approval:2:pd',
        updatedAt: '2026-01-02T00:00:00Z',
      }),
    ]);

    expect(group.id).toBe('approval-v3');
    expect(group.latestVersion).toBe(3);
    expect(group.runtimeVersion?.id).toBe('approval-v2');

    const selected = selectProcessModelVersionForStatus(group, 'DEPLOYED');

    expect(selected.id).toBe('approval-v2');
    expect(selected.latestVersion).toBe(3);
    expect(selected.runtimeVersion?.id).toBe('approval-v2');
    expect(selected.versions.map((item) => item.id)).toEqual([
      'approval-v3',
      'approval-v2',
    ]);
  });
});
