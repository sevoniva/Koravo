<template>
  <span class="copyable-text">
    <code>{{ value || '-' }}</code>
    <a-tooltip title="复制">
      <a-button size="small" type="text" @click="copy"><CopyOutlined /></a-button>
    </a-tooltip>
  </span>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { copyText } from '../../utils/format'

const props = defineProps<{ value?: string | number | null }>()

async function copy() {
  if (await copyText(props.value)) {
    message.success('已复制')
  }
}
</script>
