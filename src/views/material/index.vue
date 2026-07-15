<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><FolderOpened /></el-icon>
      素材库
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-tabs v-model="activeType" @tab-change="handleTypeChange">
          <el-tab-pane label="全部" name="" />
          <el-tab-pane label="图片" name="image" />
          <el-tab-pane label="视频" name="video" />
          <el-tab-pane label="PPT" name="ppt" />
          <el-tab-pane label="PDF" name="pdf" />
          <el-tab-pane label="Word" name="word" />
        </el-tabs>
        <el-input v-model="query.keyword" placeholder="素材名称" clearable style="width: 180px; margin-left: 12px;" @clear="handleSearch" />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="handleUpload">上传素材</el-button>
      </div>
    </div>

    <!-- 素材网格 -->
    <div class="page-card" style="margin-top: 16px;">
      <div v-loading="loading" class="material-grid">
        <div v-if="list.length === 0 && !loading" class="empty-tip">
          <el-empty description="暂无素材" />
        </div>
        <div v-for="item in sortedList" :key="item.id" class="material-card" @click="handlePreview(item)">
          <div class="material-thumb">
            <img v-if="item.type === 'image'" :src="getPreviewUrl(item)" class="thumb-img" />
            <video v-else-if="item.type === 'video'" :src="getVideoCoverUrl(item)" class="thumb-img" muted preload="metadata" />
            <template v-else-if="item.type === 'ppt' || item.type === 'pdf' || item.type === 'word'">
              <img
                v-if="docPreviewReady[item.id]"
                :src="getDocPreviewCoverUrl(item)"
                class="thumb-img"
                @error="delete docPreviewReady[item.id]"
              />
              <div v-else class="thumb-doc">
                <el-icon :size="40" color="#e6a23c"><Document /></el-icon>
              </div>
            </template>
            <div v-else class="thumb-doc">
              <el-icon :size="40" color="#e6a23c"><Document /></el-icon>
            </div>
            <!-- 类型角标 -->
            <span class="type-badge" :class="'type-' + item.type">{{ getDocTypeLabel(item.type) }}</span>
          </div>
          <div class="material-info">
            <div class="material-name" :title="item.name">{{ item.name }}</div>
            <div class="material-meta">
              <span>{{ formatFileSize(item.fileSize) }}</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
          </div>
          <div class="material-actions">
            <el-button link type="primary" size="small" @click.stop="handleRename(item)">重命名</el-button>
            <el-button link type="danger" size="small" @click.stop="handleDelete(item)">删除</el-button>
          </div>
        </div>
      </div>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <!-- 上传素材对话框 -->
    <el-dialog
      v-model="uploadVisible"
      title="上传素材"
      width="520px"
      :close-on-click-modal="false"
      @close="resetUploadForm"
    >
      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="100px">
        <el-form-item label="素材类型" prop="type">
          <el-select v-model="uploadForm.type" style="width: 200px;">
            <el-option label="图片" value="image" />
            <el-option label="视频" value="video" />
            <el-option label="PPT" value="ppt" />
            <el-option label="PDF" value="pdf" />
            <el-option label="Word" value="word" />
          </el-select>
        </el-form-item>
        <el-form-item label="素材文件" prop="file">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :accept="uploadAccept"
            :on-change="onFileChange"
            :on-remove="onFileRemove"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">{{ uploadTip }}</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="素材名称" prop="name">
          <el-input v-model="uploadForm.name" placeholder="输入素材名称（不含扩展名）" />
        </el-form-item>

      </el-form>
      <template #footer>
        <el-button :disabled="uploading" @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUploadSubmit">{{ uploading ? '上传中...' : '确定上传' }}</el-button>
      </template>
    </el-dialog>

    <!-- PDF/PPT/Word 预览对话框（PDFBox 实时渲染） -->
    <el-dialog
      v-model="previewVisible"
      :title="previewTitle"
      width="80vw"
      top="5vh"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="preview-body" v-loading="previewLoading">
        <div class="preview-nav">
          <el-button
            :disabled="previewTotalPages <= 0 || previewCurrentIndex <= 0"
            @click="previewCurrentIndex--"
            circle
          >‹</el-button>
          <div class="preview-image-wrap">
            <img v-if="previewTotalPages > 0"
              :src="previewImageUrl"
              class="preview-image"
              @load="previewLoading = false"
              @error="previewLoading = false"
            />
            <div v-else class="preview-not-ready-img">
              <el-icon :size="48" color="#e6a23c"><WarningFilled /></el-icon>
              <p>预览正在生成中，请稍后再试</p>
            </div>
          </div>
          <el-button
            :disabled="previewTotalPages <= 0 || previewCurrentIndex >= previewTotalPages - 1"
            @click="previewCurrentIndex++"
            circle
          >›</el-button>
        </div>
      </div>
      <div class="preview-footer">
        <span v-if="previewTotalPages > 0">第 {{ previewCurrentIndex + 1 }} / {{ previewTotalPages }} 页</span>
        <span v-else class="preview-not-ready">
          <el-icon style="vertical-align: middle; margin-right: 4px;"><WarningFilled /></el-icon>
          预览正在生成中，请稍后再试
        </span>
      </div>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog
      v-model="renameVisible"
      title="重命名"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form ref="renameFormRef" :model="renameForm" :rules="renameRules" label-width="80px">
        <el-form-item label="素材名称" prop="name">
          <el-input v-model="renameForm.name" placeholder="输入新的素材名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="handleRenameSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Document, WarningFilled } from '@element-plus/icons-vue'
