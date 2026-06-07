<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>流程实例详情</h1>
        <p>{{ instance?.businessKey || instanceId }}</p>
      </div>
      <a-space>
        <a-button @click="router.push('/process-instances')">启动流程</a-button>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </a-space>
    </div>

    <a-empty v-if="!loading && !instance" description="暂无流程实例详情" />

    <a-descriptions v-if="instance" bordered :column="2" class="panel-block">
      <a-descriptions-item label="实例 ID">{{ instance.instanceId }}</a-descriptions-item>
      <a-descriptions-item label="实例状态">{{ instance.status }}</a-descriptions-item>
      <a-descriptions-item label="业务编号">{{ instance.businessKey }}</a-descriptions-item>
      <a-descriptions-item label="发起人">{{ instance.startUserId }}</a-descriptions-item>
      <a-descriptions-item label="流程定义 Process Definition">{{ instance.processDefinitionId }}</a-descriptions-item>
      <a-descriptions-item label="发起时间">{{ instance.startTime }}</a-descriptions-item>
      <a-descriptions-item label="结束时间">{{ instance.endTime || '-' }}</a-descriptions-item>
      <a-descriptions-item label="当前节点">{{ currentNodeText }}</a-descriptions-item>
    </a-descriptions>

    <div v-if="traceDetail" class="metric-grid panel-block">
      <a-card title="当前任务"><strong>{{ traceDetail.currentTasks.length }}</strong><span>{{ currentTaskText }}</span></a-card>
      <a-card title="已完成节点"><strong>{{ completedNodeCount }}</strong><span>历史活动完成数</span></a-card>
      <a-card title="当前节点"><strong>{{ traceDetail.currentActivityIds.length }}</strong><span>{{ currentNodeText }}</span></a-card>
      <a-card title="变量摘要"><strong>{{ Object.keys(traceDetail.variables || {}).length }}</strong><span>流程变量数量</span></a-card>
    </div>

    <div v-if="traceDetail" class="trace-viewer-panel panel-block">
      <div class="trace-viewer-heading">
        <strong>流程图追踪</strong>
        <a-space>
          <span><i class="trace-dot trace-dot-completed" />已完成</span>
          <span><i class="trace-dot trace-dot-current" />当前</span>
        </a-space>
      </div>
      <div ref="traceCanvasRef" class="trace-viewer-canvas" />
    </div>

    <a-tabs v-if="traceDetail" class="panel-block">
      <a-tab-pane key="tasks" tab="当前任务">
        <a-table :data-source="traceDetail.currentTasks" :columns="taskColumns" row-key="taskId" :pagination="false" size="small">
          <template #emptyText>
            <a-empty description="暂无当前任务" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)">详情</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="timeline" tab="历史活动">
        <a-table :data-source="traceDetail.timeline" :columns="timelineColumns" row-key="activityId" :pagination="false" size="small" />
      </a-tab-pane>
      <a-tab-pane key="variables" tab="变量摘要">
        <JsonPreview :value="traceDetail.variables" />
      </a-tab-pane>
      <a-tab-pane key="auditLogs" tab="审计日志">
        <a-table :data-source="instance?.auditLogs || []" :columns="auditColumns" row-key="id" :pagination="false" size="small">
          <template #emptyText>
            <a-empty description="暂无审计日志" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'detailJson'">
              <code>{{ record.detailJson }}</code>
            </template>
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="openAuditDetail(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <JsonPreview :value="{ instance, trace: traceDetail }" />

    <a-modal v-model:open="auditDetailOpen" title="审计详情" :footer="null" width="820px">
      <a-descriptions v-if="selectedAuditLog" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="时间">{{ selectedAuditLog.createdAt }}</a-descriptions-item>
        <a-descriptions-item label="用户">{{ selectedAuditLog.userId }}</a-descriptions-item>
        <a-descriptions-item label="动作">{{ selectedAuditLog.action }}</a-descriptions-item>
        <a-descriptions-item label="资源">{{ selectedAuditLog.resourceType }}</a-descriptions-item>
        <a-descriptions-item label="资源 ID">{{ selectedAuditLog.resourceId }}</a-descriptions-item>
        <a-descriptions-item label="请求 ID">{{ selectedAuditLog.requestId }}</a-descriptions-item>
        <a-descriptions-item label="客户端 IP">{{ selectedAuditLog.clientIp }}</a-descriptions-item>
        <a-descriptions-item label="租户">{{ selectedAuditLog.tenantId }}</a-descriptions-item>
      </a-descriptions>
      <JsonPreview :value="selectedAuditDetail" />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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

const completedNodeCount = computed(() => traceDetail.value?.timeline.filter((item) => item.status === 'COMPLETED').length || 0)
const currentNodeText = computed(() => traceDetail.value?.currentActivityIds.join('、') || '-')
const currentTaskText = computed(() => traceDetail.value?.currentTasks.map((item) => item.name).join('、') || '-')

const taskColumns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '任务节点', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: '处理人', dataIndex: 'assignee', key: 'assignee', width: 140 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 220 },
  { title: '操作', key: 'action', width: 100 }
]

const timelineColumns = [
  { title: '活动 ID', dataIndex: 'activityId', key: 'activityId' },
  { title: '名称', dataIndex: 'activityName', key: 'activityName' },
  { title: '类型', dataIndex: 'activityType', key: 'activityType' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime' }
]

const auditColumns = [
  { title: '动作', dataIndex: 'action', key: 'action', width: 210 },
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: '请求 ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: '详情', dataIndex: 'detailJson', key: 'detailJson' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 220 },
  { title: '操作', key: 'action', width: 90 }
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
