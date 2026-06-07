<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Tasks</h1>
        <p>Query current user's pending tasks, inspect bindings, and complete approvals.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-tabs v-model:activeKey="activeTab" @change="load">
      <a-tab-pane key="pending" tab="Pending">
        <a-table
          :data-source="tasks"
          :columns="columns"
          row-key="taskId"
          :loading="loading && activeTab === 'pending'"
          :pagination="pendingPagination"
          @change="handlePendingTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)">Detail</a-button>
                <a-button size="small" type="primary" @click="openComplete(record)">Complete</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="done" tab="Done">
        <a-table
          :data-source="doneTasks"
          :columns="doneColumns"
          row-key="taskId"
          :loading="loading && activeTab === 'done'"
          :pagination="donePagination"
          @change="handleDoneTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)">Detail</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="started" tab="Started">
        <a-table
          :data-source="startedInstances"
          :columns="startedColumns"
          row-key="instanceId"
          :loading="loading && activeTab === 'started'"
          :pagination="startedPagination"
          @change="handleStartedTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)">Detail</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model:open="modalOpen" title="Complete task" @ok="submitComplete">
      <a-form layout="vertical">
        <a-form-item label="Variables JSON">
          <a-textarea v-model:value="completeVariables" :rows="5" />
        </a-form-item>
        <a-form-item label="Form data JSON">
          <a-textarea v-model:value="completeFormData" :rows="5" />
        </a-form-item>
        <a-form-item label="Comment">
          <a-input v-model:value="comment" />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import {
  completeTask,
  listDoneTasks,
  listStartedInstances,
  listTasks,
  type OpsProcessInstance,
  type TaskItem
} from '../api/koravo'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const router = useRouter()
const loading = ref(false)
const activeTab = ref('pending')
const tasks = ref<TaskItem[]>([])
const doneTasks = ref<TaskItem[]>([])
const startedInstances = ref<OpsProcessInstance[]>([])
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
const completeVariables = ref(JSON.stringify({ approved: true, comment: 'approved' }, null, 2))
const completeFormData = ref('{}')
const comment = ref('approved')

const columns = [
  { title: 'Task', dataIndex: 'name', key: 'name' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Task Key', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: 'Assignee', dataIndex: 'assignee', key: 'assignee' },
  { title: 'Created', dataIndex: 'createTime', key: 'createTime' },
  { title: 'Action', key: 'action', width: 180 }
]

const doneColumns = [
  { title: 'Task', dataIndex: 'name', key: 'name' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Task Key', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey' },
  { title: 'Assignee', dataIndex: 'assignee', key: 'assignee' },
  { title: 'Created', dataIndex: 'createTime', key: 'createTime' },
  { title: 'Action', key: 'action', width: 120 }
]

const startedColumns = [
  { title: 'Instance ID', dataIndex: 'instanceId', key: 'instanceId' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 120 },
  { title: 'Started', dataIndex: 'startTime', key: 'startTime' },
  { title: 'Ended', dataIndex: 'endTime', key: 'endTime' },
  { title: 'Action', key: 'action', width: 120 }
]

const pendingPagination = computed<TablePaginationConfig>(() => ({
  current: pendingPage.value,
  pageSize: pendingPageSize.value,
  total: pendingTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} pending tasks`
}))

const donePagination = computed<TablePaginationConfig>(() => ({
  current: donePage.value,
  pageSize: donePageSize.value,
  total: doneTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} done tasks`
}))

const startedPagination = computed<TablePaginationConfig>(() => ({
  current: startedPage.value,
  pageSize: startedPageSize.value,
  total: startedTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `${count} started instances`
}))

async function load() {
  loading.value = true
  try {
    if (activeTab.value === 'done') {
      const page = await listDoneTasks({
        page: donePage.value,
        pageSize: donePageSize.value
      })
      doneTasks.value = page.items
      doneTotal.value = page.total
      donePage.value = page.page
      donePageSize.value = page.pageSize
    } else if (activeTab.value === 'started') {
      const page = await listStartedInstances({
        page: startedPage.value,
        pageSize: startedPageSize.value
      })
      startedInstances.value = page.items
      startedTotal.value = page.total
      startedPage.value = page.page
      startedPageSize.value = page.pageSize
    } else {
      const page = await listTasks({
        page: pendingPage.value,
        pageSize: pendingPageSize.value
      })
      tasks.value = page.items
      pendingTotal.value = page.total
      pendingPage.value = page.page
      pendingPageSize.value = page.pageSize
    }
  } finally {
    loading.value = false
  }
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

function openComplete(task: TaskItem) {
  selectedTask.value = task
  modalOpen.value = true
}

async function submitComplete() {
  if (!selectedTask.value) return
  try {
    const variables = parseJsonObject(completeVariables.value, 'Variables')
    const formData = parseJsonObject(completeFormData.value, 'Form data')
    await completeTask(selectedTask.value.taskId, { variables, formData, comment: comment.value })
    message.success('Task completed')
    modalOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
  }
}

onMounted(load)
</script>
