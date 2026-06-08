import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import { LoadingOutlined } from '@ant-design/icons';
import { Spin, Typography, message } from 'antd';
import { createStyles } from 'antd-style';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { flowableModdle } from './flowableModdle';

type ModelerConstructor = new (options: Record<string, unknown>) => BpmnModeler;

type BpmnModeler = {
  destroy: () => void;
  get: (service: string) => unknown;
  importXML: (xml: string) => Promise<{ warnings?: unknown[] }>;
  saveXML: (options?: { format?: boolean }) => Promise<{ xml?: string }>;
};

type BpmnBusinessObject = {
  id?: string;
  name?: string;
  $type?: string;
  $attrs?: Record<string, string | undefined>;
  get?: (name: string) => unknown;
};

type BpmnElement = {
  id?: string;
  type?: string;
  businessObject?: BpmnBusinessObject;
  labelTarget?: BpmnElement;
};

type EventBus = {
  on: (
    eventName: string,
    callback: (event: Record<string, unknown>) => void,
  ) => void;
};

type Canvas = {
  zoom: (value: string, center?: string) => void;
};

type Modeling = {
  updateProperties: (
    element: BpmnElement,
    properties: Record<string, string | undefined>,
  ) => void;
};

export interface BpmnSelectedElement {
  elementId: string;
  elementType: string;
  name?: string;
  assignee?: string;
  candidateUsers?: string;
  candidateGroups?: string;
  formKey?: string;
  delegateExpression?: string;
  serviceClass?: string;
  expression?: string;
  resultVariable?: string;
}

export interface BpmnSelectedElementPatch {
  name?: string;
  assignee?: string;
  candidateUsers?: string;
  candidateGroups?: string;
  formKey?: string;
  delegateExpression?: string;
  serviceClass?: string;
  expression?: string;
  resultVariable?: string;
}

export interface BpmnModelerCanvasHandle {
  applySelectedElement: (values: BpmnSelectedElementPatch) => Promise<string>;
  saveXml: () => Promise<string>;
  zoomToFit: () => void;
}

interface BpmnModelerCanvasProps {
  value: string;
  onSelectionChange?: (element?: BpmnSelectedElement) => void;
  onXmlChange?: (xml: string) => void;
}

const useStyles = createStyles(({ css, token }) => ({
  canvas: css`
    position: relative;
    height: 100%;
    min-height: 640px;
    overflow: hidden;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    .djs-container {
      background: ${token.colorBgContainer};
    }

    .djs-palette {
      top: 24px;
      left: 24px;
      overflow: hidden;
      background: ${token.colorBgContainer};
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadius}px;
      box-shadow: ${token.boxShadowSecondary};
    }

    .djs-palette .entry {
      color: ${token.colorTextSecondary};
      border-radius: ${token.borderRadiusSM}px;
      transition:
        color ${token.motionDurationMid},
        background ${token.motionDurationMid};
    }

    .djs-palette .entry:hover,
    .djs-palette .entry.active {
      color: ${token.colorPrimary};
      background: ${token.colorBgTextHover};
    }

    .djs-palette .separator {
      margin: 6px 8px;
      border-top-color: ${token.colorBorderSecondary};
    }

    .bjs-powered-by {
      color: ${token.colorTextTertiary};
    }
  `,
  mount: css`
    width: 100%;
    height: 100%;
    min-height: 640px;
  `,
  loading: css`
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${token.colorBgContainer};
  `,
}));

function normalizeElement(element?: BpmnElement): BpmnElement | undefined {
  if (element?.labelTarget) return element.labelTarget;
  return element?.businessObject ? element : undefined;
}

