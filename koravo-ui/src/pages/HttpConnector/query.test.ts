import { describe, expect, it } from 'vitest';
import { parseConnectorExecutionQuery } from './query';

describe('parseConnectorExecutionQuery', () => {
  it('reads connector execution deep links', () => {
    expect(
      parseConnectorExecutionQuery(
        '?requestId=REQ-1&connectorLogId=connector-log-1',
      ),
    ).toEqual({
      requestId: 'REQ-1',
      connectorLogId: 'connector-log-1',
    });
  });

  it('ignores empty query values', () => {
    expect(
      parseConnectorExecutionQuery('?requestId=&connectorLogId='),
    ).toEqual({
      requestId: undefined,
      connectorLogId: undefined,
    });
  });
});
