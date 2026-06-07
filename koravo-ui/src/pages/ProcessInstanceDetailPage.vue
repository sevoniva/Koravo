<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Process Instance</h1>
        <p>{{ instance?.businessKey || instanceId }}</p>
      </div>
      <a-space>
        <a-button @click="router.push('/process-instances')">Start</a-button>
        <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
      </a-space>
    </div>

    <a-descriptions v-if="instance" bordered :column="2" class="panel-block">
      <a-descriptions-item label="Instance ID">{{ instance.instanceId }}</a-descriptions-item>
      <a-descriptions-item label="Status">{{ instance.status }}</a-descriptions-item>
      <a-descriptions-item label="Business Key">{{ instance.businessKey }}</a-descriptions-item>
      <a-descriptions-item label="Started By">{{ instance.startUserId }}</a-descriptions-item>
      <a-descriptions-item label="Process Definition">{{ instance.processDefinitionId }}</a-descriptions-item>
      <a-descriptions-item label="Started">{{ instance.startTime }}</a-descriptions-item>
      <a-descriptions-item label="Ended">{{ instance.endTime }}</a-descriptions-item>
    </a-descriptions>

    <div v-if="traceDetail" class="trace-viewer-panel panel-block">
      <div class="trace-viewer-heading">
        <strong>Trace Diagram</strong>
        <a-space>
          <span><i class="trace-dot trace-dot-completed" />Completed</span>
          <span><i class="trace-dot trace-dot-current" />Current</span>
        </a-space>
      </div>
      <div ref="traceCanvasRef" class="trace-viewer-canvas" />
    </div>

    <a-tabs v-if="traceDetail" class="panel-block">
      <a-tab-pane key="tasks" tab="Current Tasks">
        <a-table :data-source="traceDetail.currentTasks" :columns="taskColumns" row-key="taskId" :pagination="false" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)">Detail</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="timeline" tab="Timeline">
        <a-table :data-source="traceDetail.timeline" :columns="timelineColumns" row-key="activityId" :pagination="false" size="small" />
      </a-tab-pane>
      <a-tab-pane key="variables" tab="Variables">
        <JsonPreview :value="traceDetail.variables" />
      </a-tab-pane>
      <a-tab-pane key="auditLogs" tab="Audit Logs">
        <a-table :data-source="instance?.auditLogs || []" :columns="auditColumns" row-key="id" :pagination="false" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'detailJson'">
              <code>{{ record.detailJson }}</code>
            </template>
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="openAuditDetail(record)">View</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <JsonPreview :value="{ instance, trace: traceDetail }" />

    <a-modal v-model:open="auditDetailOpen" title="Audit detail" :footer="null" width="820px">
      <a-descriptions v-if="selectedAuditLog" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="Time">{{ selectedAuditLog.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="User">{{ selectedAuditLog.userId }}</a-descriptions-item>
        <a-descriptions-item label="Action">{{ selectedAuditLog.action }}</a-descriptions-item>
        <a-descriptions-item label="Resource">{{ selectedAuditLog.resourceType }}</a-descriptions-item>
        <a-descriptions-item label="Resource ID">{{ selectedAuditLog.resourceId }}</a-descriptions-item>
        <a-descriptions-item label="Request ID">{{ selectedAuditLog.requestId }}</a-descriptions-item>
        <a-descriptions-item label="Client IP">{{ selectedAuditLog.clientIp }}</a-descriptions-item>
        <a-descriptions-item label="Tenant">{{ selectedAuditLog.tenantId }}</a-descriptions-item>
      </a-descriptions>
      <JsonPreview :value="selectedAuditDetail" />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import JsonPreview from '../components/JsonPreview.vue'
import {
  getProcessInstance,
  getProcessTrace,
  type AuditLogItem,
  type OpsProcessInstance,
  type ProcessTrace
} from '../api/koravo'

const route = useRoute()
const router = useRouter()
const instanceId = computed(() => String(route.params.instanceId))
const loading = ref(false)
const instance = ref<OpsProcessInstance | null>(null)
const traceDetail = ref<ProcessTrace | null>(null)
const traceCanvasRef = ref<HTMLElement | null>(null)
const auditDetailOpen = ref(false)
const selectedAuditLog = ref<AuditLogItem | null>(null)
const selectedAuditDetail = ref<unknown>({})

const taskColumns = [
  { title: 'Task', dataIndex: 'name', key: 'name' },
  { title: 'Task Key', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: 'Assignee', dataIndex: 'assignee', key: 'assignee', width: 140 },
  { title: 'Created', dataIndex: 'createTime', key: 'createTime', width: 220 },
  { title: 'Action', key: 'action', width: 100 }
]

const timelineColumns = [
  { title: 'Activity ID', dataIndex: 'activityId', key: 'activityId' },
  { title: 'Name', dataIndex: 'activityName', key: 'activityName' },
  { title: 'Type', dataIndex: 'activityType', key: 'activityType' },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 110 },
  { title: 'Start', dataIndex: 'startTime', key: 'startTime' },
  { title: 'End', dataIndex: 'endTime', key: 'endTime' }
]

const auditColumns = [
  { title: 'Action', dataIndex: 'action', key: 'action', width: 210 },
  { title: 'User', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: 'Request ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: 'Detail', dataIndex: 'detailJson', key: 'detailJson' },
  { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 220 },
  { title: 'Action', key: 'action', width: 90 }
]

let traceViewer: any = null

async function load() {
  loading.value = true
  try {
    const [instanceDetail, trace] = await Promise.all([
      getProcessInstance(instanceId.value),
      getProcessTrace(instanceId.value)
    ])
    instance.value = instanceDetail
    traceDetail.value = trace
    await renderTraceDiagram()
  } finally {
    loading.value = false
  }
}

async function renderTraceDiagram() {
  if (!traceDetail.value?.bpmnXml) {
    destroyTraceViewer()
    return
  }

  await nextTick()
  if (!traceCanvasRef.value) {
    return
  }

  destroyTraceViewer()
  traceViewer = new BpmnNavigatedViewer({
    container: traceCanvasRef.value
  })

  await traceViewer.importXML(traceDetail.value.bpmnXml)

  const canvas = traceViewer.get('canvas')
  const completedActivityIds = traceDetail.value.timeline
    .filter((item) => item.status === 'COMPLETED')
    .map((item) => item.activityId)

  for (const activityId of completedActivityIds) {
    canvas.addMarker(activityId, 'trace-completed')
  }
  for (const activityId of traceDetail.value.currentActivityIds) {
    canvas.addMarker(activityId, 'trace-current')
  }
  canvas.zoom('fit-viewport')
}

function destroyTraceViewer() {
  if (traceViewer) {
    traceViewer.destroy()
    traceViewer = null
  }
}

function openAuditDetail(record: AuditLogItem) {
  selectedAuditLog.value = record
  selectedAuditDetail.value = parseJsonValue(record.detailJson)
  auditDetailOpen.value = true
}

function parseJsonValue(value?: string) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

onMounted(load)

onBeforeUnmount(() => {
  destroyTraceViewer()
})
</script>
