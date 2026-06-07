<template>
  <PageContainer wide>
    <PageHeader title="流程实例详情" :description="instance?.businessKey || instanceId">
      <template #actions>
        <a-button @click="router.push('/process-instances')">启动流程</a-button>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <EmptyState v-if="!loading && !instance" description="暂无流程实例详情" />

    <a-descriptions v-if="instance" bordered :column="2" class="panel-block">
      <a-descriptions-item label="实例">
        <CopyableText :value="instance.instanceId" :display-value="shortTraceLabel(instance.instanceId)" />
      </a-descriptions-item>
      <a-descriptions-item label="实例状态"><StatusTag :status="instance.status" /></a-descriptions-item>
      <a-descriptions-item label="业务编号">{{ instance.businessKey }}</a-descriptions-item>
      <a-descriptions-item label="发起人">{{ instance.startUserId }}</a-descriptions-item>
      <a-descriptions-item label="流程">
        <CopyableText :value="instance.processDefinitionId" :display-value="processDefinitionLabel(instance.processDefinitionId)" />
      </a-descriptions-item>
      <a-descriptions-item label="发起时间">{{ formatDateTime(instance.startTime) }}</a-descriptions-item>
      <a-descriptions-item label="结束时间">{{ formatDateTime(instance.endTime) }}</a-descriptions-item>
      <a-descriptions-item label="当前节点">{{ currentNodeText }}</a-descriptions-item>
    </a-descriptions>

    <div v-if="traceDetail" class="metric-grid panel-block">
      <a-card title="当前任务"><strong>{{ traceDetail.currentTasks.length }}</strong><span>{{ currentTaskText }}</span></a-card>
      <a-card title="已完成节点"><strong>{{ completedNodeCount }}</strong><span>历史活动完成数</span></a-card>
      <a-card title="当前节点"><strong>{{ traceDetail.currentActivityIds.length }}</strong><span>{{ currentNodeText }}</span></a-card>
      <a-card title="变量摘要"><strong>{{ variableSummaryItems.length }}</strong><span>{{ variableSummaryText }}</span></a-card>
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
            <EmptyState description="暂无当前任务" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'createTime'">
              {{ formatDateTime(record.createTime) }}
            </template>
            <template v-else-if="column.key === 'taskDefinitionKey'">
              {{ detailValueLabel(record.taskDefinitionKey) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)">详情</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="timeline" tab="历史活动">
        <a-table :data-source="traceDetail.timeline" :columns="timelineColumns" row-key="activityId" :pagination="false" size="small">
          <template #emptyText>
            <EmptyState description="暂无历史活动" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'activity'">
              {{ activityLabel(record) }}
            </template>
            <template v-else-if="column.key === 'activityType'">
              {{ activityTypeLabel(record.activityType) }}
            </template>
            <template v-else-if="column.key === 'startTime'">
              {{ formatDateTime(record.startTime) }}
            </template>
            <template v-else-if="column.key === 'endTime'">
              {{ formatDateTime(record.endTime) }}
            </template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="variables" tab="变量摘要">
        <EmptyState v-if="!variableSummaryItems.length" description="暂无流程变量" />
        <a-descriptions v-else bordered :column="2" size="small">
          <a-descriptions-item v-for="item in variableSummaryItems" :key="item.key" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
      </a-tab-pane>
      <a-tab-pane key="auditLogs" tab="审计日志">
        <a-table :data-source="instance?.auditLogs || []" :columns="auditColumns" row-key="id" :pagination="false" size="small">
          <template #emptyText>
            <EmptyState description="暂无审计日志" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'auditAction'">
              {{ actionLabel(record.action) }}
            </template>
            <template v-else-if="column.key === 'summary'">
              <span class="audit-summary">{{ auditSummary(record.detailJson, record.action) }}</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="openAuditDetail(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-collapse v-if="traceDetail" class="panel-block">
      <a-collapse-panel key="detail" header="高级详情">
        <a-tabs>
          <a-tab-pane key="variables" tab="流程变量">
            <JsonPreview :value="maskedVariables" />
          </a-tab-pane>
          <a-tab-pane key="detail" tab="实例数据">
            <JsonPreview :value="{ instance: maskedInstanceDetail, trace: maskedTraceDetail }" />
          </a-tab-pane>
        </a-tabs>
      </a-collapse-panel>
    </a-collapse>

    <a-modal v-model:open="auditDetailOpen" title="审计详情" :footer="null" width="820px">
      <a-descriptions v-if="selectedAuditLog" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="时间">{{ formatDateTime(selectedAuditLog.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="用户">{{ selectedAuditLog.userId }}</a-descriptions-item>
        <a-descriptions-item label="动作">{{ actionLabel(selectedAuditLog.action) }}</a-descriptions-item>
        <a-descriptions-item label="资源">{{ resourceLabel(selectedAuditLog.resourceType) }}</a-descriptions-item>
        <a-descriptions-item label="资源">
          <CopyableText :value="selectedAuditLog.resourceId" :display-value="shortTraceLabel(selectedAuditLog.resourceId)" />
        </a-descriptions-item>
        <a-descriptions-item label="请求">
          <CopyableText :value="selectedAuditLog.requestId" :display-value="shortTraceLabel(selectedAuditLog.requestId)" />
        </a-descriptions-item>
        <a-descriptions-item label="客户端 IP">{{ selectedAuditLog.clientIp }}</a-descriptions-item>
        <a-descriptions-item label="租户">{{ selectedAuditLog.tenantId }}</a-descriptions-item>
      </a-descriptions>
      <DetailSection v-if="selectedAuditLog" title="变更摘要">
        <a-descriptions v-if="selectedAuditSummaryItems.length" bordered :column="2" size="small">
          <a-descriptions-item v-for="item in selectedAuditSummaryItems" :key="item.key" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
        <EmptyState v-else description="暂无补充摘要" />
      </DetailSection>
      <a-collapse v-if="selectedAuditLog" class="panel-block">
        <a-collapse-panel key="detail" header="高级详情">
          <JsonPreview :value="selectedAuditDetail" />
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import JsonPreview from '../components/JsonPreview.vue'
import { CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, StatusTag } from '../components/ui'
import {
  getProcessInstance,
  getProcessTrace,
  type AuditLogItem,
  type OpsProcessInstance,
  type ProcessTrace
} from '../api/koravo'
import { formatDateTime, maskSecret, parseJsonSafe } from '../utils/format'
import { processDefinitionLabel, shortTraceLabel } from '../utils/display'

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
const selectedAuditSummaryItems = computed(() => auditSummaryItems(selectedAuditDetail.value))

const completedNodeCount = computed(() => traceDetail.value?.timeline.filter((item) => item.status === 'COMPLETED').length || 0)
const currentNodeText = computed(() => traceDetail.value?.currentActivityIds.map(detailValueLabel).join('、') || '-')
const currentTaskText = computed(() => traceDetail.value?.currentTasks.map((item) => item.name).join('、') || '-')
const maskedVariables = computed(() => maskSecret(traceDetail.value?.variables || {}))
const variableSummaryItems = computed(() => Object.entries(maskedVariables.value as Record<string, unknown>)
  .filter(([key, value]) => !isLowSignalKey(key, value))
  .map(([key, value]) => ({
    key,
    label: detailKeyLabel(key),
    value: formatSummaryValue(value)
  })))
const variableSummaryText = computed(() => variableSummaryItems.value.slice(0, 2).map((item) => `${item.label}：${item.value}`).join('，') || '无补充信息')
const maskedTraceDetail = computed(() => traceDetail.value ? { ...traceDetail.value, variables: maskedVariables.value } : null)
const maskedInstanceDetail = computed(() => {
  if (!instance.value) return null
  return {
    ...instance.value,
    auditLogs: instance.value.auditLogs?.map((item) => ({
      ...item,
      detailJson: maskedAuditDetailText(item.detailJson)
    }))
  }
})

const taskColumns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '任务节点', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '处理人', dataIndex: 'assignee', key: 'assignee', width: 140 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 220 },
  { title: '操作', key: 'action', width: 100 }
]

const timelineColumns = [
  { title: '节点', key: 'activity' },
  { title: '类型', dataIndex: 'activityType', key: 'activityType' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime' }
]

const auditColumns = [
  { title: '动作', dataIndex: 'action', key: 'auditAction', width: 180 },
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: '摘要', key: 'summary' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
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
  selectedAuditDetail.value = parseAuditDetail(record.detailJson)
  auditDetailOpen.value = true
}

function maskedAuditDetailText(value?: string) {
  const masked = parseAuditDetail(value)
  return typeof masked === 'string' ? masked : JSON.stringify(masked)
}

function parseAuditDetail(value?: string) {
  if (!value) return {}
  return maskSecret(parseJsonSafe(value, value))
}

function auditSummary(value?: string, action?: string) {
  const masked = parseAuditDetail(value)
  if (typeof masked === 'string') return masked || '无补充信息'
  const entries = auditSummaryItems(masked).slice(0, 3)
  if (!entries.length) return emptySummary(action)
  return entries.map((item) => `${item.label}：${item.value}`).join('，')
}

function auditSummaryItems(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => !isLowSignalKey(key, item))
    .map(([key, item]) => ({
      key,
      label: detailKeyLabel(key),
      value: formatSummaryValue(item)
    }))
}

function isLowSignalKey(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return /(^id$|id$|requestId|deploymentId|formSchemaId|formBindingId|processInstanceId|processDefinitionId)/i.test(key)
}

function actionLabel(action?: string) {
  const mapping: Record<string, string> = {
    TASK_COMPLETE: '完成任务',
    PROCESS_INSTANCE_START: '启动流程',
    CONNECTOR_EXECUTE: '执行连接器',
    PROCESS_MODEL_DEPLOY: '部署模型',
    PROCESS_MODEL_IMPORT: '导入模型',
    DEMO_INIT: '准备基础数据',
    DATASOURCE_CREATE: '创建数据源',
    DATASOURCE_TEST: '测试数据源',
    DATASOURCE_DELETE: '删除数据源',
    FORM_BINDING_CREATE: '创建绑定',
    FORM_BINDING_UPDATE: '更新绑定',
    FORM_BINDING_DELETE: '删除绑定'
  }
  return mapping[action || ''] || action || '-'
}

function resourceLabel(resourceType?: string) {
  const mapping: Record<string, string> = {
    TASK: '任务',
    PROCESS_INSTANCE: '流程实例',
    PROCESS_MODEL: '流程模型',
    CONNECTOR_EXECUTION: '连接器日志',
    DATASOURCE: '数据源',
    DEMO: '基础数据',
    FORM_BINDING: '表单绑定'
  }
  return mapping[resourceType || ''] || resourceType || '-'
}

function emptySummary(action?: string) {
  const mapping: Record<string, string> = {
    PROCESS_INSTANCE_START: '流程已启动',
    TASK_COMPLETE: '任务已完成',
    CONNECTOR_EXECUTE: '连接器已执行'
  }
  return mapping[action || ''] || '无补充信息'
}

function detailKeyLabel(key: string) {
  const mapping: Record<string, string> = {
    applicant: '申请人',
    approver: '审批人',
    leaveType: '请假类型',
    startDate: '开始日期',
    endDate: '结束日期',
    days: '请假天数',
    reason: '请假原因',
    attachmentNote: '附件说明',
    approved: '审批结果',
    approvalAction: '审批动作',
    status: '状态',
    businessKey: '业务编号',
    processDefinitionKey: '流程',
    statusCode: '状态码',
    connectorType: '连接器',
    elapsedMillis: '耗时',
    taskDefinitionKey: '任务节点',
    name: '名称',
    modelKey: '模型',
    version: '版本'
  }
  return mapping[key] || key
}

function formatSummaryValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined || value === null || value === '') return '-'
  const text = detailValueLabel(String(value))
  return text.length > 48 ? `${text.slice(0, 48)}...` : text
}

function detailValueLabel(value: string) {
  const mapping: Record<string, string> = {
    RUNNING: '运行中',
    SUCCESS: '成功',
    FAILED: '失败',
    DRAFT: '草稿',
    DEPLOYED: '已部署',
    COMPLETED: '已完成',
    DISABLED: '已禁用',
    ARCHIVED: '已归档',
    approveTask: '审批请假',
    reviewTask: '确认调用结果',
    leaveApproval: '请假审批',
    httpConnectorDemo: 'HTTP 健康检查',
    http: 'HTTP 调用',
    true: '是',
    false: '否'
  }
  return mapping[value] || value
}

function activityLabel(record: { activityId: string; activityName?: string }) {
  return record.activityName || detailValueLabel(record.activityId)
}

function activityTypeLabel(value?: string) {
  const mapping: Record<string, string> = {
    startEvent: '开始',
    userTask: '人工任务',
    serviceTask: '服务调用',
    endEvent: '结束',
    sequenceFlow: '流转'
  }
  return mapping[value || ''] || value || '-'
}

onMounted(load)

onBeforeUnmount(() => {
  destroyTraceViewer()
})
</script>

<style scoped>
.audit-summary {
  display: inline-block;
  overflow: hidden;
  max-width: 420px;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
