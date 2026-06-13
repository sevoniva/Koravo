import { describe, expect, it } from 'vitest';
import {
  filterWorkflowFormValues,
  isWorkflowFieldVisible,
  parseWorkflowFormFields,
  visibleWorkflowFormFields,
} from './workflowForm';

describe('workflow form helpers', () => {
  const schemaJson = JSON.stringify({
    type: 'object',
    required: ['subject', 'approvers'],
    properties: {
      subject: { title: '事项名称', type: 'string' },
      approvalType: {
        title: '审批方式',
        type: 'string',
        enum: ['single', 'joint'],
      },
      approvers: { title: '审批人', type: 'array' },
      internalNote: { title: '内部备注', type: 'string' },
    },
  });
  const uiSchemaJson = JSON.stringify({
    subject: { permission: 'readonly' },
    approvers: {
      widget: 'organizationMemberMulti',
      visibleWhenField: 'approvalType',
      visibleWhenValue: 'joint',
    },
    internalNote: { permission: 'hidden' },
  });

  it('parses runtime field metadata from schema and ui schema', () => {
    const fields = parseWorkflowFormFields(schemaJson, uiSchemaJson);

    expect(fields).toMatchObject([
      { fieldKey: 'subject', permission: 'readonly', required: true },
      {
        fieldKey: 'approvalType',
        options: [
          { label: 'single', value: 'single' },
          { label: 'joint', value: 'joint' },
        ],
      },
      {
        fieldKey: 'approvers',
        widget: 'organizationMemberMulti',
        visibleWhenField: 'approvalType',
        visibleWhenValue: 'joint',
      },
      { fieldKey: 'internalNote', permission: 'hidden' },
    ]);
  });

  it('applies hidden and conditional visibility before submission', () => {
    const fields = parseWorkflowFormFields(schemaJson, uiSchemaJson);
    const visibleFields = visibleWorkflowFormFields(fields, {
      subject: '预算调整',
      approvalType: 'single',
      approvers: ['manager'],
      internalNote: '不应提交',
    });

    expect(visibleFields.map((field) => field.fieldKey)).toEqual([
      'subject',
      'approvalType',
    ]);
    expect(
      filterWorkflowFormValues(visibleFields, {
        subject: '预算调整',
        approvalType: 'single',
        approvers: ['manager'],
        internalNote: '不应提交',
      }),
    ).toEqual({ subject: '预算调整', approvalType: 'single' });
  });

  it('supports multi-value condition sources', () => {
    expect(
      isWorkflowFieldVisible(
        {
          permission: 'editable',
          visibleWhenField: 'approvalType',
          visibleWhenValue: 'joint',
        },
        { approvalType: ['single', 'joint'] },
      ),
    ).toBe(true);
  });
});
