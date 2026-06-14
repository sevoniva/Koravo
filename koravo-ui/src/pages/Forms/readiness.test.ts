import { describe, expect, it, vi } from 'vitest';
import { formReadinessIssues } from './index';

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
        { key: 'duplicate', level: 'error', text: '业务字段不能重复' },
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
});
