import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import { LoadingOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Collapse,
  Result,
  Space,
  Spin,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  normalizeBpmnImportWarnings,
  type BpmnImportWarningView,
} from './bpmnImportWarnings';
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
  scrollToElement?: (element: BpmnElement) => void;
};

type ElementRegistry = {
  get: (id: string) => BpmnElement | undefined;
};

type Selection = {
  select: (element: BpmnElement) => void;
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
  candidateUsers?: string[];
  candidateGroups?: string[];
  formKey?: string;
  delegateExpression?: string;
  serviceClass?: string;
  expression?: string;
  resultVariable?: string;
}

export interface BpmnSelectedElementPatch {
  name?: string;
  assignee?: string;
  candidateUsers?: string[];
  candidateGroups?: string[];
  formKey?: string;
  delegateExpression?: string;
  serviceClass?: string;
  expression?: string;
  resultVariable?: string;
}

export interface BpmnModelerCanvasHandle {
  applySelectedElement: (values: BpmnSelectedElementPatch) => Promise<string>;
  focusElement: (elementId: string) => void;
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
    min-height: 560px;
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
    min-height: 560px;
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
  error: css`
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: ${token.colorBgContainer};
  `,
  warningPanel: css`
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 4;
    width: min(420px, calc(100% - 24px));

    .ant-alert {
      box-shadow: ${token.boxShadowSecondary};
    }

    .ant-collapse-header,
    .ant-collapse-content-box {
      padding-inline: 0 !important;
    }
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
    candidateUsers: splitCsv(
      readFlowableAttribute(businessObject, 'candidateUsers'),
    ),
    candidateGroups: splitCsv(
      readFlowableAttribute(businessObject, 'candidateGroups'),
    ),
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

function splitCsv(value?: string) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToCsv(value?: string[]) {
  const items = value?.map((item) => item.trim()).filter(Boolean) || [];
  return items.length ? items.join(',') : undefined;
}

function buildElementPatch(values: BpmnSelectedElementPatch) {
  return {
    name: blankToUndefined(values.name),
    'flowable:assignee': blankToUndefined(values.assignee),
    'flowable:candidateUsers': listToCsv(values.candidateUsers),
    'flowable:candidateGroups': listToCsv(values.candidateGroups),
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
  const { message } = App.useApp();
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
  const [importError, setImportError] = useState<string>();
  const [importWarnings, setImportWarnings] = useState<
    BpmnImportWarningView[]
  >([]);

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

  const focusElement = (elementId: string) => {
    try {
      const elementRegistry = modelerRef.current?.get('elementRegistry') as
        | ElementRegistry
        | undefined;
      const selection = modelerRef.current?.get('selection') as
        | Selection
        | undefined;
      const canvas = modelerRef.current?.get('canvas') as Canvas | undefined;
      const element = elementRegistry?.get(elementId);
      if (!element) return;

      selectedElementRef.current = element;
      selection?.select(element);
      canvas?.scrollToElement?.(element);
      onSelectionChangeRef.current?.(toSelectedElement(element));
    } catch {
      // The modeler may still be importing when a release-check action runs.
    }
  };

  const importDiagram = async (xml: string) => {
    const modeler = modelerRef.current;
    if (!modeler || !xml || xml === lastImportedXmlRef.current) return;

    setLoading(true);
    setImportError(undefined);
    setImportWarnings([]);
    try {
      const result = await modeler.importXML(xml);
      lastImportedXmlRef.current = xml;
      selectedElementRef.current = undefined;
      onSelectionChangeRef.current?.(undefined);
      zoomToFit();
      if (result.warnings?.length) {
        setImportWarnings(normalizeBpmnImportWarnings(result.warnings));
        message.warning('流程图已加载，存在需要关注的警告');
      }
    } catch (error) {
      setImportWarnings([]);
      setImportError(error instanceof Error ? error.message : '流程文件加载失败');
    } finally {
      setLoading(false);
    }
  };

  const retryImport = () => {
    lastImportedXmlRef.current = undefined;
    void importDiagram(valueRef.current);
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
    focusElement,
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
      {importError ? (
        <div className={styles.error}>
          <Result
            status="warning"
            title="流程图无法加载"
            subTitle="当前流程文件不能渲染为流程图。可以切换模型、查看流程文件，或修正后重新加载。"
            extra={
              <Button type="primary" onClick={retryImport}>
                重新加载
              </Button>
            }
          />
        </div>
      ) : null}
      {!importError && importWarnings.length ? (
        <div className={styles.warningPanel}>
          <Alert
            showIcon
            closable
            type="warning"
            title={`流程图有 ${importWarnings.length} 条加载警告`}
            description={
              <Collapse
                size="small"
                ghost
                defaultActiveKey={importWarnings[0]?.key}
                items={importWarnings.slice(0, 5).map((warning) => ({
                  key: warning.key,
                  label: warning.reason,
                  children: (
                    <Space vertical size={4}>
                      <Typography.Text type="secondary">
                        位置：{warning.location}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        处理：{warning.action}
                      </Typography.Text>
                    </Space>
                  ),
                }))}
              />
            }
          />
        </div>
      ) : null}
    </div>
  );
});

BpmnModelerCanvas.displayName = 'BpmnModelerCanvas';