import { listMaterial, uploadMaterial, updateMaterial, deleteMaterial } from '@/api/material'
import { initChunkUpload, uploadChunk, completeChunkUpload, getChunkMergeProgress } from '@/api/screen'
import request from '@/utils/request'

const loading = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const renaming = ref(false)

// PDF/PPT/Word 预览
const previewVisible = ref(false)
const previewTitle = ref('')
const previewId = ref('')
const previewCurrentIndex = ref(0)
const previewTotalPages = ref(0)
const previewLoading = ref(false)

const previewImageUrl = computed(() => {
  if (!previewId.value) return ''
  return `/api/storage/fetch?objectName=preview%2F${previewId.value}%2Fpage_${previewCurrentIndex.value}.jpg`
})
const total = ref(0)
const list = ref([])
const activeType = ref('')

const query = reactive({
  pageNum: 1,
  pageSize: 12,
  type: '',
  keyword: '',
})

const fetchList = async () => {
  loading.value = true
  try {
    const payload = { ...query }
    if (activeType.value) payload.type = activeType.value
    const res = await listMaterial(payload)
    if (res.code === 0 && res.data) {
      const d = res.data
      list.value = d.records || d.list || []
      total.value = d.total || 0
    }
  } catch (err) {
    console.error('[素材库] 获取列表失败:', err)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.pageNum = 1
  fetchList()
}

const handleReset = () => {
  query.keyword = ''
  query.pageNum = 1
  fetchList()
}

const handleTypeChange = () => {
  query.pageNum = 1
  fetchList()
}

// ========== 上传素材 ==========
const uploadVisible = ref(false)
const uploadRef = ref(null)
const uploadFormRef = ref(null)
const uploadForm = reactive({
  type: 'image',
  name: '',
  file: null,
})

// 根据素材类型生成文件选择器 accept 和提示
const uploadAccept = computed(() => {
  const m = {
    image: '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg',
    video: '.mp4,.webm,.avi,.mov,.mkv,.flv,.wmv',
    ppt: '.ppt,.pptx',
    pdf: '.pdf',
    word: '.doc,.docx',
  }
  return m[uploadForm.type] || '*'
})

const uploadTip = computed(() => {
  const m = {
    image: '支持 PNG、JPG、GIF、WebP、BMP、SVG 格式',
    video: '支持 MP4、WebM、AVI、MOV、MKV、FLV、WMV 格式',
    ppt: '支持 PPT、PPTX 格式',
    pdf: '支持 PDF 格式',
    word: '支持 DOC、DOCX 格式',
  }
  return m[uploadForm.type] || '支持常见文件格式'
})

const uploadRules = {
  type: [{ required: true, message: '请选择素材类型', trigger: 'change' }],
  name: [{ required: true, message: '请输入素材名称', trigger: 'blur' }],
  file: [{ required: true, message: '请选择上传文件', trigger: 'change' }],
}

const handleUpload = () => {
  uploadForm.type = 'image'
  uploadForm.name = ''
  uploadForm.file = null
  uploadVisible.value = true
}

const onFileChange = (uploadFile) => {
  uploadForm.file = uploadFile.raw
}

const onFileRemove = () => {
  uploadForm.file = null
}

const resetUploadForm = () => {
  uploadForm.type = 'image'
  uploadForm.name = ''
  uploadForm.file = null
  if (uploadRef.value) uploadRef.value.clearFiles()
}

/**
 * 分段上传单个切片，带进度累积
 */
async function uploadSingleChunk(uploadId, file, chunkIndex, totalChunks, chunkSize) {
  const start = chunkIndex * chunkSize
  const end = Math.min(start + chunkSize, file.size)
  const blob = file.slice(start, end)
  const fd = new FormData()
  fd.append('uploadId', uploadId)
  fd.append('chunkIndex', String(chunkIndex))
  fd.append('totalChunks', String(totalChunks))
  fd.append('file', blob, file.name)
  await uploadChunk(fd)
  // 更新进度
  uploadProgress.value = Math.round(((chunkIndex + 1) / totalChunks) * 90)
}

/**
 * 轮询合片进度
 */
function pollMergeProgress(taskId) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const res = await getChunkMergeProgress(taskId)
        if (res.code === 0 && res.data) {
          const pct = res.data.progress ?? res.data.percentage ?? 0
          uploadProgress.value = 90 + Math.round(pct * 0.1)
          if (res.data.status === 'completed' || res.data.finished) {
            clearInterval(timer)
            uploadProgress.value = 100
            resolve(res.data)
          }
        }
      } catch (e) {
        clearInterval(timer)
        reject(e)
      }
    }, 1000)
  })
}

