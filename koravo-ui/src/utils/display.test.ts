import { describe, expect, it } from 'vitest';
import { processModelKeyLabel, shortTraceLabel } from './display';

describe('display helpers', () => {
  it('hides legacy demo identifiers from visible process model labels', () => {
    expect(processModelKeyLabel('httpConnectorDemo')).toBe('httpHealthCheck');
  });

  it('hides legacy demo markers from visible trace labels', () => {
    expect(shortTraceLabel('demo-http-connector')).not.toContain('demo');
    expect(shortTraceLabel('demo-http-connector')).toMatch(/^TRACE-/);
  });
});
