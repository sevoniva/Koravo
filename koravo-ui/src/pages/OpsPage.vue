<template>
  <PageContainer wide>
    <PageHeader title="运维中心" description="查看实例、连接器日志、失败任务和异常摘要。">
      <template #actions>
      <a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button>
      </template>
    </PageHeader>

    <a-tabs v-model:activeKey="activeTab" @change="load">
      <a-tab-pane key="instances" tab="流程实例">
        <a-table
          :data-source="instances"
          :columns="columns"
          row-key="instanceId"
          :loading="loading"
          :pagination="instancePagination"
          @change="handleInstanceTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无流程实例" />
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
            <template v-else-if="column.key === 'action'">
              <a-space wrap>
                <a-button size="small" @click="inspect(record.instanceId)">实例详情</a-button>
                <a-button size="small" type="primary" @click="trace(record.instanceId)">流程追踪</a-button>
                <a-button size="small" @click="router.push(`/process-instances/${record.instanceId}`)">打开详情页</a-button>
                <a-button
                  v-if="record.status === 'RUNNING'"
                  size="small"
                  :loading="actionLoading === `suspend:${record.instanceId}`"
                  @click="suspend(record.instanceId)"
                >
                  挂起
                </a-button>
                <a-button
                  v-if="record.status === 'SUSPENDED'"
                  size="small"
                  :loading="actionLoading === `activate:${record.instanceId}`"
                  @click="activate(record.instanceId)"
                >
                  激活
                </a-button>
                <a-popconfirm
                  v-if="record.status !== 'COMPLETED'"
                  title="确认终止该流程实例？"
                  ok-text="终止"
                  cancel-text="取消"
                  @confirm="terminate(record.instanceId)"
                >
                  <a-button size="small" danger :loading="actionLoading === `terminate:${record.instanceId}`">终止</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="connectors" tab="连接器日志">
        <div class="metric-grid panel-block">
          <a-card title="调用总数"><strong>{{ connectorSummary?.total ?? 0 }}</strong><span>当前租户连接器调用</span></a-card>
          <a-card title="成功"><strong>{{ connectorSummary?.success ?? 0 }}</strong><span>已完成调用</span></a-card>
          <a-card title="失败"><strong>{{ connectorSummary?.failed ?? 0 }}</strong><span>异常调用</span></a-card>
        </div>

        <a-form layout="vertical" class="form-grid">
          <a-form-item label="连接器类型">
            <a-input v-model:value="connectorFilters.connectorType" placeholder="http" />
          </a-form-item>
          <a-form-item label="状态">
            <a-select v-model:value="connectorFilters.status" allow-clear>
              <a-select-option value="SUCCESS">成功</a-select-option>
              <a-select-option value="FAILED">失败</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="请求">
            <a-input v-model:value="connectorFilters.requestId" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="connectorLoading" @click="searchConnectorLogs">查询</a-button>
          </a-form-item>
        </a-form>

        <a-table
          :data-source="connectorLogs"
          :columns="connectorColumns"
          row-key="id"
          :loading="connectorLoading"
          :pagination="connectorPagination"
          size="small"
          @change="handleConnectorTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无连接器日志" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'connectorType'">
              {{ connectorTypeLabel(record.connectorType) }}
            </template>
            <template v-else-if="column.key === 'status'">
              <StatusTag :status="record.status" />
            </template>
            <template v-else-if="column.key === 'elapsedMillis'">
              {{ formatDuration(record.elapsedMillis) }}
            </template>
            <template v-else-if="column.key === 'requestId'">
              <CopyableText :value="record.requestId" :display-value="shortTraceLabel(record.requestId)" />
            </template>
            <template v-else-if="column.key === 'summary'">
              <span class="ops-summary-text">{{ connectorLogSummary(record) }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="openConnectorDetail(record)">查看</a-button>
            </template>
          </template>
        </a-table>

        <a-table
          v-if="connectorSummary?.recentFailures?.length"
          class="panel-block"
          :data-source="connectorSummary.recentFailures"
          :columns="connectorFailureColumns"
          row-key="id"
          :pagination="false"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'error'">
              <span class="ops-summary-text">{{ maskText(record.errorMessage) }}</span>
            </template>
            <template v-else-if="column.key === 'connectorType'">
              {{ connectorTypeLabel(record.connectorType) }}
            </template>
            <template v-else-if="column.key === 'requestId'">
              <CopyableText :value="record.requestId" :display-value="shortTraceLabel(record.requestId)" />
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" @click="openConnectorDetail(record)">查看</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="failed" tab="失败任务">
        <div class="metric-grid panel-block">
          <a-card title="失败任务"><strong>{{ opsSummary?.failedJobCount ?? 0 }}</strong><span>待处理异常</span></a-card>
          <a-card title="运行中实例"><strong>{{ opsSummary?.runningInstanceCount ?? 0 }}</strong><span>当前租户</span></a-card>
        </div>
        <a-table
          class="panel-block"
          :data-source="failedJobs"
          :columns="jobColumns"
          row-key="id"
          :loading="failedJobLoading"
          :pagination="failedJobPagination"
          size="small"
          @change="handleFailedJobTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无失败任务" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag color="red">失败</a-tag>
            </template>
            <template v-else-if="column.key === 'id'">
              <CopyableText :value="record.id" :display-value="shortTraceLabel(record.id)" />
            </template>
            <template v-else-if="column.key === 'processInstanceId'">
              <CopyableText :value="record.processInstanceId" :display-value="shortTraceLabel(record.processInstanceId)" />
            </template>
            <template v-else-if="column.key === 'created'">
              {{ formatDateTime(record.createTime) }}
            </template>
            <template v-else-if="column.key === 'exception'">
              <span class="ops-summary-text">{{ maskText(record.exceptionMessage) || '-' }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space wrap>
                <a-button size="small" @click="openJobDetail('failed', record.id)">查看</a-button>
                <a-button
                  v-if="record.processInstanceId"
                  size="small"
                  @click="router.push(`/process-instances/${record.processInstanceId}`)"
                >
                  流程详情
                </a-button>
                <a-popconfirm
                  title="确认重试该失败任务？"
                  ok-text="重试"
                  cancel-text="取消"
                  @confirm="retryJob('failed', record.id)"
                >
                  <a-button size="small" type="primary" :loading="jobActionLoading === `failed:retry:${record.id}`">重试</a-button>
                </a-popconfirm>
                <a-popconfirm
                  title="确认删除该失败任务？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="removeJob('failed', record.id)"
                >
                  <a-button size="small" danger :loading="jobActionLoading === `failed:delete:${record.id}`">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="dead-letter" tab="死信任务">
        <div class="metric-grid panel-block">
          <a-card title="死信任务"><strong>{{ opsSummary?.deadLetterJobCount ?? 0 }}</strong><span>需人工处理</span></a-card>
          <a-card title="连接器失败"><strong>{{ opsSummary?.connectorFailureCount ?? 0 }}</strong><span>连接器日志</span></a-card>
        </div>
        <a-table
          class="panel-block"
          :data-source="deadLetterJobs"
          :columns="jobColumns"
          row-key="id"
          :loading="deadLetterJobLoading"
          :pagination="deadLetterJobPagination"
          size="small"
          @change="handleDeadLetterJobTableChange"
        >
          <template #emptyText>
            <EmptyState description="暂无死信任务" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag color="red">死信</a-tag>
            </template>
            <template v-else-if="column.key === 'id'">
              <CopyableText :value="record.id" :display-value="shortTraceLabel(record.id)" />
            </template>
            <template v-else-if="column.key === 'processInstanceId'">
              <CopyableText :value="record.processInstanceId" :display-value="shortTraceLabel(record.processInstanceId)" />
            </template>
            <template v-else-if="column.key === 'created'">
              {{ formatDateTime(record.createTime) }}
            </template>
            <template v-else-if="column.key === 'exception'">
              <span class="ops-summary-text">{{ maskText(record.exceptionMessage) || '-' }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space wrap>
                <a-button size="small" @click="openJobDetail('dead-letter', record.id)">查看</a-button>
                <a-button
                  v-if="record.processInstanceId"
                  size="small"
                  @click="router.push(`/process-instances/${record.processInstanceId}`)"
                >
                  流程详情
                </a-button>
                <a-popconfirm
                  title="确认重试该死信任务？"
                  ok-text="重试"
                  cancel-text="取消"
                  @confirm="retryJob('dead-letter', record.id)"
                >
                  <a-button size="small" type="primary" :loading="jobActionLoading === `dead-letter:retry:${record.id}`">重试</a-button>
                </a-popconfirm>
                <a-popconfirm
                  title="确认删除该死信任务？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="removeJob('dead-letter', record.id)"
                >
                  <a-button size="small" danger :loading="jobActionLoading === `dead-letter:delete:${record.id}`">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="exceptions" tab="异常摘要">
        <div class="metric-grid panel-block">
          <a-card title="失败任务"><strong>{{ opsSummary?.failedJobCount ?? 0 }}</strong><span>待处理异常</span></a-card>
          <a-card title="死信任务"><strong>{{ opsSummary?.deadLetterJobCount ?? 0 }}</strong><span>需人工处理</span></a-card>
          <a-card title="连接器失败"><strong>{{ opsSummary?.connectorFailureCount ?? 0 }}</strong><span>当前租户</span></a-card>
        </div>
        <a-table
          class="panel-block"
          :data-source="opsSummary?.exceptions || []"
          :columns="summaryColumns"
          row-key="key"
          :pagination="false"
          size="small"
        >
          <template #emptyText>
            <EmptyState description="暂无异常摘要" />
          </template>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="capabilities" tab="能力清单">
        <a-table
          :data-source="capabilities"
          :columns="capabilityColumns"
          row-key="key"
          :loading="capabilityLoading"
          :pagination="false"
          size="small"
        >
          <template #emptyText>
            <EmptyState description="暂无能力清单" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'AVAILABLE' ? 'green' : 'orange'">{{ record.status }}</a-tag>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <div v-if="traceDetail" class="trace-viewer-panel panel-block">
      <div class="trace-viewer-heading">
        <strong>流程追踪</strong>
        <a-space>
          <span><i class="trace-dot trace-dot-completed" />已完成</span>
          <span><i class="trace-dot trace-dot-current" />当前</span>
        </a-space>
      </div>
      <div ref="traceCanvasRef" class="trace-viewer-canvas" />
    </div>

    <a-table
      v-if="traceDetail"
      class="panel-block"
      :data-source="traceDetail.timeline"
      :columns="traceColumns"
      row-key="activityId"
      :pagination="false"
      size="small"
    />

    <DetailSection v-if="inspectedInstance" title="实例详情">
      <a-descriptions bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="实例">
          <CopyableText :value="inspectedInstance.instanceId" :display-value="shortTraceLabel(inspectedInstance.instanceId)" />
        </a-descriptions-item>
        <a-descriptions-item label="实例状态"><StatusTag :status="inspectedInstance.status" /></a-descriptions-item>
        <a-descriptions-item label="业务编号">{{ inspectedInstance.businessKey || '-' }}</a-descriptions-item>
        <a-descriptions-item label="发起人">{{ inspectedInstance.startUserId || '-' }}</a-descriptions-item>
        <a-descriptions-item label="流程">
          <CopyableText :value="inspectedInstance.processDefinitionId" :display-value="processDefinitionLabel(inspectedInstance.processDefinitionId)" />
        </a-descriptions-item>
        <a-descriptions-item label="当前任务">{{ inspectedInstance.currentTasks?.length || 0 }}</a-descriptions-item>
        <a-descriptions-item label="发起时间">{{ formatDateTime(inspectedInstance.startTime) }}</a-descriptions-item>
        <a-descriptions-item label="结束时间">{{ formatDateTime(inspectedInstance.endTime) }}</a-descriptions-item>
      </a-descriptions>

      <a-tabs class="panel-block">
        <a-tab-pane key="tasks" tab="当前任务">
          <a-table
            :data-source="inspectedInstance.currentTasks || []"
            :columns="inspectedTaskColumns"
            row-key="taskId"
            :pagination="false"
            size="small"
          >
            <template #emptyText>
              <EmptyState description="暂无当前任务" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <StatusTag :status="record.status" />
              </template>
              <template v-else-if="column.key === 'taskDefinitionKey'">
                {{ detailValueLabel(record.taskDefinitionKey) }}
              </template>
              <template v-else-if="column.key === 'createTime'">
                {{ formatDateTime(record.createTime) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button size="small" @click="router.push(`/tasks/${record.taskId}`)">详情</a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="auditLogs" tab="审计摘要">
          <a-table
            :data-source="inspectedInstance.auditLogs || []"
            :columns="inspectedAuditColumns"
            row-key="id"
            :pagination="false"
            size="small"
          >
            <template #emptyText>
              <EmptyState description="暂无审计记录" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'auditAction'">
                {{ auditActionLabel(record.action) }}
              </template>
              <template v-else-if="column.key === 'summary'">
                <span class="ops-summary-text">{{ auditDetailSummary(record.detailJson, record.action) }}</span>
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatDateTime(record.createdAt) }}
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>

      <a-collapse class="panel-block">
        <a-collapse-panel key="raw" header="高级详情">
          <JsonPreview :value="maskedInspectedInstance" />
        </a-collapse-panel>
      </a-collapse>
    </DetailSection>

    <a-modal v-model:open="connectorDetailOpen" title="连接器执行详情" :footer="null" width="860px">
      <a-descriptions v-if="selectedConnectorLog" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="时间">{{ formatDateTime(selectedConnectorLog.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ connectorTypeLabel(selectedConnectorLog.connectorType) }}</a-descriptions-item>
        <a-descriptions-item label="方法">{{ selectedConnectorLog.method }}</a-descriptions-item>
        <a-descriptions-item label="状态"><StatusTag :status="selectedConnectorLog.status" /></a-descriptions-item>
        <a-descriptions-item label="状态码">{{ selectedConnectorLog.statusCode }}</a-descriptions-item>
        <a-descriptions-item label="耗时">{{ formatDuration(selectedConnectorLog.elapsedMillis) }}</a-descriptions-item>
        <a-descriptions-item label="请求">
          <CopyableText :value="selectedConnectorLog.requestId" :display-value="shortTraceLabel(selectedConnectorLog.requestId)" />
        </a-descriptions-item>
        <a-descriptions-item label="URL">{{ selectedConnectorLog.url }}</a-descriptions-item>
      </a-descriptions>
      <a-alert
        v-if="selectedConnectorLog"
        class="panel-block"
        show-icon
        :type="selectedConnectorLog.status === 'SUCCESS' ? 'success' : 'error'"
        :message="connectorDetailTitle"
        :description="connectorDetailDescription"
      />
      <a-collapse v-if="selectedConnectorLog" class="panel-block">
        <a-collapse-panel key="detail" header="高级详情">
          <a-tabs>
            <a-tab-pane key="request" tab="请求摘要">
              <p class="ops-detail-text">{{ maskText(selectedConnectorLog.requestSummary) }}</p>
            </a-tab-pane>
            <a-tab-pane key="response" tab="响应摘要">
              <p class="ops-detail-text">{{ maskText(selectedConnectorLog.responseSummary) }}</p>
            </a-tab-pane>
            <a-tab-pane key="raw" tab="原始日志">
              <JsonPreview :value="maskedSelectedConnectorLog" />
            </a-tab-pane>
          </a-tabs>
        </a-collapse-panel>
      </a-collapse>
    </a-modal>

    <a-modal v-model:open="jobDetailOpen" title="任务异常详情" :footer="null" width="900px">
      <a-descriptions v-if="selectedJob" bordered :column="2" size="small" class="panel-block">
        <a-descriptions-item label="任务">
          <CopyableText :value="selectedJob.id" :display-value="shortTraceLabel(selectedJob.id)" />
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="selectedJob.type === 'DEAD_LETTER' ? 'red' : 'orange'">
            {{ selectedJob.type === 'DEAD_LETTER' ? '死信' : '失败' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="流程实例">
          <CopyableText :value="selectedJob.processInstanceId" :display-value="shortTraceLabel(selectedJob.processInstanceId)" />
        </a-descriptions-item>
        <a-descriptions-item label="流程">
          <CopyableText :value="selectedJob.processDefinitionId" :display-value="processDefinitionLabel(selectedJob.processDefinitionId)" />
        </a-descriptions-item>
        <a-descriptions-item label="节点标识">{{ taskDefinitionLabel(selectedJob.elementId) }}</a-descriptions-item>
        <a-descriptions-item label="节点名称">{{ selectedJob.elementName || '-' }}</a-descriptions-item>
        <a-descriptions-item label="处理器">{{ selectedJob.handlerType || '-' }}</a-descriptions-item>
        <a-descriptions-item label="剩余重试">{{ selectedJob.retries }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ formatDateTime(selectedJob.createTime) }}</a-descriptions-item>
        <a-descriptions-item label="到期时间">{{ formatDateTime(selectedJob.dueDate) }}</a-descriptions-item>
      </a-descriptions>
      <a-alert
        v-if="selectedJob"
        class="panel-block"
        type="error"
        show-icon
        message="异常摘要"
        :description="selectedJobExceptionText"
      />
      <a-collapse v-if="selectedJob" class="panel-block">
        <a-collapse-panel key="stacktrace" header="异常堆栈">
          <pre class="ops-stacktrace">{{ selectedJobStacktraceText }}</pre>
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { message, type TablePaginationConfig } from 'ant-design-vue'
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import JsonPreview from '../components/JsonPreview.vue'
import { CopyableText, DetailSection, EmptyState, PageContainer, PageHeader, StatusTag } from '../components/ui'
import {
  activateProcessInstance,
  deleteDeadLetterJob,
  deleteFailedJob,
  getDeadLetterJob,
  getConnectorExecutionSummary,
  getFailedJob,
  getOpsInstance,
  getOpsSummary,
  getProcessTrace,
  listConnectorExecutionLogs,
  listDeadLetterJobs,
  listFailedJobs,
  listOpsCapabilities,
  listOpsInstances,
  retryDeadLetterJob,
  retryFailedJob,
  suspendProcessInstance,
  terminateProcessInstance,
  type ConnectorExecutionLogItem,
  type ConnectorExecutionSummary,
  type OpsCapabilityItem,
  type OpsJobItem,
  type OpsSummary,
  type OpsProcessInstance,
  type ProcessTrace
} from '../api/koravo'
import { formatDateTime, formatDuration, maskSecret, parseJsonSafe } from '../utils/format'
import { processDefinitionLabel, shortTraceLabel, taskDefinitionLabel } from '../utils/display'

const loading = ref(false)
const router = useRouter()
const route = useRoute()
const instances = ref<OpsProcessInstance[]>([])
const instancePage = ref(1)
const instancePageSize = ref(20)
const instanceTotal = ref(0)
const detail = ref<unknown>(null)
const traceDetail = ref<ProcessTrace | null>(null)
const traceCanvasRef = ref<HTMLElement | null>(null)
const actionLoading = ref<string | null>(null)
const activeTab = ref('instances')
const connectorLoading = ref(false)
const connectorLogs = ref<ConnectorExecutionLogItem[]>([])
const connectorSummary = ref<ConnectorExecutionSummary | null>(null)
const opsSummary = ref<OpsSummary | null>(null)
const connectorDetailOpen = ref(false)
const selectedConnectorLog = ref<ConnectorExecutionLogItem | null>(null)
const capabilities = ref<OpsCapabilityItem[]>([])
const capabilityLoading = ref(false)
const connectorPage = ref(1)
const connectorPageSize = ref(20)
const connectorTotal = ref(0)
const failedJobs = ref<OpsJobItem[]>([])
const deadLetterJobs = ref<OpsJobItem[]>([])
const failedJobLoading = ref(false)
const deadLetterJobLoading = ref(false)
const failedJobPage = ref(1)
const failedJobPageSize = ref(20)
const failedJobTotal = ref(0)
const deadLetterJobPage = ref(1)
const deadLetterJobPageSize = ref(20)
const deadLetterJobTotal = ref(0)
const jobActionLoading = ref<string | null>(null)
const jobDetailOpen = ref(false)
const selectedJob = ref<OpsJobItem | null>(null)
const connectorFilters = ref({
  connectorType: 'http',
  status: undefined as string | undefined,
  requestId: ''
})

const columns = [
  { title: '实例', dataIndex: 'instanceId', key: 'instanceId', width: 150 },
  { title: '业务编号', dataIndex: 'businessKey', key: 'businessKey' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '发起时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '操作', key: 'action', width: 420 }
]

const traceColumns = [
  { title: '活动 ID', dataIndex: 'activityId', key: 'activityId' },
  { title: '名称', dataIndex: 'activityName', key: 'activityName' },
  { title: '类型', dataIndex: 'activityType', key: 'activityType' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime' }
]

const connectorColumns = [
  { title: '时间', key: 'createdAt', width: 160 },
  { title: '类型', dataIndex: 'connectorType', key: 'connectorType', width: 90 },
  { title: '方法', dataIndex: 'method', key: 'method', width: 90 },
  { title: '状态', key: 'status', width: 110 },
  { title: '状态码', dataIndex: 'statusCode', key: 'statusCode', width: 80 },
  { title: '耗时', key: 'elapsedMillis', width: 100 },
  { title: '请求', dataIndex: 'requestId', key: 'requestId', width: 150 },
  { title: 'URL', dataIndex: 'url', key: 'url', width: 260 },
  { title: '摘要', key: 'summary' },
  { title: '操作', key: 'action', width: 90 }
]

const connectorFailureColumns = [
  { title: '时间', key: 'createdAt', width: 160 },
  { title: '类型', dataIndex: 'connectorType', key: 'connectorType', width: 90 },
  { title: 'URL', dataIndex: 'url', key: 'url', width: 260 },
  { title: '请求', dataIndex: 'requestId', key: 'requestId', width: 150 },
  { title: '错误', key: 'error' },
  { title: '操作', key: 'action', width: 90 }
]

const summaryColumns = [
  { title: '类型', dataIndex: 'name', key: 'name', width: 180 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '数量', dataIndex: 'count', key: 'count', width: 100 },
  { title: '说明', dataIndex: 'message', key: 'message' }
]

const jobColumns = [
  { title: '任务', dataIndex: 'id', key: 'id', width: 150 },
  { title: '状态', key: 'status', width: 80 },
  { title: '节点', dataIndex: 'elementName', key: 'elementName', width: 150 },
  { title: '流程实例', dataIndex: 'processInstanceId', key: 'processInstanceId', width: 220 },
  { title: '处理器', dataIndex: 'handlerType', key: 'handlerType', width: 150 },
  { title: '剩余重试', dataIndex: 'retries', key: 'retries', width: 90 },
  { title: '创建时间', key: 'created', width: 170 },
  { title: '异常', key: 'exception' },
  { title: '操作', key: 'action', width: 260 }
]

const capabilityColumns = [
  { title: '能力', dataIndex: 'name', key: 'name', width: 240 },
  { title: '状态', key: 'status', width: 130 },
  { title: '标识', dataIndex: 'key', key: 'key', width: 230 },
  { title: '说明', dataIndex: 'description', key: 'description' }
]

const connectorPagination = computed<TablePaginationConfig>(() => ({
  current: connectorPage.value,
  pageSize: connectorPageSize.value,
  total: connectorTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条连接器日志`
}))

const instancePagination = computed<TablePaginationConfig>(() => ({
  current: instancePage.value,
  pageSize: instancePageSize.value,
  total: instanceTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个流程实例`
}))

const failedJobPagination = computed<TablePaginationConfig>(() => ({
  current: failedJobPage.value,
  pageSize: failedJobPageSize.value,
  total: failedJobTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个失败任务`
}))

const deadLetterJobPagination = computed<TablePaginationConfig>(() => ({
  current: deadLetterJobPage.value,
  pageSize: deadLetterJobPageSize.value,
  total: deadLetterJobTotal.value,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 个死信任务`
}))
const selectedConnectorResponseBody = computed(() => extractResponseBody(selectedConnectorLog.value?.responseSummary))
const selectedConnectorHealthData = computed(() => asRecord(selectedConnectorResponseBody.value?.data) || selectedConnectorResponseBody.value || {})
const maskedSelectedConnectorLog = computed(() => selectedConnectorLog.value ? maskSecret(selectedConnectorLog.value) : {})
const inspectedInstance = computed(() => asOpsInstance(detail.value))
const maskedInspectedInstance = computed(() => {
  if (!inspectedInstance.value) return null
  return {
    ...inspectedInstance.value,
    auditLogs: inspectedInstance.value.auditLogs?.map((item) => ({
      ...item,
      detailJson: maskedAuditDetailText(item.detailJson)
    }))
  }
})
const connectorDetailTitle = computed(() => {
  if (!selectedConnectorLog.value) return ''
  if (selectedConnectorLog.value.errorMessage) return '调用失败'
  if (selectedConnectorLog.value.statusCode) return `HTTP ${selectedConnectorLog.value.statusCode}`
  return statusLabel(selectedConnectorLog.value.status)
})
const connectorDetailDescription = computed(() => {
  if (!selectedConnectorLog.value) return ''
  if (selectedConnectorLog.value.errorMessage) return maskText(selectedConnectorLog.value.errorMessage)
  const status = selectedConnectorHealthData.value.status === 'UP' ? '服务正常' : `服务状态 ${selectedConnectorHealthData.value.status || '-'}`
  const version = selectedConnectorHealthData.value.version ? `版本 ${selectedConnectorHealthData.value.version}` : '未返回版本'
  return `${status}，${version}。`
})
const selectedJobExceptionText = computed(() => selectedJob.value?.exceptionMessage ? maskText(selectedJob.value.exceptionMessage) : '暂无异常摘要')
const selectedJobStacktraceText = computed(() => selectedJob.value?.exceptionStacktrace ? maskText(selectedJob.value.exceptionStacktrace) : '暂无异常堆栈')

const inspectedTaskColumns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '任务节点', dataIndex: 'taskDefinitionKey', key: 'taskDefinitionKey', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '处理人', dataIndex: 'assignee', key: 'assignee', width: 140 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 90 }
]

const inspectedAuditColumns = [
  { title: '动作', dataIndex: 'action', key: 'auditAction', width: 180 },
  { title: '用户', dataIndex: 'userId', key: 'userId', width: 140 },
  { title: '摘要', key: 'summary' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 }
]

let traceViewer: any = null

async function load() {
  loading.value = true
  try {
    if (activeTab.value === 'connectors') {
      await loadConnectorLogs()
    } else if (activeTab.value === 'capabilities') {
      await loadCapabilities()
    } else if (activeTab.value === 'failed') {
      await Promise.all([loadOpsSummary(), loadFailedJobs()])
    } else if (activeTab.value === 'dead-letter') {
      await Promise.all([loadOpsSummary(), loadDeadLetterJobs()])
    } else if (activeTab.value === 'exceptions') {
      await loadOpsSummary()
    } else {
      const page = await listOpsInstances({
        page: instancePage.value,
        pageSize: instancePageSize.value
      })
      instances.value = page.items
      instanceTotal.value = page.total
      instancePage.value = page.page
      instancePageSize.value = page.pageSize
    }
  } finally {
    loading.value = false
  }
}

async function loadCapabilities() {
  capabilityLoading.value = true
  try {
    capabilities.value = await listOpsCapabilities()
  } finally {
    capabilityLoading.value = false
  }
}

async function loadOpsSummary() {
  opsSummary.value = await getOpsSummary()
}

async function loadFailedJobs() {
  failedJobLoading.value = true
  try {
    const page = await listFailedJobs({
      page: failedJobPage.value,
      pageSize: failedJobPageSize.value
    })
    failedJobs.value = page.items
    failedJobTotal.value = page.total
    failedJobPage.value = page.page
    failedJobPageSize.value = page.pageSize
  } finally {
    failedJobLoading.value = false
  }
}

async function loadDeadLetterJobs() {
  deadLetterJobLoading.value = true
  try {
    const page = await listDeadLetterJobs({
      page: deadLetterJobPage.value,
      pageSize: deadLetterJobPageSize.value
    })
    deadLetterJobs.value = page.items
    deadLetterJobTotal.value = page.total
    deadLetterJobPage.value = page.page
    deadLetterJobPageSize.value = page.pageSize
  } finally {
    deadLetterJobLoading.value = false
  }
}

function handleInstanceTableChange(nextPagination: TablePaginationConfig) {
  instancePage.value = nextPagination.current || 1
  instancePageSize.value = nextPagination.pageSize || 20
  load()
}

function handleFailedJobTableChange(nextPagination: TablePaginationConfig) {
  failedJobPage.value = nextPagination.current || 1
  failedJobPageSize.value = nextPagination.pageSize || 20
  loadFailedJobs()
}

function handleDeadLetterJobTableChange(nextPagination: TablePaginationConfig) {
  deadLetterJobPage.value = nextPagination.current || 1
  deadLetterJobPageSize.value = nextPagination.pageSize || 20
  loadDeadLetterJobs()
}

async function loadConnectorLogs() {
  connectorLoading.value = true
  try {
    connectorSummary.value = await getConnectorExecutionSummary(connectorFilters.value.connectorType || undefined)
    const page = await listConnectorExecutionLogs({
      connectorType: connectorFilters.value.connectorType || undefined,
      status: connectorFilters.value.status,
      requestId: connectorFilters.value.requestId || undefined,
      page: connectorPage.value,
      pageSize: connectorPageSize.value
    })
    connectorLogs.value = page.items
    connectorTotal.value = page.total
    connectorPage.value = page.page
    connectorPageSize.value = page.pageSize
  } finally {
    connectorLoading.value = false
  }
}

async function searchConnectorLogs() {
  connectorPage.value = 1
  await loadConnectorLogs()
}

function handleConnectorTableChange(nextPagination: TablePaginationConfig) {
  connectorPage.value = nextPagination.current || 1
  connectorPageSize.value = nextPagination.pageSize || 20
  loadConnectorLogs()
}

async function openJobDetail(kind: 'failed' | 'dead-letter', jobId: string) {
  selectedJob.value = kind === 'failed'
    ? await getFailedJob(jobId)
    : await getDeadLetterJob(jobId)
  jobDetailOpen.value = true
}

async function retryJob(kind: 'failed' | 'dead-letter', jobId: string) {
  await runJobAction(`${kind}:retry:${jobId}`, async () => {
    if (kind === 'failed') {
      await retryFailedJob(jobId)
      await loadFailedJobs()
    } else {
      await retryDeadLetterJob(jobId)
      await loadDeadLetterJobs()
    }
    await loadOpsSummary()
    message.success('任务已提交重试')
  })
}

async function removeJob(kind: 'failed' | 'dead-letter', jobId: string) {
  await runJobAction(`${kind}:delete:${jobId}`, async () => {
    if (kind === 'failed') {
      await deleteFailedJob(jobId)
      await loadFailedJobs()
    } else {
      await deleteDeadLetterJob(jobId)
      await loadDeadLetterJobs()
    }
    await loadOpsSummary()
    if (selectedJob.value?.id === jobId) {
      selectedJob.value = null
      jobDetailOpen.value = false
    }
    message.success('任务已删除')
  })
}

async function runJobAction(actionKey: string, action: () => Promise<void>) {
  jobActionLoading.value = actionKey
  try {
    await action()
  } finally {
    jobActionLoading.value = null
  }
}

async function inspect(instanceId: string) {
  detail.value = await getOpsInstance(instanceId)
  traceDetail.value = null
  destroyTraceViewer()
}

async function trace(instanceId: string) {
  activeTab.value = 'instances'
  traceDetail.value = await getProcessTrace(instanceId)
  detail.value = traceDetail.value
  await renderTraceDiagram()
}

async function terminate(instanceId: string) {
  await runInstanceAction(`terminate:${instanceId}`, instanceId, async () => {
    await terminateProcessInstance(instanceId, '从运维中心终止')
    message.success('流程已终止')
  })
}

async function suspend(instanceId: string) {
  await runInstanceAction(`suspend:${instanceId}`, instanceId, async () => {
    await suspendProcessInstance(instanceId)
    message.success('流程已挂起')
  })
}

async function activate(instanceId: string) {
  await runInstanceAction(`activate:${instanceId}`, instanceId, async () => {
    await activateProcessInstance(instanceId)
    message.success('流程已激活')
  })
}

async function runInstanceAction(actionKey: string, instanceId: string, action: () => Promise<void>) {
  actionLoading.value = actionKey
  try {
    await action()
    await load()
    if (traceDetail.value?.instanceId === instanceId) {
      await trace(instanceId)
    }
  } finally {
    actionLoading.value = null
  }
}

async function renderTraceDiagram() {
  if (!traceDetail.value?.bpmnXml) {
    return
  }

  await nextTick()
  if (!traceCanvasRef.value) {
    return
  }

  destroyTraceViewer()
  traceViewer = new BpmnNavigatedViewer({
    container: traceCanvasRef.value
  })

  await traceViewer.importXML(traceDetail.value.bpmnXml)

  const canvas = traceViewer.get('canvas')
  const completedActivityIds = traceDetail.value.timeline
    .filter((item) => item.status === 'COMPLETED')
    .map((item) => item.activityId)

  for (const activityId of completedActivityIds) {
    canvas.addMarker(activityId, 'trace-completed')
  }
  for (const activityId of traceDetail.value.currentActivityIds) {
    canvas.addMarker(activityId, 'trace-current')
  }
  canvas.zoom('fit-viewport')
}

function destroyTraceViewer() {
  if (traceViewer) {
    traceViewer.destroy()
    traceViewer = null
  }
}

function openConnectorDetail(record: ConnectorExecutionLogItem) {
  selectedConnectorLog.value = record
  connectorDetailOpen.value = true
}

function maskText(value?: string) {
  const masked = maskSecret(value)
  return typeof masked === 'string' ? masked : ''
}

function connectorLogSummary(record: ConnectorExecutionLogItem) {
  if (record.errorMessage) return maskText(record.errorMessage)
  const body = extractResponseBody(record.responseSummary)
  const data = asRecord(body?.data) || body || {}
  const status = data.status === 'UP' ? '服务正常' : data.status ? `服务状态 ${data.status}` : statusLabel(record.status)
  const version = data.version ? `，版本 ${data.version}` : ''
  return `${status}${version}`
}

function connectorTypeLabel(value?: string) {
  const mapping: Record<string, string> = {
    http: 'HTTP 调用'
  }
  return mapping[value || ''] || value || '-'
}

function extractResponseBody(summary?: string) {
  if (!summary) return null
  const bodyIndex = summary.indexOf('body=')
  if (bodyIndex < 0) return null
  return parseBodyPayload(summary.slice(bodyIndex + 5))
}

function parseBodyPayload(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return null
    }
  }
  return asRecord(value)
}

function asOpsInstance(value: unknown) {
  const record = asRecord(value)
  if (!record) return null
  if (Array.isArray(record.timeline) || Array.isArray(record.currentActivityIds) || 'variables' in record) return null
  if (typeof record.instanceId !== 'string' || typeof record.status !== 'string') return null
  return {
    ...record,
    currentTasks: Array.isArray(record.currentTasks) ? record.currentTasks : [],
    auditLogs: Array.isArray(record.auditLogs) ? record.auditLogs : []
  } as OpsProcessInstance
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function maskedAuditDetailText(value?: string) {
  const masked = parseJsonValue(value)
  return typeof masked === 'string' ? maskText(masked) : JSON.stringify(masked)
}

function parseJsonValue(value?: string) {
  return maskSecret(parseJsonSafe(value, value || {}))
}

function auditDetailSummary(value?: string, action?: string) {
  const parsed = parseJsonValue(value)
  if (typeof parsed === 'string') return maskText(parsed) || emptyAuditSummary(action)
  const entries = Object.entries(parsed as Record<string, unknown>)
    .filter(([key, item]) => !isLowSignalAuditKey(key, item))
    .slice(0, 3)
    .map(([key, item]) => `${auditDetailKeyLabel(key)}：${formatAuditValue(item)}`)
  return entries.length ? entries.join('，') : emptyAuditSummary(action)
}

function isLowSignalAuditKey(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return /(^id$|id$|requestId|deploymentId|formSchemaId|formBindingId|processInstanceId|processDefinitionId)/i.test(key)
}

function auditActionLabel(action?: string) {
  const mapping: Record<string, string> = {
    TASK_COMPLETE: '完成任务',
    PROCESS_INSTANCE_START: '启动流程',
    CONNECTOR_EXECUTE: '执行连接器',
    PROCESS_MODEL_DEPLOY: '部署模型',
    PROCESS_MODEL_IMPORT: '导入模型',
    DEMO_INIT: '准备基础数据',
    DATASOURCE_CREATE: '创建数据源',
    DATASOURCE_TEST: '测试数据源',
    DATASOURCE_DELETE: '删除数据源',
    FORM_SCHEMA_CREATE: '创建表单',
    FORM_SCHEMA_UPDATE: '更新表单',
    FORM_BINDING_CREATE: '创建绑定',
    FORM_BINDING_UPDATE: '更新绑定',
    FORM_BINDING_DELETE: '删除绑定'
  }
  return mapping[action || ''] || action || '-'
}

function auditDetailKeyLabel(key: string) {
  const mapping: Record<string, string> = {
    applicant: '申请人',
    approver: '审批人',
    leaveType: '请假类型',
    startDate: '开始日期',
    endDate: '结束日期',
    days: '请假天数',
    reason: '请假原因',
    attachmentNote: '附件说明',
    approved: '审批结果',
    approvalAction: '审批动作',
    businessKey: '业务编号',
    status: '状态',
    processDefinitionKey: '流程',
    connectorType: '连接器',
    statusCode: '状态码',
    elapsedMillis: '耗时',
    taskDefinitionKey: '任务节点'
  }
  return mapping[key] || key
}

function formatAuditValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined || value === null || value === '') return '-'
  const text = detailValueLabel(String(value))
  return text.length > 48 ? `${text.slice(0, 48)}...` : text
}

function emptyAuditSummary(action?: string) {
  const mapping: Record<string, string> = {
    PROCESS_INSTANCE_START: '流程已启动',
    TASK_COMPLETE: '任务已完成',
    CONNECTOR_EXECUTE: '连接器已执行'
  }
  return mapping[action || ''] || '无补充信息'
}

function detailValueLabel(value?: string) {
  const mapping: Record<string, string> = {
    RUNNING: '运行中',
    SUCCESS: '成功',
    FAILED: '失败',
    COMPLETED: '已完成',
    SUSPENDED: '已挂起',
    ACTIVE: '启用',
    approveTask: '审批请假',
    reviewTask: '确认调用结果',
    leaveApproval: '请假审批',
    httpConnectorDemo: 'HTTP 健康检查',
    http: 'HTTP 调用',
    true: '是',
    false: '否'
  }
  return mapping[value || ''] || value || '-'
}

function statusLabel(status?: string) {
  const mapping: Record<string, string> = {
    SUCCESS: '成功',
    FAILED: '失败',
    RUNNING: '运行中',
    COMPLETED: '已完成',
    ACTIVE: '启用',
    SUSPENDED: '已挂起'
  }
  return mapping[status || ''] || status || '-'
}

onMounted(async () => {
  const routeTab = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (routeTab === 'connectors') {
    activeTab.value = 'connectors'
  } else if (['failed', 'dead-letter', 'exceptions'].includes(routeTab)) {
    activeTab.value = routeTab
  }
  await load()
  await loadConnectorLogs()
  await loadOpsSummary()
  await loadFailedJobs()
  await loadDeadLetterJobs()
  await loadCapabilities()
  await loadRouteTrace()
})

onBeforeUnmount(() => {
  destroyTraceViewer()
})

async function loadRouteTrace() {
  const instanceId = typeof route.query.instanceId === 'string' ? route.query.instanceId : undefined
  if (route.query.view === 'trace' && instanceId) {
    await trace(instanceId)
  }
}
</script>

<style scoped>
.ops-summary-text {
  display: inline-block;
  overflow: hidden;
  max-width: 420px;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.ops-detail-text {
  margin: 0;
  color: #44524d;
  line-height: 1.7;
  word-break: break-word;
}

.ops-stacktrace {
  overflow: auto;
  max-height: 420px;
  margin: 0;
  padding: 12px;
  color: #44524d;
  background: #f6f8f7;
  border: 1px solid #d9e3df;
  border-radius: 8px;
  white-space: pre-wrap;
}
</style>