/**
 * 上传素材（小文件直传，大文件分片）
 */
const CHUNK_THRESHOLD = 100 * 1024 * 1024 // 100MB

const handleUploadSubmit = async () => {
  if (!uploadFormRef.value) return
  await uploadFormRef.value.validate(async (valid) => {
    if (!valid) return
    if (!uploadForm.file) {
      ElMessage.warning('请选择上传文件')
      return
    }
    uploading.value = true
    uploadProgress.value = 1
    const file = uploadForm.file
    try {
      if (file.size < CHUNK_THRESHOLD) {
        // 小文件直接上传（模拟进度条动画）
        const progressTimer = setInterval(() => {
          if (uploadProgress.value < 80) {
            uploadProgress.value += Math.round(Math.random() * 5) + 1
          }
        }, 300)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('name', uploadForm.name)
        formData.append('type', uploadForm.type)
        try {
          const res = await uploadMaterial(formData)
          clearInterval(progressTimer)
          if (res.code === 0) {
            uploadProgress.value = 100
            // 让用户看到100%后再关
            await new Promise(r => setTimeout(r, 600))
            ElMessage.success('上传成功')
            uploadVisible.value = false
            fetchList()
          } else {
            clearInterval(progressTimer)
            uploadProgress.value = 0
          }
        } catch (e) {
          clearInterval(progressTimer)
          uploadProgress.value = 0
          throw e
        }
      } else {
        // 大文件分片上传（先跑模拟进度动画，等真实进度追上）
        const simTimer = setInterval(() => {
          if (uploadProgress.value < 60) {
            uploadProgress.value += Math.round(Math.random() * 3) + 1
          }
        }, 500)

        // 1. 初始化
        const res_init = await initChunkUpload({
          fileName: file.name,
          fileSize: file.size,
        })
        clearInterval(simTimer)
        if (res_init.code !== 0 || !res_init.data) {
          ElMessage.error('分片上传初始化失败')
          uploadProgress.value = 0
          return
        }
        const { uploadId, chunkSize, totalChunks } = res_init.data

        // 2. 逐片上传（更新进度条）
        for (let i = 0; i < totalChunks; i++) {
          await uploadSingleChunk(uploadId, file, i, totalChunks, chunkSize)
          const pct = Math.round(((i + 1) / totalChunks) * 70)
          if (pct > uploadProgress.value) {
            uploadProgress.value = pct
          }
        }

        // 3. 完成合片
        const suffix = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : ''
        const finalObjectName = uploadId + suffix
        const res_complete = await completeChunkUpload({
          uploadId,
          totalChunks,
          finalObjectName,
        })
        if (res_complete.code !== 0 || !res_complete.data) {
          ElMessage.error('合片失败')
          return
        }

        // 4. 等待合片结果
        const taskId = res_complete.data.taskId
        if (taskId) {
          await pollMergeProgress(taskId)
        } else {
          uploadProgress.value = 100
        }

        // 5. 登记素材库
        const recordRes = await request.post('/api/material/record', {
          name: uploadForm.name,
          type: uploadForm.type,
          minioPath: finalObjectName,
          fileSize: file.size,
          mimeType: file.type || '',
        })
        if (recordRes && recordRes.code === 0) {
          ElMessage.success('上传成功')
          uploadVisible.value = false
          fetchList()
        } else {
          ElMessage.error('素材登记失败')
        }
      }
    } catch (err) {
      console.error('[素材库] 上传失败:', err)
      ElMessage.error('上传失败: ' + (err.message || '未知错误'))
    } finally {
      uploading.value = false
    }
  })
}

