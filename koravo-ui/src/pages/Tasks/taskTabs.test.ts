import { describe, expect, it } from 'vitest';
import { resolveTaskTab, visibleTaskTabs } from './taskTabs';

describe('task tab visibility', () => {
  it('shows only applicant work for process starters', () => {
    expect(
      visibleTaskTabs({
        canStartProcess: true,
      }),
    ).toEqual(['started']);
  });

  it('shows task work for approvers without exposing applicant tabs', () => {
    expect(
      visibleTaskTabs({
        canHandleTask: true,
        canClaimTask: true,
      }),
    ).toEqual(['todo', 'candidate', 'done']);
  });

  it('falls back to the first visible tab when a route does not match the role', () => {
    expect(resolveTaskTab('todo', ['started'])).toBe('started');
    expect(resolveTaskTab('started', ['todo', 'done'])).toBe('todo');
  });
});
