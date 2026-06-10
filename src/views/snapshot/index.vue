<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Camera /></el-icon>
      抓拍回传
    </div>

    <!-- 操作栏 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.keyword" placeholder="设备名称 / IP" clearable style="width: 200px;" />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="handleCaptureAll" :loading="capturingAll">
          <el-icon style="margin-right: 4px;"><Camera /></el-icon>
          全部抓拍
        </el-button>
        <el-button @click="handleDownloadAll">全部下载</el-button>
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
        class="snapshot-table"
        style="width: 100%;"
        empty-text="暂无数据"
        max-height="calc(100vh - 360px)"
      >
        <el-table-column label="" width="240" align="center" :resizable="false">
          <template #default="{ row }">
            <div class="snap-col">
              <img
                v-if="row.lastImageUrl"
                :src="row.lastImageUrl"
                class="snap-thumb"
                @click="previewImage = row.lastImageUrl; previewVisible = true"
              />
              <div v-else class="no-snap">暂无抓拍</div>
              <div v-if="row.lastImageName" class="snap-detail">
                <el-tooltip
                  placement="right"
                  :content="'图片名称：' + row.lastImageName + '\n文件大小：' + (row.lastImageSize || '--') + '\n抓拍时间：' + (row.lastSnapshotTime || '--')"
                >
                  <div class="snap-name">{{ row.lastImageName }}</div>
                </el-tooltip>
                <div class="snap-size">{{ row.lastImageSize || '--' }}</div>
                <div class="snap-time">{{ row.lastSnapshotTime || '--' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="equipmentName" label="设备名称" min-width="120" align="center" show-overflow-tooltip />
        <el-table-column prop="ipAddress" label="IP地址" min-width="130" align="center" />
        <el-table-column label="抓拍次数" width="100" align="center">
          <template #default="{ row }">
            <span>{{ row.snapshotCount != null ? row.snapshotCount + ' 次' : '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" align="center" fixed="right" :resizable="false">
          <template #header>
            <span>操作</span>
          </template>
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              :loading="capturingId === row.equipmentId"
              @click="handleCaptureOne(row)"
            >
              抓拍
            </el-button>
            <el-button link type="primary" size="small" @click="handleDownloadBatch(row)">批量下载</el-button>
            <el-button link type="default" size="small" @click="handleHistory(row)">历史</el-button>
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

    <!-- 图片大图预览 -->
    <el-image-viewer
      v-if="previewVisible"
      :url-list="[previewImage]"
      @close="previewVisible = false"
    />

    <!-- 历史记录弹窗 -->
    <el-dialog
      v-model="historyVisible"
      width="800px"
      :close-on-click-modal="false"
      top="5vh"
    >
      <template #header>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-size: 16px; font-weight: 600;">抓拍历史</span>
          <el-tag type="info" effect="plain" style="font-size: 12px;">{{ historyEquipmentName }}</el-tag>
          <span style="font-size: 12px; color: var(--text-secondary);">{{ historyEquipmentId }}</span>
          <span style="font-size: 12px; color: var(--text-secondary);">{{ historyEquipmentIp }}</span>
        </div>
      </template>
      <el-table :data="historyList" v-loading="historyLoading" stripe border style="width: 100%">
        <el-table-column type="index" label="序号" width="55" align="center" />
        <el-table-column label="抓拍图片" min-width="120" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              fit="cover"
              style="width: 100px; height: 70px; border-radius: 4px; cursor: pointer;"
              :preview-src-list="[row.imageUrl]"
            />
            <span v-else style="color: var(--text-secondary);">无</span>
          </template>
        </el-table-column>
        <el-table-column label="图片名称" min-width="180" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.imageName || '--' }}
          </template>
        </el-table-column>
        <el-table-column prop="snapshotTime" label="抓拍时间" min-width="170" align="center" />
        <el-table-column label="文件大小" min-width="100" align="center">
          <template #default="{ row }">
            {{ row.imageSize || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="90" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDownload(row)">下载</el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; color: var(--text-secondary);">
            {{ historyTotal > 0 ? '共 ' + historyTotal + ' 条记录' : '' }}
          </span>
          <el-pagination
            v-model:current-page="historyQuery.pageNum"
            v-model:page-size="historyQuery.pageSize"
            :total="historyTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            @size-change="fetchHistory"
            @current-change="fetchHistory"
          />
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getSnapshotList, getSnapshotHistory, captureOne, captureAll, downloadSnapshot, downloadBatch, downloadAll } from '@/api/snapshot'
import { Camera, Refresh } from '@element-plus/icons-vue'

const loading = ref(false)
const capturingAll = ref(false)
const capturingId = ref('')
const list = ref([])
const total = ref(0)

// 图片大图预览
const previewVisible = ref(false)
const previewImage = ref('')

// ─── 主列表查询 ───
const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
})

// ─── 历史弹窗 ───
const historyVisible = ref(false)
const historyLoading = ref(false)
const historyList = ref([])
const historyTotal = ref(0)
const historyEquipmentName = ref('')
const historyEquipmentId = ref('')
const historyEquipmentIp = ref('')

const historyQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  equipmentId: '',
})

