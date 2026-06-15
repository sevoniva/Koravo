import { describe, expect, it } from 'vitest';
import type {
  BpmnTaskDefinition,
  FormBindingItem,
  FormSchemaItem,
  ProcessModelItem,
} from '@/services/koravo/api';
import {
  buildReleaseCheckState,
  extractUserTasksFromBpmnXml,
  START_FORM_TASK_KEY,
} from './releaseCheck';

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

describe('ProcessDesigner release check', () => {
  it('keeps missing form bindings visible without blocking publish', () => {
    const state = buildReleaseCheckState({
      activeModel: model(),
      validation: { valid: true, errors: [], warnings: [] },
      bindings: [],
      schemas: [schema()],
      tasks: [task],
    });

    expect(state.deployable).toBe(true);
    expect(state.title).toBe('可发布，有提示');
    expect(state.items.map((item) => item.title)).toEqual(
      expect.arrayContaining(['发起表单', '任务表单']),
    );
    expect(state.items.find((item) => item.key === 'start-form')?.status).toBe(
      'warning',
    );
    expect(state.items.find((item) => item.key === 'task-forms')?.status).toBe(
      'warning',
    );
    expect(
      state.items.find((item) => item.key === 'task-forms')?.description,
    ).toBe('未绑定节点：多人会签');
    expect(
      state.items
        .filter((item) => item.action === 'bind')
        .every(
          (item) => item.actionPath === '/form-bindings?processModelId=model-1',
        ),
    ).toBe(true);
  });

  it('keeps validation warnings visible without hiding a releasable model', () => {
    const approverExpression = '$' + '{approver}';
    const bpmnXml = `<definitions><process><userTask id="jointApprovalTask" flowable:assignee="${approverExpression}" /></process></definitions>`;
    const state = buildReleaseCheckState({
      activeModel: model({
        bpmnXml,
      }),
      validation: {
        valid: true,
        errors: [],
        warnings: [
          {
            code: 'BPMN_END_EVENT_MISSING',
            message: 'missing end event',
          },
        ],
      },
      bindings: [
        binding({ taskDefinitionKey: START_FORM_TASK_KEY }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      schemas: [
        schema({
          schemaJson:
            '{"type":"object","properties":{"subject":{"type":"string"},"approver":{"type":"string"}}}',
        }),
      ],
      tasks: [task],
      bpmnXml,
    });

    expect(state.deployable).toBe(true);
    expect(state.status).toBe('warning');
    expect(state.items.map((item) => item.title)).toEqual(
      expect.arrayContaining(['缺少结束节点']),
    );
    expect(state.items.map((item) => item.title)).not.toContain('变量表达式');
    expect(state.items.map((item) => item.title)).not.toContain(
      '办理人配置',
    );
  });

  it('blocks publish when handler expressions are not supplied', () => {
    const approverExpression = '$' + '{approver}';
    const bpmnXml = `<definitions><process><userTask id="jointApprovalTask" flowable:assignee="${approverExpression}" /></process></definitions>`;
    const state = buildReleaseCheckState({
      activeModel: model({ bpmnXml }),
      validation: { valid: true, errors: [], warnings: [] },
      bindings: [
        binding({ taskDefinitionKey: START_FORM_TASK_KEY }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      schemas: [schema()],
      tasks: [task],
      bpmnXml,
    });

    expect(state.deployable).toBe(false);
    expect(state.status).toBe('error');
    expect(
      state.items.find((item) => item.key === 'handler-inputs')?.description,
    ).toBe('缺少办理人来源：审批人');
  });

  it('does not warn for countersign fields already provided by the start form', () => {
    const approvalUserExpression = '$' + '{approvalUser}';
    const approvalUsersExpression = '$' + '{approvalUsers}';
    const bpmnXml = `<definitions><process><userTask id="jointApprovalTask" flowable:assignee="${approvalUserExpression}"><multiInstanceLoopCharacteristics flowable:collection="${approvalUsersExpression}" flowable:elementVariable="approvalUser" /></userTask></process></definitions>`;
    const state = buildReleaseCheckState({
      activeModel: model({ bpmnXml }),
      validation: { valid: true, errors: [], warnings: [] },
      bindings: [
        binding({ taskDefinitionKey: START_FORM_TASK_KEY }),
        binding({ taskDefinitionKey: 'jointApprovalTask' }),
      ],
      schemas: [
        schema({
          schemaJson:
            '{"type":"object","properties":{"subject":{"type":"string"},"approvalUsers":{"type":"array"}}}',
        }),
      ],
      tasks: [task],
      bpmnXml,
    });

    expect(state.deployable).toBe(true);
    expect(state.status).toBe('success');
    expect(state.items.map((item) => item.title)).not.toContain('办理人配置');
    expect(state.items.map((item) => item.title)).not.toContain('变量表达式');
  });

  it('parses user tasks from the current BPMN XML before saving', () => {
    const tasks = extractUserTasksFromBpmnXml(`<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://flowable.org/bpmn">
  <bpmn:process id="collaborativeApproval">
    <bpmn:userTask id="jointApprovalTask" name="多人会签" flowable:assignee="manager" />
  </bpmn:process>
</bpmn:definitions>`);

    expect(tasks).toEqual([
      {
        taskDefinitionKey: 'jointApprovalTask',
        name: '多人会签',
        type: 'userTask',
        assignee: 'manager',
      },
    ]);
  });
});
