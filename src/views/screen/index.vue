<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Monitor /></el-icon>
      大屏发布
    </div>

    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.keyword" placeholder="大屏标题" clearable style="width: 200px;" @keyup.enter="handleSearch" />
        <el-select v-model="query.scbj" style="width: 110px;" @change="fetchList">
          <el-option label="未删除" value="0" />
          <el-option label="已删除" value="1" />
          <el-option label="全部" value="" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="createNew">新建大屏</el-button>
      </div>
    </div>

    <div class="page-card" style="margin-top: 16px;">
      <el-table
        :data="list"
        v-loading="loading"
        stripe
        border
        :resizable="false"
        style="width: 100%;"
        empty-text=""
        max-height="calc(100vh - 280px)"
      >
        <el-table-column label="标题" min-width="200" align="center">
          <template #default="{ row }">
            <span style="font-weight:500;">{{ row.title || '(未命名)' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="设计尺寸" min-width="120" align="center">
          <template #default="{ row }">{{ row.pageWidth || 1920 }} x {{ row.pageHeight || 1080 }}</template>
        </el-table-column>
        <el-table-column label="推送类型" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.publishType === 'interrupt' ? 'danger' : 'info'" size="small">
              {{ row.publishType === 'interrupt' ? '紧急插播' : '普通发布' }}
            </el-tag>
          </template>
        </el-table-column>
<el-table-column label="绑定终端" min-width="180" align="center">
          <template #default="{ row }">{{ row.targetGroupName || '-' }}</template>
        </el-table-column>
        <el-table-column label="插播状态" min-width="90" align="center">
          <template #default="{ row }">
            <template v-if="row.publishType === 'interrupt' && row._interruptStart">
              <el-tag :type="getInterruptTagType(row)" size="small">{{ getInterruptStatus(row) }}</el-tag>
            </template>
            <span v-else style="color:#909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="插播时间" min-width="160" align="center">
          <template #default="{ row }">
            <template v-if="row.publishType === 'interrupt' && row._interruptStart">
              {{ formatTime(row._interruptStart) }} ~ {{ formatTime(row._interruptEnd) }}
            </template>
            <span v-else style="color:#909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建人" min-width="120" align="center" prop="createdBy" />
        <el-table-column label="操作" min-width="280" fixed="right" align="center" :resizable="false">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editScreen(row)">编辑</el-button>
            <el-button v-show="false" link type="primary" size="small" @click="previewScreen(row)">预览</el-button>
            <el-button link type="success" size="small" @click="handlePushToTerminal(row)">推送大屏</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>


    <!-- 插播时间段选择弹窗（仅紧急插播时弹出） -->
    <el-dialog v-model="publishDialogVisible" title="紧急插播 - 时间段设置" :close-on-click-modal="false" width="420px">
      <div style="padding:10px 0;">
        <div style="background:#f8f9fa;padding:16px;border-radius:8px;">
          <div style="font-size:14px;font-weight:bold;margin-bottom:12px;">⏱ 插播时间段</div>
          <el-form label-position="top" size="small">
            <el-form-item label="开始时间">
              <el-date-picker v-model="publishConfig.startTime" type="datetime" placeholder="选择开始时间" style="width:100%;" :disabled-date="d=>d.getTime()<Date.now()-60000" />
            </el-form-item>
            <el-form-item label="结束时间">
              <el-date-picker v-model="publishConfig.endTime" type="datetime" placeholder="选择结束时间" style="width:100%;" :disabled-date="d=>d.getTime()<=(publishConfig.startTime?.getTime()||Date.now())" />
            </el-form-item>
          </el-form>
        </div>
      </div>
      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmInterruptPublish">确认插播</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listScreen, publishScreen, deleteScreen, pushToTerminal, schedulePublish, cancelSchedulePublish, asyncPushToTerminal, getPublishLogList } from '@/api/screen'

const router = useRouter()
const list = ref([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  keyword: '',
  scbj: '0',
  pageNum: 1,
  pageSize: 20,
})

onMounted(() => {
  fetchList()
  // 无感刷新：页面可见时每15秒自动拉列表
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

/** 自动刷新定时器 */
let autoRefreshTimer = null

function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchList()
    }
  }, 15000)
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

async function fetchList() {
  loading.value = true
  try {
    const res = await listScreen(query)
    if (res.code === 0) {
      const records = res.data?.records || []
      list.value = records
      total.value = res.data?.total || 0
      // 批量查询推送日志，补插播状态
      attachPublishLogs(records)
    }
  } catch (e) { /* ignore */ }
  loading.value = false
}

async function attachPublishLogs(records) {
  if (!records || records.length === 0) return
  const ids = records.map(r => r.id).join(',')
  try {
    const res = await getPublishLogList(ids)
    if (res.code === 0 && res.data) {
      const logMap = {}
      // 取每个大屏最新的一条日志
      for (const log of res.data) {
        if (!logMap[log.screenId]) {
          logMap[log.screenId] = log
        }
      }
      // 合并到列表记录中
      for (const record of list.value) {
        const log = logMap[record.id]
        if (log) {
          record._interruptStart = log.interruptWindowStart
          record._interruptEnd = log.interruptWindowEnd
          record._interruptStatus = log.status
        }
      }
    }
  } catch (e) { /* ignore */ }
}

function handleSearch() { query.pageNum = 1; fetchList() }
function handleReset() { query.keyword = ''; query.scbj = '0'; query.pageNum = 1; fetchList() }

function createNew() {
  router.push('/screen/editor')
}

function editScreen(row) {
  router.push(`/screen/editor/${row.id}`)
}

function previewScreen(row) {
  router.push(`/screen/preview/${row.id}`)
}

async function handlePublish(row) {
  try {
    await ElMessageBox.confirm(`确定发布「${row.title}」？`, '提示', { type: 'info' })
  } catch { return }
  try {
    const res = await publishScreen({ id: row.id })
    if (res.code === 0) {
      ElMessage.success('发布成功')
      fetchList() // 刷新列表，不跳转，让用户自行决定下一步
    } else {
      ElMessage.error(res.message || '发布失败')
    }
  } catch (e) { /* ignore */ }
}

// ==================== 异步推送（离线包 + 进度条） ====================

// ==================== 发布方式选择（v5） ====================

const publishDialogVisible = ref(false)
/** 正在推送的大屏行数据，发布确认时使用 */
const pendingPublishRow = ref(null)

const publishConfig = reactive({
  startTime: null,
  endTime: null,
})

function resetPublishConfig() {
  publishConfig.startTime = null
  publishConfig.endTime = null
}

async function handlePushToTerminal(row) {
  if (!row.targetGroupId) {
    ElMessage.warning('该大屏未绑定终端，请先编辑绑定')
    return
  }
  if (row.publishType === 'interrupt') {
    // 紧急插播 → 弹时间段选择窗
    pendingPublishRow.value = row
    resetPublishConfig()
    publishDialogVisible.value = true
    return
  }
  // 普通发布 → 直接推送
  doPush(row, 'normal', null, null)
}

/**
 * 紧急插播确认（从时间段选择弹窗触发）
 */
async function confirmInterruptPublish() {
  const row = pendingPublishRow.value
  if (!row) return
  if (!publishConfig.startTime) {
    ElMessage.warning('请选择插播开始时间')
    return
  }
  if (!publishConfig.endTime) {
    ElMessage.warning('请选择插播结束时间')
    return
  }
  publishDialogVisible.value = false
  doPush(row, 'interrupt', publishConfig.startTime.getTime(), publishConfig.endTime.getTime())
}

/**
 * 执行推送（同步版）
 */
async function doPush(row, publishType, interruptStart, interruptEnd, forceOverwrite) {
  const params = {
    screenId: row.id,
    publishType: publishType,
  }
  if (interruptStart != null) params.interruptWindowStart = interruptStart
  if (interruptEnd != null) params.interruptWindowEnd = interruptEnd
  if (forceOverwrite) params.forceOverwrite = true

  try {
    const res = await asyncPushToTerminal(params)
    if (res.code === 0) {
      const data = res.data
      // 冲突检测：后端返回冲突信息
      if (data && data.conflict) {
        try {
          await ElMessageBox.confirm(data.message, '插播时间冲突', {
            confirmButtonText: '确认替换',
            cancelButtonText: '取消',
            type: 'warning',
            dangerouslyUseHTMLString: false,
          })
          // 用户确认替换，重新发送（带上 forceOverwrite=true）
          doPush(row, publishType, interruptStart, interruptEnd, true)
        } catch {
          // 用户点了取消，不做任何操作
        }
        return
      }
      // 推送成功，直接提示（不弹进度窗）
      ElMessage.success(data || '推送指令已提交')
      // 立即刷新列表，展示最新状态
      fetchList()
    } else {
      ElMessage.error(res.message || '推送失败')
    }
  } catch (e) {
    ElMessage.error('推送请求异常: ' + (e.message || e))
  }
}


async function handleSchedulePublish(row) {
  const isScheduled = row.scheduledPublishTime && row.scheduledPublishStatus !== '1'
  if (isScheduled) {
    // 已设置定时，提供取消/修改选项
    const action = await ElMessageBox.confirm(
      `当前定时发布时间：${formatTime(row.scheduledPublishTime)}\n\n取消还是修改？`,
      '定时发布',
      {
        type: 'info',
        confirmButtonText: '修改时间',
        cancelButtonText: '取消定时',
        distinguishCancelAndClose: true,
      }
    ).catch((action) => {
      if (action === 'cancel') return 'cancel'
      throw action
    })
    if (action === 'cancel') {
      // 取消定时
      try {
        const res = await cancelSchedulePublish({ id: row.id })
        if (res.code === 0) {
          ElMessage.success('已取消定时发布')
          fetchList()
        } else {
          ElMessage.error(res.message || '操作失败')
        }
      } catch (e) {
        ElMessage.error('操作失败')
      }
      return
    }
    // 修改时间 -> 继续弹日期选择
  }
  // 弹出日期时间选择器
  try {
    const { value } = await ElMessageBox.prompt(
      `请选择定时发布时间（${row.title}）`,
      '定时发布',
      {
        inputType: 'datetime-local',
        inputPlaceholder: '选择日期和时间',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValidator: (val) => {
          if (!val) return '请选择发布时间'
          const d = new Date(val)
          if (isNaN(d.getTime())) return '日期格式无效'
          if (d.getTime() <= Date.now()) return '发布时间必须晚于当前时间'
          return true
        },
      }
    )
    if (!value) return
    const d = new Date(value)
    const pad = (n) => String(n).padStart(2, '0')
    const localTime = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
    const res = await schedulePublish({
      screenId: row.id,
      scheduledPublishTime: localTime,
    })
    if (res.code === 0) {
      ElMessage.success('定时发布设置成功')
      fetchList()
    } else {
      ElMessage.error(res.message || '设置失败')
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error('设置失败')
    }
  }
}
async function handleDelete(row) {
  // 如果有插播冲突，让后端返回冲突信息，前端弹确认后再强制删除
  await doDeleteWithCheck(row, false)
}

async function doDeleteWithCheck(row, forceDelete) {
  try {
    if (!forceDelete) {
      try {
        await ElMessageBox.confirm(`确定删除「${row.title}」？`, '提示', { type: 'warning' })
      } catch { return }
    }
    const res = await deleteScreen({ id: row.id, forceDelete: forceDelete || undefined })
    if (res.code === 0) {
      const data = res.data
      if (data && data.interruptConflict) {
        // 返回插播冲突，让用户确认
        try {
          await ElMessageBox.confirm(data.message, '插播任务冲突', {
            confirmButtonText: '确认删除',
            cancelButtonText: '取消',
            type: 'warning',
          })
          // 用户确认，强制删除
          doDeleteWithCheck(row, true)
        } catch { /* 用户取消 */ }
        return
      }
      ElMessage.success(data || '删除成功')
      fetchList()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) { /* ignore */ }
}

function formatTime(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 插播状态计算
 * 优先使用后端返回的精确状态；后端无状态时用本地时间估算
 */
function getInterruptStatus(row) {
  // 优先使用后端精确状态
  const backendStatus = row._interruptStatus
  if (backendStatus === 'cancelled') return '冲突已停止'
  if (backendStatus === 'completed') return '已完成'
  if (backendStatus === 'active') return '执行中'
  if (backendStatus === 'pending') return '待执行'

  // fallback：本地时间估算
  const now = Date.now()
  const start = row._interruptStart
  const end = row._interruptEnd
  if (!start) return '-'
  if (now < start) return '待执行'
  if (!end || now >= end) return '已完成'
  return '执行中'
}

function getInterruptTagType(row) {
  const s = getInterruptStatus(row)
  if (s === '待执行') return 'warning'
  if (s === '冲突已停止') return 'info'
  if (s === '执行中') return 'danger'
  if (s === '已完成') return 'success'
  return 'info'
}

function formatMsTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-bar-right {
  display: flex;
  align-items: center;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table) {
  font-size: 13px;
  table-layout: fixed;
}

:deep(.el-table .cell) {
  padding-left: 10px;
  padding-right: 10px;
}

:deep(.el-table__empty-text) {
  display: none;
}

.page-card {
  overflow-x: auto;
}

/* 发布类型选择弹窗中的网格布局 */
.prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.prop-grid .el-form-item {
  margin-bottom: 0;
}
</style>
