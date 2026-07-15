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
            <el-button link type="warning" size="small" @click="handleSchedulePublish(row)">定时</el-button>
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

    <!-- 定时发布规则编辑对话框（新版：支持每天/每周/指定日期段） -->
    <el-dialog v-model="scheduleDialogVisible" title="定时发布规则" :close-on-click-modal="false" width="540px">
      <div style="padding:10px 0;">
        <el-form :model="scheduleForm" :rules="scheduleRules" ref="scheduleFormRef" label-width="100px">
          <el-form-item label="规则类型" prop="ruleType">
            <el-select v-model="scheduleForm.ruleType" placeholder="选择类型" style="width:100%;">
              <el-option label="每天" value="daily" />
              <el-option label="每周" value="weekly" />
              <el-option label="指定日期段" value="date" />
            </el-select>
          </el-form-item>
          <el-form-item label="生效星期" prop="daysOfWeek" v-if="scheduleForm.ruleType === 'weekly'">
            <el-checkbox-group v-model="scheduleWeeklyDays">
              <el-checkbox label="1">周一</el-checkbox>
              <el-checkbox label="2">周二</el-checkbox>
              <el-checkbox label="3">周三</el-checkbox>
              <el-checkbox label="4">周四</el-checkbox>
              <el-checkbox label="5">周五</el-checkbox>
              <el-checkbox label="6">周六</el-checkbox>
              <el-checkbox label="7">周日</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="日期范围" prop="specifyStartDate" v-if="scheduleForm.ruleType === 'date'">
            <el-date-picker v-model="scheduleDateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width:100%;" value-format="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item label="亮屏时段" prop="startTime">
            <el-time-picker v-model="scheduleForm.startTime" format="HH:mm" placeholder="开始时间" style="width:48%;margin-right:4%;" />
            <el-time-picker v-model="scheduleForm.endTime" format="HH:mm" placeholder="结束时间" style="width:48%;" />
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="scheduleForm.remark" placeholder="备注（可选）" maxlength="200" />
          </el-form-item>
        </el-form>
        <div v-if="scheduleHint" style="margin-top:12px;font-size:12px;color:#909399;">
          {{ scheduleHint }}
        </div>
      </div>
      <template #footer>
        <el-button @click="closeScheduleDialog">取消</el-button>
        <el-button type="danger" :disabled="!scheduleForm.id" @click="handleDeleteSchedule">删除规则</el-button>
        <el-button type="warning" :loading="scheduleLoading" @click="confirmScheduleRule">保存规则</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listScreen, publishScreen, deleteScreen, pushToTerminal, schedulePublish, cancelSchedulePublish, asyncPushToTerminal, getPublishLogList, saveScheduleRule, getScheduleRule, deleteScheduleRule } from '@/api/screen'

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

// ==================== 异步推送 ====================

const publishDialogVisible = ref(false)
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
    pendingPublishRow.value = row
    resetPublishConfig()
    publishDialogVisible.value = true
    return
  }
  doPush(row, 'normal', null, null)
}

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
      if (data && data.conflict) {
        try {
          await ElMessageBox.confirm(data.message, '插播时间冲突', {
            confirmButtonText: '确认替换',
            cancelButtonText: '取消',
            type: 'warning',
            dangerouslyUseHTMLString: false,
          })
          doPush(row, publishType, interruptStart, interruptEnd, true)
        } catch { }
        return
      }
      ElMessage.success(data || '推送指令已提交')
      fetchList()
    } else {
      ElMessage.error(res.message || '推送失败')
    }
  } catch (e) {
    ElMessage.error('推送请求异常: ' + (e.message || e))
  }
}

// ==================== 新版定时规则 (ScreenScheduleRule) ====================

const scheduleDialogVisible = ref(false)
const scheduleRow = ref(null)
const scheduleLoading = ref(false)
const scheduleFormRef = ref(null)
const scheduleWeeklyDays = ref([])
const scheduleDateRange = ref(null)
const scheduleHint = ref('')

const defaultScheduleForm = {
  id: '',
  screenId: '',
  ruleType: 'daily',
  daysOfWeek: '',
  specifyStartDate: null,
  specifyEndDate: null,
  startTime: '',
  endTime: '',
  remark: '',
}

const scheduleForm = reactive({ ...defaultScheduleForm })

const scheduleRules = {
  ruleType: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
}

function fmtTime(v) {
  if (!v) return ''
  if (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) return v
  if (v instanceof Date && !isNaN(v)) {
    return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0')
  }
  return String(v)
}

function formatDaysOfWeek(str) {
  if (!str) return ''
  const map = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日' }
  return str.split(',').map(d => '周' + (map[d] || d)).join('、')
}

function buildScheduleHint(rule) {
  if (!rule) return ''
  const tips = {
    daily: '每天 ' + rule.startTime + ' — ' + rule.endTime + ' 播放，其余时间黑屏',
    weekly: '每周 ' + formatDaysOfWeek(rule.daysOfWeek) + ' ' + rule.startTime + ' — ' + rule.endTime + ' 播放，其余时间黑屏',
    date: rule.specifyStartDate + ' 至 ' + (rule.specifyEndDate || '长期') + ' ' + rule.startTime + ' — ' + rule.endTime + ' 播放，其余时间黑屏',
  }
  return tips[rule.ruleType] || ''
}

