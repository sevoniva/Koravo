import { productCopy } from './display';

export type WorkflowFieldPermission = 'editable' | 'readonly' | 'hidden';
export type WorkflowFieldType = 'string' | 'number' | 'boolean' | 'array';

export interface WorkflowFormField {
  fieldKey: string;
  title: string;
  type: WorkflowFieldType;
  format?: string;
  widget?: string;
  placeholder?: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  permission: WorkflowFieldPermission;
  visibleWhenField?: string;
  visibleWhenValue?: string;
}

interface WorkflowJsonSchemaProperty {
  title?: string;
  type?: string;
  format?: string;
  widget?: string;
  enum?: unknown[];
  'ui:placeholder'?: string;
  'ui:widget'?: string;
}

type JsonRecord = Record<string, unknown>;

function parseJsonObject(value?: string): JsonRecord {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as JsonRecord;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeFieldType(type?: string): WorkflowFieldType {
  if (type === 'array') return 'array';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

function normalizePermission(permission?: unknown): WorkflowFieldPermission {
  return permission === 'readonly' || permission === 'hidden'
    ? permission
    : 'editable';
}

function normalizeOptions(options?: unknown[]) {
  if (!Array.isArray(options)) return undefined;
  const normalized = options
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean);
  return normalized.length
    ? Array.from(new Set(normalized)).map((value) => ({ label: value, value }))
    : undefined;
}

function normalizedText(value: unknown) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function matchesVisibleCondition(value: unknown, expected: string) {
  const expectedText = normalizedText(expected);
  if (Array.isArray(value)) {
    return value.some((item) => normalizedText(item) === expectedText);
  }
  return normalizedText(value) === expectedText;
}

export function parseWorkflowFormFields(
  schemaJson?: string,
  uiSchemaJson?: string,
  options?: { excludeKeys?: Set<string> },
): WorkflowFormField[] {
  const schema = parseJsonObject(schemaJson);
  const uiSchema = parseJsonObject(uiSchemaJson);
  const properties = schema.properties as
    | Record<string, WorkflowJsonSchemaProperty>
    | undefined;
  if (!properties || typeof properties !== 'object') return [];

  const required = Array.isArray(schema.required)
    ? schema.required.map(String)
    : [];
  const excludeKeys = options?.excludeKeys || new Set<string>();

  return Object.entries(properties)
    .filter(([fieldKey]) => !excludeKeys.has(fieldKey))
    .map(([fieldKey, property]) => {
      const uiField = uiSchema[fieldKey] as JsonRecord | undefined;
      const type = normalizeFieldType(property.type);
      const widget =
        uiField?.['ui:widget'] || uiField?.widget || property['ui:widget'];
      const placeholder =
        uiField?.['ui:placeholder'] ||
        uiField?.placeholder ||
        property['ui:placeholder'];
      const visibleWhenField =
        typeof uiField?.visibleWhenField === 'string'
          ? uiField.visibleWhenField.trim()
          : '';
      const visibleWhenValue =
        typeof uiField?.visibleWhenValue === 'string'
          ? uiField.visibleWhenValue.trim()
          : '';

      return {
        fieldKey,
        title: productCopy(property.title) || fieldKey,
        type,
        format: property.format,
        widget: typeof widget === 'string' ? widget : '',
        placeholder: typeof placeholder === 'string' ? placeholder : undefined,
        required: required.includes(fieldKey),
        options: normalizeOptions(property.enum),
        permission: normalizePermission(uiField?.permission),
        visibleWhenField: visibleWhenField || undefined,
        visibleWhenValue: visibleWhenValue || undefined,
      };
    });
}

export function isWorkflowFieldVisible(
  field: Pick<
    WorkflowFormField,
    'permission' | 'visibleWhenField' | 'visibleWhenValue'
  >,
  values?: JsonRecord,
) {
  if (field.permission === 'hidden') return false;
  if (!field.visibleWhenField || field.visibleWhenValue === undefined) {
    return true;
  }
  return matchesVisibleCondition(
    values?.[field.visibleWhenField],
    field.visibleWhenValue,
  );
}

export function visibleWorkflowFormFields(
  fields: WorkflowFormField[],
  values?: JsonRecord,
) {
  return fields.filter((field) => isWorkflowFieldVisible(field, values));
}

export function filterWorkflowFormValues(
  fields: WorkflowFormField[],
  values?: JsonRecord,
): JsonRecord {
  if (!fields.length) return { ...(values || {}) };
  const allowedKeys = new Set(fields.map((field) => field.fieldKey));
  return Object.entries(values || {}).reduce<JsonRecord>(
    (result, [key, value]) => {
      if (allowedKeys.has(key)) {
        result[key] = value;
      }
      return result;
    },
    {},
  );
}
