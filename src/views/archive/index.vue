<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Files /></el-icon>
      异地归档
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.archiveId" placeholder="归档ID" clearable style="width: 180px;" />
        <el-select v-model="query.archiveType" placeholder="归档类型" clearable style="width: 130px;">
          <el-option label="日志归档" value="LOG" />
          <el-option label="抓拍归档" value="SNAPSHOT" />
        </el-select>
        <el-date-picker
          v-model="query.createStart"
          type="date"
          placeholder="创建起始"
          value-format="YYYY-MM-DD"
          style="width: 140px;"
        />
        <span style="color: #999; margin: 0 4px;">~</span>
        <el-date-picker
          v-model="query.createEnd"
          type="date"
          placeholder="创建结束"
          value-format="YYYY-MM-DD"
          style="width: 140px;"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="handleAdd">新增归档</el-button>
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
        <el-table-column prop="id" label="归档ID" min-width="200" align="center" show-overflow-tooltip />
        <el-table-column label="数据周期" min-width="260" align="center">
          <template #default="{ row }">
            {{ row.cycleDisplay }}
          </template>
        </el-table-column>
        <el-table-column label="类型" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.archiveType === 'LOG' ? 'primary' : 'success'" size="small">
              {{ row.archiveTypeName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createName" label="创建人" min-width="100" align="center" />
        <el-table-column label="操作" width="200" fixed="right" align="center" :resizable="false">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleDownload(row)">下载</el-button>
            <el-button type="warning" link size="small" @click="handleEdit(row)">修改</el-button>
            <el-popconfirm
              title="确定删除该归档配置吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <!-- 新增/修改弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '修改归档' : '新增归档'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="归档类型" prop="archiveType">
          <el-select v-model="form.archiveType" placeholder="请选择归档类型" :disabled="isEdit" style="width: 100%;">
            <el-option label="日志归档" value="LOG" />
            <el-option label="抓拍归档" value="SNAPSHOT" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据周期" prop="cycleStart">
          <div style="display: flex; align-items: center; width: 100%;">
            <el-date-picker
              v-model="form.cycleStart"
              type="datetime"
              placeholder="起始时间"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              style="flex: 1;"
            />
            <span style="margin: 0 8px; color: #999;">~</span>
            <el-date-picker
              v-model="form.cycleEnd"
              type="datetime"
              placeholder="结束时间"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              style="flex: 1;"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, h, resolveComponent } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Files } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { getArchiveList, createArchive, updateArchive, deleteArchive, downloadArchive } from '@/api/archive'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const query = reactive({
  page: 1,
  pageSize: 10,
  archiveId: '',
  archiveType: '',
  createStart: '',
  createEnd: ''
})

const form = reactive({
  id: '',
  archiveType: 'LOG',
  cycleStart: '',
  cycleEnd: ''
})

const formRules = {
  archiveType: [{ required: true, message: '请选择归档类型', trigger: 'change' }],
  cycleStart: [{ required: true, message: '请选择起始时间', trigger: 'change' }],
  cycleEnd: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

async function fetchList() {
  loading.value = true
  try {
    const params = { ...query }
    if (!params.archiveId) delete params.archiveId
    if (!params.archiveType) delete params.archiveType
    if (!params.createStart) delete params.createStart
    if (!params.createEnd) delete params.createEnd
    const res = await getArchiveList(params)
    list.value = res.data.records || []
    total.value = res.data.total || 0
  } catch (e) {
    console.error('获取归档列表失败', e)
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  fetchList()
}

function handleReset() {
  query.archiveId = ''
  query.archiveType = ''
  query.createStart = ''
  query.createEnd = ''
  query.page = 1
  fetchList()
}

function handleAdd() {
  isEdit.value = false
  form.id = ''
  form.archiveType = 'LOG'
  form.cycleStart = ''
  form.cycleEnd = ''
  dialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true
  form.id = row.id
  form.archiveType = row.archiveType
  form.cycleStart = row.cycleStart
  form.cycleEnd = row.cycleEnd
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      id: form.id,
      archiveType: form.archiveType,
      cycleStart: form.cycleStart,
      cycleEnd: form.cycleEnd
    }
    if (isEdit.value) {
      await updateArchive(payload)
      ElMessage.success('修改成功')
    } else {
      await createArchive(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error(isEdit.value ? '修改失败' : '新增失败')
  } finally {
    submitting.value = false
  }
}

function handleDelete(row) {
  deleteArchive(row.id).then(() => {
    ElMessage.success('删除成功')
    fetchList()
  }).catch(() => {
    ElMessage.error('删除失败')
  })
}

function handleDownload(row) {
  // 从行数据拼文件名，不依赖后端 Content-Disposition
  const typeName = row.archiveType === 'LOG' ? '日志归档' : '抓拍归档'
  const startStr = row.cycleStart ? row.cycleStart.substring(0, 10) : ''
  const endStr = row.cycleEnd ? row.cycleEnd.substring(0, 10) : ''
  const fileName = typeName + '_' + startStr + '~' + endStr + '.xlsx'

  downloadArchive(row.id).then(blob => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }).catch(() => {
    ElMessage.error('下载失败')
  })
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.filter-bar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.filter-bar-right {
  display: flex;
  gap: 8px;
}

.page-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  flex: 1;
  overflow: hidden;
}
</style>
