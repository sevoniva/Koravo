import { describe, expect, it } from 'vitest';
import {
  filterWorkflowFormValues,
  isWorkflowFieldVisible,
  parseWorkflowFormFields,
  visibleWorkflowFormFields,
  workflowFieldRules,
  workflowNumberFieldProps,
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

  it('parses field validation and builds runtime rules', async () => {
    const fields = parseWorkflowFormFields(
      JSON.stringify({
        type: 'object',
        required: ['subject'],
        properties: {
          subject: {
            title: '事项名称',
            type: 'string',
            minLength: 2,
            maxLength: 30,
            pattern: '^[\\u4e00-\\u9fa5A-Za-z0-9]+$',
          },
          amount: {
            title: '金额',
            type: 'number',
            minimum: 1,
            maximum: 100,
          },
        },
      }),
      '{}',
    );

    const subject = fields.find((field) => field.fieldKey === 'subject');
    const amount = fields.find((field) => field.fieldKey === 'amount');

    expect(subject).toBeDefined();
    expect(amount).toBeDefined();
    if (!subject || !amount) return;

    expect(subject).toMatchObject({
      minLength: 2,
      maxLength: 30,
      pattern: '^[\\u4e00-\\u9fa5A-Za-z0-9]+$',
    });
    expect(amount).toMatchObject({ minimum: 1, maximum: 100 });
    expect(workflowFieldRules(subject)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ required: true }),
        expect.objectContaining({ min: 2 }),
        expect.objectContaining({ max: 30 }),
      ]),
    );
    expect(workflowNumberFieldProps(amount)).toEqual({ min: 1, max: 100 });

    const rangeRule = workflowFieldRules(amount).find(
      (rule) => typeof rule === 'object' && 'validator' in rule,
    ) as {
      validator: (_rule: unknown, value: unknown) => Promise<void>;
    };
    await expect(rangeRule.validator({}, 0)).rejects.toThrow(
      '金额不能小于 1',
    );
  });
});
