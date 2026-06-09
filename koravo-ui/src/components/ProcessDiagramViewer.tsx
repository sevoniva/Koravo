import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Empty, Flex, Spin, Steps, Tag, Typography } from 'antd';
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
    display: flex;
    height: 100%;
    min-height: inherit;
    flex-direction: column;
    gap: 16px;
    justify-content: center;
    padding: 24px;
    background: ${token.colorBgContainer};

    .ant-steps-item-title {
      max-width: 160px;
      white-space: normal;
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

function generatedStepStatus(node: ProcessTraceNode, currentActivityIds: string[]) {
  const normalized = String(node.status || '').toUpperCase();
  if (currentActivityIds.includes(node.activityId) || normalized === 'ACTIVE' || normalized === 'RUNNING') {
    return 'process' as const;
  }
  if (normalized === 'COMPLETED') return 'finish' as const;
  if (normalized === 'FAILED' || normalized === 'TERMINATED') return 'error' as const;
  return 'wait' as const;
}

function nodeTitle(node: ProcessTraceNode) {
  if (node.activityType === 'startEvent') return '开始';
  if (node.activityType === 'endEvent') return '结束';
  return node.activityName || taskDefinitionLabel(node.activityId) || node.activityId;
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

function stepDescription(node: ProcessTraceNode) {
  return `${activityTypeLabel(node.activityType)} · ${processStatusLabel(node.status)}`;
}

const GeneratedFlow: React.FC<{
  timeline: ProcessTraceNode[];
  currentActivityIds: string[];
  height: number;
}> = ({ timeline, currentActivityIds, height }) => {
  const { styles } = useStyles();
  const nodes = visibleFlowNodes(timeline);
  const currentIndex = Math.max(
    0,
    nodes.findIndex((node) => currentActivityIds.includes(node.activityId)),
  );

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
        <Flex align="center" gap={8} wrap>
          <Tag color="processing">按执行轨迹生成</Tag>
          <Typography.Text type="secondary">
            当前流程未保存图形布局，已按节点记录展示流程位置。
          </Typography.Text>
        </Flex>
        <Steps
          current={currentIndex}
          responsive
          items={nodes.map((node) => ({
            title: nodeTitle(node),
            description: stepDescription(node),
            status: generatedStepStatus(node, currentActivityIds),
          }))}
        />
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

  React.useEffect(() => {
    let disposed = false;

    async function bootViewer() {
      if (!mountRef.current || viewerRef.current || !hasXml) return;
      const module = await import('bpmn-js/lib/Viewer');
      if (disposed || !mountRef.current) return;
      const Viewer = module.default as ViewerConstructor;
      viewerRef.current = new Viewer({ container: mountRef.current });
    }

    void bootViewer();

    return () => {
      disposed = true;
      viewerRef.current?.destroy();
      viewerRef.current = undefined;
    };
  }, [hasXml]);

  React.useEffect(() => {
    let disposed = false;

    async function importDiagram() {
      if (!hasXml || !bpmnXml) return;
      if (!viewerRef.current) {
        const module = await import('bpmn-js/lib/Viewer');
        if (disposed || !mountRef.current) return;
        const Viewer = module.default as ViewerConstructor;
        viewerRef.current = new Viewer({ container: mountRef.current });
      }

      setLoading(true);
      setError(undefined);
      try {
        await viewerRef.current.importXML(bpmnXml);
        const canvas = viewerRef.current.get('canvas') as Canvas;
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
