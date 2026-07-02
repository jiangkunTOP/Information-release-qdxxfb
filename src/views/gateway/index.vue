<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Connection /></el-icon>
      网关管理
    </div>

    <!-- 操作栏 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="searchKeyword" placeholder="设备 ID / 名称 / IP" clearable style="width: 220px;" />
        <el-select v-model="statusFilter" placeholder="状态筛选" style="width: 120px;" clearable>
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button @click="fetchData">
          <el-icon style="margin-right: 4px;"><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 终端表格 -->
    <div class="page-card" style="margin-top: 16px;">
      <el-table
        :data="pagedList"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="deviceId" label="设备 ID" min-width="130" />
        <el-table-column prop="deviceName" label="设备名称" min-width="120" />
        <el-table-column prop="ip" label="IP 地址" min-width="120" />
        <el-table-column label="在线状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'success' : 'danger'" size="small">
              {{ row.online ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="延迟" width="80">
          <template #default="{ row }">
            <span>{{ row.latencyMs ?? '--' }}<span style="color:#909399;font-size:12px;">ms</span></span>
          </template>
        </el-table-column>
        <el-table-column label="最后心跳" width="165">
          <template #default="{ row }">
            {{ formatTime(row.lastHeartbeatTime) }}
          </template>
        </el-table-column>
        <el-table-column label="连接时长" width="165">
          <template #default="{ row }">
            {{ formatTime(row.connectedTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goDetail(row.deviceId)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <el-pagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total="filteredList.length"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无终端连接" />
    </div>


  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getGatewayTerminals } from '@/api/gateway'
import { ElMessage } from 'element-plus'
import { Connection, Refresh } from '@element-plus/icons-vue'

const router = useRouter()
const loading = ref(false)
const terminals = ref([])
const searchKeyword = ref('')
const statusFilter = ref('')

// 分页
const pageNum = ref(1)
const pageSize = ref(10)

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleString('zh-CN', { hour12: false })
}

const filteredList = computed(() => {
  let list = terminals.value
  const kw = searchKeyword.value?.trim().toLowerCase()
  if (kw) {
    list = list.filter(t =>
      (t.deviceId && t.deviceId.toLowerCase().includes(kw)) ||
      (t.deviceName && t.deviceName.toLowerCase().includes(kw)) ||
      (t.ip && t.ip.toLowerCase().includes(kw))
    )
  }
  if (statusFilter.value === 'online') {
    list = list.filter(t => t.online)
  } else if (statusFilter.value === 'offline') {
    list = list.filter(t => !t.online)
  }
  return list
})

const pagedList = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredList.value.slice(start, end)
})

async function fetchData() {
  loading.value = true
  try {
    const termRes = await getGatewayTerminals()
    if (termRes.code === 0) {
      terminals.value = termRes.data || []
    }
  } catch (e) {
    console.error('获取网关数据失败:', e)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pageNum.value = 1
  fetchData()
}

function handleReset() {
  searchKeyword.value = ''
  statusFilter.value = ''
  pageNum.value = 1
  fetchData()
}

function goDetail(deviceId) {
  router.push('/gateway/terminal/' + deviceId)
}

onMounted(fetchData)
</script>

<style scoped>
.stat-cards {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}
.stat-item {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-value.total { color: #409eff; }
.stat-value.online { color: #67c23a; }
.stat-value.offline { color: #f56c6c; }
.stat-value.delay { color: #409eff; font-size: 24px; }
.stat-value.interval { color: #909399; font-size: 22px; }
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.filter-bar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.filter-bar-right {
  display: flex;
  gap: 8px;
}
</style>
