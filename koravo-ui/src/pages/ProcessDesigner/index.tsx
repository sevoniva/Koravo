import {
  AimOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DownloadOutlined,
  FileAddOutlined,
  MoreOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProDescriptions,
  ProForm,
  ProFormText,
  ProList,
} from '@ant-design/pro-components';
import { useLocation } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Drawer,
  Dropdown,
  Flex,
  FloatButton,
  Input,
  Space,
  Tooltip,
  Typography,
  message,
  type MenuProps,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getProcessModel,
  importProcessModel,
  listProcessModels,
  updateProcessModel,
  validateProcessModelXml,
  type ProcessModelItem,
} from '@/services/koravo/api';
import {
  processDisplayName,
  processModelKeyLabel,
  processStatusLabel,
} from '@/utils/display';
import { formatDateTime } from '@/utils/format';
import {
  BpmnModelerCanvas,
  type BpmnModelerCanvasHandle,
  type BpmnSelectedElement,
  type BpmnSelectedElementPatch,
} from './BpmnModelerCanvas';
import { createDefaultBpmnXml, resolveDesignerXml } from './modelerXml';

interface ModelFormValues {
  modelName: string;
  description?: string;
}

const useStyles = createStyles(({ css, token }) => ({
  workbench: css`
    position: relative;
    height: calc(100vh - 132px);
    min-height: 720px;
    overflow: hidden;
    background: ${token.colorBgLayout};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
  `,
  editor: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 16px;
    background: ${token.colorBgLayout};
  `,
  editorHeader: css`
    flex: 0 0 auto;
    margin-bottom: 12px;
    padding: 0 4px;
  `,
  canvasRegion: css`
    flex: 1 1 auto;
    min-height: 0;
  `,
  meta: css`
    margin-bottom: 16px;
  `,
  xmlPreview: css`
    min-height: 560px;
    font-family: ${token.fontFamilyCode};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.6;
  `,
  modelList: css`
    .ant-pro-list-row {
      padding: 0;
    }

    .ant-list-pagination {
      margin-block-start: 12px;
      text-align: center;
    }
  `,
  modelItem: css`
    margin-bottom: 10px;
    padding: 12px;
    cursor: pointer;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    transition:
      border-color ${token.motionDurationMid},
      background ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid};

    &:hover {
      background: ${token.colorFillQuaternary};
      border-color: ${token.colorPrimaryBorder};
      box-shadow: ${token.boxShadowTertiary};
    }
  `,
  modelItemSelected: css`
    background: ${token.colorPrimaryBg};
    border-color: ${token.colorPrimaryBorder};
  `,
  modelName: css`
    max-width: 170px;
  `,
  modelMeta: css`
    font-size: ${token.fontSizeSM}px;
    color: ${token.colorTextDescription};
  `,
  drawerSection: css`
    padding-bottom: 18px;

    & + & {
      padding-top: 18px;
      border-top: 1px solid ${token.colorBorderSecondary};
    }
  `,
  sectionTitle: css`
    margin: 0 0 12px;
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    font-weight: ${token.fontWeightStrong};
  `,
  canvasTools: css`
    .ant-float-btn-body {
      background: ${token.colorBgContainer};
      box-shadow: ${token.boxShadowSecondary};
    }
  `,
  nodePlaceholder: css`
    padding: 24px 16px;
    text-align: center;
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadius}px;
  `,
}));

function createDraftModelKey() {
  return `koravoProcess${Date.now().toString(36)}`;
}

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isUserTask(element?: BpmnSelectedElement) {
  return element?.elementType === 'bpmn:UserTask';
}

function isServiceTask(element?: BpmnSelectedElement) {
  return element?.elementType === 'bpmn:ServiceTask';
}

const ProcessDesigner: React.FC = () => {
  const location = useLocation();
  const { styles } = useStyles();
  const modelerRef = useRef<BpmnModelerCanvasHandle>(null);
  const draftModelKeyRef = useRef(createDraftModelKey());
  const [selectedId, setSelectedId] = useState<string>();
  const [designerXml, setDesignerXml] = useState('');
  const [selectedElement, setSelectedElement] = useState<BpmnSelectedElement>();
  const [modelDrawerOpen, setModelDrawerOpen] = useState(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false);
  const [xmlDrawerOpen, setXmlDrawerOpen] = useState(false);
  const [modelForm, setModelForm] = useState<ModelFormValues>({
    modelName: '新流程模型',
  });
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    data: models,
    isLoading: modelsLoading,
    refetch: reloadModels,
  } = useQuery({
    queryKey: ['designer-models'],
    queryFn: () => listProcessModels(),
  });
  const { data: selected, refetch } = useQuery({
    queryKey: ['designer-model', selectedId],
    queryFn: () => getProcessModel(selectedId || ''),
    enabled: Boolean(selectedId),
  });
  const activeModel = selectedId ? selected : undefined;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modelId = params.get('modelId') || undefined;
    if (modelId) {
      setSelectedId(modelId);
    }
  }, [location.search]);

  useEffect(() => {
    if (!activeModel) return;

    const displayName = processDisplayName(
      activeModel.modelKey,
      activeModel.modelName,
    );
    setModelForm({
      modelName: displayName,
      description: activeModel.description,
    });
    setDesignerXml(
      resolveDesignerXml(
        activeModel.bpmnXml,
        activeModel.modelKey,
        displayName,
      ),
    );
    setSelectedElement(undefined);
  }, [activeModel]);

  useEffect(() => {
    if (selectedId) return;

    setModelForm({ modelName: '新流程模型' });
    setDesignerXml(
      createDefaultBpmnXml(draftModelKeyRef.current, '新流程模型'),
    );
    setSelectedElement(undefined);
  }, [selectedId]);

  const getCurrentXml = useCallback(async () => {
    return (await modelerRef.current?.saveXml()) || designerXml;
  }, [designerXml]);

  const handleNewModel = useCallback(() => {
    draftModelKeyRef.current = createDraftModelKey();
    setSelectedId(undefined);
    setModelForm({ modelName: '新流程模型' });
    setDesignerXml(
      createDefaultBpmnXml(draftModelKeyRef.current, '新流程模型'),
    );
    setSelectedElement(undefined);
    setInspectorDrawerOpen(true);
  }, []);

  const handleSelectionChange = useCallback((element?: BpmnSelectedElement) => {
    setSelectedElement(element);
    if (element) setInspectorDrawerOpen(true);
  }, []);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      await validateProcessModelXml(await getCurrentXml());
      message.success('校验通过');
    } finally {
      setValidating(false);
    }
  }, [getCurrentXml]);

  const handleSave = useCallback(async () => {
    if (!modelForm.modelName?.trim()) {
      message.warning('请输入模型名称');
      return;
    }

    setSaving(true);
    try {
      const bpmnXml = await getCurrentXml();
      if (activeModel) {
        await updateProcessModel(activeModel.id, {
          modelName: modelForm.modelName.trim(),
          description: modelForm.description,
          bpmnXml,
        });
        message.success('已保存');
        await refetch();
      } else {
        const imported = await importProcessModel({
          modelName: modelForm.modelName.trim(),
          description: modelForm.description,
          bpmnXml,
        });
        message.success('已导入');
        setSelectedId(imported.id);
      }
      await reloadModels();
    } finally {
      setSaving(false);
    }
  }, [activeModel, getCurrentXml, modelForm, refetch, reloadModels]);

  const handleExport = useCallback(async () => {
    const xml = await getCurrentXml();
    const filename = `${processModelKeyLabel(
      activeModel?.modelKey || draftModelKeyRef.current,
    )}.bpmn20.xml`;
    downloadXml(xml, filename);
  }, [activeModel, getCurrentXml]);

  const handleApplyElement = useCallback(
    async (values: BpmnSelectedElementPatch) => {
      const xml = await modelerRef.current?.applySelectedElement(values);
      if (xml) setDesignerXml(xml);
      message.success('属性已更新');
      return true;
    },
    [],
  );

  const renderModelList = () => (
    <ProList<ProcessModelItem>
      className={styles.modelList}
      rowKey="id"
      dataSource={models || []}
      loading={modelsLoading}
      options={false}
      search={false}
      locale={{ emptyText: '暂无流程模型' }}
      pagination={{
        pageSize: 8,
        size: 'small',
        align: 'center',
      }}
      itemRender={(item) => {
        const selected = selectedId === item.id;
        return (
          <div
            className={`${styles.modelItem} ${
              selected ? styles.modelItemSelected : ''
            }`}
            onClick={() => {
              setSelectedId(item.id);
              setModelDrawerOpen(false);
            }}
          >
            <Flex vertical gap={6} style={{ width: '100%' }}>
              <Flex align="center" justify="space-between" gap={8}>
                <Typography.Text strong ellipsis className={styles.modelName}>
                  {processDisplayName(item.modelKey, item.modelName)}
                </Typography.Text>
                <KoravoStatusTag
                  status={item.status}
                  text={processStatusLabel(item.status)}
                />
              </Flex>
              <Flex align="center" justify="space-between" gap={8}>
                <Typography.Text ellipsis className={styles.modelMeta}>
                  {processModelKeyLabel(item.modelKey)}
                </Typography.Text>
                <Typography.Text className={styles.modelMeta}>
                  {formatDateTime(item.updatedAt)}
                </Typography.Text>
              </Flex>
            </Flex>
          </div>
        );
      }}
    />
  );

  const renderElementProperties = () => {
    if (!selectedElement) {
      return (
        <div className={styles.nodePlaceholder}>
          <Typography.Text type="secondary">
            选择画布节点后编辑属性
          </Typography.Text>
        </div>
      );
    }

    return (
      <ProForm<BpmnSelectedElementPatch>
        key={selectedElement.elementId}
        initialValues={selectedElement}
        submitter={{
          render: (_, dom) => <Flex justify="end">{dom}</Flex>,
          searchConfig: {
            submitText: '应用属性',
          },
        }}
        onFinish={handleApplyElement}
      >
        <ProDescriptions
          column={1}
          dataSource={selectedElement}
          columns={[
            { title: '节点标识', dataIndex: 'elementId', copyable: true },
            { title: '节点类型', dataIndex: 'elementType' },
          ]}
          className={styles.meta}
        />
        <ProFormText name="name" label="名称" />
        {isUserTask(selectedElement) && (
          <>
            <ProFormText name="assignee" label="办理人" />
            <ProFormText name="candidateUsers" label="候选用户" />
            <ProFormText name="candidateGroups" label="候选组" />
            <ProFormText name="formKey" label="表单标识" />
          </>
        )}
        {isServiceTask(selectedElement) && (
          <>
            <ProFormText name="delegateExpression" label="Delegate 表达式" />
            <ProFormText name="serviceClass" label="Java 类" />
            <ProFormText name="expression" label="执行表达式" />
            <ProFormText name="resultVariable" label="结果变量" />
          </>
        )}
      </ProForm>
    );
  };

  const actionMenu: MenuProps = {
    items: [
      { key: 'new', icon: <FileAddOutlined />, label: '新建模型' },
      { type: 'divider' },
      { key: 'export', icon: <DownloadOutlined />, label: '导出 BPMN' },
      { key: 'xml', icon: <CodeOutlined />, label: '查看 XML' },
    ],
    onClick: ({ key }) => {
      if (key === 'new') handleNewModel();
      if (key === 'export') void handleExport();
      if (key === 'xml') setXmlDrawerOpen(true);
    },
  };

  return (
    <PageContainer
      title="流程设计器"
      extra={[
        <Space.Compact key="workspace">
          <Tooltip title="模型">
            <Button
              icon={<BarsOutlined />}
              onClick={() => setModelDrawerOpen(true)}
            />
          </Tooltip>
          <Tooltip title="配置">
            <Button
              icon={<SettingOutlined />}
              onClick={() => setInspectorDrawerOpen(true)}
            />
          </Tooltip>
          <Tooltip title="校验">
            <Button
              icon={<CheckCircleOutlined />}
              loading={validating}
              onClick={handleValidate}
            />
          </Tooltip>
        </Space.Compact>,
        <Dropdown key="more" menu={actionMenu} trigger={['click']}>
          <Button icon={<MoreOutlined />}>更多</Button>
        </Dropdown>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存
        </Button>,
      ]}
    >
      <div className={styles.workbench}>
        <section className={styles.editor}>
          <Flex
            align="center"
            justify="space-between"
            className={styles.editorHeader}
          >
            <Flex vertical gap={0}>
              <Typography.Text strong>
                {activeModel
                  ? processDisplayName(
                      activeModel.modelKey,
                      activeModel.modelName,
                    )
                  : modelForm.modelName}
              </Typography.Text>
              <Typography.Text type="secondary">
                {processModelKeyLabel(
                  activeModel?.modelKey || draftModelKeyRef.current,
                )}
              </Typography.Text>
            </Flex>
          </Flex>
          <div className={styles.canvasRegion}>
            <BpmnModelerCanvas
              ref={modelerRef}
              value={designerXml}
              onXmlChange={setDesignerXml}
              onSelectionChange={handleSelectionChange}
            />
          </div>
          <FloatButton.Group
            shape="square"
            className={styles.canvasTools}
            style={{ top: 156, right: 32, bottom: 'auto' }}
          >
            <FloatButton
              icon={<BarsOutlined />}
              tooltip="模型"
              onClick={() => setModelDrawerOpen(true)}
            />
            <FloatButton
              icon={<SettingOutlined />}
              tooltip="配置"
              onClick={() => setInspectorDrawerOpen(true)}
            />
            <FloatButton
              icon={<AimOutlined />}
              tooltip="适应画布"
              onClick={() => modelerRef.current?.zoomToFit()}
            />
          </FloatButton.Group>
        </section>
      </div>

      <Drawer
        title="模型"
        placement="left"
        open={modelDrawerOpen}
        size={380}
        destroyOnHidden
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => void reloadModels()}
          >
            刷新
          </Button>
        }
        onClose={() => setModelDrawerOpen(false)}
      >
        {renderModelList()}
      </Drawer>

      <Drawer
        title="配置"
        open={inspectorDrawerOpen}
        size={420}
        resizable
        destroyOnHidden
        extra={
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存
          </Button>
        }
        onClose={() => setInspectorDrawerOpen(false)}
      >
        <section className={styles.drawerSection}>
          <Typography.Title level={5} className={styles.sectionTitle}>
            模型设置
          </Typography.Title>
          <ProForm<ModelFormValues>
            key={activeModel?.id || draftModelKeyRef.current}
            initialValues={modelForm}
            submitter={false}
            onValuesChange={(_, values) => setModelForm(values)}
          >
            <ProFormText
              name="modelName"
              label="模型名称"
              rules={[{ required: true, message: '请输入模型名称' }]}
            />
            <ProFormText name="description" label="说明" />
          </ProForm>

          {activeModel && (
            <ProDescriptions<ProcessModelItem>
              column={1}
              dataSource={activeModel}
              columns={[
                {
                  title: '模型标识',
                  dataIndex: 'modelKey',
                  render: (_, record) => (
                    <CopyableText
                      value={record.modelKey}
                      displayValue={processModelKeyLabel(record.modelKey)}
                    />
                  ),
                },
                {
                  title: '版本',
                  dataIndex: 'version',
                  renderText: (value) => `v${value || 1}`,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (_, record) => (
                    <KoravoStatusTag
                      status={record.status}
                      text={processStatusLabel(record.status)}
                    />
                  ),
                },
                {
                  title: '流程定义',
                  dataIndex: 'flowableDefinitionId',
                  copyable: true,
                },
              ]}
              className={styles.meta}
            />
          )}
        </section>

        <section className={styles.drawerSection}>
          <Typography.Title level={5} className={styles.sectionTitle}>
            节点属性
          </Typography.Title>
          {renderElementProperties()}
        </section>
      </Drawer>

      <Drawer
        title="BPMN XML"
        open={xmlDrawerOpen}
        size={720}
        resizable
        destroyOnHidden
        extra={
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        }
        onClose={() => setXmlDrawerOpen(false)}
      >
        <Input.TextArea
          readOnly
          value={designerXml}
          className={styles.xmlPreview}
        />
      </Drawer>
    </PageContainer>
  );
};

export default ProcessDesigner;
