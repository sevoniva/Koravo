<template>
  <PageContainer>
    <PageHeader title="任务详情" :description="detail?.task.name || taskId">
      <template #actions>
        <a-button v-if="detail?.task.processInstanceId" @click="openProcessTrace">
          <DeploymentUnitOutlined />流程追踪
        </a-button>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <EmptyState v-if="!loading && !detail" description="暂无任务详情" />

    <a-descriptions v-if="detail" bordered :column="2" class="panel-block">
      <a-descriptions-item label="任务名称">{{ detail.task.name }}</a-descriptions-item>
      <a-descriptions-item label="任务节点">{{ taskLabel(detail.task.taskDefinitionKey) }}</a-descriptions-item>
      <a-descriptions-item label="状态"><StatusTag :status="detail.task.status" /></a-descriptions-item>
      <a-descriptions-item label="业务编号">{{ detail.task.businessKey }}</a-descriptions-item>
      <a-descriptions-item label="处理人">{{ detail.task.assignee }}</a-descriptions-item>
      <a-descriptions-item label="创建时间">{{ formatDateTime(detail.task.createTime) }}</a-descriptions-item>
      <a-descriptions-item label="流程实例">
        <a-button type="link" class="inline-link-button" @click="openProcessTrace">
          {{ shortTraceLabel(detail.task.processInstanceId) }}
        </a-button>
      </a-descriptions-item>
      <a-descriptions-item label="流程">
        <CopyableText :value="detail.task.processDefinitionId" :display-value="processDefinitionLabel(detail.task.processDefinitionId)" />
      </a-descriptions-item>
      <a-descriptions-item label="表单信息" :span="2">
        {{ detail.formSchema ? `${detail.formSchema.formName} v${detail.formSchema.version}` : '未绑定表单' }}
      </a-descriptions-item>
    </a-descriptions>

    <a-alert
      v-if="detail && !isCompletable"
      class="panel-block"
      type="info"
      show-icon
      message="已办任务"
      description="可查看快照、意见、变量和记录。"
    />

    <DetailSection v-if="detail && isCompletable" title="办理任务">
      <a-form layout="vertical" class="form-grid">
        <a-form-item label="审批结果">
          <a-segmented v-model:value="approvalAction" :options="approvalOptions" />
        </a-form-item>
        <a-form-item v-if="detail.formSchema" label="绑定表单" class="span-2">
          <a-alert
            :message="`${detail.formSchema.formName} v${detail.formSchema.version}`"
            description="提交后写入任务记录。"
            type="info"
            show-icon
          />
        </a-form-item>
        <SchemaForm
          v-if="detail.formSchema"
          v-model="formDataValues"
          :schema-json="detail.formSchema.schemaJson"
          @fields-change="schemaFields = $event"
        />
        <a-form-item label="审批意见" class="span-2">
          <a-input v-model:value="comment" />
        </a-form-item>
        <a-collapse ghost class="span-2">
          <a-collapse-panel key="advanced" header="更多参数">
            <a-form-item label="表单数据">
              <a-textarea v-model:value="formDataJson" :rows="5" />
            </a-form-item>
            <a-form-item label="流程变量">
              <a-textarea v-model:value="variablesJson" :rows="5" />
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>
      </a-form>
      <template #actions>
        <Toolbar>
          <a-button type="primary" :loading="submitting" @click="submit"><CheckCircleOutlined />提交</a-button>
          <a-button @click="router.push('/tasks')">返回列表</a-button>
        </Toolbar>
      </template>
    </DetailSection>

    <a-tabs v-if="detail" class="panel-block">
      <a-tab-pane key="processVariables" tab="申请摘要">
        <EmptyState v-if="!processVariableSummaryItems.length" description="暂无申请摘要" />
        <a-descriptions v-else bordered :column="2" size="small">
          <a-descriptions-item v-for="item in processVariableSummaryItems" :key="item.key" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
      </a-tab-pane>
      <a-tab-pane key="taskVariables" tab="任务摘要">
        <EmptyState v-if="!taskVariableSummaryItems.length" description="暂无任务摘要" />
        <a-descriptions v-else bordered :column="2" size="small">
          <a-descriptions-item v-for="item in taskVariableSummaryItems" :key="item.key" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
      </a-tab-pane>
      <a-tab-pane key="comments" tab="审批意见">
        <a-table :data-source="detail.comments" :columns="commentColumns" row-key="id" :pagination="false" size="small">
          <template #emptyText>
            <EmptyState description="暂无审批意见" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'time'">{{ formatDateTime(record.time) }}</template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="snapshots" tab="表单快照">
        <a-table :data-source="detail.formSnapshots" :columns="snapshotColumns" row-key="id" :pagination="false" size="small">
          <template #emptyText>
            <EmptyState description="暂无表单快照" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'taskId'">
              <CopyableText :value="record.taskId" :display-value="shortTraceLabel(record.taskId)" />
            </template>
            <template v-else-if="column.key === 'formSchemaId'">
              <CopyableText :value="record.formSchemaId" :display-value="shortTraceLabel(record.formSchemaId)" />
            </template>
            <template v-else-if="column.key === 'dataJson'">
              <span class="task-summary-text">{{ snapshotSummary(record.dataJson) }}</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="openSnapshot(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="auditLogs" tab="操作记录">
        <a-table :data-source="detail.auditLogs" :columns="auditColumns" row-key="id" :pagination="false" size="small">
          <template #emptyText>
            <EmptyState description="暂无操作记录" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actionLabel'">
              {{ actionLabel(record.action) }}
            </template>
            <template v-else-if="column.key === 'requestId'">
              <CopyableText :value="record.requestId" :display-value="shortTraceLabel(record.requestId)" />
            </template>
            <template v-else-if="column.key === 'detailJson'">
              <span class="task-summary-text">{{ auditSummary(record.detailJson, record.action) }}</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-collapse v-if="detail" class="panel-block">
      <a-collapse-panel key="detail" header="原始数据">
        <a-tabs>
          <a-tab-pane key="variables" tab="流程变量">
            <JsonPreview :value="maskedProcessVariables" />
          </a-tab-pane>
          <a-tab-pane key="taskVariables" tab="任务变量">
            <JsonPreview :value="maskedTaskVariables" />
          </a-tab-pane>
          <a-tab-pane key="detail" tab="详情数据">
            <JsonPreview :value="maskedDetail" />
          </a-tab-pane>
        </a-tabs>
      </a-collapse-panel>
    </a-collapse>

    <a-modal v-model:open="snapshotModalOpen" title="表单快照" :footer="null" width="840px">
      <a-descriptions v-if="selectedSnapshot" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="任务">
          <CopyableText :value="selectedSnapshot.taskId" :display-value="shortTraceLabel(selectedSnapshot.taskId)" />
        </a-descriptions-item>
        <a-descriptions-item label="表单">
          <CopyableText :value="selectedSnapshot.formSchemaId" :display-value="shortTraceLabel(selectedSnapshot.formSchemaId)" />
        </a-descriptions-item>
        <a-descriptions-item label="版本">{{ selectedSnapshot.formSchemaVersion }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDateTime(selectedSnapshot.createdAt) }}</a-descriptions-item>
      </a-descriptions>
      <a-descriptions v-if="selectedSnapshot" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item v-for="item in selectedSnapshotSummaryItems" :key="item.key" :label="item.label">
          {{ item.value }}
        </a-descriptions-item>
      </a-descriptions>
      <a-collapse v-if="selectedSnapshot" class="panel-block">
        <a-collapse-panel key="snapshot" header="原始快照">
          <a-tabs>
            <a-tab-pane key="data" tab="表单数据">
              <JsonPreview :value="selectedSnapshotData" />
            </a-tab-pane>
            <a-tab-pane key="schema" tab="表单结构">
              <JsonPreview :value="selectedSnapshotSchema" />
            </a-tab-pane>
            <a-tab-pane key="uiSchema" tab="界面配置">
              <JsonPreview :value="selectedSnapshotUiSchema" />
            </a-tab-pane>
          </a-tabs>
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, DeploymentUnitOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import SchemaForm from '../components/SchemaForm.vue'
import { CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, StatusTag, Toolbar } from '../components/ui'
import { completeTask, getTaskDetail, type FormSnapshotItem, type JsonRecord, type TaskDetail } from '../api/koravo'
import { formatDateTime, maskSecret, parseJsonSafe } from '../utils/format'
import { processDefinitionLabel, shortTraceLabel, taskDefinitionLabel } from '../utils/display'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

