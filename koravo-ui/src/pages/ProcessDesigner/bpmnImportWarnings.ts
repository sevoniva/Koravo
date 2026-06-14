export interface BpmnImportWarningView {
  key: string;
  reason: string;
  location: string;
  action: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object';
}

function fieldText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function warningMessage(warning: unknown) {
  if (typeof warning === 'string') return warning;
  if (warning instanceof Error) return warning.message;
  if (!isRecord(warning)) return '流程文件有加载警告';

  const nestedError = isRecord(warning.error)
    ? fieldText(warning.error.message)
    : undefined;
  const nestedWarning = isRecord(warning.warning)
    ? fieldText(warning.warning.message)
    : undefined;

  return (
    fieldText(warning.message) ||
    nestedError ||
    nestedWarning ||
    '流程文件有加载警告'
  );
}

function objectId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  return (
    fieldText(value.id) ||
    objectId(value.businessObject) ||
    objectId(value.element) ||
    objectId(value.semantic) ||
    objectId(value.context)
  );
}

function messageLocation(message: string) {
  const idMatch =
    message.match(/\bid=["']([^"']+)["']/i) ||
    message.match(/\bid\s+([^,\s]+)/i) ||
    message.match(/element\s+([A-Za-z0-9_.:-]+)/i);

  return idMatch?.[1]?.trim();
}

function warningLocation(warning: unknown, message: string) {
  const id = objectId(warning) || messageLocation(message);
  return id || '流程文件（未返回节点 ID）';
}

function shortTechnicalMessage(message: string) {
  return message
    .split('\n')[0]
    .replace(/\s+/g, ' ')
    .replace(/^warning:\s*/i, '')
    .trim();
}

function warningReason(message: string) {
  if (/duplicate|already exists/i.test(message)) return '节点标识重复';
  if (/unparsable|unrecognized|unknown/i.test(message)) {
    return '存在设计器未识别的流程内容';
  }
  if (/missing|not found|cannot resolve|unresolved/i.test(message)) {
    return '引用的节点或资源不存在';
  }
  if (/incoming|outgoing|source|target|sequence flow/i.test(message)) {
    return '连线起止节点需要检查';
  }

  const cleaned = shortTechnicalMessage(message);
  return cleaned || '流程文件有加载警告';
}

function warningAction(reason: string) {
  if (reason.includes('重复')) return '修改重复节点标识后重新加载';
  if (reason.includes('未识别')) return '检查扩展属性或改为标准 BPMN 内容';
  if (reason.includes('不存在')) return '补齐引用目标或删除失效引用';
  if (reason.includes('连线')) return '重新连接起点和终点';
  return '查看流程文件或选中节点后修正';
}

export function normalizeBpmnImportWarnings(
  warnings?: unknown[],
): BpmnImportWarningView[] {
  return (warnings || []).map((warning, index) => {
    const message = warningMessage(warning);
    const reason = warningReason(message);

    return {
      key: `${index}-${reason}-${warningLocation(warning, message)}`,
      reason,
      location: warningLocation(warning, message),
      action: warningAction(reason),
    };
  });
}
