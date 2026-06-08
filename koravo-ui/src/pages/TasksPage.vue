<template>
  <PageContainer>
    <PageHeader title="我的任务" description="待办、已办、发起。">
      <template #actions>
        <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <SearchBar v-model="filters.keyword" placeholder="搜索任务" @search="applyFilters">
      <Toolbar>
        <a-select v-model:value="filters.status" allow-clear placeholder="状态" style="width: 130px">
          <a-select-option value="RUNNING">运行中</a-select-option>
          <a-select-option value="COMPLETED">已完成</a-select-option>
          <a-select-option value="SUSPENDED">已挂起</a-select-option>
        </a-select>
        <a-date-picker v-model:value="filters.startDate" value-format="YYYY-MM-DD" placeholder="开始日期" />
        <a-date-picker v-model:value="filters.endDate" value-format="YYYY-MM-DD" placeholder="结束日期" />
        <a-button type="primary" @click="applyFilters"><SearchOutlined />查询</a-button>
        <a-button @click="resetFilters">重置</a-button>
      </Toolbar>
    </SearchBar>

    <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
      <a-tab-pane key="pending" tab="我的待办">
        <a-table
          :data-source="tasks"
          :columns="columns"
          row-key="taskId"
          :loading="loading && activeTab === 'pending'"
          :pagination="pendingPagination"
          @change="handlePendingTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无待办任务" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'taskDefinitionKey'">
              {{ taskDefinitionLabel(record.taskDefinitionKey) }}
            </template>
            <template v-else-if="column.key === 'createTime'">
              {{ formatDateTime(record.createTime) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)"><EyeOutlined />详情</a-button>
                <a-button size="small" type="primary" @click="openComplete(record)"><FormOutlined />办理</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="done" tab="我的已办">
        <a-table
          :data-source="doneTasks"
          :columns="doneColumns"
          row-key="taskId"
          :loading="loading && activeTab === 'done'"
          :pagination="donePagination"
          @change="handleDoneTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无已办任务" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'taskDefinitionKey'">
              {{ taskDefinitionLabel(record.taskDefinitionKey) }}
            </template>
            <template v-else-if="column.key === 'createTime'">
              {{ formatDateTime(record.createTime) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)"><EyeOutlined />详情</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="started" tab="我发起的">
        <a-table
          :data-source="startedInstances"
          :columns="startedColumns"
          row-key="instanceId"
          :loading="loading && activeTab === 'started'"
          :pagination="startedPagination"
          @change="handleStartedTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无我发起的流程" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'instanceId'">
              <CopyableText :value="record.instanceId" :display-value="shortTraceLabel(record.instanceId)" />
            </template>
            <template v-else-if="column.key === 'startTime'">
              {{ formatDateTime(record.startTime) }}
            </template>
            <template v-else-if="column.key === 'endTime'">
              {{ formatDateTime(record.endTime) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)"><EyeOutlined />详情</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model:open="modalOpen" title="办理任务" :confirm-loading="completeLoading" ok-text="提交" cancel-text="取消" @ok="submitComplete">
      <a-form layout="vertical">
        <a-form-item label="审批结果">
          <a-segmented v-model:value="approvalAction" :options="approvalOptions" />
        </a-form-item>
        <a-form-item v-if="taskDetail?.formSchema" label="绑定表单">
          <a-alert
            :message="`${taskDetail.formSchema.formName} v${taskDetail.formSchema.version}`"
            description="提交后写入任务记录。"
            type="info"
            show-icon
          />
        </a-form-item>
        <SchemaForm
          v-if="taskDetail?.formSchema"
          v-model="formDataValues"
          :schema-json="taskDetail.formSchema.schemaJson"
        />
        <a-form-item label="审批意见">
          <a-input v-model:value="comment" />
        </a-form-item>
        <a-collapse ghost>
          <a-collapse-panel key="advanced" header="更多参数">
            <a-form-item label="表单数据">
              <a-textarea v-model:value="completeFormData" :rows="4" />
            </a-form-item>
            <a-form-item label="流程变量">
              <a-textarea v-model:value="completeVariables" :rows="4" />
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import { EyeOutlined, FormOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import SchemaForm from '../components/SchemaForm.vue'
import {
  completeTask,
  getTaskDetail,
  listDoneTasks,
  listStartedInstances,
  listTasks,
  type JsonRecord,
  type OpsProcessInstance,
  type TaskDetail,
  type TaskListParams,
  type TaskItem
} from '../api/koravo'
import { CopyableText, EmptyState, PageContainer, PageHeader, SearchBar, StatusTag, Toolbar } from '../components/ui'
import { formatDateTime } from '../utils/format'
import { shortTraceLabel, taskDefinitionLabel } from '../utils/display'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const router = useRouter()
const loading = ref(false)
const activeTab = ref('pending')
const tasks = ref<TaskItem[]>([])
const doneTasks = ref<TaskItem[]>([])
const startedInstances = ref<OpsProcessInstance[]>([])
const filters = reactive({
  keyword: '',
  status: '',
  startDate: '',
  endDate: ''
})
const pendingPage = ref(1)
const pendingPageSize = ref(20)
const pendingTotal = ref(0)
const donePage = ref(1)
const donePageSize = ref(20)
const doneTotal = ref(0)
const startedPage = ref(1)
const startedPageSize = ref(20)
const startedTotal = ref(0)
const modalOpen = ref(false)
const selectedTask = ref<TaskItem | null>(null)
const taskDetail = ref<TaskDetail | null>(null)
const completeLoading = ref(false)
const completeVariables = ref(JSON.stringify({ approved: true, comment: 'approved' }, null, 2))
const completeFormData = ref('{}')
const formDataValues = ref<JsonRecord>({})
const comment = ref('同意')
const approvalAction = ref('同意')
const approvalOptions = ['同意', '拒绝', '提交']

const columns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '业务编号', dataIndex: 'businessKey', key: 'businessKey' },
  { title: '任务节点', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '处理人', dataIndex: 'assignee', key: 'assignee' },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
  { title: '操作', key: 'action', width: 180 }
]

const doneColumns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '业务编号', dataIndex: 'businessKey', key: 'businessKey' },
  { title: '任务节点', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '处理人', dataIndex: 'assignee', key: 'assignee' },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
  { title: '操作', key: 'action', width: 120 }
]

