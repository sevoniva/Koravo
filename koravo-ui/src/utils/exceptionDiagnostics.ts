export interface ExceptionDiagnosticsSummary {
  rawText: string;
  hasRawText: boolean;
  exceptionType?: string;
  exceptionMessage?: string;
  rootCause?: string;
  applicationFrame?: string;
  stackFrameCount: number;
}

function compactExceptionType(value?: string) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  return text.split('.').pop();
}

function splitExceptionLine(line?: string) {
  const text = String(line || '')
    .replace(/^Caused by:\s*/i, '')
    .trim();
  if (!text) return {};

  const separator = text.indexOf(':');
  const typeText = separator >= 0 ? text.slice(0, separator).trim() : text;
  const message = separator >= 0 ? text.slice(separator + 1).trim() : '';
  const isQualifiedType = /^[\w$.]+(?:Exception|Error|Throwable)$/i.test(
    typeText,
  );

  return {
    exceptionType: isQualifiedType ? compactExceptionType(typeText) : undefined,
    exceptionMessage: message || (isQualifiedType ? undefined : text),
  };
}

function compactFrame(line?: string) {
  const text = String(line || '').trim();
  const match = text.match(/^at\s+([^(]+)\(([^)]+)\)$/);
  if (!match) return undefined;

  const [, fullMethod, location] = match;
  const methodParts = fullMethod.split('.');
  const method = methodParts.slice(-2).join('.');
  const prefix = fullMethod.startsWith('org.flowable.')
    ? 'Flowable 引擎'
    : fullMethod.startsWith('io.koravo.')
      ? 'Koravo'
      : '';
  return [prefix, `${method}（${location}）`].filter(Boolean).join('：');
}

export function summarizeExceptionStacktrace(
  value?: string | null,
): ExceptionDiagnosticsSummary {
  const rawText = String(value || '').trim();
  if (!rawText) {
    return { rawText: '', hasRawText: false, stackFrameCount: 0 };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines.find((line) => !line.startsWith('at '));
  const causeLine = lines.find((line) => /^Caused by:/i.test(line));
  const frameLines = lines.filter((line) => line.startsWith('at '));
  const applicationFrame =
    frameLines.find((line) => line.includes('io.koravo.')) ||
    frameLines.find((line) => line.includes('org.flowable.'));
  const primary = splitExceptionLine(firstLine);
  const cause = splitExceptionLine(causeLine);

  return {
    rawText,
    hasRawText: true,
    exceptionType: primary.exceptionType,
    exceptionMessage: primary.exceptionMessage,
    rootCause: cause.exceptionMessage
      ? [cause.exceptionType, cause.exceptionMessage].filter(Boolean).join('：')
      : cause.exceptionType,
    applicationFrame: compactFrame(applicationFrame),
    stackFrameCount: frameLines.length,
  };
}
