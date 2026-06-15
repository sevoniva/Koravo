export const KORAVO_CONNECTOR_DELEGATE = '$' + '{koravoConnectorDelegate}';

export const CONNECTOR_FIELD_NAMES = [
  'connectorType',
  'method',
  'url',
  'headers',
  'body',
  'timeoutMillis',
  'outputVariable',
] as const;

export type ConnectorFieldName = (typeof CONNECTOR_FIELD_NAMES)[number];

export interface ConnectorHeaderRow {
  name?: string;
  value?: string;
}

export interface ServiceTaskConnectorFields {
  connectorEnabled?: boolean;
  connectorType?: string;
  connectorMethod?: string;
  connectorUrl?: string;
  connectorHeaders?: ConnectorHeaderRow[];
  connectorBody?: string;
  connectorTimeoutMillis?: number | string;
  connectorOutputVariable?: string;
  delegateExpression?: string;
}

function cleanText(value?: string | number | null) {
  const text = value === undefined || value === null ? '' : String(value);
  return text.trim();
}

export function connectorHeadersFromJson(headersJson?: string) {
  const value = cleanText(headersJson);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
      return [];

    return Object.entries(parsed as Record<string, unknown>)
      .map(([name, rawValue]) => ({
        name,
        value: typeof rawValue === 'string' ? rawValue : String(rawValue ?? ''),
      }))
      .filter((header) => cleanText(header.name));
  } catch {
    return [];
  }
}

export function connectorHeadersToRecord(headers?: ConnectorHeaderRow[]) {
  return (headers || []).reduce<Record<string, string>>((result, header) => {
    const name = cleanText(header.name);
    if (!name) return result;
    result[name] = cleanText(header.value);
    return result;
  }, {});
}

export function connectorHeadersToJson(headers?: ConnectorHeaderRow[]) {
  const record = connectorHeadersToRecord(headers);
  return Object.keys(record).length ? JSON.stringify(record) : undefined;
}

export function normalizeServiceTaskConnectorFields<
  T extends ServiceTaskConnectorFields,
>(values: T): T & ServiceTaskConnectorFields {
  const enabled =
    values.connectorEnabled === false
      ? false
      : Boolean(
          values.connectorEnabled ||
            values.connectorUrl ||
            values.connectorMethod ||
            values.connectorHeaders?.length ||
            values.connectorBody ||
            values.connectorOutputVariable ||
            values.delegateExpression === KORAVO_CONNECTOR_DELEGATE,
        );

  if (!enabled) {
    return {
      ...values,
      connectorEnabled: false,
      connectorType: undefined,
      connectorMethod: undefined,
      connectorUrl: undefined,
      connectorHeaders: [],
      connectorBody: undefined,
      connectorTimeoutMillis: undefined,
      connectorOutputVariable: undefined,
      delegateExpression:
        values.delegateExpression === KORAVO_CONNECTOR_DELEGATE
          ? undefined
          : values.delegateExpression,
    };
  }

  const timeout = Number(values.connectorTimeoutMillis || 5000);

  return {
    ...values,
    connectorEnabled: true,
    connectorType: 'http',
    connectorMethod: cleanText(values.connectorMethod) || 'GET',
    connectorHeaders: connectorHeadersFromJson(
      connectorHeadersToJson(values.connectorHeaders),
    ),
    connectorTimeoutMillis:
      Number.isFinite(timeout) && timeout > 0 ? timeout : 5000,
    connectorOutputVariable:
      cleanText(values.connectorOutputVariable) || 'connectorResult',
    delegateExpression: KORAVO_CONNECTOR_DELEGATE,
  };
}

export function connectorFieldValueMap(values: ServiceTaskConnectorFields) {
  const normalized = normalizeServiceTaskConnectorFields(values);
  if (!normalized.connectorEnabled) return {};

  return {
    connectorType: 'http',
    method: cleanText(normalized.connectorMethod) || 'GET',
    url: cleanText(normalized.connectorUrl),
    headers: connectorHeadersToJson(normalized.connectorHeaders),
    body: cleanText(normalized.connectorBody),
    timeoutMillis: cleanText(normalized.connectorTimeoutMillis),
    outputVariable: cleanText(normalized.connectorOutputVariable),
  } satisfies Record<ConnectorFieldName, string | undefined>;
}
