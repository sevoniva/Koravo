import { describe, expect, it } from 'vitest';
import { taskActionAccess, taskHandlingInstruction } from './taskAccess';

describe('taskActionAccess', () => {
  it('allows only the current assignee to complete and manage an assigned task', () => {
    expect(
      taskActionAccess({
        task: { status: 'RUNNING', assignee: 'manager' },
        currentUserId: 'manager',
        hasForm: true,
      }),
    ).toMatchObject({
      canCompleteTask: true,
      canManageAssignedTask: true,
      canClaimDetailTask: false,
    });

    expect(
      taskActionAccess({
        task: { status: 'RUNNING', assignee: 'manager' },
        currentUserId: 'applicant',
        hasForm: true,
      }),
    ).toMatchObject({
      canCompleteTask: false,
      canManageAssignedTask: false,
      canClaimDetailTask: false,
    });
  });

  it('allows claim only for open unassigned tasks with claim permission', () => {
    expect(
      taskActionAccess({
        task: { status: 'RUNNING', assignee: '' },
        currentUserId: 'manager',
        canClaimTask: true,
      }).canClaimDetailTask,
    ).toBe(true);

    expect(
      taskActionAccess({
        task: { status: 'COMPLETED', assignee: '' },
        currentUserId: 'manager',
        canClaimTask: true,
      }).canClaimDetailTask,
    ).toBe(false);

    expect(
      taskActionAccess({
        task: { status: 'RUNNING', assignee: '' },
        currentUserId: 'applicant',
        canClaimTask: false,
      }).canClaimDetailTask,
    ).toBe(false);
  });

  it('shows task handling instructions from the current user perspective', () => {
    expect(
      taskHandlingInstruction({
        task: { status: 'RUNNING', assignee: 'manager' },
        currentUserId: 'manager',
        hasForm: true,
      }),
    ).toBe('填写意见并提交');

    expect(
      taskHandlingInstruction({
        task: { status: 'RUNNING', assignee: 'manager' },
        currentUserId: 'applicant',
        hasForm: true,
      }),
    ).toBe('待审批主管处理');

    expect(
      taskHandlingInstruction({
        task: { status: 'RUNNING', assignee: '' },
        currentUserId: 'manager',
        hasForm: true,
      }),
    ).toBe('待认领');
  });
});
