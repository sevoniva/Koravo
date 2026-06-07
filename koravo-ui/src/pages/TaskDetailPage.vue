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

    <a-tabs v-if="detail" class="panel-block">
      <a-tab-pane key="processVariables" tab="Process Variables">
        <JsonPreview :value="detail.processVariables" />
      </a-tab-pane>
      <a-tab-pane key="taskVariables" tab="Task Variables">
        <JsonPreview :value="detail.taskVariables" />
      </a-tab-pane>
      <a-tab-pane key="comments" tab="Comments">
        <a-table :data-source="detail.comments" :columns="commentColumns" row-key="id" :pagination="false" size="small" />
      </a-tab-pane>
      <a-tab-pane key="snapshots" tab="Form Snapshots">
        <a-table :data-source="detail.formSnapshots" :columns="snapshotColumns" row-key="id" :pagination="false" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'dataJson'">
              <code>{{ record.dataJson }}</code>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="auditLogs" tab="Audit Logs">
        <a-table :data-source="detail.auditLogs" :columns="auditColumns" row-key="id" :pagination="false" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'detailJson'">
              <code>{{ record.detailJson }}</code>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Variables JSON" class="span-2">
        <a-textarea v-model:value="variablesJson" :rows="5" />
      </a-form-item>
      <a-form-item v-if="detail?.formSchema" label="Bound form" class="span-2">
        <a-alert
          :message="`${detail.formSchema.formName} v${detail.formSchema.version}`"
          :description="`Form key: ${detail.formSchema.formKey}`"
          type="info"
          show-icon
        />
      </a-form-item>
      <template v-if="schemaFields.length">
        <a-form-item
          v-for="field in schemaFields"
          :key="field.key"
          :label="field.label"
          :required="field.required"
        >
          <a-switch
            v-if="field.type === 'boolean'"
            v-model:checked="formDataValues[field.key]"
            @change="syncFormDataJson"
          />
          <a-input-number
            v-else-if="field.type === 'number' || field.type === 'integer'"
            v-model:value="formDataValues[field.key]"
            :precision="field.type === 'integer' ? 0 : undefined"
            style="width: 100%"
            @change="syncFormDataJson"
          />
          <a-input
            v-else
            v-model:value="formDataValues[field.key]"
            @change="syncFormDataJson"
          />
        </a-form-item>
      </template>
      <a-form-item :label="schemaFields.length ? 'Raw form data JSON' : 'Form data JSON'" class="span-2">
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
import { computed, onMounted, ref, watch } from 'vue'
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
const formDataValues = ref<JsonRecord>({})
const comment = ref('approved')

type SchemaField = {
  key: string
  label: string
  type: 'string' | 'number' | 'integer' | 'boolean'
  required: boolean
}

const commentColumns = [
  { title: 'User', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: 'Message', dataIndex: 'message', key: 'message' },
  { title: 'Time', dataIndex: 'time', key: 'time', width: 220 }
]

const snapshotColumns = [
  { title: 'Task ID', dataIndex: 'taskId', key: 'taskId', width: 180 },
  { title: 'Form Schema', dataIndex: 'formSchemaId', key: 'formSchemaId', width: 180 },
  { title: 'Data', dataIndex: 'dataJson', key: 'dataJson' },
  { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 220 }
]

const auditColumns = [
  { title: 'Action', dataIndex: 'action', key: 'action', width: 190 },
  { title: 'User', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: 'Request ID', dataIndex: 'requestId', key: 'requestId', width: 180 },
  { title: 'Detail', dataIndex: 'detailJson', key: 'detailJson' },
  { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 220 }
]

const schemaFields = computed<SchemaField[]>(() => {
  const schemaJson = detail.value?.formSchema?.schemaJson
  if (!schemaJson) return []
  try {
    const schema = JSON.parse(schemaJson) as {
      required?: string[]
      properties?: Record<string, { type?: string; title?: string }>
    }
    const required = new Set(schema.required || [])
    return Object.entries(schema.properties || {})
      .filter(([, property]) => ['string', 'number', 'integer', 'boolean'].includes(property.type || 'string'))
      .map(([key, property]) => ({
        key,
        label: property.title || key,
        type: (property.type || 'string') as SchemaField['type'],
        required: required.has(key)
      }))
  } catch {
    return []
  }
})

watch(schemaFields, initializeFormDataValues)

async function load() {
  loading.value = true
  try {
    detail.value = await getTaskDetail(taskId.value)
  } finally {
    loading.value = false
  }
}

function initializeFormDataValues() {
  const next: JsonRecord = {}
  for (const field of schemaFields.value) {
    next[field.key] = field.type === 'boolean' ? false : undefined
  }
  formDataValues.value = next
  if (schemaFields.value.length) {
    syncFormDataJson()
  }
}

function syncFormDataJson() {
  const data = Object.fromEntries(
    Object.entries(formDataValues.value).filter(([, value]) => value !== undefined && value !== '')
  )
  formDataJson.value = JSON.stringify(data, null, 2)
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
