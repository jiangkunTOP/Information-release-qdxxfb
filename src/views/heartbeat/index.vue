<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Connection /></el-icon>
      设备心跳
    </div>

    <!-- 统计头部：在线/离线/总数 -->
    <div class="stat-cards">
      <div class="stat-item">
        <div class="stat-label">终端总数</div>
        <div class="stat-value total">{{ summary.totalCount ?? '--' }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">在线设备</div>
        <div class="stat-value online">{{ summary.onlineCount ?? '--' }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">离线设备</div>
        <div class="stat-value offline">{{ summary.offlineCount ?? '--' }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">心跳间隔</div>
        <div class="stat-value interval">
          {{ heartbeatInterval }} 秒
          <el-button link type="primary" size="small" @click="showIntervalDialog = true" style="margin-left: 6px;">
            修改
          </el-button>
        </div>
      </div>
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.keyword" placeholder="设备名称 / IP" clearable style="width: 200px;" />
        <el-select v-model="query.status" placeholder="状态筛选" style="width: 120px;" clearable @change="fetchList">
          <el-option label="在线" value="在线" />
          <el-option label="超时" value="超时" />
          <el-option label="待检测" value="待检测" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button @click="fetchList">
          <el-icon style="margin-right: 4px;"><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="page-card" style="margin-top: 16px;">
      <el-table
        :data="list"
        v-loading="loading"
        stripe
        border
        :resizable="false"
        style="width: 100%;"
        empty-text="暂无数据"
        max-height="calc(100vh - 360px)"
      >
        <el-table-column prop="equipmentName" label="设备名称" min-width="120" align="center" show-overflow-tooltip />
        <el-table-column label="设备类型" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.deviceType === 'server'" type="warning" size="small">小终端</el-tag>
            <el-tag v-else type="primary" size="small">摄像头</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="equipmentId" label="设备ID" min-width="160" align="center" />
        <el-table-column prop="ipAddress" label="设备IP" min-width="130" align="center" />
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === '在线' ? 'success' : row.status === '超时' ? 'danger' : 'info'"
              size="small"
            >
              {{ row.status || '--' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="延迟" min-width="100" align="center">
          <template #default="{ row }">
            <span :class="{ 'latency-high': row.latencyMs > 1000 }">
              {{ row.latencyMs != null ? row.latencyMs + ' ms' : '--' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最后心跳时间" min-width="170" align="center">
          <template #default="{ row }">
            {{ row.lastHeartbeatTime || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="心跳间隔" min-width="110" align="center">
          <template #default="{ row }">
            {{ row.heartbeatIntervalSeconds ? row.heartbeatIntervalSeconds + ' 秒' : '--' }}
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

    <!-- 修改心跳间隔弹窗 -->
    <el-dialog v-model="showIntervalDialog" title="修改心跳间隔" width="400px" :close-on-click-modal="false">
      <el-form label-width="120px">
        <el-form-item label="心跳间隔（秒）">
          <el-input-number v-model="intervalForm.seconds" :min="5" :max="3600" style="width: 200px;" />
        </el-form-item>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: -8px; margin-bottom: 8px; margin-left: 120px;">
          最小 5 秒，最大 3600 秒（1 小时）
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showIntervalDialog = false">取消</el-button>
        <el-button type="primary" :loading="intervalSubmitting" @click="handleSetInterval">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getHeartbeatList, getHeartbeatSummary, setHeartbeatInterval, getHeartbeatInterval } from '@/api/heartbeat'
import { Connection, Refresh } from '@element-plus/icons-vue'

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  status: '',
})

// ─── 统计 ───
const summary = reactive({
  totalCount: null,
  onlineCount: null,
  offlineCount: null,
})
const heartbeatInterval = ref(5)

// 自动刷新定时器
let autoRefreshTimer = null

function startAutoRefresh() {
  stopAutoRefresh()
  const intervalMs = Math.max(heartbeatInterval.value, 5) * 1000
  autoRefreshTimer = setInterval(() => {
    fetchList(true)
    loadSummary()
  }, intervalMs)
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

// ─── 心跳间隔弹窗 ───
const showIntervalDialog = ref(false)
const intervalSubmitting = ref(false)
const intervalForm = reactive({
  seconds: 5,
})

// ─── 数据加载 ───

async function fetchList(silent) {
  if (!silent) {
    loading.value = true
  }
  try {
    const res = await getHeartbeatList({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword,
    })
    if (res.code === 0 && res.data) {
      let records = res.data.records || res.data.list || []
      // 如果有状态筛选（前端过滤）
      if (query.status) {
        records = records.filter(r => r.status === query.status)
      }
      list.value = records
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取心跳列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    const res = await getHeartbeatSummary()
    if (res.code === 0 && res.data) {
      summary.totalCount = res.data.totalCount
      summary.onlineCount = res.data.onlineCount
      summary.offlineCount = res.data.offlineCount
    }
  } catch (err) {
    console.error('获取心跳统计失败:', err)
  }
}

async function loadInterval() {
  try {
    const res = await getHeartbeatInterval()
    if (res.code === 0 && res.data) {
      heartbeatInterval.value = res.data.heartbeatInterval || 5
      // 加载后按新间隔启动自动刷新
      startAutoRefresh()
    }
  } catch (err) {
    console.error('获取心跳间隔失败:', err)
  }
}

// ─── 操作 ───

function handleSearch() {
  query.pageNum = 1
  fetchList()
}

function handleReset() {
  query.keyword = ''
  query.status = ''
  query.pageNum = 1
  fetchList()
}

async function handleSetInterval() {
  intervalSubmitting.value = true
  try {
    const res = await setHeartbeatInterval(intervalForm.seconds)
    if (res.code === 0) {
      ElMessage.success('心跳间隔已修改')
      heartbeatInterval.value = intervalForm.seconds
      showIntervalDialog.value = false
      // 重新启动自动刷新（新间隔）
      startAutoRefresh()
    } else {
      ElMessage.error(res.message || '修改失败')
    }
  } catch (err) {
    console.error('设置心跳间隔失败:', err)
    ElMessage.error('修改失败')
  } finally {
    intervalSubmitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadSummary(), loadInterval()])
  fetchList()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
/* 统计卡片 */
.stat-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;

  .stat-item {
    flex: 1;
    background: #fff;
    border-radius: 10px;
    padding: 20px 24px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);

    .stat-label {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;

      &.total {
        color: var(--text-primary);
      }
      &.online {
        color: #67c23a;
      }
      &.offline {
        color: #f56c6c;
      }
      &.interval {
        font-size: 20px;
        color: var(--color-primary);
      }
    }
  }
}

/* 延迟高亮 */
:deep(.latency-high) {
  color: #f56c6c;
  font-weight: 500;
}

/* 筛选操作栏（与内容发布/终端分组统一） */
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
