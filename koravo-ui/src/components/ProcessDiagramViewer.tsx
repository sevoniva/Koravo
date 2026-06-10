import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Empty, Flex, Spin, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import type { ProcessTraceNode } from '@/services/koravo/api';
import { processStatusLabel, taskDefinitionLabel } from '@/utils/display';

type ViewerConstructor = new (options: Record<string, unknown>) => BpmnViewer;

type BpmnViewer = {
  destroy: () => void;
  get: (service: string) => unknown;
  importXML: (xml: string) => Promise<{ warnings?: unknown[] }>;
};

type Canvas = {
  zoom: (value: string, center?: string) => void;
  addMarker: (elementId: string, marker: string) => void;
  removeMarker: (elementId: string, marker: string) => void;
};

type ElementRegistry = {
  get: (elementId: string) => unknown;
  getAll: () => Array<{ id?: string }>;
};

interface ProcessDiagramViewerProps {
  bpmnXml?: string;
  currentActivityIds?: string[];
  timeline?: ProcessTraceNode[];
  height?: number;
}

const MARKERS = [
  'koravo-node-completed',
  'koravo-node-active',
  'koravo-node-current',
];

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    position: relative;
    height: 100%;
    min-height: 320px;
    overflow: hidden;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;

    .djs-container {
      background: ${token.colorBgContainer};
    }

    .bjs-powered-by {
      color: ${token.colorTextQuaternary};
    }

    .djs-element.koravo-node-completed .djs-visual > :first-child {
      stroke: ${token.colorSuccess} !important;
      stroke-width: 3px !important;
      fill: ${token.colorSuccessBg} !important;
    }

    .djs-element.koravo-node-active .djs-visual > :first-child {
      stroke: ${token.colorWarning} !important;
      stroke-width: 3px !important;
      fill: ${token.colorWarningBg} !important;
    }

    .djs-element.koravo-node-current .djs-visual > :first-child {
      stroke: ${token.colorPrimary} !important;
      stroke-width: 4px !important;
      fill: ${token.colorPrimaryBg} !important;
    }
  `,
  mount: css`
    width: 100%;
    height: 100%;
    min-height: inherit;
  `,
  overlay: css`
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: ${token.colorBgContainer};
  `,
  legend: css`
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1;
    padding: 6px 8px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusSM}px;
    box-shadow: ${token.boxShadowTertiary};
  `,
  generatedFlow: css`
    height: 100%;
    min-height: inherit;
    overflow: auto;
    padding: 16px 18px;
    background: ${token.colorBgContainer};
  `,
  generatedHeader: css`
    position: sticky;
    top: 0;
    z-index: 1;
    padding-bottom: 12px;
    background: ${token.colorBgContainer};
  `,
  generatedList: css`
    display: grid;
    gap: 10px;
    padding-bottom: 8px;
  `,
  generatedRow: css`
    display: grid;
    grid-template-columns: 34px 20px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  `,
  generatedIndex: css`
    display: inline-flex;
    width: 30px;
    height: 30px;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextSecondary};
    font-weight: 600;
    font-size: 12px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 50%;
  `,
  generatedRail: css`
    position: relative;
    display: flex;
    min-height: 64px;
    justify-content: center;

    &::before {
      position: absolute;
      top: 16px;
      bottom: -18px;
      width: 2px;
      background: ${token.colorBorderSecondary};
      content: '';
    }
  `,
  generatedRailEnd: css`
    &::before {
      display: none;
    }
  `,
  generatedDot: css`
    position: relative;
    z-index: 1;
    width: 12px;
    height: 12px;
    margin-top: 9px;
    background: ${token.colorBgContainer};
    border: 3px solid ${token.colorBorder};
    border-radius: 50%;
  `,
  generatedDotFinish: css`
    border-color: ${token.colorSuccess};
  `,
  generatedDotProcess: css`
    border-color: ${token.colorPrimary};
    box-shadow: 0 0 0 4px ${token.colorPrimaryBg};
  `,
  generatedDotError: css`
    border-color: ${token.colorError};
  `,
  generatedCard: css`
    min-width: 0;
    padding: 10px 12px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    border-left: 3px solid ${token.colorBorder};
    border-radius: ${token.borderRadiusSM}px;
  `,
  generatedCardFinish: css`
    border-left-color: ${token.colorSuccess};
    background: ${token.colorSuccessBg};
  `,
  generatedCardProcess: css`
    border-color: ${token.colorPrimaryBorder};
    border-left-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  generatedCardError: css`
    border-left-color: ${token.colorError};
    background: ${token.colorErrorBg};
  `,
  generatedTitle: css`
    min-width: 0;
    word-break: break-word;
  `,
  generatedMeta: css`
    margin-top: 4px;
    color: ${token.colorTextSecondary};
    font-size: 12px;

    .ant-tag {
      margin-inline-end: 4px;
    }
  `,
}));

