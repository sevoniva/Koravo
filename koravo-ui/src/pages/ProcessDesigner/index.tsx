import {
  AimOutlined,
  BarsOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
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
  ProFormSelect,
  ProFormText,
  ProList,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  Collapse,
  Dropdown,
  Flex,
  FloatButton,
  Input,
  type MenuProps,
  Segmented,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import KoravoDrawer from '@/components/KoravoDrawer';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  deployProcessModelDraft,
  getProcessModel,
  importProcessModel,
  type FormSchemaItem,
  listFormSchemas,
  listFormBindings,
  listProcessModels,
  listProcessModelTaskDefinitions,
  type BpmnTaskDefinition,
  type FormBindingItem,
  type ProcessModelItem,
  updateProcessModel,
  validateProcessModelXml,
} from '@/services/koravo/api';
import {
  organizationGroupOptions,
  organizationHandlerOptions,
} from '@/services/koravo/organization';
import { getSessionContext } from '@/services/koravo/session';
import {
  bpmnValidationIssueText,
  formSchemaOptionLabel,
  isBusinessProcessModel,
  processDisplayName,
  processModelKeyLabel,
  processStatusLabel,
  taskDefinitionLabel,
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

type ModelViewMode = 'business' | 'all';
const START_FORM_TASK_KEY = '__START__';

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
  return `businessFlow${Date.now().toString(36)}`;
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

function bpmnElementTypeLabel(type?: string) {
  const mapping: Record<string, string> = {
    'bpmn:StartEvent': '开始节点',
    'bpmn:UserTask': '人工节点',
    'bpmn:ServiceTask': '自动节点',
    'bpmn:EndEvent': '结束节点',
    'bpmn:ExclusiveGateway': '条件分支',
    'bpmn:ParallelGateway': '并行分支',
  };
  return mapping[type || ''] || '流程节点';
}

function formOptions(forms?: FormSchemaItem[]) {
  return (forms || [])
    .filter((form) => form.status === 'ACTIVE')
    .map((form) => ({
      label: formSchemaOptionLabel(form),
      value: form.formKey,
    }));
}

function modelSecondaryText(model?: ProcessModelItem) {
  if (!model) return '未保存草稿';
  return `流程标识：${processModelKeyLabel(model.modelKey)}`;
}

function modelBindings(
  model: ProcessModelItem,
  bindings: FormBindingItem[],
) {
  return bindings.filter(
    (binding) =>
      binding.processModelId === model.id ||
      Boolean(
        model.flowableDefinitionId &&
          binding.processDefinitionId === model.flowableDefinitionId,
      ),
  );
}

function missingTaskBindings(
  bindings: FormBindingItem[],
  tasks: BpmnTaskDefinition[],
) {
  const taskBindings = bindings.filter(
    (binding) => binding.taskDefinitionKey !== START_FORM_TASK_KEY,
  );
  return tasks.filter(
    (task) =>
      !taskBindings.some(
        (binding) => binding.taskDefinitionKey === task.taskDefinitionKey,
      ),
  );
}

function renderReleaseCheckItem(
  label: string,
  ready: boolean,
  description: React.ReactNode,
) {
  return (
    <Flex key={label} vertical gap={2}>
      <Badge status={ready ? 'success' : 'error'} text={label} />
      <Typography.Text type="secondary">{description}</Typography.Text>
    </Flex>
  );
}

const ProcessDesigner: React.FC = () => {
  const location = useLocation();
  const { message, modal } = App.useApp();
  const { styles } = useStyles();
  const session = getSessionContext();
  const canStartProcess =
    session.permissions?.canStartProcess ?? session.role === 'applicant';
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
  const [deploying, setDeploying] = useState(false);
  const [modelViewMode, setModelViewMode] = useState<ModelViewMode>('business');

  const {
    data: models,
    isLoading: modelsLoading,
    refetch: reloadModels,
  } = useQuery({
    queryKey: ['designer-models'],
    queryFn: () => listProcessModels(),
  });
  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ['designer-form-schemas'],
    queryFn: () => listFormSchemas(),
  });
  const { data: selected, refetch } = useQuery({
    queryKey: ['designer-model', selectedId],
    queryFn: () => getProcessModel(selectedId || ''),
    enabled: Boolean(selectedId),
  });
  const activeModel = selectedId ? selected : undefined;
  const visibleModels =
    modelViewMode === 'business'
      ? (models || []).filter(isBusinessProcessModel)
      : models || [];
  const handlerOptions = organizationHandlerOptions();
  const candidateGroupOptions = organizationGroupOptions();
  const activeFormOptions = formOptions(forms);

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

  const handleDeploy = useCallback(async () => {
    if (!activeModel) {
      message.warning('请先保存流程模型');
      return;
    }
    if (!modelForm.modelName?.trim()) {
      message.warning('请输入模型名称');
      return;
    }

    setDeploying(true);
    try {
      const currentXml = await getCurrentXml();
      const validation = await validateProcessModelXml(currentXml);
      const [bindings, tasks] = await Promise.all([
        listFormBindings({ processModelId: activeModel.id }),
        listProcessModelTaskDefinitions(activeModel.id).catch(() => []),
      ]);
      const scopedBindings = modelBindings(activeModel, bindings);
      const hasStartBinding = scopedBindings.some(
        (binding) => binding.taskDefinitionKey === START_FORM_TASK_KEY,
      );
      const missingTasks = missingTaskBindings(scopedBindings, tasks);
      const releaseReady =
        validation.valid && hasStartBinding && missingTasks.length === 0;

      if (!releaseReady) {
        modal.warning({
          title: '发布检查未通过',
          width: 620,
          okText: '知道了',
          content: (
            <Flex vertical gap={12}>
              <Alert
                showIcon
                type="warning"
                title="先完善发布条件"
                description="处理未通过项后再部署，避免发起后缺表单或缺办理人。"
              />
              {renderReleaseCheckItem(
                '流程结构',
                validation.valid,
                validation.valid
                  ? '流程结构可解析'
                  : `发现 ${validation.errors.length} 个错误`,
              )}
              {validation.errors.length ? (
                <Typography.Text type="secondary">
                  {validation.errors.map(bpmnValidationIssueText).join('；')}
                </Typography.Text>
              ) : null}
              {renderReleaseCheckItem(
                '发起表单',
                hasStartBinding,
                hasStartBinding ? '已绑定发起表单' : '缺少发起表单绑定',
              )}
              {renderReleaseCheckItem(
                '任务表单',
                missingTasks.length === 0,
                tasks.length
                  ? `已绑定 ${tasks.length - missingTasks.length}/${tasks.length} 个任务节点`
                  : '当前流程没有用户任务',
              )}
              {missingTasks.length ? (
                <Typography.Text type="secondary">
                  未绑定节点：
                  {missingTasks
                    .map((task) =>
                      taskDefinitionLabel(task.taskDefinitionKey, task),
                    )
                    .join('、')}
                </Typography.Text>
              ) : null}
              <Space wrap>
                <Button
                  type="primary"
                  onClick={() =>
                    history.push(`/form-bindings?processModelId=${activeModel.id}`)
                  }
                >
                  绑定表单
                </Button>
                <Button onClick={() => history.push('/process-models')}>
                  查看模型列表
                </Button>
              </Space>
            </Flex>
          ),
        });
        return;
      }
      await handleSave();
      const result = await deployProcessModelDraft(activeModel.id);
      const deployedModel = result.model;
      message.success('已部署');
      await refetch();
      await reloadModels();
      modal.success({
        title: '流程已部署',
        width: 520,
        okText: '留在设计器',
        content: (
          <Flex vertical gap={12}>
            <span>
              {processDisplayName(
                deployedModel.modelKey,
                deployedModel.modelName,
              )}
              已发布。发起后进入实例追踪。
            </span>
            <Space wrap>
              <Button
                type="primary"
                onClick={() =>
                  history.push(
                    `/form-bindings?processModelId=${deployedModel.id}`,
                  )
                }
              >
                绑定表单
              </Button>
              {canStartProcess ? (
                <Button
                  onClick={() =>
                    history.push(
                      `/process-start?processModelId=${deployedModel.id}`,
                    )
                  }
                >
                  发起流程
                </Button>
              ) : null}
              <Button onClick={() => history.push('/process-models')}>
                查看模型列表
              </Button>
            </Space>
          </Flex>
        ),
      });
    } finally {
      setDeploying(false);
    }
  }, [
    activeModel,
    getCurrentXml,
    handleSave,
    canStartProcess,
    message,
    modal,
    modelForm,
    refetch,
    reloadModels,
  ]);

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
      dataSource={visibleModels}
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
                  {modelSecondaryText(item)}
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
            {
              title: '节点',
              dataIndex: 'elementId',
              render: (_, record) => (
                <CopyableText
                  value={record.elementId}
                  displayValue={taskDefinitionLabel(record.elementId, {
                    name: record.name,
                  })}
                />
              ),
            },
            {
              title: '类型',
              dataIndex: 'elementType',
              renderText: bpmnElementTypeLabel,
            },
          ]}
          className={styles.meta}
        />
        <ProFormText name="name" label="名称" />
        {isUserTask(selectedElement) && (
          <>
            <ProFormSelect
              name="assignee"
              label="办理人"
              options={handlerOptions}
              fieldProps={{ allowClear: true, showSearch: true }}
            />
            <ProFormSelect
              name="candidateUsers"
              label="候选用户"
              options={handlerOptions}
              fieldProps={{
                allowClear: true,
                mode: 'multiple',
                showSearch: true,
                maxTagCount: 'responsive',
                optionFilterProp: 'label',
              }}
            />
            <ProFormSelect
              name="candidateGroups"
              label="候选角色"
              options={candidateGroupOptions}
              fieldProps={{
                allowClear: true,
                mode: 'multiple',
                showSearch: true,
                maxTagCount: 'responsive',
                optionFilterProp: 'label',
              }}
            />
            <ProFormSelect
              name="formKey"
              label="绑定表单"
              options={activeFormOptions}
              placeholder={
                activeFormOptions.length ? '选择表单' : '暂无可绑定表单'
              }
              fieldProps={{
                allowClear: true,
                loading: formsLoading,
                showSearch: true,
                optionFilterProp: 'label',
              }}
            />
          </>
        )}
        {isServiceTask(selectedElement) && (
          <Collapse
            size="small"
            ghost
            items={[
              {
                key: 'service-task-advanced',
                label: '高级执行配置',
                children: (
                  <>
                    <ProFormText name="delegateExpression" label="执行代理" />
                    <ProFormText name="serviceClass" label="服务处理类" />
                    <ProFormText name="expression" label="执行条件" />
                    <ProFormText name="resultVariable" label="结果变量" />
                  </>
                ),
              },
            ]}
          />
        )}
      </ProForm>
    );
  };

  const actionMenu: MenuProps = {
    items: [
      { key: 'new', icon: <FileAddOutlined />, label: '新建模型' },
      { type: 'divider' },
      { key: 'export', icon: <DownloadOutlined />, label: '导出流程文件' },
      { key: 'xml', icon: <CodeOutlined />, label: '查看流程文件' },
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
          key="deploy"
          icon={<DeploymentUnitOutlined />}
          disabled={!activeModel || activeModel.status === 'ARCHIVED'}
          loading={deploying}
          onClick={handleDeploy}
        >
          部署
        </Button>,
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
                {modelSecondaryText(activeModel)}
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

      <KoravoDrawer
        title="模型"
        placement="left"
        open={modelDrawerOpen}
        size={380}
        extra={
          <Space>
            <Segmented
              size="small"
              value={modelViewMode}
              options={[
                { label: '业务', value: 'business' },
                { label: '全部', value: 'all' },
              ]}
              onChange={(value) => setModelViewMode(value as ModelViewMode)}
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void reloadModels()}
            >
              刷新
            </Button>
          </Space>
        }
        onClose={() => setModelDrawerOpen(false)}
      >
        {renderModelList()}
      </KoravoDrawer>

      <KoravoDrawer
        title="配置"
        open={inspectorDrawerOpen}
        size={420}
        resizable
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
                  title: '流程标识',
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
                  title: '运行版本',
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
      </KoravoDrawer>

      <KoravoDrawer
        title="流程文件"
        open={xmlDrawerOpen}
        size={720}
        resizable
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
      </KoravoDrawer>
    </PageContainer>
  );
};

export default ProcessDesigner;