// ─── 数据加载 ───

async function fetchList() {
  loading.value = true
  try {
    const res = await getSnapshotList({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword,
    })
    if (res.code === 0 && res.data) {
      list.value = res.data.records || res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取抓拍列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function fetchHistory() {
  historyLoading.value = true
  try {
    const res = await getSnapshotHistory({
      pageNum: historyQuery.pageNum,
      pageSize: historyQuery.pageSize,
      equipmentId: historyQuery.equipmentId,
    })
    if (res.code === 0 && res.data) {
      historyList.value = res.data.records || res.data.list || []
      historyTotal.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取历史记录失败:', err)
  } finally {
    historyLoading.value = false
  }
}

// ─── 操作 ───

function handleSearch() {
  query.pageNum = 1
  fetchList()
}

function handleReset() {
  query.keyword = ''
  query.pageNum = 1
  fetchList()
}

async function handleCaptureOne(row) {
  capturingId.value = row.equipmentId
  try {
    const res = await captureOne(row.equipmentId)
    if (res.code === 0 && res.data?.success) {
      ElMessage.success('抓拍成功')
      fetchList()
    } else {
      ElMessage.error(res.data?.message || res.message || '抓拍失败')
    }
  } catch (err) {
    ElMessage.error('抓拍失败')
  } finally {
    capturingId.value = ''
  }
}

async function handleCaptureAll() {
  capturingAll.value = true
  try {
    const res = await captureAll()
    if (res.code === 0) {
      ElMessage.success('全部抓拍完成')
      fetchList()
    } else {
      ElMessage.error(res.message || '全部抓拍失败')
    }
  } catch (err) {
    ElMessage.error('全部抓拍失败')
  } finally {
    capturingAll.value = false
  }
}

async function handleDownload(row) {
  try {
    const res = await downloadSnapshot(row.id)
    const blob = new Blob([res])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.imageName || `snapshot_${row.id}.jpg`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    ElMessage.error('下载失败')
  }
}

async function handleDownloadBatch(row) {
  try {
    const res = await downloadBatch(row.equipmentId)
    const blob = new Blob([res])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot_batch_${row.equipmentId}.zip`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    ElMessage.error('批量下载失败')
  }
}

async function handleDownloadAll() {
  try {
    const res = await downloadAll()
    const blob = new Blob([res])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'snapshot_all.zip'
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    ElMessage.error('全部下载失败')
  }
}

function handleHistory(row) {
  historyQuery.equipmentId = row.equipmentId
  historyQuery.pageNum = 1
  historyEquipmentName.value = row.equipmentName || row.equipmentId
  historyEquipmentId.value = row.equipmentId || '--'
  historyEquipmentIp.value = row.ipAddress || '--'
  historyVisible.value = true
  fetchHistory()
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped lang="scss">
/* 筛选操作栏 */
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
  gap: 8px;
  flex-wrap: wrap;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 预览列：图片撑满 + 下方竖排详情 */
.snap-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
}

.snap-thumb {
  width: 220px;
  height: 130px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  display: block;
  transition: transform 0.15s;

  &:hover {
    transform: scale(1.04);
  }
}

.no-snap {
  width: 220px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-secondary);
  background: #f5f7fa;
  border-radius: 4px;
}

.snap-detail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 160px;
  line-height: 1.5;
  text-align: left;
  font-size: 12px;

  .snap-name {
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
  }

  .snap-size {
    color: var(--text-secondary);
  }

  .snap-time {
    color: var(--text-secondary);
  }
}

:deep(.el-table) {
  font-size: 13px;
  table-layout: fixed;
}

:deep(.el-table .cell) {
  padding-left: 8px;
  padding-right: 8px;
}

:deep(.el-table__empty-text) {
  display: none;
}

/* 主列表第一列（图片列）隐藏表头 */
.snapshot-table :deep(.el-table__header) th:first-child {
  height: 0 !important;
  padding: 0 !important;
  border: none !important;
  overflow: hidden;
}

.page-card {
  overflow-x: auto;
}
</style>
