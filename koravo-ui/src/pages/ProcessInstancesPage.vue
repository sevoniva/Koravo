<template>
  <PageContainer>
    <PageHeader title="流程实例" description="启动流程并查看当前状态。">
      <template #actions>
        <a-button :loading="listLoading || modelLoading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="已部署模型">
        <a-select
          v-model:value="selectedModelId"
          allow-clear
          :loading="modelLoading"
          placeholder="请选择已部署模型"
          @change="selectModel"
        >
          <a-select-option v-for="model in deployedModels" :key="model.id" :value="model.id">
            {{ model.modelName }} · v{{ model.version }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="业务编号"><a-input v-model:value="businessKey" /></a-form-item>
      <template v-if="isLeaveModel">
        <a-form-item label="申请人"><a-input v-model:value="startForm.applicant" /></a-form-item>
        <a-form-item label="审批人"><a-input v-model:value="startForm.approver" /></a-form-item>
        <a-form-item label="请假类型">
          <a-select v-model:value="startForm.leaveType">
            <a-select-option value="年假">年假</a-select-option>
            <a-select-option value="病假">病假</a-select-option>
            <a-select-option value="事假">事假</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="开始日期">
          <a-date-picker v-model:value="startForm.startDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="结束日期">
          <a-date-picker v-model:value="startForm.endDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="请假天数">
          <a-input-number v-model:value="startForm.days" :min="1" :precision="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="请假原因" class="span-2">
          <a-textarea v-model:value="startForm.reason" :rows="3" />
        </a-form-item>
      </template>
      <template v-else>
        <a-form-item label="审批人"><a-input v-model:value="startForm.approver" /></a-form-item>
        <a-form-item label="调用目标">
          <a-input :value="connectorTarget" disabled />
        </a-form-item>
      </template>
      <a-form-item class="span-2">
        <a-collapse ghost>
          <a-collapse-panel key="advanced" header="高级配置">
            <a-form layout="vertical" class="compact-form-grid">
              <a-form-item label="流程">
                <a-input v-model:value="processDefinitionKey" />
              </a-form-item>
              <a-form-item label="流程变量" class="span-2">
                <a-textarea v-model:value="variablesText" :rows="6" />
              </a-form-item>
            </a-form>
          </a-collapse-panel>
        </a-collapse>
      </a-form-item>
      <a-form-item>
        <Toolbar>
          <a-button type="primary" :loading="loading" @click="start"><PlayCircleOutlined />启动流程</a-button>
        </Toolbar>
      </a-form-item>
    </a-form>

    <DetailSection v-if="instance" title="启动结果">
      <a-descriptions bordered :column="2" size="small">
        <a-descriptions-item label="实例">
          <CopyableText :value="instance.instanceId" :display-value="shortTraceLabel(instance.instanceId)" />
        </a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :status="instance.status" /></a-descriptions-item>
        <a-descriptions-item label="业务编号">{{ instance.businessKey }}</a-descriptions-item>
        <a-descriptions-item label="流程">
          <CopyableText :value="instance.processDefinitionId" :display-value="processDefinitionLabel(instance.processDefinitionId)" />
        </a-descriptions-item>
      </a-descriptions>
      <template #actions>
        <a-button @click="router.push(`/process-instances/${instance.instanceId}`)">详情</a-button>
        <a-button type="primary" @click="openOpsTrace(instance.instanceId)">追踪</a-button>
      </template>
    </DetailSection>

    <a-table
      class="panel-block"
      :data-source="startedInstances"
      :columns="startedColumns"
      row-key="instanceId"
      :loading="listLoading"
      :pagination="startedPagination"
      @change="handleStartedTableChange"
    >
      <template #emptyText>
        <EmptyState description="暂无流程实例" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'instance'">
          <CopyableText :value="record.instanceId" :display-value="shortTraceLabel(record.instanceId)" />
        </template>
        <template v-else-if="column.key === 'status'">
          <StatusTag :status="record.status" />
        </template>
        <template v-else-if="column.key === 'startTime'">
          {{ formatDateTime(record.startTime) }}
        </template>
        <template v-else-if="column.key === 'endTime'">
          {{ formatDateTime(record.endTime) }}
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)">详情</a-button>
            <a-button size="small" type="primary" @click="openOpsTrace(record.instanceId)">追踪</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, StatusTag, Toolbar } from '../components/ui'
import {
  listProcessModels,
  listStartedInstances,
  startProcessInstance,
  type OpsProcessInstance,
  type ProcessInstance,
  type ProcessModelItem
} from '../api/koravo'
import { formatDateTime } from '../utils/format'
import { processDefinitionLabel, shortTraceLabel } from '../utils/display'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const processDefinitionKey = ref('leaveApproval')
const selectedModelId = ref<string | undefined>()
const todayCompact = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const today = new Date().toISOString().slice(0, 10)
const businessKey = ref('')
const variablesText = ref('')

