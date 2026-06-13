import type { Rule } from 'antd/es/form';
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
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

interface WorkflowJsonSchemaProperty {
  title?: string;
  type?: string;
  format?: string;
  widget?: string;
  enum?: unknown[];
  minLength?: unknown;
  maxLength?: unknown;
  pattern?: unknown;
  minimum?: unknown;
  maximum?: unknown;
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

function finiteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
        minLength: finiteNumber(property.minLength),
        maxLength: finiteNumber(property.maxLength),
        pattern:
          typeof property.pattern === 'string' && property.pattern.trim()
            ? property.pattern.trim()
            : undefined,
        minimum: finiteNumber(property.minimum),
        maximum: finiteNumber(property.maximum),
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

export function workflowFieldRules(
  field: {
    title: string;
    type: WorkflowFieldType;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minimum?: number;
    maximum?: number;
  },
  messagePrefix = '请输入',
): Rule[] {
  const rules: Rule[] = [];

  if (field.required) {
    rules.push({ required: true, message: `${messagePrefix}${field.title}` });
  }

  if (field.type === 'number') {
    const minimum = finiteNumber(field.minimum);
    const maximum = finiteNumber(field.maximum);
    if (minimum !== undefined || maximum !== undefined) {
      rules.push({
        validator: async (_rule, value) => {
          if (value === undefined || value === null || value === '') return;
          const numeric = finiteNumber(value);
          if (numeric === undefined) {
            throw new Error(`${field.title}必须为数字`);
          }
          if (minimum !== undefined && numeric < minimum) {
            throw new Error(`${field.title}不能小于 ${minimum}`);
          }
          if (maximum !== undefined && numeric > maximum) {
            throw new Error(`${field.title}不能大于 ${maximum}`);
          }
        },
      });
    }
    return rules;
  }

  if (field.minLength !== undefined) {
    rules.push({
      min: field.minLength,
      message: `${field.title}至少 ${field.minLength} 个字符`,
    });
  }
  if (field.maxLength !== undefined) {
    rules.push({
      max: field.maxLength,
      message: `${field.title}最多 ${field.maxLength} 个字符`,
    });
  }
  if (field.pattern?.trim()) {
    try {
      rules.push({
        pattern: new RegExp(field.pattern.trim()),
        message: `${field.title}格式不正确`,
      });
    } catch {
      // 历史表单可能保存过无效正则，运行态不阻断页面渲染。
    }
  }

  return rules;
}

export function workflowNumberFieldProps(
  field: Pick<WorkflowFormField, 'minimum' | 'maximum'>,
) {
  return {
    ...(field.minimum !== undefined ? { min: field.minimum } : {}),
    ...(field.maximum !== undefined ? { max: field.maximum } : {}),
  };
}
