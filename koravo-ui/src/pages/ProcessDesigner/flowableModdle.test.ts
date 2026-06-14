import { describe, expect, it } from 'vitest';
import { flowableModdle } from './flowableModdle';

describe('flowableModdle', () => {
  it('registers multi-instance approval attributes used by the default workflow', () => {
    const multiInstance = flowableModdle.types.find(
      (type) => type.name === 'MultiInstanceLoopCharacteristics',
    );

    expect(multiInstance?.extends).toContain(
      'bpmn:MultiInstanceLoopCharacteristics',
    );
    expect(multiInstance?.properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'collection', isAttr: true }),
        expect.objectContaining({ name: 'elementVariable', isAttr: true }),
      ]),
    );
  });
});
