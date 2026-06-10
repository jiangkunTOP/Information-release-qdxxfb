<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><FolderOpened /></el-icon>
      内容发布
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.keyword" placeholder="标题 / 内容ID / 分组" clearable style="width: 220px;" @keyup.enter="handleSearch" />
        <el-select v-model="query.scbj" style="width: 110px;" @change="fetchList">
          <el-option label="未删除" value="0" />
          <el-option label="已删除" value="1" />
          <el-option label="全部" value="" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="handleAdd">新增发布</el-button>
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
        <el-table-column prop="contentId" label="内容ID" min-width="130" align="center" />
        <el-table-column prop="title" label="标题" min-width="180" align="center" show-overflow-tooltip />
        <el-table-column label="类型" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="tagType(row.type)" size="small">
              {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" min-width="100" align="center">
          <template #default="{ row }">
            {{ row.size || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="targetGroup" label="目标分组" min-width="140" align="center" show-overflow-tooltip />
        <el-table-column label="状态" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === '已发布' ? 'success' : row.status === '待发布' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.status || '待发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" min-width="160" align="center">
          <template #default="{ row }">
            {{ formatTime(row.publishedTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right" align="center" :resizable="false">
          <template #default="{ row }">
            <template v-if="row.status === '待发布'">
              <el-button link type="primary" size="small" @click="handlePreview(row)">预览</el-button>
              <el-button link type="success" size="small" @click="handlePublish(row)">发布</el-button>
              <el-button link type="primary" size="small" @click="handleEdit(row)">修改</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
            <template v-else>
              <!-- 已发布 -->
              <el-button link type="primary" size="small" @click="handlePreview(row)">预览</el-button>
              <el-button link type="default" size="small" @click="handleView(row)">查看</el-button>
              <el-button link type="warning" size="small" @click="handleUnpublish(row)">下架</el-button>
            </template>
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

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '修改内容' : '新增发布'"
      width="650px"
      :close-on-click-modal="false"
      :before-close="handleDialogClose"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <!-- 内容ID：手填 -->
        <el-form-item label="内容ID" prop="contentId">
          <el-input v-model="form.contentId" placeholder="请填写内容ID" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <!-- 内容类型选择 -->
        <el-form-item label="内容类型" prop="type">
          <el-radio-group v-model="form.type" @change="handleTypeChange">
            <el-radio-button value="video">
              <el-icon><VideoCamera /></el-icon>
              视频
            </el-radio-button>
            <el-radio-button value="image">
              <el-icon><Picture /></el-icon>
              图片
            </el-radio-button>
            <el-radio-button value="doc">
              <el-icon><Document /></el-icon>
              文档
            </el-radio-button>
            <el-radio-button value="content">
              <el-icon><EditPen /></el-icon>
              文本内容
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 文件上传区域 -->
        <template v-if="form.type && form.type !== 'content'">
          <el-form-item label="上传文件">
            <!-- 视频 -->
            <div v-if="form.type === 'video'" class="upload-wrapper upload-video" @click="triggerUpload">
              <el-icon class="upload-icon"><VideoCamera /></el-icon>
              <span class="upload-text">上传视频文件</span>
              <span v-if="form.fileName" class="upload-file-name">{{ form.fileName }}</span>
              <span v-else-if="isEdit && form.dz" class="upload-file-name upload-old-file">当前文件: {{ form.dz }}</span>
              <span v-else class="upload-hint">点击此处选择视频文件</span>
            </div>
            <!-- 图片 -->
            <div v-else-if="form.type === 'image'" class="upload-wrapper upload-image" @click="triggerUpload">
              <el-icon class="upload-icon"><Picture /></el-icon>
              <span class="upload-text">上传图片文件</span>
              <span v-if="form.fileName" class="upload-file-name">{{ form.fileName }}</span>
              <span v-else-if="isEdit && form.dz" class="upload-file-name upload-old-file">当前文件: {{ form.dz }}</span>
              <span v-else class="upload-hint">点击此处选择图片文件</span>
            </div>
            <!-- 文档 -->
            <div v-else class="upload-wrapper upload-doc" @click="triggerUpload">
              <el-icon class="upload-icon"><Document /></el-icon>
              <span class="upload-text">上传文档文件</span>
              <span v-if="form.fileName" class="upload-file-name">{{ form.fileName }}</span>
              <span v-else-if="isEdit && form.dz" class="upload-file-name upload-old-file">当前文件: {{ form.dz }}</span>
              <span v-else class="upload-hint">点击此处选择文档文件</span>
            </div>
            <input
              ref="fileInputRef"
              type="file"
              style="display: none"
              @change="handleNativeFileChange"
            />
          </el-form-item>
        </template>

        <!-- 文本内容输入 -->
        <el-form-item
          label="文本内容"
          :prop="form.type === 'content' ? 'content' : undefined"
          :rules="form.type === 'content' ? [{ required: true, message: '文本内容不能为空', trigger: 'blur' }] : undefined"
        >
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="4"
            :placeholder="form.type === 'content' ? '请输入文本内容（必填）' : '文本说明（选填）'"
          />
        </el-form-item>

        <!-- 目标分组：多选 -->
        <el-form-item label="目标分组" prop="targetGroup">
          <el-select
            v-model="form.targetGroup"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择目标分组（可多选）"
            style="width: 100%"
          >
            <el-option
              v-for="g in groupOptions"
              :key="g"
              :label="g"
              :value="g"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 查看详情弹窗 -->
    <el-dialog v-model="viewVisible" title="内容详情" width="720px" :close-on-click-modal="false">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="内容ID">{{ viewData.contentId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ viewData.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ typeLabel(viewData.type) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag
            :type="viewData.status === '已发布' ? 'success' : viewData.status === '待发布' ? 'warning' : 'info'"
            size="small"
          >
            {{ viewData.status || '-' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="目标分组" :span="2">{{ viewData.targetGroup || '-' }}</el-descriptions-item>
        <el-descriptions-item label="大小">{{ viewData.size || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发布时间">{{ formatTime(viewData.publishedTime) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 内容预览区域 -->
      <div v-if="viewData.type === 'content' || viewData.type === 'doc'" class="preview-section">
        <div class="preview-title">内容预览</div>
        <div class="preview-content-text">{{ viewData.content || '无文本内容' }}</div>
      </div>
      <div v-else-if="viewData.type === 'image'" class="preview-section">
        <div class="preview-title">图片预览</div>
        <img :src="previewUrl" class="preview-image" @error="onPreviewError" />
      </div>
      <div v-else-if="viewData.type === 'video'" class="preview-section">
        <div class="preview-title">视频预览</div>
        <video :src="previewUrl" controls class="preview-video"></video>
      </div>

      <template #footer>
        <el-button @click="viewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getContentList, getContentDetail, addContent, updateContent, deleteContent,
  uploadFile, getPreviewUrl, publishContent, unpublishContent
} from '@/api/content'
import { getTerminalList } from '@/api/terminal'
import {
  FolderOpened, VideoCamera, Picture, Document, EditPen,
} from '@element-plus/icons-vue'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const dialogVisible = ref(false)
const viewVisible = ref(false)
const viewData = ref({})
const previewUrl = ref('')
const isEdit = ref(false)

const formRef = ref(null)
const fileInputRef = ref(null)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  scbj: '0',
})

const defaultForm = {
  id: '',
  contentId: '',
  title: '',
  type: '',
  targetGroup: [],
  dz: '',
  content: '',
  size: '',
  status: '待发布',
  file: null,
  fileName: '',
}

const form = reactive({ ...defaultForm })

const formRules = computed(() => ({
  contentId: [
    { required: true, message: '请输入内容ID', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '内容ID仅支持字母、数字、下划线和中划线', trigger: 'blur' },
  ],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择内容类型', trigger: 'change' }],
  targetGroup: [{ required: true, message: '请选择目标分组', trigger: 'change' }],
}))

/** 分组选项列表 */
const groupOptions = ref([])

async function loadGroupOptions() {
  try {
    const res = await getTerminalList({
      pageNum: 1,
      pageSize: 9999,
      keyword: '',
      scbj: '0',
    })
    if (res.code === 0 && res.data) {
      const records = res.data.records || res.data.list || []
      const groups = new Set()
      records.forEach(item => {
        if (item.group && item.group.trim()) {
          groups.add(item.group.trim())
        }
      })
      groupOptions.value = Array.from(groups).sort()
    }
  } catch (err) {
    console.error('加载分组选项失败:', err)
    groupOptions.value = []
  }
}

// ───────── 类型辅助 ─────────

function tagType(type) {
  if (!type) return 'info'
  const t = type.toLowerCase()
  if (t === 'video') return 'success'
  if (t === 'image') return 'primary'
  if (t === 'doc') return ''
  if (t === 'content') return 'warning'
  return 'info'
}

function typeLabel(type) {
  if (!type) return '-'
  const map = { video: '视频', image: '图片', doc: '文档', content: '文本内容' }
  return map[type.toLowerCase()] || type
}

function formatTime(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ───────── 文件上传 ─────────

function triggerUpload() {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

function handleNativeFileChange(e) {
  const files = e.target.files
  if (!files || files.length === 0) return
  const f = files[0]
  form.file = f
  form.fileName = f.name
  form.size = formatFileSize(f.size)
  e.target.value = ''
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return size.toFixed(2) + units[i]
}

/** 内容类型切换时，清空文件状态 */
function handleTypeChange() {
  form.file = null
  form.fileName = ''
  if (!isEdit.value) {
    form.dz = ''
  }
}

// ───────── 数据接口 ─────────

async function fetchList() {
  loading.value = true
  try {
    const res = await getContentList({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword,
      scbj: query.scbj,
    })
    if (res.code === 0 && res.data) {
      list.value = res.data.records || res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取内容列表失败:', err)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.pageNum = 1
  fetchList()
}

function handleReset() {
  query.keyword = ''
  query.scbj = '0'
  query.pageNum = 1
  fetchList()
}

function resetForm() {
  Object.assign(form, {
    id: '',
    contentId: '',
    title: '',
    type: '',
    targetGroup: [],
    dz: '',
    content: '',
    size: '',
    status: '待发布',
    file: null,
    fileName: '',
  })
}

function handleAdd() {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

// ───────── 发布 / 下架 ─────────

async function handlePublish(row) {
  try {
    const res = await publishContent({ id: row.id })
    if (res.code === 0) {
      ElMessage.success('发布成功')
      fetchList()
    } else {
      ElMessage.error(res.message || '发布失败')
    }
  } catch (err) {
    console.error('发布失败:', err)
  }
}

async function handleUnpublish(row) {
  ElMessageBox.confirm('确定要下架此内容吗？', '提示', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await unpublishContent({ id: row.id })
      if (res.code === 0) {
        ElMessage.success('下架成功')
        fetchList()
      } else {
        ElMessage.error(res.message || '下架失败')
      }
    } catch (err) {
      console.error('下架失败:', err)
    }
  }).catch(() => {})
}

// ───────── 查看 / 修改 / 预览 / 删除 ─────────

async function handleView(row) {
  try {
    const res = await getContentDetail(row.id)
    if (res.code === 0 && res.data) {
      viewData.value = res.data
    } else {
      viewData.value = row
    }
    previewUrl.value = ''
    if (viewData.value.dzUrl) {
      previewUrl.value = viewData.value.dzUrl
    } else if (viewData.value.dz) {
      try {
        const pres = await getPreviewUrl(viewData.value.dz)
        if (pres.code === 0 && pres.data) {
          previewUrl.value = pres.data
        }
      } catch {}
    }
    viewVisible.value = true
  } catch (err) {
    console.error('获取内容详情失败:', err)
    viewData.value = row
    viewVisible.value = true
  }
}

function onPreviewError() {
  previewUrl.value = ''
}

async function handleEdit(row) {
  isEdit.value = true
  try {
    const res = await getContentDetail(row.id)
    if (res.code === 0 && res.data) {
      const d = res.data
      let groups = d.targetGroup
      if (typeof groups === 'string') {
        groups = groups ? groups.split(/[,，]\s*/).filter(Boolean) : []
      } else if (!Array.isArray(groups)) {
        groups = []
      }
      Object.assign(form, {
        id: d.id,
        contentId: d.contentId,
        title: d.title,
        type: d.type,
        targetGroup: groups,
        dz: d.dz || '',
        content: d.content || '',
        size: d.size || '',
        status: d.status || '待发布',
        file: null,
        fileName: '',
      })
    } else {
      let groups = row.targetGroup
      if (typeof groups === 'string') {
        groups = groups ? groups.split(/[,，]\s*/).filter(Boolean) : []
      } else if (!Array.isArray(groups)) {
        groups = []
      }
      Object.assign(form, {
        id: row.id,
        contentId: row.contentId,
        title: row.title,
        type: row.type,
        targetGroup: groups,
        dz: row.dz || '',
        content: row.content || '',
        size: row.size || '',
        status: row.status || '待发布',
        file: null,
        fileName: '',
      })
    }
    dialogVisible.value = true
  } catch (err) {
    console.error('获取内容详情失败:', err)
  }
}

async function handlePreview(row) {
  if (row.dzUrl) {
    window.open(row.dzUrl, '_blank')
  } else if (row.dz) {
    try {
      const res = await getPreviewUrl(row.dz)
      if (res.code === 0 && res.data) {
        window.open(res.data, '_blank')
      } else {
        ElMessage.warning('无法获取预览地址')
      }
    } catch (err) {
      if (row.dz) {
        window.open(row.dz, '_blank')
      } else {
        ElMessage.warning('该内容无文件可预览')
      }
    }
  } else {
    ElMessage.info('该内容无文件可预览')
  }
}

function handleDelete(row) {
  ElMessageBox.confirm('确定要删除此内容吗？', '提示', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await deleteContent({ id: row.id })
      if (res.code === 0) {
        ElMessage.success('删除成功')
        fetchList()
      }
    } catch (err) {
      console.error('删除失败:', err)
    }
  }).catch(() => {})
}

function handleDialogClose() {
  form.file = null
  form.fileName = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    // 视频/图片/文档文件必传
    if (form.type !== 'content') {
      if (!form.file && !form.dz) {
        ElMessage.warning('请上传文件')
        return
      }
    }

    submitting.value = true
    try {
      let dz = form.file ? '' : form.dz
      if (form.file) {
        const fData = new FormData()
        fData.append('file', form.file)
        const uploadRes = await uploadFile(fData)
        if (uploadRes.code === 0 && uploadRes.data) {
          dz = uploadRes.data.objectName || ''
        }
      }

      const targetGroupStr = Array.isArray(form.targetGroup) ? form.targetGroup.join(',') : form.targetGroup

      const payload = {
        id: form.id,
        contentId: form.contentId,
        title: form.title,
        type: form.type,
        dz: dz,
        content: form.content,
        size: form.type === 'content' ? '' : form.size,
        targetGroup: targetGroupStr,
      }

      // 新增传状态，修改不传
      let res
      if (isEdit.value) {
        res = await updateContent(payload)
      } else {
        payload.status = form.status // "待发布"
        payload.publishedTime = null
        res = await addContent(payload)
      }

      if (res.code === 0) {
        ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
        dialogVisible.value = false
        fetchList()
      }
    } catch (err) {
      console.error('提交失败:', err)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchList()
  loadGroupOptions()
})
</script>

<style scoped>
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
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 表格 */
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

/* ========== 上传区域 ========== */

.upload-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 24px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
}

.upload-wrapper:hover {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.04);
}

.upload-icon {
  font-size: 36px;
  color: #909399;
}

.upload-wrapper:hover .upload-icon {
  color: #409eff;
}

.upload-text {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.upload-file-name {
  font-size: 13px;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 10px;
  border-radius: 4px;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

.upload-video { border-color: #409eff; background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%); }
.upload-video .upload-icon { color: #409eff; }

.upload-image { border-color: #b37feb; background: linear-gradient(135deg, #f9f0ff 0%, #f0e6ff 100%); }
.upload-image .upload-icon { color: #b37feb; }

.upload-doc { border-color: #faad14; background: linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%); }
.upload-doc .upload-icon { color: #faad14; }

.upload-old-file {
  background: #fdf6ec !important;
  color: #e6a23c !important;
}

/* ========== 预览区域 ========== */

.preview-section {
  margin-top: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.preview-content-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
  display: block;
  margin: 0 auto;
  border-radius: 4px;
}

.preview-video {
  width: 100%;
  max-height: 400px;
  border-radius: 4px;
}

/* 内容类型 radio 按钮组样式 */
:deep(.el-radio-group .el-radio-button) {
  margin-bottom: 4px;
}
:deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
