import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import {
  AimOutlined,
  FullscreenOutlined,
  LoadingOutlined,
  ZoomInOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Empty,
  Flex,
  Space,
  Spin,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import type { ProcessTraceNode } from '@/services/koravo/api';
import {
  normalizeBpmnXmlLabels,
  processStatusLabel,
  taskDefinitionLabel,
} from '@/utils/display';

type BpmnAutoLayoutModule = {
  layoutProcess: (xml: string) => Promise<string>;
};

type ViewerConstructor = new (options: Record<string, unknown>) => BpmnViewer;

type BpmnViewer = {
  destroy: () => void;
  get: (service: string) => unknown;
  importXML: (xml: string) => Promise<{ warnings?: unknown[] }>;
};

type Canvas = {
  zoom: (value: string | number, center?: string) => void;
  addMarker: (elementId: string, marker: string) => void;
  removeMarker: (elementId: string, marker: string) => void;
  scrollToElement?: (element: unknown, padding?: number) => void;
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
    min-height: 220px;
    overflow: hidden;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;

    .djs-container {
      background: ${token.colorBgContainer};
    }

    .djs-element .djs-visual text,
    .djs-label text {
      fill: ${token.colorText} !important;
      font-weight: ${token.fontWeightStrong};
      font-size: 14px !important;
    }

    .djs-element.koravo-node-current .djs-visual text,
    .djs-element.koravo-node-active .djs-visual text {
      fill: ${token.colorPrimary} !important;
    }

    .bjs-powered-by {
      display: none;
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
  toolbar: css`
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1;
    padding: 4px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusSM}px;
    box-shadow: ${token.boxShadowTertiary};
  `,
  diagramStatus: css`
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1;
    max-width: min(420px, calc(100% - 164px));
    padding: 6px 8px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusSM}px;
    box-shadow: ${token.boxShadowTertiary};

    @media (max-width: 640px) {
      top: 52px;
      right: 12px;
      max-width: none;
    }
  `,
  generatedFlow: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    min-height: inherit;
    overflow: auto;
    padding: 16px;
    background: ${token.colorBgContainer};
  `,
  generatedHeader: css`
    flex: none;
  `,
  generatedSteps: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px 4px 2px;

    .ant-steps {
      min-width: max-content;
    }

    .ant-steps-item {
      min-width: 128px;
      max-width: 180px;
    }

    .ant-steps-item-title,
    .ant-steps-item-description {
      max-width: 150px;
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

function hasBpmnDiagramLayout(bpmnXml: string) {
  if (typeof DOMParser === 'undefined') return true;
  try {
    const document = new DOMParser().parseFromString(bpmnXml, 'application/xml');
    if (document.querySelector('parsererror')) return true;
    return Array.from(document.getElementsByTagName('*')).some(
      (element) => element.localName === 'BPMNShape',
    );
  } catch {
    return true;
  }
}

async function ensureBpmnDiagramLayout(bpmnXml: string) {
  if (hasBpmnDiagramLayout(bpmnXml)) return bpmnXml;
  const module = await import('bpmn-auto-layout') as BpmnAutoLayoutModule;
  return module.layoutProcess(bpmnXml);
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

function renderableDiagramElements(elementRegistry: ElementRegistry) {
  return elementRegistry.getAll().filter((element) => element.id && !element.id.endsWith('_label'));
}

function currentDiagramElementId(
  currentActivityIds: string[],
  timeline: ProcessTraceNode[] | undefined,
) {
  const currentIds = currentActivityIds.filter(Boolean);
  if (currentIds.length) return currentIds[0];
  const active = (timeline || []).find((node) =>
    ['ACTIVE', 'RUNNING'].includes(String(node.status || '').toUpperCase()),
  );
  if (active?.activityId) return active.activityId;
  const completed = (timeline || []).filter(
    (node) =>
      node.activityId &&
      node.activityType !== 'sequenceFlow' &&
      String(node.status || '').toUpperCase() === 'COMPLETED',
  );
  const businessNodes = completed.filter((node) => node.activityType !== 'startEvent');
  return [...(businessNodes.length ? businessNodes : completed)]
    .sort((left, right) => activityTime(right) - activityTime(left))[0]
    ?.activityId;
}

function currentDiagramNode(
  currentActivityIds: string[],
  timeline: ProcessTraceNode[] | undefined,
) {
  const currentId = currentDiagramElementId(currentActivityIds, timeline);
  const node = (timeline || []).find((item) => item.activityId === currentId);
  return {
    id: currentId,
    label: node ? nodeTitle(node) : currentId ? taskDefinitionLabel(currentId) : '-',
    status: node?.status,
  };
}

function diagramStatusCounts(timeline: ProcessTraceNode[]) {
  const nodes = visibleFlowNodes(timeline);
  return {
    completed: nodes.filter(
      (node) => String(node.status || '').toUpperCase() === 'COMPLETED',
    ).length,
    active: nodes.filter((node) =>
      ['ACTIVE', 'RUNNING'].includes(String(node.status || '').toUpperCase()),
    ).length,
    total: nodes.length,
  };
}

function activityTime(node: ProcessTraceNode) {
  return Date.parse(node.endTime || node.startTime || '') || 0;
}

function focusDiagramElement(
  canvas: Canvas,
  elementRegistry: ElementRegistry,
  elementId?: string,
) {
  if (!elementId || !canvas.scrollToElement) return;
  const element = elementRegistry.get(elementId);
  if (element) {
    canvas.scrollToElement(element, 96);
  }
}

function readableZoom(elementCount: number) {
  if (elementCount <= 5) return 1.18;
  if (elementCount <= 10) return 1.08;
  return 1;
}

function fitDiagramViewport(
  canvas: Canvas,
  elementRegistry: ElementRegistry,
) {
  const elements = renderableDiagramElements(elementRegistry);
  canvas.zoom('fit-viewport', 'auto');
  return elements;
}

function applyReadableViewport(
  canvas: Canvas,
  elementRegistry: ElementRegistry,
) {
  const elements = fitDiagramViewport(canvas, elementRegistry);
  const zoom = readableZoom(elements.length);
  if (zoom > 1) {
    canvas.zoom(zoom, 'auto');
  }
  return elements;
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

function diagramBadgeStatus(status?: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'success' as const;
  if (normalized === 'ACTIVE' || normalized === 'RUNNING')
    return 'processing' as const;
  if (normalized === 'FAILED' || normalized === 'TERMINATED')
    return 'error' as const;
  return 'default' as const;
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

function generatedCurrentText(nodes: ProcessTraceNode[], currentIndex: number) {
  const currentNode = nodes[currentIndex];
  return currentNode ? nodeTitle(currentNode) : '-';
}

function generatedStepItems(
  nodes: ProcessTraceNode[],
  currentActivityIds: string[],
) {
  return nodes.map((node) => {
    const status = generatedStepStatus(node, currentActivityIds);
    return {
      title: (
        <Typography.Text ellipsis={{ tooltip: nodeTitle(node) }}>
          {nodeTitle(node)}
        </Typography.Text>
      ),
      description: (
        <Tag color={generatedStatusColor(status)}>
          {processStatusLabel(node.status)}
        </Tag>
      ),
      status,
    };
  });
}

const DiagramStatusOverlay: React.FC<{
  currentActivityIds: string[];
  timeline: ProcessTraceNode[];
}> = ({ currentActivityIds, timeline }) => {
  const { styles } = useStyles();
  if (!timeline.length) return null;

  const current = currentDiagramNode(currentActivityIds, timeline);
  const counts = diagramStatusCounts(timeline);

  return (
    <div className={styles.diagramStatus}>
      <Space size={8} wrap>
        <Badge status={diagramBadgeStatus(current.status)} />
        <Tag color={counts.active ? 'processing' : 'default'}>当前</Tag>
        <Typography.Text
          strong
          ellipsis={{ tooltip: current.label }}
          style={{ maxWidth: 220 }}
        >
          {current.label}
        </Typography.Text>
        <Typography.Text type="secondary">
          已办 {counts.completed}/{counts.total}
        </Typography.Text>
      </Space>
    </div>
  );
};

const GeneratedFlow: React.FC<{
  bpmnXml?: string;
  timeline: ProcessTraceNode[];
  currentActivityIds: string[];
  height: number;
}> = ({ bpmnXml, timeline, currentActivityIds, height }) => {
  const { styles } = useStyles();
  const nodes = generatedFlowNodes(timeline, bpmnXml);
  const currentIndex = currentNodeIndex(nodes, currentActivityIds);
  const completedCount = nodes.filter(
    (node) => String(node.status || '').toUpperCase() === 'COMPLETED',
  ).length;

  if (!nodes.length) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: height }}>
        <Empty description="暂无流程图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Flex>
    );
  }
  const stepsStatus =
    generatedStepStatus(nodes[currentIndex], currentActivityIds) === 'error'
      ? 'error'
      : 'process';

  return (
    <div className={styles.shell} style={{ height }} data-testid="process-diagram-viewer">
      <div className={styles.generatedFlow}>
        <Flex
          className={styles.generatedHeader}
          align="center"
          justify="space-between"
          gap={8}
          wrap
        >
          <Space size={8}>
            <Badge status="processing" />
            <Tag color="processing">当前</Tag>
            <Typography.Text strong>
              {generatedCurrentText(nodes, currentIndex)}
            </Typography.Text>
          </Space>
          <Typography.Text type="secondary">
            已办 {completedCount}/{nodes.length}
          </Typography.Text>
        </Flex>
        <div className={styles.generatedSteps}>
          <Steps
            current={currentIndex}
            items={generatedStepItems(nodes, currentActivityIds)}
            responsive={false}
            size="small"
            status={stepsStatus}
            type="dot"
          />
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
  const normalizedBpmnXml = React.useMemo(
    () => normalizeBpmnXmlLabels(bpmnXml),
    [bpmnXml],
  );
  const mountRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<BpmnViewer | undefined>(undefined);
  const [loading, setLoading] = React.useState(Boolean(normalizedBpmnXml));
  const [error, setError] = React.useState<string>();
  const [diagramReady, setDiagramReady] = React.useState(false);
  const hasXml = Boolean(normalizedBpmnXml.trim());

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

  const diagramServices = React.useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    return {
      canvas: viewer.get('canvas') as Canvas,
      elementRegistry: viewer.get('elementRegistry') as ElementRegistry,
    };
  }, []);

  const focusCurrentActivity = React.useCallback(() => {
    const services = diagramServices();
    if (!services) return;
    focusDiagramElement(
      services.canvas,
      services.elementRegistry,
      currentDiagramElementId(currentActivityIds, timeline),
    );
  }, [currentActivityIds, diagramServices, timeline]);

  const fitDiagram = React.useCallback(() => {
    const services = diagramServices();
    if (!services) return;
    services.canvas.zoom('fit-viewport', 'auto');
  }, [diagramServices]);

  const readableDiagram = React.useCallback(() => {
    const services = diagramServices();
    if (!services) return;
    applyReadableViewport(services.canvas, services.elementRegistry);
    focusDiagramElement(
      services.canvas,
      services.elementRegistry,
      currentDiagramElementId(currentActivityIds, timeline),
    );
  }, [currentActivityIds, diagramServices, timeline]);

  React.useEffect(() => () => {
    viewerRef.current?.destroy();
    viewerRef.current = undefined;
  }, []);

  React.useEffect(() => {
    let disposed = false;

    async function importDiagram() {
      if (!hasXml || !normalizedBpmnXml) return;
      if (!viewerRef.current) {
        const module = await import('bpmn-js/lib/Viewer');
        if (disposed || !mountRef.current) return;
        const Viewer = module.default as ViewerConstructor;
        mountRef.current.replaceChildren();
        viewerRef.current = new Viewer({ container: mountRef.current });
      }

      setLoading(true);
      setError(undefined);
      setDiagramReady(false);
      try {
        const renderableBpmnXml = await ensureBpmnDiagramLayout(normalizedBpmnXml);
        if (disposed) return;
        await viewerRef.current.importXML(renderableBpmnXml);
        const canvas = viewerRef.current.get('canvas') as Canvas;
        const elementRegistry = viewerRef.current.get('elementRegistry') as ElementRegistry;
        const elements = applyReadableViewport(canvas, elementRegistry);
        if (!elements.length) {
          throw new Error('流程图没有可显示节点');
        }
        applyMarkers();
        focusDiagramElement(
          canvas,
          elementRegistry,
          currentDiagramElementId(currentActivityIds, timeline),
        );
        setDiagramReady(true);
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
  }, [applyMarkers, currentActivityIds, hasXml, normalizedBpmnXml, timeline]);

  React.useEffect(() => {
    applyMarkers();
  }, [applyMarkers]);

  if (!hasXml) {
    if (timeline.length) {
      return (
        <GeneratedFlow
          bpmnXml={normalizedBpmnXml}
          timeline={timeline}
          currentActivityIds={currentActivityIds}
          height={height}
        />
      );
    }
    return (
      <Flex align="center" justify="center" style={{ minHeight: height }}>
        <Empty description="暂无流程图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Flex>
    );
  }

  if (error && timeline.length) {
    return (
      <GeneratedFlow
        bpmnXml={normalizedBpmnXml}
        timeline={timeline}
        currentActivityIds={currentActivityIds}
        height={height}
      />
    );
  }

  return (
    <div className={styles.shell} style={{ height }} data-testid="process-diagram-viewer">
      <div ref={mountRef} className={styles.mount} />
      <DiagramStatusOverlay
        currentActivityIds={currentActivityIds}
        timeline={timeline}
      />
      <Space.Compact className={styles.toolbar}>
        <Tooltip title="适配视图">
          <Button
            aria-label="适配视图"
            disabled={!diagramReady}
            icon={<FullscreenOutlined />}
            size="small"
            type="text"
            onClick={fitDiagram}
          />
        </Tooltip>
        <Tooltip title="放大">
          <Button
            aria-label="放大"
            disabled={!diagramReady}
            icon={<ZoomInOutlined />}
            size="small"
            type="text"
            onClick={readableDiagram}
          />
        </Tooltip>
        <Tooltip title="定位当前节点">
          <Button
            aria-label="定位当前节点"
            disabled={!diagramReady}
            icon={<AimOutlined />}
            size="small"
            type="text"
            onClick={focusCurrentActivity}
          />
        </Tooltip>
      </Space.Compact>
      {loading ? (
        <div className={styles.overlay}>
          <Spin indicator={<LoadingOutlined spin />} />
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
