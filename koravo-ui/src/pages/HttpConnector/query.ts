export interface ConnectorExecutionQuery {
  requestId?: string;
  connectorLogId?: string;
}

export function parseConnectorExecutionQuery(
  search: string,
): ConnectorExecutionQuery {
  const params = new URLSearchParams(search);
  return {
    requestId: params.get('requestId') || undefined,
    connectorLogId: params.get('connectorLogId') || undefined,
  };
}
