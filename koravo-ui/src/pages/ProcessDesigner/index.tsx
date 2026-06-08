import {
  AimOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DownloadOutlined,
  FileAddOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProForm,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { useLocation } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Empty,
  Flex,
  Input,
  Space,
  Splitter,
  Tabs,
  Typography,
  message,
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
import { processDisplayName, processStatusLabel } from '@/utils/display';
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
  workbenchCard: css`
    .ant-pro-card-body {
      padding: 0;
    }
  `,
  workbench: css`
    min-height: 724px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
  `,
  panel: css`
    height: 100%;
    min-height: 724px;
    overflow: hidden;
    background: ${token.colorBgContainer};
  `,
  panelBody: css`
    height: calc(100% - 49px);
    overflow: auto;
    padding: 16px;
  `,
  panelHeader: css`
    height: 49px;
    padding: 0 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  title: css`
    margin: 0;
  `,
  editor: css`
    height: 100%;
    min-height: 724px;
    padding: 16px;
    background: ${token.colorBgLayout};
  `,
  editorHeader: css`
    margin-bottom: 12px;
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
}));

const columns: ProColumns<ProcessModelItem>[] = [
  {
    title: '模型名称',
    dataIndex: 'modelName',
    renderText: (_, record) =>
      processDisplayName(record.modelKey, record.modelName),
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (_, record) => (
      <KoravoStatusTag
        status={record.status}
        text={processStatusLabel(record.status)}
      />
    ),
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 156,
    renderText: formatDateTime,
  },
];

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
    if (modelId) setSelectedId(modelId);
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
    const filename = `${activeModel?.modelKey || draftModelKeyRef.current}.bpmn20.xml`;
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

  const renderElementProperties = () => {
    if (!selectedElement) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="选择画布节点后编辑属性"
        />
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

  return (
    <PageContainer
      title="流程设计器"
      content="图形化编辑 BPMN 流程，校验后保存草稿。"
      extra={[
        <Button key="new" icon={<FileAddOutlined />} onClick={handleNewModel}>
          新建模型
        </Button>,
        <Button
          key="validate"
          icon={<CheckCircleOutlined />}
          loading={validating}
          onClick={handleValidate}
        >
          校验
        </Button>,
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          导出 XML
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          {activeModel ? '保存草稿' : '导入模型'}
        </Button>,
      ]}
    >
      <ProCard className={styles.workbenchCard}>
        <Splitter className={styles.workbench}>
          <Splitter.Panel defaultSize={320} min={280} max={440}>
            <section className={styles.panel}>
              <Flex
                align="center"
                justify="space-between"
                className={styles.panelHeader}
              >
                <Typography.Title level={5} className={styles.title}>
                  模型列表
                </Typography.Title>
                <Typography.Text type="secondary">
                  {models?.length || 0} 个
                </Typography.Text>
              </Flex>
              <div className={styles.panelBody}>
                <ProTable<ProcessModelItem>
                  rowKey="id"
                  columns={columns}
                  dataSource={models || []}
                  loading={modelsLoading}
                  search={false}
                  pagination={{ pageSize: 8 }}
                  options={false}
                  rowSelection={{
                    type: 'radio',
                    selectedRowKeys: selectedId ? [selectedId] : [],
                    onChange: ([key]) => setSelectedId(String(key)),
                  }}
                  onRow={(record) => ({
                    onClick: () => setSelectedId(record.id),
                  })}
                />
              </div>
            </section>
          </Splitter.Panel>

          <Splitter.Panel min={520}>
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
                    {activeModel?.modelKey || draftModelKeyRef.current}
                  </Typography.Text>
                </Flex>
                <Button
                  icon={<AimOutlined />}
                  onClick={() => modelerRef.current?.zoomToFit()}
                >
                  适应画布
                </Button>
              </Flex>
              <BpmnModelerCanvas
                ref={modelerRef}
                value={designerXml}
                onXmlChange={setDesignerXml}
                onSelectionChange={setSelectedElement}
              />
            </section>
          </Splitter.Panel>

          <Splitter.Panel defaultSize={360} min={320} max={460}>
            <section className={styles.panel}>
              <Flex
                align="center"
                justify="space-between"
                className={styles.panelHeader}
              >
                <Typography.Title level={5} className={styles.title}>
                  配置
                </Typography.Title>
              </Flex>
              <div className={styles.panelBody}>
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
                          <CopyableText value={record.modelKey} />
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

                <Tabs
                  destroyOnHidden
                  items={[
                    {
                      key: 'properties',
                      label: (
                        <Space>
                          <SettingOutlined />
                          属性
                        </Space>
                      ),
                      children: renderElementProperties(),
                    },
                    {
                      key: 'xml',
                      label: (
                        <Space>
                          <CodeOutlined />
                          XML
                        </Space>
                      ),
                      children: (
                        <Input.TextArea
                          readOnly
                          value={designerXml}
                          className={styles.xmlPreview}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </section>
          </Splitter.Panel>
        </Splitter>
      </ProCard>
    </PageContainer>
  );
};

export default ProcessDesigner;
