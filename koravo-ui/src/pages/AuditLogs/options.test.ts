import { describe, expect, it, vi } from 'vitest';
import {
  actionOptions,
  auditCanOpenProcessContext,
  auditConnectorRecordPath,
  auditProcessInstanceId,
  auditTaskId,
} from './index';

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProDescriptions: () => null,
  ProTable: () => null,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
  useLocation: () => ({ search: '' }),
}));

vi.mock('@/components/ProcessProgressCard', () => ({
  default: () => null,
}));

describe('AuditLogs actionOptions', () => {
  it('keeps production audit actions selectable with product labels', () => {
    expect(actionOptions.PROCESS_MODEL_DEPLOY.text).toBe('发布流程模型');
    expect(actionOptions.CONNECTOR_RETRY.text).toBe('重试连接器');
  });

  it('finds process context from process and task audit records', () => {
    expect(
      auditProcessInstanceId({
        id: 'audit-process',
        tenantId: 'default',
        userId: 'applicant',
        action: 'PROCESS_INSTANCE_START',
        resourceType: 'PROCESS_INSTANCE',
        resourceId: 'process-1',
        detailJson: '{}',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe('process-1');

    expect(
      auditProcessInstanceId({
        id: 'audit-task',
        tenantId: 'default',
        userId: 'manager',
        action: 'TASK_COMPLETE',
        resourceType: 'TASK',
        resourceId: 'task-1',
        detailJson: JSON.stringify({ processInstanceId: 'process-2' }),
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe('process-2');
  });

  it('finds task context from task audit records', () => {
    expect(
      auditTaskId({
        id: 'audit-task',
        tenantId: 'default',
        userId: 'manager',
        action: 'TASK_COMPLETE',
        resourceType: 'TASK',
        resourceId: 'task-1',
        detailJson: '{}',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe('task-1');

    expect(
      auditTaskId({
        id: 'audit-start',
        tenantId: 'default',
        userId: 'applicant',
        action: 'PROCESS_INSTANCE_START',
        resourceType: 'PROCESS_INSTANCE',
        resourceId: 'process-1',
        detailJson: JSON.stringify({ taskId: 'task-2' }),
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe('task-2');
  });

  it('lets audit operators open process context from audit detail', () => {
    expect(
      auditCanOpenProcessContext({
        role: 'admin',
        permissions: {
          canViewProcessContext: false,
          canViewAudit: true,
        },
      }),
    ).toBe(true);

    expect(
      auditCanOpenProcessContext({
        role: 'operator',
        permissions: {
          canViewProcessContext: false,
          canViewAudit: false,
          canOperateSystem: false,
        },
      }),
    ).toBe(false);

    expect(auditCanOpenProcessContext({ role: 'manager' })).toBe(true);
  });

  it('opens connector audit records in the integration log page', () => {
    expect(
      auditConnectorRecordPath({
        id: 'audit-connector',
        tenantId: 'default',
        userId: 'system',
        action: 'CONNECTOR_EXECUTE',
        resourceType: 'CONNECTOR_EXECUTION',
        resourceId: 'connector-log-1',
        requestId: 'REQ-1',
        detailJson: '{}',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe('/http-connector?connectorLogId=connector-log-1');

    expect(
      auditConnectorRecordPath({
        id: 'audit-connector',
        tenantId: 'default',
        userId: 'system',
        action: 'CONNECTOR_EXECUTE',
        resourceType: 'CONNECTOR_EXECUTION',
        resourceId: '',
        requestId: 'REQ-1',
        detailJson: '{}',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ).toBe('/http-connector?requestId=REQ-1');
  });
});
