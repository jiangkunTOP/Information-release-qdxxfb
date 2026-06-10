<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><WarningFilled /></el-icon>
      异常告警
      <el-tag v-if="newAlarmTip > 0" type="danger" size="small" style="margin-left: 8px;">
        +{{ newAlarmTip }}
      </el-tag>
    </div>

    <!-- 总览卡片 -->
    <div class="overview-cards">
      <div class="overview-card pending">
        <div class="card-value">{{ overview.pendingCount }}</div>
        <div class="card-label">待处理</div>
      </div>
      <div class="overview-card today">
        <div class="card-value">{{ overview.todayCount }}</div>
        <div class="card-label">今日新增</div>
      </div>
      <div class="overview-card total">
        <div class="card-value">{{ overview.totalCount }}</div>
        <div class="card-label">累计总数</div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        placeholder="搜索告警内容"
        clearable
        style="width: 260px"
        @keyup.enter="query.pageNum = 1; fetchList()"
      />
      <el-button type="primary" @click="query.pageNum = 1; fetchList()" style="margin-left: 8px;">
        搜索
      </el-button>
      <el-button @click="query.keyword = ''; query.pageNum = 1; fetchList()">
        重置
      </el-button>
    </div>

    <!-- 查看抓拍图片弹窗 -->
    <el-dialog
      v-model="previewVisible"
      title="布防报警抓拍"
      width="600px"
      :close-on-click-modal="false"
      top="5vh"
    >
      <div style="text-align: center;" v-loading="previewLoading">
        <el-empty v-if="!previewUrl" description="暂无抓拍图片" />
        <img
          v-else
          :src="previewUrl"
          style="max-width: 100%; max-height: 70vh; border-radius: 4px;"
          alt="布防报警抓拍"
        />
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 表格 -->
    <div class="page-card" style="margin-top: 16px;">
      <el-table :data="list" v-loading="loading" stripe border style="width: 100%">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="alarmType" label="告警类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.alarmType === 'OFFLINE' ? 'warning' : 'danger'" size="small">
              {{ row.alarmType === 'OFFLINE' ? '离线告警' : '布防告警' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="alarmContent" label="告警内容" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.status"
              :type="row.status === 'PENDING' ? 'danger' : row.status === 'HANDLING' ? 'warning' : 'success'"
              size="small"
            >
              {{ row.status === 'PENDING' ? '待处理' : row.status === 'HANDLING' ? '处理中' : '已处理' }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="alarmLevel" label="告警级别" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.alarmLevel === 'HIGH' ? 'danger' : row.alarmLevel === 'MEDIUM' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.alarmLevel === 'HIGH' ? '高' : row.alarmLevel === 'MEDIUM' ? '中' : '低' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" width="120" align="center" />
        <el-table-column label="告警时间" width="170" align="center">
          <template #default="{ row }">
            {{ formatTime(row.alarmTime) }}
          </template>
        </el-table-column>
        <el-table-column label="处理时间" width="170" align="center">
          <template #default="{ row }">
            {{ formatTime(row.handleTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <!-- 离线告警：保留原有处理按钮 -->
            <template v-if="row.alarmType === 'OFFLINE'">
              <el-button
                v-if="row.status === 'PENDING'"
                type="warning"
                size="small"
                @click="handleAlarm(row)"
              >
                处理中
              </el-button>
              <el-button
                v-if="row.status === 'PENDING' || row.status === 'HANDLING'"
                type="success"
                size="small"
                @click="resolveAlarm(row)"
              >
                已处理
              </el-button>
              <el-button
                v-if="row.status === 'PENDING'"
                type="primary"
                size="small"
                @click="quickResolveAlarm(row)"
              >
                一键完成
              </el-button>
            </template>
            <!-- 布防告警：只显示查看按钮 -->
            <template v-else-if="row.alarmType === 'ALARM'">
              <el-button
                type="primary"
                size="small"
                @click="viewSnapshot(row)"
              >
                查看
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  getAlarmList,
  getAlarmOverview,
  handleAlarm as apiHandleAlarm,
  resolveAlarm as apiResolveAlarm,
  quickResolveAlarm as apiQuickResolveAlarm,
  getAlarmSnapshot as apiGetAlarmSnapshot
} from '@/api/alarm'

const userStore = useUserStore()

const loading = ref(false)
const list = ref([])
const total = ref(0)
const overview = reactive({
  pendingCount: 0,
  todayCount: 0,
  totalCount: 0,
})
const newAlarmTip = ref(0)

// 查看图片弹窗
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewUrl = ref('')

// WebSocket 连接
let ws = null
let wsReconnectTimer = null

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
})

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getAlarmList({ ...query })
    if (res.code === 0 && res.data) {
      list.value = res.data.records || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('[告警] 获取列表失败:', err)
  } finally {
    loading.value = false
  }
}

const fetchOverview = async () => {
  try {
    const res = await getAlarmOverview()
    if (res.code === 0 && res.data) {
      overview.pendingCount = res.data.pendingCount || 0
      overview.todayCount = res.data.todayCount || 0
      overview.totalCount = res.data.totalCount || 0
    }
  } catch (err) {
    console.error('[告警] 获取总览失败:', err)
  }
}

// ============ 弹出输入框让用户填写处理人（已处理时必填） ============

async function promptHandler(defaultName) {
  try {
    const { value } = await ElMessageBox.prompt('请输入处理人姓名', '处理人', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: defaultName,
      inputPlaceholder: '请输入处理人姓名',
      inputValidator: (v) => {
        if (!v || !v.trim()) return '请输入处理人姓名'
        return true
      },
    })
    return value?.trim()
  } catch {
    return null // 用户取消
  }
}

// 标记处理中 — 不填处理人，直接标记
const handleAlarm = async (row) => {
  try {
    const res = await apiHandleAlarm(row.id)
    if (res.code === 0) {
      ElMessage.success('已标记为处理中')
      row.status = 'HANDLING'
      overview.pendingCount = Math.max(0, overview.pendingCount - 1)
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (err) {
    ElMessage.error('操作失败: ' + (err.message || ''))
  }
}

// 标记已处理 — 弹窗必填处理人
const resolveAlarm = async (row) => {
  const handler = await promptHandler(row.handler || '')
  if (!handler) return // 取消 或 为空
  try {
    const res = await apiResolveAlarm(row.id, handler)
    if (res.code === 0) {
      ElMessage.success('已标记为已处理')
      row.status = 'HANDLED'
      row.handler = handler
      fetchList()
      fetchOverview()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (err) {
    ElMessage.error('操作失败: ' + (err.message || ''))
  }
}

// 一键完成 — 自动填当前登录用户名
const quickResolveAlarm = async (row) => {
  const handler = userStore.userName || 'system'
  try {
    const res = await apiQuickResolveAlarm(row.id, handler)
    if (res.code === 0) {
      ElMessage.success('已一键完成')
      row.status = 'HANDLED'
      row.handler = handler
      fetchList()
      fetchOverview()
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (err) {
    ElMessage.error('操作失败: ' + (err.message || ''))
  }
}

// 查看布防告警的抓拍图片
const viewSnapshot = async (row) => {
  previewVisible.value = true
  previewLoading.value = true
  previewUrl.value = ''
  try {
    // 优先使用 VO 中已返回的 snapshotUrl
    if (row.snapshotUrl) {
      previewUrl.value = row.snapshotUrl
    } else {
      // 如果没有，调接口获取
      const res = await apiGetAlarmSnapshot(row.id)
      if (res.code === 0 && res.data && res.data.snapshotUrl) {
        previewUrl.value = res.data.snapshotUrl
      } else {
        ElMessage.warning('暂无抓拍图片')
      }
    }
  } catch (err) {
    console.error('[告警] 获取抓拍图片失败:', err)
    ElMessage.error('获取抓拍图片失败')
  } finally {
    previewLoading.value = false
  }
}

// 时间格式化
function formatTime(val) {
  if (!val) return '-'
  // 处理 ISO 格式: 2026-06-08T15:45:52.504848400 等
  if (typeof val === 'string' && val.includes('T')) {
    // 统一用 new Date 解析
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    // 兜底：纯字符串替换
    return val.replace('T', ' ').substring(0, 19)
  }
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// WebSocket 连接
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${location.host}/ws/alarm`
  try {
    ws = new WebSocket(url)
    ws.onopen = () => {
      // WebSocket 连接成功，重置新告警提示计数
      newAlarmTip.value = 0
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_alarm' || data.type === 'new_notification') {
          newAlarmTip.value++
          fetchList()
          fetchOverview()
        }
      } catch (e) {
        console.error('[告警] 解析消息失败:', e)
      }
    }
    ws.onerror = (err) => {
      console.error('[告警] WebSocket 错误:', err)
      if (ws) {
        ws.close()
      }
    }
    ws.onclose = () => {
      ws = null
      scheduleReconnect()
    }
  } catch (err) {
    console.error('[告警] 创建 WebSocket 失败:', err)
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
  }
  wsReconnectTimer = setTimeout(() => {
    connectWebSocket()
  }, 5000)
}

function disconnectWebSocket() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (ws) {
    ws.onclose = null
    ws.onerror = null
    ws.onmessage = null
    ws.close()
    ws = null
  }
}

const route = useRoute()

onMounted(() => {
  fetchList()
  fetchOverview()
  connectWebSocket()
})

onBeforeUnmount(() => {
  disconnectWebSocket()
})

// 路由切换回本页面时重新加载数据（解决切页面空白问题）
watch(
  () => route.path,
  (path) => {
    if (path === '/alarm') {
      query.pageNum = 1
      fetchList()
      fetchOverview()
    }
  }
)
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
}

.overview-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.overview-card {
  flex: 1;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  color: #fff;
}

.overview-card.pending {
  background: linear-gradient(135deg, #f56c6c, #e74c3c);
}

.overview-card.today {
  background: linear-gradient(135deg, #e6a23c, #d67c20);
}

.overview-card.total {
  background: linear-gradient(135deg, #409eff, #2d8cf0);
}

.card-value {
  font-size: 32px;
  font-weight: bold;
}

.card-label {
  font-size: 14px;
  margin-top: 4px;
  opacity: 0.9;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