function timelineIdsByStatus(timeline: ProcessTraceNode[] | undefined, statuses: string[]) {
  const statusSet = new Set(statuses);
  return new Set(
    (timeline || [])
      .filter((node) => statusSet.has(String(node.status || '').toUpperCase()))
      .map((node) => node.activityId)
      .filter(Boolean),
  );
}

function clearMarkers(canvas: Canvas, elementRegistry: ElementRegistry) {
  elementRegistry.getAll().forEach((element) => {
    if (!element.id) return;
    MARKERS.forEach((marker) => {
      canvas.removeMarker(element.id as string, marker);
    });
  });
}

function addMarkerIfPresent(
  canvas: Canvas,
  elementRegistry: ElementRegistry,
  elementId: string,
  marker: string,
) {
  if (elementRegistry.get(elementId)) {
    canvas.addMarker(elementId, marker);
  }
}

function visibleFlowNodes(timeline: ProcessTraceNode[]) {
  const nodes = timeline.filter((node) => node.activityType !== 'sequenceFlow');
  const source = nodes.length ? nodes : timeline;
  const seen = new Set<string>();

  return source.filter((node) => {
    if (!node.activityId || seen.has(node.activityId)) return false;
    seen.add(node.activityId);
    return true;
  });
}

function bpmnActivityOrder(bpmnXml?: string) {
  if (!bpmnXml || typeof DOMParser === 'undefined') return [];
  try {
    const document = new DOMParser().parseFromString(bpmnXml, 'application/xml');
    if (document.querySelector('parsererror')) return [];
    const processElement = Array.from(document.getElementsByTagName('*')).find(
      (element) => element.localName === 'process',
    );
    if (!processElement) return [];

    const orderedIds: string[] = [];
    const activityTypes = new Set([
      'startEvent',
      'endEvent',
      'userTask',
      'serviceTask',
      'exclusiveGateway',
      'parallelGateway',
      'inclusiveGateway',
      'subProcess',
    ]);

    function collect(scope: Element) {
      Array.from(scope.children).forEach((child) => {
        if (!activityTypes.has(child.localName)) return;
        const id = child.getAttribute('id');
        if (id) orderedIds.push(id);
        if (child.localName === 'subProcess') {
          collect(child);
        }
      });
    }

    collect(processElement);
    return orderedIds;
  } catch {
    return [];
  }
}

function generatedFlowNodes(timeline: ProcessTraceNode[], bpmnXml?: string) {
  const nodes = visibleFlowNodes(timeline);
  const order = bpmnActivityOrder(bpmnXml);
  if (!order.length) return nodes;

  const nodeById = new Map(nodes.map((node) => [node.activityId, node]));
  const ordered = order
    .map((activityId) => nodeById.get(activityId))
    .filter((node): node is ProcessTraceNode => Boolean(node));
  const orderedIds = new Set(ordered.map((node) => node.activityId));
  return [
    ...ordered,
    ...nodes.filter((node) => !orderedIds.has(node.activityId)),
  ];
}

function generatedStepStatus(node: ProcessTraceNode, currentActivityIds: string[]) {
  const normalized = String(node.status || '').toUpperCase();
  if (currentActivityIds.includes(node.activityId) || normalized === 'ACTIVE' || normalized === 'RUNNING') {
    return 'process' as const;
  }
  if (normalized === 'COMPLETED') return 'finish' as const;
  if (normalized === 'FAILED' || normalized === 'TERMINATED') return 'error' as const;
  return 'wait' as const;
}

function generatedStatusColor(status: ReturnType<typeof generatedStepStatus>) {
  const mapping = {
    finish: 'success',
    process: 'processing',
    error: 'error',
    wait: 'default',
  };
  return mapping[status];
}

