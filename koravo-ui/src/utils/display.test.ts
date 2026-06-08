import { describe, expect, it } from 'vitest';
import { processModelKeyLabel } from './display';

describe('display helpers', () => {
  it('hides legacy demo identifiers from visible process model labels', () => {
    expect(processModelKeyLabel('httpConnectorDemo')).toBe('httpHealthCheck');
  });
});