// ========== 重命名 ==========
const renameVisible = ref(false)
const renameFormRef = ref(null)
const renameForm = reactive({ id: '', name: '' })
const renameRules = {
  name: [{ required: true, message: '请输入素材名称', trigger: 'blur' }],
}

const handleRename = (item) => {
  renameForm.id = item.id
  renameForm.name = item.name
  renameVisible.value = true
}

const handleRenameSubmit = async () => {
  if (!renameFormRef.value) return
  await renameFormRef.value.validate(async (valid) => {
    if (!valid) return
    renaming.value = true
    try {
      const res = await updateMaterial({ id: renameForm.id, name: renameForm.name })
      if (res.code === 0) {
        ElMessage.success('重命名成功')
        renameVisible.value = false
        fetchList()
      }
    } catch (err) {
      console.error('[素材库] 重命名失败:', err)
    } finally {
      renaming.value = false
    }
  })
}

// ========== 删除 ==========
const handleDelete = (item) => {
  ElMessageBox.confirm(`确定删除素材 "${item.name}" 吗？`, '提示', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await deleteMaterial(item.id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        fetchList()
      }
    } catch (err) {
      console.error('[素材库] 删除失败:', err)
    }
  }).catch(() => {})
}

// ========== 预览 ==========
const handlePreview = async (item) => {
  if (item.type === 'image') {
    window.open(getPreviewUrl(item), '_blank')
    return
  }
  if (item.type === 'video') {
    window.open(`/api/storage/fetch/range?objectName=${encodeURIComponent(item.minioPath)}`, '_blank')
    return
  }

  // PDF/PPT/Word 走预生成的预览图片
  previewTitle.value = item.name
  previewCurrentIndex.value = 0
  previewId.value = item.id
  previewVisible.value = true
  previewLoading.value = false

  // 获取真实页数
  getPreviewPageCount(item.id)
}

// 从 .count 文件获取真实页数
async function getPreviewPageCount(id) {
  try {
    const resp = await fetch(`/api/storage/fetch?objectName=preview%2F${id}%2F.count`)
    if (resp.ok) {
      const text = await resp.text()
      const count = parseInt(text, 10)
      previewTotalPages.value = !isNaN(count) && count > 0 ? count : 0
    } else {
      previewTotalPages.value = 0
    }
  } catch {
    previewTotalPages.value = 0
  }
}

