<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Document /></el-icon>
      操作审计
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.operator" placeholder="操作人" clearable style="width: 150px;" @keyup.enter="handleSearch" />
        <el-select v-model="query.module" placeholder="操作模块" clearable style="width: 140px;" @change="handleSearch">
          <el-option label="内容发布" value="内容发布" />
          <el-option label="终端分组" value="终端分组" />
          <el-option label="抓拍回传" value="抓拍回传" />
          <el-option label="用户管理" value="用户管理" />
        </el-select>
        <el-date-picker
          v-model="query.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 240px;"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-dropdown @command="handleExport" trigger="click">
          <el-button>
            导出<el-icon style="margin-left: 4px;"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">全部导出</el-dropdown-item>
              <el-dropdown-item command="filter">按条件导出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
        empty-text=""
        max-height="calc(100vh - 280px)"
      >
        <el-table-column type="index" label="序号" width="55" align="center" :resizable="false" />
        <el-table-column prop="userName" label="操作人" width="110" align="center" />
        <el-table-column label="操作类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="tagType(row.description)" size="small">
              {{ row.description || '--' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="操作模块" width="120" align="center" />
        <el-table-column prop="content" label="操作内容" min-width="350" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="150" align="center" />
        <el-table-column prop="createDate" label="操作时间" width="170" align="center" />
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAuditList, exportAudit } from '@/api/audit'
import { Document, ArrowDown } from '@element-plus/icons-vue'

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  operator: '',
  module: '',
  dateRange: null,
})

// ─── 操作类型标签颜色 ───

function tagType(description) {
  if (!description) return 'info'
  if (description.includes('新增') || description.includes('添加')) return 'success'
  if (description.includes('修改') || description.includes('编辑') || description.includes('更新')) return 'warning'
  if (description.includes('删除') || description.includes('下架')) return 'danger'
  if (description.includes('登录') || description.includes('发布') || description.includes('抓拍')) return 'primary'
  return 'info'
}

// ─── 数据加载 ───

async function fetchList() {
  loading.value = true
  try {
    const params = {
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    }
    if (query.operator) params.operator = query.operator
    if (query.module) params.module = query.module
    if (query.dateRange && query.dateRange[0]) {
      params.startDate = query.dateRange[0]
      params.endDate = query.dateRange[1]
    }
    const res = await getAuditList(params)
    if (res.code === 0 && res.data) {
      list.value = res.data.records || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取审计列表失败:', err)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.pageNum = 1
  fetchList()
}

function handleReset() {
  query.operator = ''
  query.module = ''
  query.dateRange = null
  query.pageNum = 1
  fetchList()
}

async function handleExport(command) {
  try {
    const params = {}
    if (command === 'all') {
      // 全部导出：不传筛选参数
    } else {
      // 按条件导出
      if (query.operator) params.operator = query.operator
      if (query.module) params.module = query.module
      if (query.dateRange && query.dateRange[0]) {
        params.startDate = query.dateRange[0]
        params.endDate = query.dateRange[1]
      }
    }
    const res = await exportAudit(params)
    const blob = new Blob([res])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `审计日志_${new Date().getTime()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    console.error('导出失败:', err)
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped lang="scss">
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
</style>