function generatedDotClassName(
  styles: ReturnType<typeof useStyles>['styles'],
  status: ReturnType<typeof generatedStepStatus>,
) {
  return [
    styles.generatedDot,
    status === 'finish' ? styles.generatedDotFinish : '',
    status === 'process' ? styles.generatedDotProcess : '',
    status === 'error' ? styles.generatedDotError : '',
  ].filter(Boolean).join(' ');
}

function generatedCardClassName(
  styles: ReturnType<typeof useStyles>['styles'],
  status: ReturnType<typeof generatedStepStatus>,
) {
  return [
    styles.generatedCard,
    status === 'finish' ? styles.generatedCardFinish : '',
    status === 'process' ? styles.generatedCardProcess : '',
    status === 'error' ? styles.generatedCardError : '',
  ].filter(Boolean).join(' ');
}

function currentNodeIndex(nodes: ProcessTraceNode[], currentActivityIds: string[]) {
  const currentIds = new Set(currentActivityIds.filter(Boolean));
  const current = nodes.findIndex((node) => currentIds.has(node.activityId));
  if (current >= 0) return current;

  const active = nodes.findIndex((node) =>
    ['ACTIVE', 'RUNNING'].includes(String(node.status || '').toUpperCase()),
  );
  if (active >= 0) return active;

  const completed = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => String(node.status || '').toUpperCase() === 'COMPLETED')
    .at(-1)?.index;
  return completed ?? 0;
}

function nodeTitle(node: ProcessTraceNode) {
  if (node.activityType === 'startEvent') return '开始';
  if (node.activityType === 'endEvent') return '结束';
  return taskDefinitionLabel(node.activityId, { name: node.activityName }) || node.activityId;
}

function activityTypeLabel(activityType?: string) {
  const mapping: Record<string, string> = {
    startEvent: '开始',
    endEvent: '结束',
    userTask: '人工任务',
    serviceTask: '系统任务',
    exclusiveGateway: '条件分支',
    parallelGateway: '并行分支',
    inclusiveGateway: '包容分支',
  };
  return mapping[activityType || ''] || activityType || '-';
}

