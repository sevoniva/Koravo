import { describe, expect, it, vi } from 'vitest';
import { actionOptions } from './index';

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProDescriptions: () => null,
  ProTable: () => null,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
  useLocation: () => ({ search: '' }),
}));

describe('AuditLogs actionOptions', () => {
  it('keeps production audit actions selectable with product labels', () => {
    expect(actionOptions.PROCESS_MODEL_DEPLOY.text).toBe('发布流程模型');
    expect(actionOptions.CONNECTOR_RETRY.text).toBe('重试连接器');
  });
});
