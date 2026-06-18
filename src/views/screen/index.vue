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
<el-table-column label="绑定终端" min-width="120" align="center">
          <template #default="{ row }">{{ row.targetGroupName || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建人" min-width="120" align="center" prop="createdBy" />
        <el-table-column label="创建时间" min-width="160" align="center">
          <template #default="{ row }">{{ formatTime(row.createdDate) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="160" align="center">
          <template #default="{ row }">{{ formatTime(row.updateDate) }}</template>
        </el-table-column>
                <el-table-column label="定时发布" min-width="160" align="center">
          <template #default="{ row }">
            <template v-if="row.scheduledPublishTime && row.scheduledPublishStatus === '1'">
              <span style="color:#67c23a;">已发布</span>
            </template>
            <template v-else-if="row.scheduledPublishTime">
              <span>{{ formatTime(row.scheduledPublishTime) }}</span>
            </template>
            <template v-else>
              <span style="color:#909399;">-</span>
            </template>
          </template>
        </el-table-column><el-table-column label="操作" width="520" fixed="right" align="center" :resizable="false">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editScreen(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="previewScreen(row)">预览</el-button>
            <el-button link type="success" size="small" @click="handlePushToTerminal(row)">推送大屏</el-button>            <el-button link type="warning" size="small" @click="handleSchedulePublish(row)">定时发布</el-button>
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

    <!-- P2: 异步推送进度条对话框 -->
    <el-dialog v-model="pushDialogVisible" title="推送进度" :close-on-click-modal="false" width="450px">
      <div style="text-align: center; padding: 10px 0;">
        <div style="margin-bottom: 12px;">
          <div v-if="pushTask.running" style="position:relative;width:60px;height:60px;margin:0 auto;">
            <el-progress type="circle" :percentage="pushTask.progress" :width="60" :stroke-width="5" />
          </div>
          <div v-else-if="pushTask.success" style="display:flex;align-items:center;justify-content:center;">
            <el-icon :size="48" color="#67c23a"><CircleCheckFilled /></el-icon>
          </div>
          <div v-else style="display:flex;align-items:center;justify-content:center;">
            <el-icon :size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
          </div>
        </div>
        <div style="font-size:16px;font-weight:bold;margin-bottom:4px;">{{ pushTask.phase }}</div>
        <div style="font-size:14px;color:#909399;">{{ pushTask.stepDetail }}</div>
        <div v-if="pushTask.success" style="margin-top:12px;font-size:14px;color:#67c23a;">
          推送已完成！终端正在打开大屏
        </div>
        <div v-if="pushTask.errorMsg" style="margin-top:12px;font-size:13px;color:#f56c6c;">
          {{ pushTask.errorMsg }}
        </div>
      </div>
      <template #footer>
        <el-button v-if="!pushTask.running" @click="pushDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listScreen, publishScreen, deleteScreen, pushToTerminal, schedulePublish, cancelSchedulePublish, asyncPushToTerminal, getPushTaskProgress } from '@/api/screen'

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

onMounted(() => { fetchList() })

async function fetchList() {
  loading.value = true
  try {
    const res = await listScreen(query)
    if (res.code === 0) {
      list.value = res.data?.records || []
      total.value = res.data?.total || 0
    }
  } catch (e) { /* ignore */ }
  loading.value = false
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

// ==================== P2: 异步推送（离线包 + 进度条） ====================

const pushDialogVisible = ref(false)
const pushTask = reactive({
  taskId: '',
  screenId: '',
  screenTitle: '',
  terminalIp: '',
  progress: 0,
  phase: '',
  stepDetail: '',
  running: false,
  success: false,
  errorMsg: '',
})

/** 进度轮询定时器 */
let pushPollTimer = null

async function handlePushToTerminal(row) {
  if (!row.targetGroupId) {
    ElMessage.warning('该大屏未绑定终端，请先编辑绑定')
    return
  }
  try {
    await ElMessageBox.confirm(`确定将「${row.title}」推送到〖${row.targetGroupName || '终端'}〗播放？`, '推送确认', {
      type: 'info',
      confirmButtonText: '推送',
      cancelButtonText: '取消',
    })
  } catch { return }

  // 重置状态
  Object.assign(pushTask, {
    taskId: '', screenId: row.id, screenTitle: row.title,
    terminalIp: row.targetGroupName || '终端',
    progress: 0, phase: '启动中', stepDetail: '正在发起推送请求...',
    running: true, success: false, errorMsg: '',
  })
  pushDialogVisible.value = true

  try {
    const res = await asyncPushToTerminal({ screenId: row.id })
    if (res.code === 0 && res.data) {
      const task = res.data
      pushTask.taskId = task.taskId
      pushTask.progress = task.progress
      pushTask.phase = task.phase
      pushTask.stepDetail = task.stepDetail

      // 开始轮询进度
      startPushPolling(task.taskId)
    } else {
      pushTask.running = false
      pushTask.errorMsg = '启动推送失败: ' + (res.msg || '未知错误')
    }
  } catch (e) {
    pushTask.running = false
    pushTask.errorMsg = '请求异常: ' + (e.message || e)
  }
}

function startPushPolling(taskId) {
  if (pushPollTimer) clearInterval(pushPollTimer)
  pushPollTimer = setInterval(async () => {
    try {
      const res = await getPushTaskProgress(taskId)
      if (res.code === 0 && res.data) {
        const t = res.data
        pushTask.progress = t.progress
        pushTask.phase = t.phase
        pushTask.stepDetail = t.stepDetail
        pushTask.running = t.running
        pushTask.success = t.success
        pushTask.errorMsg = t.errorMsg || ''

        if (!t.running || t.success) {
          clearInterval(pushPollTimer)
          pushPollTimer = null
        }
      }
    } catch (e) {
      // 轮询失败不打断用户，保留当前状态
      console.warn('推送进度轮询失败:', e)
    }
  }, 1500) // 1.5 秒轮询一次
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
  try {
    await ElMessageBox.confirm(`确定删除「${row.title}」？`, '提示', { type: 'warning' })
  } catch { return }
  try {
    const res = await deleteScreen({ id: row.id })
    if (res.code === 0) {
      ElMessage.success('删除成功')
      fetchList() // 留在当前页面，刷新列表
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
</style>