type SchemaField = {
  key: string
  label: string
  required: boolean
}

const route = useRoute()
const router = useRouter()
const taskId = computed(() => String(route.params.taskId))
const loading = ref(false)
const submitting = ref(false)
const detail = ref<TaskDetail | null>(null)
const approvalAction = ref('同意')
const approvalOptions = ['同意', '拒绝', '提交']
const variablesJson = ref(JSON.stringify({ approved: true, approvalAction: '同意' }, null, 2))
const formDataJson = ref('{}')
const formDataValues = ref<JsonRecord>({})
const comment = ref('同意')
const snapshotModalOpen = ref(false)
const selectedSnapshot = ref<FormSnapshotItem | null>(null)
const selectedSnapshotData = ref<unknown>({})
const selectedSnapshotSchema = ref<unknown>({})
const selectedSnapshotUiSchema = ref<unknown>({})
const schemaFields = ref<SchemaField[]>([])

const commentColumns = [
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: '意见', dataIndex: 'message', key: 'message' },
  { title: '时间', dataIndex: 'time', key: 'time', width: 220 }
]

const snapshotColumns = [
  { title: '任务', dataIndex: 'taskId', key: 'taskId', width: 150 },
  { title: '表单', dataIndex: 'formSchemaId', key: 'formSchemaId', width: 180 },
  { title: '版本', dataIndex: 'formSchemaVersion', key: 'formSchemaVersion', width: 90 },
  { title: '摘要', dataIndex: 'dataJson', key: 'dataJson' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 220 },
  { title: '操作', key: 'action', width: 90 }
]