function getPreviewUrl(item) {
  if (!item.minioPath) return ''
  return `/api/storage/fetch?objectName=${encodeURIComponent(item.minioPath)}`
}

function getVideoCoverUrl(item) {
  if (!item.minioPath) return ''
  // 用 range 接口只拉取视频前一小段作为封面，避免下载整个视频
  return `/api/storage/fetch/range?objectName=${encodeURIComponent(item.minioPath)}`
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let idx = 0
  let size = bytes
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx++
  }
  return size.toFixed(2) + ' ' + units[idx]
}

function formatTime(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getDocTypeLabel(type) {
  const labels = {
    image: '图片',
    video: '视频',
    ppt: 'PPT',
    pdf: 'PDF',
    word: 'Word',
  }
  return labels[type] || type
}

// 按类型分组排序：图片 → 视频 → PPT → PDF → Word，每组内按上传时间倒序
const sortedList = computed(() => {
  const order = { image: 0, video: 1, ppt: 2, pdf: 3, word: 4 }
  return [...list.value].sort((a, b) => {
    const orderA = order[a.type] ?? 99
    const orderB = order[b.type] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
})

function getDocExt(item) {
  if (!item.minioPath) return ''
  const idx = item.minioPath.lastIndexOf('.')
  return idx >= 0 ? item.minioPath.substring(idx) : ''
}

// 标记哪些文档类素材的预览图已生成
const docPreviewReady = reactive({})

function getDocPreviewCoverUrl(item) {
  return `/api/storage/fetch?objectName=preview%2F${item.id}%2Fpage_0.jpg`
}

// 列表加载后，检查文档类素材的预览封面
watch(list, (newList) => {
  if (!newList || newList.length === 0) return
  newList.forEach(item => {
    if (item.type === 'ppt' || item.type === 'pdf' || item.type === 'word') {
      // 异步检查 .count 文件是否存在
      fetch(`/api/storage/fetch?objectName=preview%2F${item.id}%2F.count`)
        .then(res => {
          if (res.ok) docPreviewReady[item.id] = true
        })
        .catch(() => {})
    }
  })
})

// 翻页时触发 loading
watch(previewCurrentIndex, () => {
  previewLoading.value = true
})

const refreshTimer = ref(null)

onMounted(() => {
  fetchList()
  // 无感刷新：每10秒自动刷新列表，用于检测文档预览图生成完成
  refreshTimer.value = setInterval(() => {
    fetchList()
  }, 10000)
})

onBeforeUnmount(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-bar-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.filter-bar-right {
  display: flex;
  align-items: center;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.material-card {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.material-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.material-thumb {
  width: 100%;
  height: 140px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-doc {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.doc-type {
  font-size: 12px;
  color: #909399;
}

.type-badge {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 1.6;
  border-radius: 3px;
  color: #fff;
  background: rgba(0,0,0,0.5);
}

.type-badge.type-image {
  background: rgba(64,158,255,0.8);
}
.type-badge.type-video {
  background: rgba(245,108,108,0.8);
}
.type-badge.type-ppt {
  background: rgba(230,162,60,0.8);
}
.type-badge.type-pdf {
  background: rgba(144,147,153,0.8);
}
.type-badge.type-word {
  background: rgba(103,194,58,0.8);
}

.material-info {
  padding: 8px 10px 4px;
  flex: 1;
}

.material-name {
  font-size: 13px;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.material-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 8px 6px;
  gap: 4px;
}

.empty-tip {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.page-card {
  overflow-x: auto;
}

.preview-body {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.preview-image-wrap {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  max-height: 75vh;
  overflow: auto;
}

.preview-image {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
}

.preview-footer {
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.preview-not-ready {
  color: #e6a23c;
  font-size: 14px;
}

.preview-not-ready-img {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.preview-not-ready-img p {
  margin-top: 12px;
  font-size: 14px;
}

.preview-nav .el-button {
  font-size: 18px;
  flex-shrink: 0;
}
</style>
