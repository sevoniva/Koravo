<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Tasks</h1>
        <p>Query current user's pending tasks and complete them with variables.</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-table :data-source="tasks" :columns="columns" row-key="taskId" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button size="small" type="primary" @click="openComplete(record)">Complete</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalOpen" title="Complete task" @ok="submitComplete">
      <a-textarea v-model:value="completeVariables" :rows="8" />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { completeTask, listTasks, type TaskItem } from '../api/koravo'

const loading = ref(false)
const tasks = ref<TaskItem[]>([])
const modalOpen = ref(false)
const selectedTask = ref<TaskItem | null>(null)
const completeVariables = ref(JSON.stringify({ approved: true, comment: 'approved' }, null, 2))

const columns = [
  { title: 'Task', dataIndex: 'name', key: 'name' },
  { title: 'Business Key', dataIndex: 'businessKey', key: 'businessKey' },
  { title: 'Assignee', dataIndex: 'assignee', key: 'assignee' },
  { title: 'Created', dataIndex: 'createTime', key: 'createTime' },
  { title: 'Action', key: 'action', width: 120 }
]

async function load() {
  loading.value = true
  try {
    const page = await listTasks()
    tasks.value = page.items
  } finally {
    loading.value = false
  }
}

function openComplete(task: TaskItem) {
  selectedTask.value = task
  modalOpen.value = true
}

async function submitComplete() {
  if (!selectedTask.value) return
  try {
    const variables = JSON.parse(completeVariables.value)
    await completeTask(selectedTask.value.taskId, variables)
    message.success('Task completed')
    modalOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof SyntaxError) {
      message.error('Variables must be valid JSON')
    }
  }
}

onMounted(load)
</script>