const auditColumns = [
  { title: '动作', key: 'actionLabel', width: 190 },
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: '请求', dataIndex: 'requestId', key: 'requestId', width: 150 },
  { title: '摘要', dataIndex: 'detailJson', key: 'detailJson' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 220 }
]

const isCompletable = computed(() => detail.value?.task.status === 'RUNNING')
const maskedProcessVariables = computed(() => maskSecret(detail.value?.processVariables || {}))
const maskedTaskVariables = computed(() => maskSecret(detail.value?.taskVariables || {}))
const processVariableSummaryItems = computed(() => variableSummaryItems(maskedProcessVariables.value as Record<string, unknown>))
const taskVariableSummaryItems = computed(() => variableSummaryItems(maskedTaskVariables.value as Record<string, unknown>))
const selectedSnapshotSummaryItems = computed(() => variableSummaryItems(selectedSnapshotData.value as Record<string, unknown>))
const maskedDetail = computed(() => detail.value ? {
  ...detail.value,
  processVariables: maskedProcessVariables.value,
  taskVariables: maskedTaskVariables.value,
  formSnapshots: detail.value.formSnapshots.map((item) => ({
    ...item,
    dataJson: maskedJsonText(item.dataJson)
  })),
  auditLogs: detail.value.auditLogs.map((item) => ({
    ...item,
    detailJson: maskedJsonText(item.detailJson)
  }))
} : null)

watch(formDataValues, (value) => {
  formDataJson.value = JSON.stringify(value || {}, null, 2)
}, { deep: true })

watch(approvalAction, (value) => {
  const approved = value !== '拒绝'
  variablesJson.value = JSON.stringify({ approved, approvalAction: value }, null, 2)
  comment.value = value
})

async function load() {
  loading.value = true
  try {
    detail.value = await getTaskDetail(taskId.value)
    initializeFormDataValues()
  } finally {
    loading.value = false
  }
}

