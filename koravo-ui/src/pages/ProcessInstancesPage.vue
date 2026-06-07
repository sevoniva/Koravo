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
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlayCircleOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { startProcessInstance, type ProcessInstance } from '../api/koravo'

const processDefinitionKey = ref('leaveApproval')
const businessKey = ref('LEAVE-001')
const variablesText = ref(JSON.stringify({ applicant: 'u001', approver: 'admin', days: 2 }, null, 2))
const instance = ref<ProcessInstance | null>(null)
const loading = ref(false)

async function start() {
  loading.value = true
  try {
    const variables = JSON.parse(variablesText.value)
    instance.value = await startProcessInstance({ processDefinitionKey: processDefinitionKey.value, businessKey: businessKey.value, variables })
    message.success('Process started')
  } catch (error) {
    if (error instanceof SyntaxError) {
      message.error('Variables must be valid JSON')
    }
  } finally {
    loading.value = false
  }
}
</script>
