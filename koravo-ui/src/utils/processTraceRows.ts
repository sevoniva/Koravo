import type { ProcessTraceNode } from '@/services/koravo/api';

export interface ProcessTraceNodeRow extends ProcessTraceNode {
  rowKey: string;
}

function processTraceRowBaseKey(node: ProcessTraceNode) {
  return [
    node.activityId,
    node.activityType,
    node.startTime || 'pending',
    node.endTime || 'running',
    node.status,
  ].join('|');
}

export function withProcessTraceRowKeys(
  nodes: ProcessTraceNode[],
): ProcessTraceNodeRow[] {
  const counts = new Map<string, number>();

  return nodes.map((node) => {
    const baseKey = processTraceRowBaseKey(node);
    const nextCount = (counts.get(baseKey) || 0) + 1;
    counts.set(baseKey, nextCount);

    return {
      ...node,
      rowKey: `${baseKey}#${nextCount}`,
    };
  });
}
