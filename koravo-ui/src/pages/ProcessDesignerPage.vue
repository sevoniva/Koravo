<template>
  <PageContainer wide class="designer-page">
    <PageHeader title="流程设计器" :description="designerDescription">
      <template #actions>
        <a-button @click="newDiagram"><PlusOutlined />新建</a-button>
        <a-button @click="loadLeaveTemplate"><PlusOutlined />请假模板</a-button>
        <a-upload :before-upload="beforeImport" :show-upload-list="false" accept=".xml,.bpmn,.bpmn20.xml">
          <a-button><UploadOutlined />导入</a-button>
        </a-upload>
        <a-button :disabled="!selectedModel" @click="downloadSelected"><DownloadOutlined />导出</a-button>
        <a-button :loading="saving" type="primary" @click="saveDraft"><SaveOutlined />保存草稿</a-button>
        <a-button :loading="validating" @click="validate"><CheckCircleOutlined />校验</a-button>
        <a-button :loading="deploying" :disabled="!canDeploySelectedModel" type="primary" @click="deploy"><CloudUploadOutlined />部署</a-button>
      </template>
    </PageHeader>

    <div class="designer-shell">
      <aside class="designer-sidebar">
        <div class="panel-title">模型列表</div>
        <a-button block size="small" :loading="loadingModels" @click="loadModels"><ReloadOutlined />刷新</a-button>
        <a-list :data-source="models" size="small" class="model-list">
          <template #emptyText>
            <a-empty description="暂无流程模型" />
          </template>
          <template #renderItem="{ item }">
            <a-list-item :class="{ active: item.id === selectedModel?.id }" @click="openModel(item)">
              <a-list-item-meta :title="modelDisplayTitle(item)" :description="modelListDescription(item)" />
            </a-list-item>
          </template>
        </a-list>
      </aside>

      <main class="designer-canvas-wrap">
        <div ref="canvasRef" class="designer-canvas"></div>
      </main>

      <aside class="designer-properties">
        <div class="panel-title">模型属性</div>
        <a-form layout="vertical">
          <a-form-item label="模型标识">
            <a-input v-model:value="form.modelKey" :disabled="!!selectedModel" />
          </a-form-item>
          <a-form-item label="模型名称">
            <a-input v-model:value="form.modelName" />
          </a-form-item>
          <a-form-item label="说明">
            <a-textarea v-model:value="form.description" :rows="3" />
          </a-form-item>
        </a-form>

        <div class="panel-title">选中节点</div>
        <a-alert
          v-if="!selectedElement"
          type="info"
          message="选择节点后编辑"
          show-icon
        />
        <a-form v-else layout="vertical">
          <a-form-item label="节点类型">
            <a-input :value="selectedElement.type" disabled />
          </a-form-item>
          <a-form-item label="节点标识">
            <a-input v-model:value="elementForm.id" />
          </a-form-item>
          <a-form-item label="节点名称">
            <a-input v-model:value="elementForm.name" />
          </a-form-item>
          <a-form-item v-if="selectedElement.type === 'bpmn:UserTask'" label="处理人">
            <a-input v-model:value="elementForm.assignee" />
          </a-form-item>
          <template v-if="selectedElement.type === 'bpmn:ServiceTask'">
            <a-form-item label="执行器">
              <a-input v-model:value="elementForm.delegateExpression" />
            </a-form-item>
            <a-form-item label="连接器类型">
              <a-input v-model:value="elementForm.connectorType" />
            </a-form-item>
            <a-form-item label="请求方法">
              <a-select v-model:value="elementForm.method">
                <a-select-option value="GET">GET</a-select-option>
                <a-select-option value="POST">POST</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="URL">
              <a-input v-model:value="elementForm.url" />
            </a-form-item>
            <a-form-item label="请求头配置">
              <a-textarea v-model:value="elementForm.headers" :rows="3" />
            </a-form-item>
            <a-form-item label="请求体">
              <a-textarea v-model:value="elementForm.body" :rows="3" />
            </a-form-item>
            <a-form-item label="超时毫秒">
              <a-input v-model:value="elementForm.timeoutMillis" />
            </a-form-item>
            <a-form-item label="输出变量">
              <a-input v-model:value="elementForm.outputVariable" />
            </a-form-item>
          </template>
          <a-button size="small" type="primary" @click="applyElementProperties">应用</a-button>
        </a-form>

        <div class="panel-title">校验结果</div>
        <a-alert
          v-if="validation"
          :type="validation.valid ? 'success' : 'error'"
          :message="validation.valid ? '校验通过' : '存在校验错误'"
          show-icon
        />
        <a-list v-if="validation" :data-source="[...validation.errors, ...validation.warnings]" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <span>{{ item.code }} · {{ item.elementId || '-' }} · {{ item.message }}</span>
            </a-list-item>
          </template>
        </a-list>
      </aside>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons-vue'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import { PageContainer, PageHeader } from '../components/ui'
