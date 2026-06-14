import { describe, expect, it, vi } from 'vitest';
import type { DataSourceItem } from '@/services/koravo/api';
import {
  buildDataSourcePayload,
  type DataSourceForm,
  dataSourcePoolConfig,
  dataSourcePoolConfigSummary,
  defaultPoolConfig,
  toFormValues,
} from './index';

vi.mock('@ant-design/pro-components', () => ({
  ModalForm: ({ children }: { children?: unknown }) => children,
  PageContainer: ({ children }: { children?: unknown }) => children,
  ProDescriptions: () => null,
  ProFormDigit: () => null,
  ProFormSelect: () => null,
  ProFormSwitch: () => null,
  ProFormText: () => null,
  ProTable: () => null,
}));

function dataSource(overrides: Partial<DataSourceItem> = {}): DataSourceItem {
  return {
    id: 'ds-1',
    name: '主库',
    type: 'POSTGRESQL',
    jdbcUrl: 'jdbc:postgresql://localhost:5432/koravo',
    username: 'koravo',
    driverClassName: 'org.postgresql.Driver',
    readOnly: true,
    poolConfigJson: '',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('DataSources pool config', () => {
  it('uses business fields instead of exposing raw pool config JSON', () => {
    const item = dataSource({
      poolConfigJson: JSON.stringify({
        maximumPoolSize: 16,
        minimumIdle: 4,
        connectionTimeout: 45000,
      }),
    });

    expect(toFormValues(item)).toMatchObject({
      maximumPoolSize: 16,
      minimumIdle: 4,
      connectionTimeout: 45000,
    });
    expect(dataSourcePoolConfigSummary(item)).toBe(
      '最大 16 / 空闲 4 / 超时 45.0 s',
    );
  });

  it('falls back to stable defaults when stored config is invalid', () => {
    expect(dataSourcePoolConfig('{broken')).toEqual(defaultPoolConfig);
    expect(toFormValues()).toMatchObject(defaultPoolConfig);
  });

  it('keeps the API payload compatible with the backend contract', () => {
    const payload = buildDataSourcePayload({
      name: '主库',
      type: 'POSTGRESQL',
      jdbcUrl: 'jdbc:postgresql://localhost:5432/koravo',
      username: 'koravo',
      password: 'secret',
      driverClassName: 'org.postgresql.Driver',
      readOnly: true,
      maximumPoolSize: 20,
      minimumIdle: 5,
      connectionTimeout: 60000,
    } satisfies DataSourceForm);

    expect(payload.poolConfigJson).toBe(
      JSON.stringify({
        maximumPoolSize: 20,
        minimumIdle: 5,
        connectionTimeout: 60000,
      }),
    );
  });
});