const startedColumns = [
  { title: '实例', dataIndex: 'instanceId', key: 'instanceId', width: 150 },
  { title: '业务编号', dataIndex: 'businessKey', key: 'businessKey' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '发起时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime' },
  { title: '操作', key: 'action', width: 120 }
]

const pendingPagination = computed<TablePaginationConfig>(() => ({
  current: pendingPage.value,
  pageSize: pendingPageSize.value,
  total: pendingTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个待办`
}))

const donePagination = computed<TablePaginationConfig>(() => ({
  current: donePage.value,
  pageSize: donePageSize.value,
  total: doneTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个已办`
}))

const startedPagination = computed<TablePaginationConfig>(() => ({
  current: startedPage.value,
  pageSize: startedPageSize.value,
  total: startedTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个我发起的实例`
}))

watch(formDataValues, (value) => {
  completeFormData.value = JSON.stringify(value || {}, null, 2)
}, { deep: true })

watch(approvalAction, (value) => {
  const approved = value !== '拒绝'
  completeVariables.value = JSON.stringify({ approved, approvalAction: value }, null, 2)
  comment.value = value
})

async function load() {
  if (!validateDateRange()) return
  loading.value = true
  try {
    if (activeTab.value === 'done') {
      const page = await listDoneTasks(buildTaskParams(donePage.value, donePageSize.value))
      doneTasks.value = page.items
      doneTotal.value = page.total
      donePage.value = page.page
      donePageSize.value = page.pageSize
    } else if (activeTab.value === 'started') {
      const page = await listStartedInstances(buildTaskParams(startedPage.value, startedPageSize.value))
      startedInstances.value = page.items
      startedTotal.value = page.total
      startedPage.value = page.page
      startedPageSize.value = page.pageSize
    } else {
      const page = await listTasks(buildTaskParams(pendingPage.value, pendingPageSize.value))
      tasks.value = page.items
      pendingTotal.value = page.total
      pendingPage.value = page.page
      pendingPageSize.value = page.pageSize
    }
  } finally {
    loading.value = false
  }
}

function buildTaskParams(page: number, pageSize: number): TaskListParams {
  return {
    page,
    pageSize,
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    startTime: toStartTime(filters.startDate),
    endTime: toEndTime(filters.endDate)
  }
}

function applyFilters() {
  if (!validateDateRange()) return
  resetActivePage()
  load()
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.startDate = ''
  filters.endDate = ''
  resetActivePage()
  load()
}

function handleTabChange() {
  resetActivePage()
  load()
}

function resetActivePage() {
  if (activeTab.value === 'done') {
    donePage.value = 1
  } else if (activeTab.value === 'started') {
    startedPage.value = 1
  } else {
    pendingPage.value = 1
  }
}

function validateDateRange() {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    message.error('开始日期不能晚于结束日期')
    return false
  }
  return true
}

function toStartTime(value: string) {
  return toIsoTime(value, 'T00:00:00')
}

function toEndTime(value: string) {
  return toIsoTime(value, 'T23:59:59.999')
}

function toIsoTime(value: string, suffix: string) {
  if (!value) return undefined
  const date = new Date(`${value}${suffix}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function handlePendingTableChange(nextPagination: TablePaginationConfig) {
  pendingPage.value = nextPagination.current || 1
  pendingPageSize.value = nextPagination.pageSize || 20
  load()
}

function handleDoneTableChange(nextPagination: TablePaginationConfig) {
  donePage.value = nextPagination.current || 1
  donePageSize.value = nextPagination.pageSize || 20
  load()
}

function handleStartedTableChange(nextPagination: TablePaginationConfig) {
  startedPage.value = nextPagination.current || 1
  startedPageSize.value = nextPagination.pageSize || 20
  load()
}

async function openComplete(task: TaskItem) {
  selectedTask.value = task
  taskDetail.value = null
  completeFormData.value = '{}'
  formDataValues.value = {}
  approvalAction.value = '同意'
  completeVariables.value = JSON.stringify({ approved: true, approvalAction: '同意' }, null, 2)
  comment.value = '同意'
  modalOpen.value = true
  completeLoading.value = true
  try {
    taskDetail.value = await getTaskDetail(task.taskId)
    initializeFormDataValues()
  } finally {
    completeLoading.value = false
  }
}

function initializeFormDataValues() {
  const next: JsonRecord = {
    applicant: String(taskDetail.value?.processVariables.applicant || ''),
    leaveType: String(taskDetail.value?.processVariables.leaveType || '年假'),
    startDate: String(taskDetail.value?.processVariables.startDate || ''),
    endDate: String(taskDetail.value?.processVariables.endDate || ''),
    days: Number(taskDetail.value?.processVariables.days || 1),
    reason: String(taskDetail.value?.processVariables.reason || ''),
    attachmentNote: String(taskDetail.value?.processVariables.attachmentNote || '')
  }
  formDataValues.value = next
  completeFormData.value = JSON.stringify(next, null, 2)
}

async function submitComplete() {
  if (!selectedTask.value) return
  completeLoading.value = true
  try {
    const variables = parseJsonObject(completeVariables.value, '流程变量')
    const formData = parseJsonObject(completeFormData.value, '表单数据')
    await completeTask(selectedTask.value.taskId, {
      variables,
      formData,
      formSchemaId: taskDetail.value?.formSchema?.id,
      comment: comment.value
    })
    message.success('任务已完成')
    modalOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
  } finally {
    completeLoading.value = false
  }
}

onMounted(load)
</script>
