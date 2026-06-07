<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <h1>Process Models</h1>
        <p>Deploy BPMN XML into Flowable through Koravo model metadata.</p>
      </div>
      <a-button type="primary" @click="router.push('/process-designer')"><EditOutlined />Open Designer</a-button>
    </div>

    <a-form layout="vertical" class="form-grid">
      <a-form-item label="Model name">
        <a-input v-model:value="modelName" placeholder="Leave Approval" />
      </a-form-item>
      <a-form-item label="BPMN file">
        <a-upload :before-upload="beforeUpload" :max-count="1" accept=".xml,.bpmn,.bpmn20.xml">
          <a-button><UploadOutlined />Select BPMN</a-button>
        </a-upload>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" :disabled="!file" :loading="loading" @click="deploy"><UploadOutlined />Deploy</a-button>
      </a-form-item>
    </a-form>

    <JsonPreview :value="deployment" />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { EditOutlined, UploadOutlined } from '@ant-design/icons-vue'
import JsonPreview from '../components/JsonPreview.vue'
import { deployProcessModel, type ProcessDeployment } from '../api/koravo'

const modelName = ref('Leave Approval')
const router = useRouter()
const file = ref<File | null>(null)
const loading = ref(false)
const deployment = ref<ProcessDeployment | null>(null)

function beforeUpload(nextFile: File) {
  file.value = nextFile
  return false
}

async function deploy() {
  if (!file.value) {
    message.warning('Select a BPMN file first')
    return
  }
  loading.value = true
  try {
    deployment.value = await deployProcessModel(modelName.value, file.value)
    message.success('Process deployed')
  } finally {
    loading.value = false
  }
}
</script>
