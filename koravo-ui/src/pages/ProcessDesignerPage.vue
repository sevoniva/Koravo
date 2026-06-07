<template>
  <section class="designer-page">
    <div class="page-heading">
      <div>
        <h1>Process Designer</h1>
        <p>{{ selectedModel ? `${selectedModel.modelName} v${selectedModel.version} · ${selectedModel.status}` : 'Draft BPMN model' }}</p>
      </div>
      <a-space wrap>
        <a-button @click="newDiagram"><PlusOutlined />New</a-button>
        <a-upload :before-upload="beforeImport" :show-upload-list="false" accept=".xml,.bpmn,.bpmn20.xml">
          <a-button><UploadOutlined />Import</a-button>
        </a-upload>
        <a-button :disabled="!selectedModel" @click="downloadSelected"><DownloadOutlined />Export</a-button>
        <a-button :loading="saving" type="primary" @click="saveDraft"><SaveOutlined />Save Draft</a-button>
        <a-button :loading="validating" @click="validate"><CheckCircleOutlined />Validate</a-button>
        <a-button :loading="deploying" :disabled="!canDeploySelectedModel" type="primary" @click="deploy"><CloudUploadOutlined />Deploy</a-button>
      </a-space>
    </div>

    <div class="designer-shell">
      <aside class="designer-sidebar">
        <div class="panel-title">Models</div>
        <a-button block size="small" :loading="loadingModels" @click="loadModels"><ReloadOutlined />Reload</a-button>
        <a-list :data-source="models" size="small" class="model-list">
          <template #renderItem="{ item }">
            <a-list-item :class="{ active: item.id === selectedModel?.id }" @click="openModel(item)">
              <a-list-item-meta :title="item.modelName" :description="`${item.modelKey} · ${item.status}`" />
            </a-list-item>
          </template>
        </a-list>
      </aside>

      <main class="designer-canvas-wrap">
        <div ref="canvasRef" class="designer-canvas"></div>
      </main>

      <aside class="designer-properties">
        <div class="panel-title">Properties</div>
        <a-form layout="vertical">
          <a-form-item label="Model key">
            <a-input v-model:value="form.modelKey" :disabled="!!selectedModel" />
          </a-form-item>
          <a-form-item label="Model name">
            <a-input v-model:value="form.modelName" />
          </a-form-item>
          <a-form-item label="Description">
            <a-textarea v-model:value="form.description" :rows="3" />
          </a-form-item>
        </a-form>

        <div class="panel-title">Selected Element</div>
        <a-alert
          v-if="!selectedElement"
          type="info"
          message="Select a BPMN element to edit its properties."
          show-icon
        />
        <a-form v-else layout="vertical">
          <a-form-item label="Element type">
            <a-input :value="selectedElement.type" disabled />
          </a-form-item>
          <a-form-item label="Element id">
            <a-input v-model:value="elementForm.id" />
          </a-form-item>
          <a-form-item label="Element name">
            <a-input v-model:value="elementForm.name" />
          </a-form-item>
          <a-form-item v-if="selectedElement.type === 'bpmn:UserTask'" label="Assignee">
            <a-input v-model:value="elementForm.assignee" />
          </a-form-item>
          <a-button size="small" type="primary" @click="applyElementProperties">Apply</a-button>
        </a-form>

        <div class="panel-title">Validation</div>
        <a-alert
          v-if="validation"
          :type="validation.valid ? 'success' : 'error'"
          :message="validation.valid ? 'BPMN is valid' : 'BPMN has errors'"
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
  </section>
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
  modelName: 'Leave Approval',
  description: 'Default approval process'
})
const elementForm = reactive({
  id: '',
  name: '',
  assignee: ''
})
const canDeploySelectedModel = computed(() => selectedModel.value?.status === 'DRAFT')

const defaultBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
             targetNamespace="https://koravo.io/designer">
  <process id="leaveApproval" name="Leave Approval" isExecutable="true">
    <startEvent id="start" name="Start"/>
    <sequenceFlow id="flow_start_approve" sourceRef="start" targetRef="approveTask"/>
    <userTask id="approveTask" name="Approve" flowable:assignee="\${approver}"/>
    <sequenceFlow id="flow_approve_end" sourceRef="approveTask" targetRef="end"/>
    <endEvent id="end" name="End"/>
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
  modeler.value = new BpmnModeler({ container: canvasRef.value })
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
  form.modelName = 'Leave Approval'
  form.description = 'Default approval process'
  await modeler.value.importXML(defaultBpmnXml)
  modeler.value.get('canvas').zoom('fit-viewport')
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
    message.warning('Model key and name are required')
    return
  }
  saving.value = true
  try {
    const bpmnXml = await currentXml()
    selectedModel.value = selectedModel.value
      ? await updateProcessModel(selectedModel.value.id, { modelName: form.modelName, description: form.description, bpmnXml })
      : await createProcessModel({ modelKey: form.modelKey, modelName: form.modelName, description: form.description, bpmnXml })
    message.success('Draft saved')
    await loadModels()
  } finally {
    saving.value = false
  }
}

async function validate() {
  validating.value = true
  try {
    validation.value = await validateProcessModelXml(await currentXml())
    message[validation.value.valid ? 'success' : 'warning'](validation.value.valid ? 'BPMN is valid' : 'BPMN has validation errors')
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
    message.success('Model deployed')
    await loadModels()
  } finally {
    deploying.value = false
  }
}

async function beforeImport(file: File) {
  const xml = await file.text()
  selectedModel.value = await importProcessModel({
    modelName: file.name.replace(/\.(bpmn20\.xml|bpmn|xml)$/i, ''),
    description: 'Imported from designer',
    bpmnXml: xml
  })
  form.modelKey = selectedModel.value.modelKey
  form.modelName = selectedModel.value.modelName
  form.description = selectedModel.value.description || ''
  await modeler.value.importXML(selectedModel.value.bpmnXml || xml)
  modeler.value.get('canvas').zoom('fit-viewport')
  await loadModels()
  message.success('BPMN imported')
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
}

function readAssignee(businessObject: any) {
  if (!businessObject) return ''
  return businessObject.get?.('flowable:assignee') || businessObject.$attrs?.['flowable:assignee'] || ''
}

function applyElementProperties() {
  if (!selectedElement.value || !modeler.value) return
  const elementId = normalizeBpmnId(elementForm.id)
  if (!elementId) {
    message.warning('Element id is required')
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
  modeling.updateProperties(selectedElement.value, properties)
  selectElement(selectedElement.value)
  validation.value = null
  message.success('Element properties updated')
}
</script>