const startForm = reactive({
  applicant: '张三',
  approver: 'admin',
  leaveType: '年假',
  startDate: today,
  endDate: today,
  days: 2,
  reason: '家庭事务',
  attachmentNote: ''
})

const instance = ref<ProcessInstance | null>(null)
const loading = ref(false)
const listLoading = ref(false)
const modelLoading = ref(false)
const startedInstances = ref<OpsProcessInstance[]>([])
const deployedModels = ref<ProcessModelItem[]>([])
const startedPage = ref(1)
const startedPageSize = ref(20)
const startedTotal = ref(0)
const router = useRouter()
const selectedModelKey = computed(() => deployedModels.value.find((item) => item.id === selectedModelId.value)?.modelKey || processDefinitionKey.value)
const isLeaveModel = computed(() => selectedModelKey.value !== 'httpConnectorDemo')
const connectorTarget = 'GET /api/v1/health'

applyStartTemplate('leaveApproval')

const startedColumns = [
  { title: '实例', key: 'instance', width: 180 },
  { title: '业务编号', dataIndex: 'businessKey', key: 'businessKey' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '发起时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime' },
  { title: '操作', key: 'action', width: 150 }
]

const startedPagination = computed<TablePaginationConfig>(() => ({
  current: startedPage.value,
  pageSize: startedPageSize.value,
  total: startedTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个我发起的实例`
}))

async function start() {
  loading.value = true
  try {
    syncVariablesFromForm()
    const variables = parseJsonObject(variablesText.value, '流程变量')
    instance.value = await startProcessInstance({ processDefinitionKey: processDefinitionKey.value, businessKey: businessKey.value, variables })
    message.success('流程已启动')
    startedPage.value = 1
    await loadStartedInstances()
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
  } finally {
    loading.value = false
  }
}

async function loadStartedInstances() {
  listLoading.value = true
  try {
    const page = await listStartedInstances({
      page: startedPage.value,
      pageSize: startedPageSize.value
    })
    startedInstances.value = page.items
    startedTotal.value = page.total
    startedPage.value = page.page
    startedPageSize.value = page.pageSize
  } finally {
    listLoading.value = false
  }
}

async function loadDeployedModels() {
  modelLoading.value = true
  try {
    deployedModels.value = await listProcessModels('DEPLOYED')
    if (!selectedModelId.value && deployedModels.value.length > 0) {
      selectModel(deployedModels.value.find((item) => item.modelKey === 'leaveApproval')?.id || deployedModels.value[0].id)
    }
  } finally {
    modelLoading.value = false
  }
}

async function load() {
  await Promise.all([loadStartedInstances(), loadDeployedModels()])
}

function selectModel(modelId?: string) {
  selectedModelId.value = modelId
  const model = deployedModels.value.find((item) => item.id === modelId)
  if (model?.modelKey) {
    processDefinitionKey.value = model.modelKey
    applyStartTemplate(model.modelKey)
  }
}

function applyStartTemplate(modelKey: string) {
  if (modelKey === 'httpConnectorDemo') {
    businessKey.value = `HTTP-${Date.now()}`
    startForm.approver = 'admin'
    syncVariablesFromForm()
    return
  }
  businessKey.value = `LEAVE-${todayCompact}-001`
  startForm.applicant = '张三'
  startForm.approver = 'admin'
  startForm.leaveType = '年假'
  startForm.startDate = today
  startForm.endDate = today
  startForm.days = 2
  startForm.reason = '家庭事务'
  startForm.attachmentNote = ''
  syncVariablesFromForm()
}

function syncVariablesFromForm() {
  const variables = isLeaveModel.value
    ? {
        applicant: startForm.applicant,
        approver: startForm.approver,
        leaveType: startForm.leaveType,
        startDate: startForm.startDate,
        endDate: startForm.endDate,
        days: startForm.days,
        reason: startForm.reason,
        attachmentNote: startForm.attachmentNote
      }
    : {
        approver: startForm.approver
      }
  variablesText.value = JSON.stringify(variables, null, 2)
}

function handleStartedTableChange(nextPagination: TablePaginationConfig) {
  startedPage.value = nextPagination.current || 1
  startedPageSize.value = nextPagination.pageSize || 20
  loadStartedInstances()
}

function openOpsTrace(instanceId: string) {
  router.push({
    path: '/ops',
    query: { view: 'trace', instanceId }
  })
}

onMounted(load)

watch(startForm, syncVariablesFromForm, { deep: true })
</script>