function initializeFormDataValues() {
  const variables = detail.value?.processVariables || {}
  const next: JsonRecord = {
    applicant: String(variables.applicant || ''),
    leaveType: String(variables.leaveType || '年假'),
    startDate: String(variables.startDate || ''),
    endDate: String(variables.endDate || ''),
    days: Number(variables.days || 1),
    reason: String(variables.reason || ''),
    attachmentNote: String(variables.attachmentNote || '')
  }
  formDataValues.value = next
  formDataJson.value = JSON.stringify(next, null, 2)
}

function openProcessTrace() {
  if (detail.value?.task.processInstanceId) {
    router.push(`/process-instances/${detail.value.task.processInstanceId}`)
  }
}

function openSnapshot(snapshot: FormSnapshotItem) {
  selectedSnapshot.value = snapshot
  selectedSnapshotData.value = parseJsonValue(snapshot.dataJson)
  selectedSnapshotSchema.value = maskSecret(parseJsonValue(snapshot.schemaJson))
  selectedSnapshotUiSchema.value = maskSecret(parseJsonValue(snapshot.uiSchemaJson))
  snapshotModalOpen.value = true
}

function parseJsonValue(value?: string) {
  return maskSecret(parseJsonSafe(value, value || {}))
}

function maskedJsonText(value?: string) {
  const masked = parseJsonValue(value)
  return typeof masked === 'string' ? masked : JSON.stringify(masked)
}

function variableSummaryItems(value: Record<string, unknown>) {
  return Object.entries(value || {})
    .filter(([key, item]) => !isLowSignalKey(key, item))
    .map(([key, item]) => ({
      key,
      label: fieldLabel(key),
      value: formatSummaryValue(item)
    }))
}

function snapshotSummary(value?: string) {
  const parsed = parseJsonValue(value)
  const items = variableSummaryItems(parsed as Record<string, unknown>).slice(0, 4)
  return items.length ? items.map((item) => `${item.label}：${item.value}`).join('，') : '无表单数据'
}

function auditSummary(value?: string, action?: string) {
  const parsed = parseJsonValue(value)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const items = variableSummaryItems(parsed as Record<string, unknown>).slice(0, 3)
    if (items.length) return items.map((item) => `${item.label}：${item.value}`).join('，')
  }
  return actionLabel(action)
}

function actionLabel(action?: string) {
  const mapping: Record<string, string> = {
    TASK_COMPLETE: '任务已完成',
    PROCESS_INSTANCE_START: '流程已启动',
    FORM_SUBMIT: '表单已提交',
    FORM_SCHEMA_CREATE: '表单已创建',
    FORM_BINDING_CREATE: '表单已绑定',
    CONNECTOR_EXECUTE: '连接器已执行'
  }
  return mapping[action || ''] || action || '无补充信息'
}

function taskLabel(key?: string) {
  return taskDefinitionLabel(key)
}

function fieldLabel(key: string) {
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
    businessKey: '业务编号',
    tenantId: '租户',
    startUserId: '发起人',
    status: '状态',
    statusCode: '状态码',
    elapsedMillis: '耗时'
  }
  return mapping[key] || key
}

function formatSummaryValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined || value === null || value === '') return '-'
  const text = taskDefinitionLabel(String(value))
  return text.length > 48 ? `${text.slice(0, 48)}...` : text
}

function isLowSignalKey(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return true
  return ['requestId'].includes(key)
}

function validateRequiredFormFields(formData: JsonRecord) {
  const missing = schemaFields.value
    .filter((field) => field.required && isBlank(formData[field.key]))
    .map((field) => field.label)
  if (missing.length) {
    message.error(`请填写：${missing.join('、')}`)
    return false
  }
  return true
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === ''
}

async function submit() {
  submitting.value = true
  try {
    const variables = parseJsonObject(variablesJson.value, '流程变量') as JsonRecord
    const formData = parseJsonObject(formDataJson.value, '表单数据') as JsonRecord
    if (detail.value?.formSchema && !validateRequiredFormFields(formData)) {
      return
    }
    await completeTask(taskId.value, {
      variables,
      formData,
      formSchemaId: detail.value?.formSchema?.id,
      comment: comment.value
    })
    message.success('任务已完成')
    router.push('/tasks')
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>
