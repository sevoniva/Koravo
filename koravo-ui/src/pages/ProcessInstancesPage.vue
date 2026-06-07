<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Process Instances</h1>
        <p>Start process instances and inspect their current state.</p>
      </div>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Process definition key"><a-input v-model:value="processDefinitionKey" /></a-form-item>
      <a-form-item label="Business key"><a-input v-model:value="businessKey" /></a-form-item>
      <a-form-item label="Variables JSON" class="span-2">
        <a-textarea v-model:value="variablesText" :rows="8" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :loading="loading" @click="start"><PlayCircleOutlined />Start</a-button>
      </a-form-item>
    </a-form>

    <JsonPreview :value="instance" />
    <a-button v-if="instance" class="panel-block" @click="router.push(`/process-instances/${instance.instanceId}`)">Detail</a-button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlayCircleOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { startProcessInstance, type ProcessInstance } from '../api/koravo'
import { JsonInputError, parseJsonObject } from '../utils/jsonInput'

const processDefinitionKey = ref('leaveApproval')
const businessKey = ref('LEAVE-001')
const variablesText = ref(JSON.stringify({ applicant: 'u001', approver: 'admin', days: 2 }, null, 2))
const instance = ref<ProcessInstance | null>(null)
const loading = ref(false)
const router = useRouter()

async function start() {
  loading.value = true
  try {
    const variables = parseJsonObject(variablesText.value, 'Variables')
    instance.value = await startProcessInstance({ processDefinitionKey: processDefinitionKey.value, businessKey: businessKey.value, variables })
    message.success('Process started')
  } catch (error) {
    if (error instanceof JsonInputError) {
      message.error(error.message)
    }
  } finally {
    loading.value = false
  }
}
</script>