import { processDisplayName } from '../utils/display'
import {
  createProcessModel,
  deployProcessModelDraft,
  exportProcessModel,
  getProcessModel,
  importProcessModel,
  listProcessModels,
  updateProcessModel,
  validateProcessModelXml,
  type BpmnValidationResult,
  type ProcessModelItem
} from '../api/koravo'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const canvasRef = ref<HTMLDivElement | null>(null)
const route = useRoute()
const modeler = ref<any>(null)
const models = ref<ProcessModelItem[]>([])
const selectedModel = ref<ProcessModelItem | null>(null)
const selectedElement = ref<any | null>(null)
const validation = ref<BpmnValidationResult | null>(null)
const loadingModels = ref(false)
const saving = ref(false)
const validating = ref(false)
const deploying = ref(false)
const form = reactive({
  modelKey: 'leaveApproval',
  modelName: '请假审批流程',
  description: 'admin 审批。'
})
const elementForm = reactive({
  id: '',
  name: '',
  assignee: '',
  delegateExpression: '',
  connectorType: 'http',
  method: 'GET',
  url: '',
  headers: '{}',
  body: '',
  timeoutMillis: '5000',
  outputVariable: 'connectorResult'
})
const canDeploySelectedModel = computed(() => selectedModel.value?.status === 'DRAFT')
const designerDescription = computed(() => (
  selectedModel.value
    ? `${modelDisplayTitle(selectedModel.value)} · 版本 ${selectedModel.value.version} · ${statusText(selectedModel.value.status)}`
    : '草稿'
))
const flowableModdle = {
  name: 'Flowable',
  uri: 'http://flowable.org/bpmn',
  prefix: 'flowable',
  xml: {
    tagAlias: 'lowerCase'
  },
  types: [
    {
      name: 'UserTask',
      extends: ['bpmn:UserTask'],
      properties: [
        { name: 'assignee', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'ServiceTask',
      extends: ['bpmn:ServiceTask'],
      properties: [
        { name: 'delegateExpression', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'Field',
      superClass: ['Element'],
      properties: [
        { name: 'name', isAttr: true, type: 'String' },
        { name: 'stringValue', isAttr: true, type: 'String' }
      ]
    }
  ]
}

const defaultBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
             targetNamespace="https://koravo.io/designer">
  <process id="leaveApproval" name="请假审批流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow_start_approve" sourceRef="start" targetRef="approveTask"/>
    <userTask id="approveTask" name="审批请假" flowable:assignee="\${approver}"/>
    <sequenceFlow id="flow_approve_end" sourceRef="approveTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_leaveApproval">
    <bpmndi:BPMNPlane id="BPMNPlane_leaveApproval" bpmnElement="leaveApproval">
      <bpmndi:BPMNShape id="Shape_start" bpmnElement="start"><omgdc:Bounds x="100" y="120" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_approveTask" bpmnElement="approveTask"><omgdc:Bounds x="210" y="98" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_end" bpmnElement="end"><omgdc:Bounds x="420" y="120" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_flow_start_approve" bpmnElement="flow_start_approve"><omgdi:waypoint x="136" y="138"/><omgdi:waypoint x="210" y="138"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_flow_approve_end" bpmnElement="flow_approve_end"><omgdi:waypoint x="330" y="138"/><omgdi:waypoint x="420" y="138"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

onMounted(async () => {
  await nextTick()
  modeler.value = new BpmnModeler({
    container: canvasRef.value,
    moddleExtensions: {
      flowable: flowableModdle
    }
  })
  modeler.value.on('selection.changed', (event: { newSelection: any[] }) => {
    selectElement(event.newSelection[0] || null)
  })
  await modeler.value.importXML(defaultBpmnXml)
  modeler.value.get('canvas').zoom('fit-viewport')
  await loadModels()
  await openRouteModel()
})

onBeforeUnmount(() => {
  modeler.value?.destroy()
})

async function loadModels() {
  loadingModels.value = true
  try {
    models.value = await listProcessModels()
  } finally {
    loadingModels.value = false
  }
}

async function openRouteModel() {
  const modelId = typeof route.query.modelId === 'string' ? route.query.modelId : ''
  if (!modelId) return
  const model = await getProcessModel(modelId)
  await openModel(model)
}

async function newDiagram() {
  selectedModel.value = null
  selectElement(null)
  validation.value = null
  form.modelKey = 'leaveApproval'
  form.modelName = '请假审批流程'
  form.description = 'admin 审批。'
  await modeler.value.importXML(defaultBpmnXml)
  modeler.value.get('canvas').zoom('fit-viewport')
}

async function loadLeaveTemplate() {
  await newDiagram()
  message.success('已加载请假流程')
}

async function openModel(model: ProcessModelItem) {
  selectedModel.value = model
  selectElement(null)
  validation.value = null
  form.modelKey = model.modelKey
  form.modelName = model.modelName
  form.description = model.description || ''
  await modeler.value.importXML(model.bpmnXml || defaultBpmnXml)
  modeler.value.get('canvas').zoom('fit-viewport')
}

async function currentXml() {
  syncNewDraftProcessMetadata()
  const result = await modeler.value.saveXML({ format: true })
  return result.xml as string
}

function syncNewDraftProcessMetadata() {
  if (selectedModel.value || !modeler.value) return
  const modelKey = normalizeBpmnId(form.modelKey)
  if (!modelKey) return
  form.modelKey = modelKey
  const rootElement = modeler.value.get('canvas').getRootElement()
  const process = rootElement?.businessObject
  if (!process) return
  process.id = modelKey
  process.name = form.modelName || modelKey
}

function normalizeBpmnId(value: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9_]/g, '_')
  if (!normalized) return ''
  return /^[A-Za-z_]/.test(normalized) ? normalized : `Process_${normalized}`
}

async function saveDraft() {
  if (!normalizeBpmnId(form.modelKey) || !form.modelName.trim()) {
    message.warning('请输入模型标识和模型名称')
    return
  }
  saving.value = true
  try {
    const bpmnXml = await currentXml()
    selectedModel.value = selectedModel.value
      ? await updateProcessModel(selectedModel.value.id, { modelName: form.modelName, description: form.description, bpmnXml })
      : await createProcessModel({ modelKey: form.modelKey, modelName: form.modelName, description: form.description, bpmnXml })
    message.success('草稿已保存')
    await loadModels()
  } finally {
    saving.value = false
  }
}

async function validate() {
  validating.value = true
  try {
    validation.value = await validateProcessModelXml(await currentXml())
    message[validation.value.valid ? 'success' : 'warning'](validation.value.valid ? '校验通过' : '存在校验错误')
  } finally {
    validating.value = false
  }
}

async function deploy() {
  if (!canDeploySelectedModel.value || !selectedModel.value) return
  deploying.value = true
  try {
    await saveDraft()
    const result = await deployProcessModelDraft(selectedModel.value.id)
    selectedModel.value = result.model
    message.success('模型已部署')
    await loadModels()
  } finally {
    deploying.value = false
  }
}

async function beforeImport(file: File) {
  const xml = await file.text()
  selectedModel.value = await importProcessModel({
    modelName: file.name.replace(/\.(bpmn20\.xml|bpmn|xml)$/i, ''),
    description: '从设计器导入',
    bpmnXml: xml
  })
  form.modelKey = selectedModel.value.modelKey
  form.modelName = selectedModel.value.modelName
  form.description = selectedModel.value.description || ''
  await modeler.value.importXML(selectedModel.value.bpmnXml || xml)
  modeler.value.get('canvas').zoom('fit-viewport')
  await loadModels()
  message.success('BPMN 已导入')
  return false
}

async function downloadSelected() {
  if (!selectedModel.value) return
  const blob = await exportProcessModel(selectedModel.value.id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${selectedModel.value.modelKey}.bpmn20.xml`
  link.click()
  URL.revokeObjectURL(url)
}

function selectElement(element: any | null) {
  selectedElement.value = element
  const businessObject = element?.businessObject
  elementForm.id = businessObject?.id || ''
  elementForm.name = businessObject?.name || ''
  elementForm.assignee = readAssignee(businessObject)
  elementForm.delegateExpression = businessObject?.get?.('flowable:delegateExpression') || businessObject?.$attrs?.['flowable:delegateExpression'] || ''
  elementForm.connectorType = readConnectorField(businessObject, 'connectorType') || 'http'
  elementForm.method = readConnectorField(businessObject, 'method') || 'GET'
  elementForm.url = readConnectorField(businessObject, 'url') || ''
  elementForm.headers = readConnectorField(businessObject, 'headers') || '{}'
  elementForm.body = readConnectorField(businessObject, 'body') || ''
  elementForm.timeoutMillis = readConnectorField(businessObject, 'timeoutMillis') || '5000'
  elementForm.outputVariable = readConnectorField(businessObject, 'outputVariable') || 'connectorResult'
}

function readAssignee(businessObject: any) {
  if (!businessObject) return ''
  return businessObject.get?.('flowable:assignee') || businessObject.$attrs?.['flowable:assignee'] || ''
}

function applyElementProperties() {
  if (!selectedElement.value || !modeler.value) return
  const elementId = normalizeBpmnId(elementForm.id)
  if (!elementId) {
    message.warning('请输入节点标识')
    return
  }
  const modeling = modeler.value.get('modeling')
  const properties: Record<string, string> = {
    id: elementId,
    name: elementForm.name
  }
  if (selectedElement.value.type === 'bpmn:UserTask') {
    properties['flowable:assignee'] = elementForm.assignee
  }
  if (selectedElement.value.type === 'bpmn:ServiceTask') {
    if (!validateConnectorFields()) {
      return
    }
    properties['flowable:delegateExpression'] = elementForm.delegateExpression || '${koravoConnectorDelegate}'
  }
  modeling.updateProperties(selectedElement.value, properties)
  if (selectedElement.value.type === 'bpmn:ServiceTask') {
    applyConnectorFields(selectedElement.value)
  }
  selectElement(selectedElement.value)
  validation.value = null
  message.success('节点属性已更新')
}

function readConnectorField(businessObject: any, name: string) {
  const values = businessObject?.extensionElements?.values || []
  const field = values.find((item: any) => item.name === name)
  return field?.stringValue || ''
}

function applyConnectorFields(element: any) {
  const businessObject = element.businessObject
  const modeling = modeler.value.get('modeling')
  const moddle = modeler.value.get('moddle')
  if (!businessObject.extensionElements) {
    modeling.updateProperties(element, {
      extensionElements: moddle.create('bpmn:ExtensionElements', { values: [] })
    })
  }
  setConnectorField(businessObject, 'connectorType', elementForm.connectorType || 'http')
  setConnectorField(businessObject, 'method', elementForm.method || 'GET')
  setConnectorField(businessObject, 'url', elementForm.url)
  setConnectorField(businessObject, 'headers', elementForm.headers)
  setConnectorField(businessObject, 'body', elementForm.body)
  setConnectorField(businessObject, 'timeoutMillis', elementForm.timeoutMillis || '5000')
  setConnectorField(businessObject, 'outputVariable', elementForm.outputVariable || 'connectorResult')
}

function setConnectorField(businessObject: any, name: string, value: string) {
  const moddle = modeler.value.get('moddle')
  const extensionElements = businessObject.extensionElements
  const values = extensionElements.values || []
  let field = values.find((item: any) => item.name === name)
  if (!field) {
    field = moddle.create('flowable:Field', { name })
    values.push(field)
    extensionElements.values = values
  }
  field.stringValue = value || ''
}

function validateConnectorFields() {
  try {
    parseJsonObject(elementForm.headers || '{}', '请求头配置')
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
    return false
  }
  if (!/^[1-9]\d*$/.test(elementForm.timeoutMillis || '')) {
    message.error('超时毫秒必须是正整数')
    return false
  }
  if (!elementForm.url.trim()) {
    message.error('请输入连接器 URL')
    return false
  }
  return true
}

function statusText(status?: string) {
  const mapping: Record<string, string> = {
    DRAFT: '草稿',
    DEPLOYED: '已部署',
    DISABLED: '已禁用',
    ARCHIVED: '已归档'
  }
  return mapping[status || ''] || status || '-'
}

function modelListDescription(model: ProcessModelItem) {
  return `${statusText(model.status)} · 版本 ${model.version}`
}

function modelDisplayTitle(model: ProcessModelItem) {
  return processDisplayName(model.modelKey, model.modelName)
}
</script>