function readFlowableAttribute(
  businessObject: BpmnBusinessObject,
  key: string,
): string | undefined {
  const prefixedKey = `flowable:${key}`;
  const value =
    businessObject.get?.(prefixedKey) ??
    businessObject.get?.(key) ??
    businessObject.$attrs?.[prefixedKey] ??
    businessObject.$attrs?.[key] ??
    businessObject[key as keyof BpmnBusinessObject];

  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toSelectedElement(
  element?: BpmnElement,
): BpmnSelectedElement | undefined {
  const normalized = normalizeElement(element);
  const businessObject = normalized?.businessObject;
  if (!normalized || !businessObject) return undefined;

  return {
    elementId: businessObject.id || normalized.id || '',
    elementType: businessObject.$type || normalized.type || '',
    name: businessObject.name,
    assignee: readFlowableAttribute(businessObject, 'assignee'),
    candidateUsers: readFlowableAttribute(businessObject, 'candidateUsers'),
    candidateGroups: readFlowableAttribute(businessObject, 'candidateGroups'),
    formKey: readFlowableAttribute(businessObject, 'formKey'),
    delegateExpression: readFlowableAttribute(
      businessObject,
      'delegateExpression',
    ),
    serviceClass: readFlowableAttribute(businessObject, 'class'),
    expression: readFlowableAttribute(businessObject, 'expression'),
    resultVariable: readFlowableAttribute(businessObject, 'resultVariable'),
  };
}

function blankToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function buildElementPatch(values: BpmnSelectedElementPatch) {
  return {
    name: blankToUndefined(values.name),
    'flowable:assignee': blankToUndefined(values.assignee),
    'flowable:candidateUsers': blankToUndefined(values.candidateUsers),
    'flowable:candidateGroups': blankToUndefined(values.candidateGroups),
    'flowable:formKey': blankToUndefined(values.formKey),
    'flowable:delegateExpression': blankToUndefined(values.delegateExpression),
    'flowable:class': blankToUndefined(values.serviceClass),
    'flowable:expression': blankToUndefined(values.expression),
    'flowable:resultVariable': blankToUndefined(values.resultVariable),
  };
}

export const BpmnModelerCanvas = forwardRef<
  BpmnModelerCanvasHandle,
  BpmnModelerCanvasProps
>(({ value, onSelectionChange, onXmlChange }, ref) => {
  const { styles } = useStyles();
  const mountRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | undefined>(undefined);
  const selectedElementRef = useRef<BpmnElement | undefined>(undefined);
  const lastImportedXmlRef = useRef<string | undefined>(undefined);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const valueRef = useRef(value);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onXmlChangeRef = useRef(onXmlChange);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onXmlChangeRef.current = onXmlChange;
  }, [onSelectionChange, onXmlChange]);

  const saveXml = async () => {
    const result = await modelerRef.current?.saveXML({ format: true });
    return result?.xml || valueRef.current;
  };

  const emitXmlChange = async () => {
    if (!modelerRef.current) return;
    const xml = await saveXml();
    lastImportedXmlRef.current = xml;
    onXmlChangeRef.current?.(xml);
  };

  const zoomToFit = () => {
    try {
      const canvas = modelerRef.current?.get('canvas') as Canvas | undefined;
      canvas?.zoom('fit-viewport', 'auto');
    } catch {
      // bpmn-js throws if the canvas is not ready yet.
    }
  };

  const importDiagram = async (xml: string) => {
    const modeler = modelerRef.current;
    if (!modeler || !xml || xml === lastImportedXmlRef.current) return;

    setLoading(true);
    try {
      const result = await modeler.importXML(xml);
      lastImportedXmlRef.current = xml;
      selectedElementRef.current = undefined;
      onSelectionChangeRef.current?.(undefined);
      zoomToFit();
      if (result.warnings?.length) {
        message.warning('BPMN 已加载，存在需要关注的警告');
      }
    } catch (error) {
      message.error('BPMN XML 加载失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    applySelectedElement: async (values) => {
      const element = normalizeElement(selectedElementRef.current);
      const modeling = modelerRef.current?.get('modeling') as
        | Modeling
        | undefined;
      if (!element || !modeling) return saveXml();

      modeling.updateProperties(element, buildElementPatch(values));
      await emitXmlChange();
      onSelectionChangeRef.current?.(toSelectedElement(element));
      return saveXml();
    },
    saveXml,
    zoomToFit,
  }));

  useEffect(() => {
    let disposed = false;

    async function bootModeler() {
      if (!mountRef.current || modelerRef.current) return;

      const module = await import('bpmn-js/lib/Modeler');
      if (disposed || !mountRef.current) return;

      const Modeler = module.default as ModelerConstructor;
      const modeler = new Modeler({
        container: mountRef.current,
        keyboard: { bindTo: document },
        moddleExtensions: {
          flowable: flowableModdle,
        },
      });
      modelerRef.current = modeler;

      const eventBus = modeler.get('eventBus') as EventBus;
      eventBus.on('selection.changed', (event) => {
        const selected = event.newSelection as BpmnElement[] | undefined;
        const element = normalizeElement(selected?.[0]);
        selectedElementRef.current = element;
        onSelectionChangeRef.current?.(toSelectedElement(element));
      });
      eventBus.on('element.changed', () => {
        onSelectionChangeRef.current?.(
          toSelectedElement(selectedElementRef.current),
        );
      });
      eventBus.on('commandStack.changed', () => {
        if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
        changeTimerRef.current = setTimeout(() => {
          void emitXmlChange();
        }, 250);
      });

      await importDiagram(valueRef.current);
      setLoading(false);
    }

    void bootModeler();

    return () => {
      disposed = true;
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      modelerRef.current?.destroy();
      modelerRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    void importDiagram(value);
  }, [value]);

  return (
    <div className={styles.canvas} data-testid="bpmn-modeler-canvas">
      <div ref={mountRef} className={styles.mount} />
      {loading && (
        <div className={styles.loading}>
          <Spin indicator={<LoadingOutlined spin />} />
          <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
            加载中
          </Typography.Text>
        </div>
      )}
    </div>
  );
});

BpmnModelerCanvas.displayName = 'BpmnModelerCanvas';
