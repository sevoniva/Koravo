import { describe, expect, it, vi } from 'vitest';
import {
  completionAssigneeDisplayLabels,
  completionFieldReadOnly,
} from './completionFieldState';

vi.mock('@ant-design/pro-components', () => ({
  ModalForm: () => null,
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProCard: ({ children }: { children?: unknown }) => children,
  ProDescriptions: () => null,
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
  useParams: () => ({ taskId: 'task-1' }),
}));

describe('completionFieldReadOnly', () => {
  it('keeps business fields read-only while completing a task', () => {
    expect(completionFieldReadOnly()).toBe(true);
  });

  it('renders read-only assignees as organization labels', () => {
    expect(completionAssigneeDisplayLabels(['manager', 'finance', 'manager'])).toEqual([
      '审批主管',
      '复核专员',
    ]);
    expect(completionAssigneeDisplayLabels('manager')).toEqual(['审批主管']);
    expect(completionAssigneeDisplayLabels(undefined)).toEqual([]);
  });
});
