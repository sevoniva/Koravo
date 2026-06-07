<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Task Detail</h1>
        <p>{{ detail?.task.name || taskId }}</p>
      </div>
      <a-button :loading="loading" @click="load"><ReloadOutlined />Reload</a-button>
    </div>

    <a-descriptions v-if="detail" bordered :column="2" class="panel-block">
      <a-descriptions-item label="Task ID">{{ detail.task.taskId }}</a-descriptions-item>
      <a-descriptions-item label="Task Key">{{ detail.task.taskDefinitionKey }}</a-descriptions-item>
      <a-descriptions-item label="Business Key">{{ detail.task.businessKey }}</a-descriptions-item>
      <a-descriptions-item label="Assignee">{{ detail.task.assignee }}</a-descriptions-item>
      <a-descriptions-item label="Process Instance">{{ detail.task.processInstanceId }}</a-descriptions-item>
      <a-descriptions-item label="Process Definition">{{ detail.task.processDefinitionId }}</a-descriptions-item>
    </a-descriptions>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Variables JSON" class="span-2">
        <a-textarea v-model:value="variablesJson" :rows="5" />
      </a-form-item>
      <a-form-item label="Form data JSON" class="span-2">
        <a-textarea v-model:value="formDataJson" :rows="6" />
      </a-form-item>
      <a-form-item label="Comment" class="span-2">
        <a-input v-model:value="comment" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :loading="submitting" @click="submit"><CheckCircleOutlined />Complete</a-button>
      </a-form-item>
    </a-form>

    <JsonPreview :value="detail" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { completeTask, getTaskDetail, type JsonRecord, type TaskDetail } from '../api/koravo'

const route = useRoute()
const router = useRouter()
const taskId = computed(() => String(route.params.taskId))
const loading = ref(false)
const submitting = ref(false)
const detail = ref<TaskDetail | null>(null)
const variablesJson = ref(JSON.stringify({ approved: true }, null, 2))
const formDataJson = ref('{}')
const comment = ref('approved')

async function load() {
  loading.value = true
  try {
    detail.value = await getTaskDetail(taskId.value)
  } finally {
    loading.value = false
  }
}

async function submit() {
  submitting.value = true
  try {
    const variables = JSON.parse(variablesJson.value) as JsonRecord
    const formData = JSON.parse(formDataJson.value) as JsonRecord
    await completeTask(taskId.value, {
      variables,
      formData,
      formSchemaId: detail.value?.formSchema?.id,
      comment: comment.value
    })
    message.success('Task completed')
    router.push('/tasks')
  } catch (error) {
    if (error instanceof SyntaxError) {
      message.error('JSON input is invalid')
    }
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>