const GeneratedFlow: React.FC<{
  bpmnXml?: string;
  timeline: ProcessTraceNode[];
  currentActivityIds: string[];
  height: number;
}> = ({ bpmnXml, timeline, currentActivityIds, height }) => {
  const { styles } = useStyles();
  const activeNodeRef = React.useRef<HTMLDivElement>(null);
  const nodes = generatedFlowNodes(timeline, bpmnXml);
  const currentIndex = currentNodeIndex(nodes, currentActivityIds);
  const completedCount = nodes.filter(
    (node) => String(node.status || '').toUpperCase() === 'COMPLETED',
  ).length;

  React.useEffect(() => {
    activeNodeRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  if (!nodes.length) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: height }}>
        <Empty description="当前实例暂无流程图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Flex>
    );
  }

  return (
    <div className={styles.shell} style={{ height }} data-testid="process-diagram-viewer">
      <div className={styles.generatedFlow}>
        <Flex className={styles.generatedHeader} vertical gap={8}>
          <Flex align="center" gap={8} wrap>
            <Tag color="processing">执行轨迹流程图</Tag>
            <Typography.Text type="secondary">
              已完成 {completedCount}/{nodes.length}
            </Typography.Text>
          </Flex>
          <Typography.Text strong>
            当前位置：{nodeTitle(nodes[currentIndex])}
          </Typography.Text>
        </Flex>
        <div className={styles.generatedList}>
          {nodes.map((node, index) => {
            const status = generatedStepStatus(node, currentActivityIds);
            const selected = index === currentIndex;
            return (
              <div
                key={`${node.activityId}-${node.startTime || index}`}
                ref={selected ? activeNodeRef : undefined}
                className={styles.generatedRow}
              >
                <span className={styles.generatedIndex}>{index + 1}</span>
                <span
                  className={[
                    styles.generatedRail,
                    index === nodes.length - 1 ? styles.generatedRailEnd : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={generatedDotClassName(styles, status)} />
                </span>
                <div className={generatedCardClassName(styles, status)}>
                  <Flex align="center" gap={8} wrap>
                    <Typography.Text strong className={styles.generatedTitle}>
                      {nodeTitle(node)}
                    </Typography.Text>
                    {selected ? <Tag color="processing">当前位置</Tag> : null}
                    <Tag color={generatedStatusColor(status)}>
                      {processStatusLabel(node.status)}
                    </Tag>
                  </Flex>
                  <div className={styles.generatedMeta}>
                    <Tag>{activityTypeLabel(node.activityType)}</Tag>
                    <Typography.Text type="secondary">
                      {processStatusLabel(node.status)}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ProcessDiagramViewer: React.FC<ProcessDiagramViewerProps> = ({
  bpmnXml,
  currentActivityIds = [],
  timeline = [],
  height = 360,
}) => {
  const { styles } = useStyles();
  const mountRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<BpmnViewer | undefined>(undefined);
  const [loading, setLoading] = React.useState(Boolean(bpmnXml));
  const [error, setError] = React.useState<string>();
  const hasXml = Boolean(bpmnXml?.trim());

  const applyMarkers = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      const canvas = viewer.get('canvas') as Canvas;
      const elementRegistry = viewer.get('elementRegistry') as ElementRegistry;
      const completedIds = timelineIdsByStatus(timeline, ['COMPLETED']);
      const activeIds = timelineIdsByStatus(timeline, ['ACTIVE', 'RUNNING']);
      const currentIds = new Set(currentActivityIds.filter(Boolean));

      clearMarkers(canvas, elementRegistry);
      completedIds.forEach((id) => {
        addMarkerIfPresent(canvas, elementRegistry, id, 'koravo-node-completed');
      });
      activeIds.forEach((id) => {
        addMarkerIfPresent(canvas, elementRegistry, id, 'koravo-node-active');
      });
      currentIds.forEach((id) => {
        addMarkerIfPresent(canvas, elementRegistry, id, 'koravo-node-current');
      });
    } catch {
      // The diagram can still be useful even if a marker points to a missing BPMN element.
    }
  }, [currentActivityIds, timeline]);

  React.useEffect(() => () => {
    viewerRef.current?.destroy();
    viewerRef.current = undefined;
  }, []);

  React.useEffect(() => {
    let disposed = false;

    async function importDiagram() {
      if (!hasXml || !bpmnXml) return;
      if (!viewerRef.current) {
        const module = await import('bpmn-js/lib/Viewer');
        if (disposed || !mountRef.current) return;
        const Viewer = module.default as ViewerConstructor;
        mountRef.current.replaceChildren();
        viewerRef.current = new Viewer({ container: mountRef.current });
      }

      setLoading(true);
      setError(undefined);
      try {
        await viewerRef.current.importXML(bpmnXml);
        const canvas = viewerRef.current.get('canvas') as Canvas;
        const elementRegistry = viewerRef.current.get('elementRegistry') as ElementRegistry;
        if (!elementRegistry.getAll().some((element) => element.id && !element.id.endsWith('_label'))) {
          throw new Error('流程图没有可显示节点');
        }
        canvas.zoom('fit-viewport', 'auto');
        applyMarkers();
      } catch (err) {
        setError(err instanceof Error ? err.message : '流程图加载失败');
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void importDiagram();

    return () => {
      disposed = true;
    };
  }, [applyMarkers, bpmnXml, hasXml]);

  React.useEffect(() => {
    applyMarkers();
  }, [applyMarkers]);

  if (!hasXml) {
    if (timeline.length) {
      return (
        <GeneratedFlow
          bpmnXml={bpmnXml}
          timeline={timeline}
          currentActivityIds={currentActivityIds}
          height={height}
        />
      );
    }
    return (
      <Flex align="center" justify="center" style={{ minHeight: height }}>
        <Empty description="当前实例暂无流程图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Flex>
    );
  }

  if (error && timeline.length) {
    return (
      <GeneratedFlow
        bpmnXml={bpmnXml}
        timeline={timeline}
        currentActivityIds={currentActivityIds}
        height={height}
      />
    );
  }

  return (
    <div className={styles.shell} style={{ height }} data-testid="process-diagram-viewer">
      <div ref={mountRef} className={styles.mount} />
      <Flex className={styles.legend} gap={8} wrap>
        <Tag color="success">已完成</Tag>
        <Tag color="processing">当前节点</Tag>
        <Tag color="warning">处理中</Tag>
      </Flex>
      {loading ? (
        <div className={styles.overlay}>
          <Spin indicator={<LoadingOutlined spin />} />
          <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
            加载流程图
          </Typography.Text>
        </div>
      ) : null}
      {error && !timeline.length ? (
        <div className={styles.overlay}>
          <Alert showIcon type="warning" title="流程图无法加载" description={error} />
        </div>
      ) : null}
    </div>
  );
};

export default ProcessDiagramViewer;