async function openScheduleDialog(row) {
  scheduleRow.value = row
  scheduleForm.screenId = row.id
  scheduleForm.id = ''
  scheduleForm.ruleType = 'daily'
  scheduleForm.daysOfWeek = ''
  scheduleForm.specifyStartDate = null
  scheduleForm.specifyEndDate = null
  scheduleForm.startTime = ''
  scheduleForm.endTime = ''
  scheduleForm.remark = ''
  scheduleWeeklyDays.value = []
  scheduleDateRange.value = null
  scheduleHint.value = ''

  // 查询是否已有规则
  try {
    const res = await getScheduleRule(row.id)
    if (res.code === 0 && res.data) {
      const rule = res.data
      scheduleForm.id = rule.id
      scheduleForm.ruleType = rule.ruleType
      scheduleForm.daysOfWeek = rule.daysOfWeek || ''
      scheduleForm.specifyStartDate = rule.specifyStartDate || null
      scheduleForm.specifyEndDate = rule.specifyEndDate || null
      scheduleForm.remark = rule.remark || ''

      // 时间转 Date
      if (rule.startTime && /^\d{2}:\d{2}$/.test(rule.startTime)) {
        const [h, m] = rule.startTime.split(':')
        const d = new Date()
        d.setHours(parseInt(h), parseInt(m), 0, 0)
        scheduleForm.startTime = d
      }
      if (rule.endTime && /^\d{2}:\d{2}$/.test(rule.endTime)) {
        const [h, m] = rule.endTime.split(':')
        const d = new Date()
        d.setHours(parseInt(h), parseInt(m), 0, 0)
        scheduleForm.endTime = d
      }

      if (rule.ruleType === 'weekly' && rule.daysOfWeek) {
        scheduleWeeklyDays.value = rule.daysOfWeek.split(',')
      }
      if (rule.ruleType === 'date' && rule.specifyStartDate) {
        scheduleDateRange.value = [rule.specifyStartDate, rule.specifyEndDate || null]
      }

      scheduleHint.value = '当前规则：' + buildScheduleHint(rule)
    }
  } catch (e) {
    console.error('[Schedule] 查询规则失败', e)
  }

  scheduleDialogVisible.value = true
}

function closeScheduleDialog() {
  scheduleDialogVisible.value = false
  scheduleRow.value = null
  scheduleLoading.value = false
}

async function confirmScheduleRule() {
  const valid = await scheduleFormRef.value.validate().catch(() => false)
  if (!valid) return

  const payload = {
    id: scheduleForm.id || undefined,
    screenId: scheduleRow.value.id,
    ruleType: scheduleForm.ruleType,
    daysOfWeek: scheduleForm.ruleType === 'weekly' ? scheduleWeeklyDays.value.join(',') : '',
    specifyStartDate: scheduleForm.ruleType === 'date' && scheduleDateRange.value ? scheduleDateRange.value[0] : null,
    specifyEndDate: scheduleForm.ruleType === 'date' && scheduleDateRange.value ? scheduleDateRange.value[1] : null,
    startTime: fmtTime(scheduleForm.startTime),
    endTime: fmtTime(scheduleForm.endTime),
    remark: scheduleForm.remark || '',
  }

  if (!payload.startTime || !payload.endTime) {
    ElMessage.warning('请选择亮屏时段')
    return
  }

  scheduleLoading.value = true
  try {
    const res = await saveScheduleRule(payload)
    if (res.code === 0) {
      ElMessage.success('定时规则保存成功')
      closeScheduleDialog()
      fetchList()
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.message || e))
  } finally {
    scheduleLoading.value = false
  }
}

async function handleDeleteSchedule() {
  if (!scheduleForm.id) return
  try {
    await ElMessageBox.confirm('确定删除这条定时规则？删除后将不会自动播放切换', '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    const res = await deleteScheduleRule(scheduleForm.id)
    if (res.code === 0) {
      ElMessage.success('规则已删除')
      closeScheduleDialog()
      fetchList()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) {
    ElMessage.error('删除失败: ' + (e.message || e))
  }
}

async function handleSchedulePublish(row) {
  // 直接打开规则编辑对话框，支持每天/每周/指定日期段
  openScheduleDialog(row)
}

// ==================== 删除 ====================

async function handleDelete(row) {
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
        try {
          await ElMessageBox.confirm(data.message, '插播任务冲突', {
            confirmButtonText: '确认删除',
            cancelButtonText: '取消',
            type: 'warning',
          })
          doDeleteWithCheck(row, true)
        } catch { }
        return
      }
      ElMessage.success(data || '删除成功')
      fetchList()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) { /* ignore */ }
}

// ==================== 工具函数 ====================

function formatTime(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getInterruptStatus(row) {
  const backendStatus = row._interruptStatus
  if (backendStatus === 'cancelled') return '冲突已停止'
  if (backendStatus === 'completed') return '已完成'
  if (backendStatus === 'active') return '执行中'
  if (backendStatus === 'pending') return '待执行'
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

.prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.prop-grid .el-form-item {
  margin-bottom: 0;
}
</style>
