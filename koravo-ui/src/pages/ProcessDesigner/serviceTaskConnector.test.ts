import { describe, expect, it } from 'vitest';
import {
  connectorFieldValueMap,
  connectorHeadersFromJson,
  connectorHeadersToJson,
  KORAVO_CONNECTOR_DELEGATE,
  normalizeServiceTaskConnectorFields,
} from './serviceTaskConnector';

describe('serviceTaskConnector', () => {
  it('converts request headers between field rows and Flowable field values', () => {
    expect(
      connectorHeadersFromJson(
        '{"X-Koravo-Tenant-Id":"default","X-Trace":123}',
      ),
    ).toEqual([
      { name: 'X-Koravo-Tenant-Id', value: 'default' },
      { name: 'X-Trace', value: '123' },
    ]);
    expect(
      connectorHeadersToJson([
        { name: ' X-Koravo-Tenant-Id ', value: ' default ' },
        { name: '', value: 'ignored' },
      ]),
    ).toBe('{"X-Koravo-Tenant-Id":"default"}');
    expect(connectorHeadersFromJson('not-json')).toEqual([]);
  });

  it('defaults enabled HTTP connector fields without exposing JSON editing', () => {
    const normalized = normalizeServiceTaskConnectorFields({
      connectorEnabled: true,
      connectorUrl: 'http://localhost:8080/api/v1/health',
    });

    expect(normalized.delegateExpression).toBe(KORAVO_CONNECTOR_DELEGATE);
    expect(normalized.connectorType).toBe('http');
    expect(normalized.connectorMethod).toBe('GET');
    expect(normalized.connectorTimeoutMillis).toBe(5000);
    expect(normalized.connectorOutputVariable).toBe('connectorResult');
  });

  it('builds Flowable field values and omits empty headers', () => {
    expect(
      connectorFieldValueMap({
        connectorEnabled: true,
        connectorMethod: 'POST',
        connectorUrl: 'https://example.com/hook',
        connectorHeaders: [{ name: 'X-Test', value: 'koravo' }],
        connectorBody: '{"ok":true}',
        connectorTimeoutMillis: 3000,
        connectorOutputVariable: 'hookResult',
      }),
    ).toEqual({
      connectorType: 'http',
      method: 'POST',
      url: 'https://example.com/hook',
      headers: '{"X-Test":"koravo"}',
      body: '{"ok":true}',
      timeoutMillis: '3000',
      outputVariable: 'hookResult',
    });

    expect(
      connectorFieldValueMap({
        connectorEnabled: true,
        connectorUrl: 'https://example.com/hook',
      }).headers,
    ).toBeUndefined();
  });

  it('clears built-in connector delegate when the connector is disabled', () => {
    const normalized = normalizeServiceTaskConnectorFields({
      connectorEnabled: false,
      connectorUrl: 'https://example.com/stale',
      delegateExpression: KORAVO_CONNECTOR_DELEGATE,
    });

    expect(normalized.delegateExpression).toBeUndefined();
    expect(normalized.connectorUrl).toBeUndefined();
    expect(connectorFieldValueMap(normalized)).toEqual({});
  });
});
