import { describe, expect, it, vi } from 'vitest';
import {
  businessFieldTooltip,
  conditionFieldOptions,
  conditionValueOptions,
  fieldChangeCount,
  fieldChangeSummary,
  fieldEditorPanelOpenKeys,
  fieldEditorSummaryTags,
  formBlockingReadinessIssues,
  formReadinessIssues,
} from './index';

vi.mock('@ant-design/pro-components', () => ({
  ModalForm: () => null,
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProForm: ({ children }: { children?: unknown }) => children,
  ProFormDatePicker: () => null,
  ProFormDependency: () => null,
  ProFormDigit: () => null,
  ProFormList: () => null,
  ProFormSelect: () => null,
  ProFormSwitch: () => null,
  ProFormText: () => null,
  ProFormTextArea: () => null,
  ProTable: () => null,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
}));

type ReadinessField = Parameters<typeof formReadinessIssues>[0][number];

describe('formReadinessIssues', () => {
  it('flags fields that would block a product-ready form release', () => {
    const issues = formReadinessIssues([
      {
        fieldKey: 'subject',
        title: '事项名称',
        type: 'string',
        widget: 'input',
        required: true,
        permission: 'hidden',
      },
      {
        fieldKey: 'subject',
        title: '重复字段',
        type: 'string',
        widget: 'input',
      },
    ] as ReadinessField[]);

    expect(issues).toEqual(
      expect.arrayContaining([
        { key: 'duplicate', level: 'error', text: '字段编号不能重复' },
        {
          key: 'hiddenRequired',
          level: 'error',
          text: '隐藏必填字段：事项名称',
        },
        {
          key: 'profile',
          level: 'warning',
          text: '建议配置申请人或部门联动字段',
        },
        {
          key: 'assignee',
          level: 'warning',
          text: '建议配置审批人组织成员字段',
        },
      ]),
    );
  });

  it('passes a workflow form with organization profile and assignees', () => {
    expect(
      formReadinessIssues([
        {
          fieldKey: 'requester',
          title: '发起人',
          type: 'string',
          widget: 'organizationProfile',
          permission: 'readonly',
          required: true,
        },
        {
          fieldKey: 'approvalUsers',
          title: '审批人',
          type: 'array',
          widget: 'organizationMemberMulti',
          required: true,
        },
      ] as ReadinessField[]),
    ).toEqual([]);
  });

  it('blocks release only on error-level readiness issues', () => {
    const blockingIssues = formBlockingReadinessIssues([
      {
        fieldKey: 'subject',
        title: '事项名称',
        type: 'string',
        widget: 'input',
        required: true,
        permission: 'hidden',
      },
    ] as ReadinessField[]);

    expect(blockingIssues).toEqual([
      {
        key: 'hiddenRequired',
        level: 'error',
        text: '隐藏必填字段：事项名称',
      },
    ]);

    const warningOnlyIssues = formBlockingReadinessIssues([
      {
        fieldKey: 'subject',
        title: '事项名称',
        type: 'string',
        widget: 'input',
        required: true,
      },
    ] as ReadinessField[]);

    expect(warningOnlyIssues).toEqual([]);
  });

  it('builds product condition options from current fields', () => {
    const fields = [
      {
        fieldKey: 'subject',
        title: '事项名称',
        type: 'string',
        widget: 'input',
      },
      {
        fieldKey: 'approvalResult',
        title: '审批结果',
        type: 'string',
        widget: 'select',
        options: ['通过', '退回'],
      },
      {
        fieldKey: 'internalCode',
        title: '内部字段',
        type: 'string',
        widget: 'input',
        permission: 'hidden',
      },
    ] as ReadinessField[];

    expect(conditionFieldOptions(fields, 'subject')).toEqual([
      { label: '审批结果', value: 'approvalResult' },
    ]);
    expect(conditionValueOptions(fields, 'approvalResult')).toEqual([
      { label: '通过', value: '通过' },
      { label: '退回', value: '退回' },
    ]);
  });

  it('ignores unmounted field rows when building condition options', () => {
    const fields = [
      undefined,
      {
        fieldKey: 'subject',
        title: '事项名称',
        type: 'string',
        widget: 'input',
      },
    ] as unknown as ReadinessField[];

    expect(conditionFieldOptions(fields, 'approvalUsers')).toEqual([
      { label: '事项名称', value: 'subject' },
    ]);
  });

  it('blocks invalid conditional display rules', () => {
    expect(
      formBlockingReadinessIssues([
        {
          fieldKey: 'subject',
          title: '事项名称',
          type: 'string',
          widget: 'input',
          required: true,
          visibleWhenField: 'subject',
          visibleWhenValue: '1',
        },
      ] as ReadinessField[]),
    ).toEqual([
      {
        key: 'config',
        level: 'error',
        text: '事项名称不能以自身作为显示条件',
      },
    ]);

    expect(
      formBlockingReadinessIssues([
        {
          fieldKey: 'result',
          title: '审批结果',
          type: 'string',
          widget: 'select',
          options: ['通过'],
          required: true,
        },
        {
          fieldKey: 'remark',
          title: '补充说明',
          type: 'string',
          widget: 'textarea',
          visibleWhenField: 'result',
          visibleWhenValue: '退回',
        },
      ] as ReadinessField[]),
    ).toEqual([
      {
        key: 'config',
        level: 'error',
        text: '补充说明的显示条件值不在可选项内',
      },
    ]);
  });

  it('summarizes field changes for version comparison', () => {
    const summary = fieldChangeSummary(
      [
        {
          fieldKey: 'subject',
          title: '事项名称',
          type: 'string',
          widget: 'input',
          required: true,
        },
        {
          fieldKey: 'remark',
          title: '备注',
          type: 'string',
          widget: 'textarea',
        },
        {
          fieldKey: 'internalCode',
          title: '内部编号',
          type: 'string',
          widget: 'input',
        },
      ] as ReadinessField[],
      [
        {
          fieldKey: 'subject',
          title: '事项标题',
          type: 'string',
          widget: 'input',
          required: true,
        },
        {
          fieldKey: 'amount',
          title: '金额',
          type: 'number',
          widget: 'number',
        },
        {
          fieldKey: 'remark',
          title: '备注',
          type: 'string',
          widget: 'textarea',
        },
      ] as ReadinessField[],
    );

    expect(summary.added.map((field) => field.fieldKey)).toEqual(['amount']);
    expect(summary.removed.map((field) => field.fieldKey)).toEqual([
      'internalCode',
    ]);
    expect(summary.changed.map((field) => field.fieldKey)).toEqual(['subject']);
    expect(fieldChangeCount(summary)).toBe(3);
  });

  it('summarizes editable field panels without exposing raw config names', () => {
    expect(businessFieldTooltip).not.toContain('流程变量');
    expect(businessFieldTooltip).toContain('字段编号');
    expect(
      fieldEditorSummaryTags({
        fieldKey: 'approvalUsers',
        title: '审批人',
        type: 'array',
        widget: 'organizationMemberMulti',
        required: true,
        permission: 'readonly',
        visibleWhenField: 'approvalResult',
      }),
    ).toEqual(['多选', '组织成员多选', '必填', '只读', '有条件']);
  });

  it('keeps every field editor panel open by default', () => {
    expect(fieldEditorPanelOpenKeys).toEqual(['field']);
  });
});
