<template>
  <div class="editor-layout">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button size="small" @click="goBack">← 返回</el-button>
        <el-button size="small" type="warning" @click="resetCanvas">新建</el-button>
        <span class="toolbar-title">{{ isNew ? '新建大屏' : '编辑大屏' }}</span>
        <el-input v-model="publishTitle" placeholder="大屏标题" style="width:200px;margin-left:12px;" @input="dirty=true" />
        <el-select v-model="targetGroupId" placeholder="选择绑定终端" style="width:200px;margin-left:12px;" clearable @change="dirty=true">
          <el-option v-for="t in serverTerminals" :key="t.id" :label="t.equipmentName" :value="t.id" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button size="small" @click="handleSave">💾 保存</el-button>
        <el-button size="small" type="primary" @click="handlePreview">👁 预览</el-button>
      </div>
    </div>
    <div class="editor-body">
      <div class="editor-sidebar left-sidebar">
        <div class="sidebar-title">组件库</div>
        <div class="component-list">
          <div v-for="cp in componentTypes" :key="cp.type" class="component-item" draggable="true" @dragstart="onDragStart($event, cp.type)">
            <span class="cp-icon">{{ cp.icon }}</span>
            <span class="cp-label">{{ cp.label }}</span>
          </div>
        </div>
        <el-divider style="margin:8px 0;" />
        <div class="sidebar-title">画布设置</div>
        <div class="canvas-settings">
          <div class="setting-row"><label>宽度</label><el-input-number v-model="pageWidth" :min="800" :max="7680" :step="100" size="small" style="width:100px;" @change="onSettingChange" /></div>
          <div class="setting-row"><label>高度</label><el-input-number v-model="pageHeight" :min="600" :max="4320" :step="100" size="small" style="width:100px;" @change="onSettingChange" /></div>
          <div class="setting-row"><label>预设</label><el-select v-model="presetSize" size="small" style="width:130px;" @change="onPresetChange"><el-option label="1920×1080" :value="[1920,1080]" /><el-option label="3840×2160" :value="[3840,2160]" /><el-option label="1366×768" :value="[1366,768]" /><el-option label="自定义" :value="[0,0]" /></el-select></div>
        </div>
      </div>
      <div class="canvas-scroll" ref="scrollRef">
        <div class="canvas-stage" ref="canvasRef" :style="stageStyle" @drop="onDrop" @dragover.prevent @mousedown="onCanvasClick">
          <div v-for="(el, idx) in elements" :key="el.id" class="canvas-element" :class="{ selected: selectedIdx === idx, 'layout-block': el.layoutMode === 'block' }" :style="elementStyle(el)" @mousedown.stop="startDrag(idx, $event)">
            <div v-if="selectedIdx === idx" class="el-badge">{{ el.label }}</div>
            <div v-if="el.layoutMode === 'block'" class="block-overlay">━ 占位</div>
            <div v-if="selectedIdx === idx" class="resize-handle tl" @mousedown.stop="startResize(idx, 'tl', $event)"></div>
            <div v-if="selectedIdx === idx" class="resize-handle tr" @mousedown.stop="startResize(idx, 'tr', $event)"></div>
            <div v-if="selectedIdx === idx" class="resize-handle bl" @mousedown.stop="startResize(idx, 'bl', $event)"></div>
            <div v-if="selectedIdx === idx" class="resize-handle br" @mousedown.stop="startResize(idx, 'br', $event)"></div>
            <video v-if="el.type==='video'" :key="'v_'+el.src" :src="resolveMediaUrl(el.src)" :autoplay="el.autoplay!==false" :muted="el.muted!==false" :loop="el.loop!==false" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;" @error="onMediaError"></video>
            <div v-if="el.type==='video' && !el.src" class="placeholder-text">🎬 视频组件<br><span style="font-size:11px;opacity:0.6;">上传视频后自动播放</span></div>
            <img v-else-if="el.type==='image'" :key="'i_'+el.src" :src="resolveMediaUrl(el.src)" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;" :style="{ opacity: el.opacity ?? 1 }" @error="onMediaError" />
            <div v-else-if="el.type==='carousel'" class="carousel-wrap">
              <img v-for="(img, ci) in (el.images||[])" :key="ci" :src="resolveMediaUrl(img)" style="width:100%;height:100%;object-fit:contain;position:absolute;left:0;top:0;" :style="{ opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
              <div v-if="!el.images || !el.images.length" class="placeholder-text">📷 轮播图<br><span style="font-size:11px;opacity:0.6;">点击上传图片</span></div>
            </div>
            <div v-else-if="el.type==='text'" class="el-text" :style="{ fontSize: el.fontSize+'px', color: el.color, fontWeight: el.bold?'bold':'normal', textAlign: el.textAlign||'center', fontFamily: el.fontFamily||'inherit' }">{{ el.content || '文字内容' }}</div>
            <div v-else-if="el.type==='scrollText'" class="el-scroll-text">
              <div class="scroll-inner" :style="{ fontSize: el.fontSize+'px', color: el.color, fontFamily: el.fontFamily||'inherit', background: el.backgroundColor||'transparent', animationDuration: scrollDuration(el) }">{{ el.content || '📜 滚动文字内容' }}</div>
            </div>

            <div v-else-if="el.type==='clock'" class="el-clock" :style="{ fontSize: el.fontSize+'px', color: el.color, fontFamily: el.fontFamily||'monospace', background: el.backgroundColor||'transparent' }" :class="'clock-'+(el.clockStyle||'digital')">
              <div v-if="el.clockStyle==='simple'" class="clock-simple">{{ currentTimeStr }}</div>
              <div v-else-if="el.clockStyle==='flip'" class="clock-flip"><span class="flip-num">{{ currentTimeStr.slice(0,2) }}</span><span class="flip-sep">:</span><span class="flip-num">{{ currentTimeStr.slice(3,5) }}</span><span class="flip-sep">:</span><span class="flip-num">{{ currentTimeStr.slice(6,8) }}</span></div>
              <div v-else class="clock-digital">{{ currentTimeStr }}</div>
              <div v-if="el.showDate!==false" class="clock-date">{{ currentDateStr }}</div>
            </div>

          </div>
        </div>
      </div>
      <div class="editor-sidebar right-sidebar">
        <div class="sidebar-title">属性设置</div>
        <div v-if="selectedEl" class="prop-body">
          <el-form label-position="top" size="small">
            <el-form-item label="标签"><el-input v-model="selectedEl.label" @input="emitChange" /></el-form-item>
            <el-divider style="margin:4px 0;" />
            <div class="prop-grid">
              <el-form-item label="X"><el-input-number v-model="selectedEl.x" :min="0" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
              <el-form-item label="Y"><el-input-number v-model="selectedEl.y" :min="0" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
              <el-form-item label="W"><el-input-number v-model="selectedEl.w" :min="20" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
              <el-form-item label="H"><el-input-number v-model="selectedEl.h" :min="20" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
            </div>

            <el-divider style="margin:4px 0;" />
            <el-form-item label="布局模式">
              <el-select v-model="selectedEl.layoutMode" style="width:100%;" @change="emitChange">
                <el-option label="悬浮（可叠加）" value="float" />
                <el-option label="占位（不可重叠）" value="block" />
              </el-select>
            </el-form-item>

            <template v-if="selectedEl.type==='video'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="上传视频">
                <el-upload :auto-upload="false" :show-file-list="false" accept="video/*" @change="(f)=>handleFileUpload(f,'video')">
                  <el-button size="small" type="primary">📁 选择文件</el-button>
                </el-upload>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="视频URL">
                <el-input v-model="selectedEl.src" placeholder="或直接输入URL" @input="emitChange" />
              </el-form-item>
              <div class="prop-grid" style="margin-top:8px;">
                <el-form-item label="自动播放"><el-switch v-model="selectedEl.autoplay" @change="emitChange" /></el-form-item>
                <el-form-item label="静音"><el-switch v-model="selectedEl.muted" @change="emitChange" /></el-form-item>
                <el-form-item label="循环播放"><el-switch v-model="selectedEl.loop" @change="emitChange" /></el-form-item>
              </div>
              <div v-if="selectedEl.src" class="upload-preview" style="max-height:80px;">
                <video :src="resolveMediaUrl(selectedEl.src)" :autoplay="selectedEl.autoplay!==false" :muted="selectedEl.muted!==false" :loop="selectedEl.loop!==false" style="width:100%;max-height:80px;border-radius:4px;" />
              </div>
            </template>

            <template v-if="selectedEl.type==='image'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="上传图片">
                <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'image')">
                  <el-button size="small" type="primary">📁 选择文件</el-button>
                </el-upload>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="图片URL">
                <el-input v-model="selectedEl.src" placeholder="或直接输入URL" @input="emitChange" />
              </el-form-item>
              <div v-if="selectedEl.src" class="upload-preview" style="max-height:80px;">
                <img :src="resolveMediaUrl(selectedEl.src)" style="width:100%;max-height:80px;object-fit:contain;border-radius:4px;" />
              </div>
              <el-form-item label="透明度">
                <el-slider v-model="selectedEl.opacity" :min="0.1" :max="1" :step="0.05" @change="emitChange" />
              </el-form-item>
            </template>

            <template v-if="selectedEl.type==='carousel'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="添加图片">
                <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'carousel')">
                  <el-button size="small" type="primary">📁 添加图片</el-button>
                </el-upload>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="切换间隔(秒)">
                <el-input-number v-model="selectedEl.interval" :min="1" :max="60" style="width:100%;" @change="emitChange" />
              </el-form-item>
              <div class="img-list">
                <div v-for="(img,ci) in selectedEl.images||[]" :key="ci" class="img-item">
                  <img :src="resolveMediaUrl(img)" style="width:36px;height:24px;object-fit:contain;border-radius:2px;" />
                  <span>第{{ ci+1 }}张</span>
                  <el-button size="small" type="danger" link @click="selectedEl.images.splice(ci,1);emitChange">×</el-button>
                </div>
                <div v-if="!selectedEl.images||!selectedEl.images.length" style="font-size:11px;color:#909399;padding:4px;">暂无图片</div>
              </div>
            </template>

            <template v-if="selectedEl.type==='text'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="文字内容"><el-input v-model="selectedEl.content" type="textarea" :rows="3" @input="emitChange" /></el-form-item>
              <div class="prop-grid">
                <el-form-item label="字体"><el-select v-model="selectedEl.fontFamily" style="width:100%;" @change="emitChange"><el-option label="默认" value="" /><el-option label="微软雅黑" value="Microsoft YaHei" /><el-option label="宋体" value="SimSun" /><el-option label="Arial" value="Arial, sans-serif" /><el-option label="Times New Roman" value="Times New Roman, serif" /></el-select></el-form-item>
                <el-form-item label="字号"><el-input-number v-model="selectedEl.fontSize" :min="12" :max="200" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
              </div>
              <div class="prop-grid">
                <el-form-item label="颜色"><el-color-picker v-model="selectedEl.color" @change="emitChange" /></el-form-item>
                <el-form-item label="加粗"><el-switch v-model="selectedEl.bold" @change="emitChange" /></el-form-item>
              </div>
              <el-form-item label="对齐">
                <el-radio-group v-model="selectedEl.textAlign" @change="emitChange">
                  <el-radio-button value="left">左</el-radio-button>
                  <el-radio-button value="center">中</el-radio-button>
                  <el-radio-button value="right">右</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </template>

            <template v-if="selectedEl.type==='scrollText'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="文字内容"><el-input v-model="selectedEl.content" type="textarea" :rows="2" @input="emitChange" /></el-form-item>
              <div class="prop-grid">
                <el-form-item label="字体"><el-select v-model="selectedEl.fontFamily" style="width:100%;" @change="emitChange"><el-option label="默认" value="" /><el-option label="微软雅黑" value="Microsoft YaHei" /><el-option label="宋体" value="SimSun" /><el-option label="Arial" value="Arial, sans-serif" /></el-select></el-form-item>
                <el-form-item label="字号"><el-input-number v-model="selectedEl.fontSize" :min="12" :max="200" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
              </div>
              <div class="prop-grid">
                <el-form-item label="颜色"><el-color-picker v-model="selectedEl.color" @change="emitChange" /></el-form-item>
                <el-form-item label="背景色"><el-color-picker v-model="selectedEl.backgroundColor" show-alpha @change="emitChange" /></el-form-item>
              </div>
              <el-form-item label="速度">
                <el-select v-model="selectedEl.speed" style="width:100%;" @change="emitChange">
                  <el-option label="慢速" value="slow" />
                  <el-option label="中速" value="medium" />
                  <el-option label="快速" value="fast" />
                </el-select>
              </el-form-item>
            </template>
            <template v-if="selectedEl.type==='clock'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="样式">
                <el-select v-model="selectedEl.clockStyle" style="width:100%;" @change="emitChange">
                  <el-option label="数码管" value="digital" />
                  <el-option label="简约" value="simple" />
                  <el-option label="翻页钟" value="flip" />
                </el-select>
              </el-form-item>
              <div class="prop-grid">
                <el-form-item label="字体"><el-select v-model="selectedEl.fontFamily" style="width:100%;" @change="emitChange"><el-option label="等宽(数码管风格)" value="monospace" /><el-option label="默认" value="" /><el-option label="微软雅黑" value="Microsoft YaHei" /></el-select></el-form-item>
                <el-form-item label="字号"><el-input-number v-model="selectedEl.fontSize" :min="20" :max="300" controls-position="right" style="width:100%;" @change="emitChange" /></el-form-item>
              </div>
              <div class="prop-grid">
                <el-form-item label="颜色"><el-color-picker v-model="selectedEl.color" @change="emitChange" /></el-form-item>
                <el-form-item label="是否显示日期"><el-switch v-model="selectedEl.showDate" @change="emitChange" /></el-form-item>
              </div>
            </template>
            <el-divider style="margin:8px 0;" />
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <el-button size="small" @click="copyElement" style="flex:1;">📋 复制</el-button>
              <el-button size="small" @click="moveUp" style="flex:1;">⬆️ 上移</el-button>
              <el-button size="small" @click="moveDown" style="flex:1;">⬇️ 下移</el-button>
            </div>
            <el-button type="danger" size="small" style="width:100%;margin-top:6px;" @click="removeElement">🗑 删除此元素</el-button>
          </el-form>
        </div>
        <div v-else class="prop-body no-selection">
          <div class="no-select-hint">点击选择元素编辑属性</div>
          <el-divider style="margin:8px 0;" />
          <el-form label-position="top" size="small">
            <el-form-item label="背景色"><el-color-picker v-model="backgroundColor" show-alpha @change="onSettingChange" /></el-form-item>
            <el-form-item label="背景图"><el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'bg')"><el-button size="small" type="primary">选择文件</el-button></el-upload></el-form-item>
            <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
              <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
            </el-form-item>
            <el-form-item label="背景图URL"><el-input v-model="backgroundImage" placeholder="或输入URL" @input="onSettingChange" /></el-form-item>
            <div v-if="backgroundImage" class="upload-preview"><img :src="resolveMediaUrl(backgroundImage)" style="width:100%;max-height:80px;object-fit:contain;border-radius:4px;" /></div>
            <div class="setting-row"><label>缩放</label><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;"><el-button size="small" :type="zoom===100?'primary':''" @click="zoom=100">100%</el-button><el-button size="small" :type="zoom===75?'primary':''" @click="zoom=75">75%</el-button><el-button size="small" :type="zoom===50?'primary':''" @click="zoom=50">50%</el-button><el-button size="small" :type="zoom===25?'primary':''" @click="zoom=25">25%</el-button><el-button size="small" type="success" @click="fitScreen">适应窗口</el-button></div></div>
          </el-form>
        </div>
      </div>
    </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getScreenDetail, saveScreen, updateScreen, uploadFile, getServerTerminalList,
         initChunkUpload, uploadChunk, completeChunkUpload, getChunkMergeProgress } from '@/api/screen'

const route = useRoute()
const router = useRouter()
const recordId = computed(() => route.params.id || '')
const isNew = computed(() => !recordId.value)

// ==== 画布 ====
const pageWidth = ref(1920)
const pageHeight = ref(1080)
const backgroundColor = ref('#000000')
const backgroundImage = ref('')
const publishTitle = ref('')
const targetGroupId = ref('')
const serverTerminals = ref([])
const zoom = ref(80)
const elements = ref([])
const selectedIdx = ref(-1)
const dirty = ref(false)

// ===== 上传进度 =====
const uploadProgress = ref(0)           // 当前上传进度百分比（0-100）
const uploading = ref(false)            // 是否正在上传中
const chunkEnabledThreshold = 104857600 // 100MB，超过此值走切片上传（与后端配置一致）
const CHUNK_SIZE = 5242880             // 5MB 每片
const MAX_RETRIES = 3                   // 单片最大重试次数
const UPLOAD_FILE_SIZE_LIMIT = 524288000 // 500MB（前端限制）
const CHUNK_CONCURRENCY = 3            // 切片并发上传数
const canvasRef = ref(null)
const scrollRef = ref(null)
const presetSize = ref([1920, 1080])

// ==== 组件类型 ====
const componentTypes = [
  { type: 'video', icon: '🎬', label: '视频' },
  { type: 'image', icon: '🖼', label: '图片' },
  { type: 'carousel', icon: '📷', label: '轮播图' },
  { type: 'text', icon: '📝', label: '文字' },
  { type: 'scrollText', icon: '📜', label: '滚动文本' },
  { type: 'clock', icon: '🕐', label: '时间' },
]

// ==== 运行时状态 ====
const currentTimeStr = ref('')
const currentDateStr = ref('')
const carouselState = reactive({})
let allCarouselTimers = {}
let clockTimer = null
let dragInfo = null
let resizeInfo = null

// ==== Computed ====
const stageStyle = computed(() => {
  const s = {
    width: pageWidth.value + 'px',
    height: pageHeight.value + 'px',
    transform: 'scale(' + (zoom.value / 100) + ')',
    transformOrigin: 'center center',
    backgroundColor: backgroundColor.value,
  }
  if (backgroundImage.value) {
    s.backgroundImage = 'url(' + resolveMediaUrl(backgroundImage.value) + ')'
    s.backgroundSize = '100% 100%'
    s.backgroundPosition = 'center'
  }
  return s
})

const selectedEl = computed(() => {
  if (selectedIdx.value < 0 || selectedIdx.value >= elements.value.length) return null
  return elements.value[selectedIdx.value]
})

function elementStyle(el) {
  return {
    position: 'absolute',
    left: el.x + 'px',
    top: el.y + 'px',
    width: el.w + 'px',
    height: el.h + 'px',
    zIndex: el.zIndex ?? 1,
    cursor: 'move',
  }
}

function emitChange() { dirty.value = true }

function onCanvasClick() { selectedIdx.value = -1 }

// ==== 生命周期 ====
onMounted(() => {
  loadServerTerminals()
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  if (recordId.value) loadRecord(recordId.value)
  else {
    elements.value = []; startCarouselTimer()
    fitScreen()
  }
  nextTick(() => setTimeout(fitScreen, 200))
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  Object.values(allCarouselTimers).forEach(t => clearInterval(t))
  // 清理全局防抖残留
  if (window._resizeTimer) {
    clearTimeout(window._resizeTimer)
    window._resizeTimer = null
  }
  window.removeEventListener('resize', onWindowResize)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
})

function onKeyDown(e) {
  const tag = document.activeElement?.tagName || ''
  const editable = document.activeElement?.getAttribute('contenteditable')
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'EL-INPUT' || editable === 'true') return
  if (!selectedEl.value) return
  if (e.key === 'Delete' || e.key === 'Backspace') { removeElement(); e.preventDefault() }
}

function updateClock() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  currentTimeStr.value = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  currentDateStr.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
}

// ==== 画布设置 ====
function onSettingChange() { dirty.value = true }

function onPresetChange(val) {
  if (val[0] === 0) return
  pageWidth.value = val[0]; pageHeight.value = val[1]
  dirty.value = true
  nextTick(() => fitScreen())
}

function fitScreen() {
  const el = scrollRef.value
  if (!el) return
  const pw = pageWidth.value, ph = pageHeight.value
  const cw = el.clientWidth - 40, ch = el.clientHeight - 40
  if (cw <= 0 || ch <= 0) return
  const s = Math.min(cw / pw, ch / ph)
  zoom.value = Math.round(Math.min(Math.max(s * 100, 10), 200))
}

function onWindowResize() {
  clearTimeout(window._resizeTimer)
  window._resizeTimer = setTimeout(fitScreen, 300)
}

// ==== 媒体URL ====
function resolveMediaUrl(name) {
  if (!name) return ''
  if (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('data:') || name.startsWith('blob:')) return name
  return '/api/screen/public-preview?objectName=' + encodeURIComponent(name)
}

function onMediaError(e) {
  console.warn('[ScreenEditor] 媒体资源加载失败:', e?.message || e)
}

// ==== 文件上传 ====
/**
 * 上传文件（支持小文件直传和大文件切片上传，含进度条）
 * 受后端全局并发上限 + IP 令牌桶双重限流保护，429 时提示"服务器上传繁忙，请稍后重试"
 *
 * @param {File|object} fileInfo 文件信息（el-upload 的 change 事件参数或 File 对象）
 * @param {string} targetType 目标类型：video / image / carousel / bg
 */
async function handleFileUpload(fileInfo, targetType) {
  const rawFile = fileInfo.raw || fileInfo.file || fileInfo
  if (!rawFile) return

  // ===== 文件大小检查（前端限制 500MB）=----
  if (rawFile.size > UPLOAD_FILE_SIZE_LIMIT) {
    ElMessage.error('文件大小不能超过 500MB')
    return
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    let objectName

    if (rawFile.size > chunkEnabledThreshold) {
      // ===== 大文件：切片上传 =====
      objectName = await uploadByChunks(rawFile, targetType)
    } else {
      // ===== 小文件：直传 =====
      objectName = await uploadDirect(rawFile, targetType)
    }

    // ===== 更新编辑器中的引用 =====
    if (objectName) {
      if (targetType === 'video' && selectedEl.value) {
        selectedEl.value.src = objectName
      } else if (targetType === 'image' && selectedEl.value) {
        selectedEl.value.src = objectName
      } else if (targetType === 'carousel' && selectedEl.value) {
        if (!selectedEl.value.images) selectedEl.value.images = []
        selectedEl.value.images.push(objectName)
      } else if (targetType === 'bg') {
        backgroundImage.value = objectName
      }
      dirty.value = true
      ElMessage.success('上传成功')
    }
  } catch (e) {
    if (e && e.message && e.message.includes('429')) {
      ElMessage.error('服务器上传繁忙，请稍后重试')
    } else if (e && e.message) {
      ElMessage.error('上传失败: ' + e.message)
    } else {
      ElMessage.error('上传异常，请重试')
    }
  } finally {
    uploading.value = false
    // 进度条保持 1 秒再回零，让用户看到 100% 完成
    if (uploadProgress.value >= 100) {
      setTimeout(() => { uploadProgress.value = 0 }, 1000)
    } else {
      uploadProgress.value = 0
    }
  }
}

/**
 * 小文件直传（带 onUploadProgress 进度回调）
 */
function uploadDirect(rawFile) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', rawFile)

    // 带进度回调的直传
    uploadFile(form, (progressEvent) => {
      if (progressEvent.total > 0) {
        uploadProgress.value = Math.round((progressEvent.loaded / progressEvent.total) * 100)
      }
    })
      .then(res => {
        if (res.code === 0 && res.data?.objectName) {
          uploadProgress.value = 100
          resolve(res.data.objectName)
        } else {
          reject(new Error(res.message || '上传失败'))
        }
      })
      .catch(e => {
        if (e.response && e.response.status === 429) {
          reject(new Error('429: 服务器上传繁忙，请稍后重试'))
        } else {
          reject(e)
        }
      })
  })
}

/**
 * 大文件切片上传（含进度条 + 并发窗口 + 失败重试）
 */
async function uploadByChunks(rawFile, targetType) {
  const totalChunks = Math.ceil(rawFile.size / CHUNK_SIZE)

  // ===== Step 1: 初始化 =====
  const initRes = await initChunkUpload({
    fileName: rawFile.name,
    fileSize: rawFile.size,
  })
  if (initRes.code !== 0 || !initRes.data) {
    throw new Error((initRes.message || '初始化失败') + (initRes.code === 1004 ? ' (429)' : ''))
  }

  const { uploadId, totalChunks: serverTotal, finalObjectName } = initRes.data
  // 以后端返回的 totalChunks 为准
  const realTotalChunks = serverTotal || totalChunks

  // ===== Step 2: 并发上传切片（每批3片）=----
  let successCount = 0
  let failedMsg = null

  // 进度更新函数
  const updateProgress = () => {
    uploadProgress.value = Math.round((successCount / realTotalChunks) * 99)
  }

  // 上传单片（含重试）
  async function uploadSingleChunk(index) {
    let lastError = null
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const start = index * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, rawFile.size)
        const blob = rawFile.slice(start, end)

        const form = new FormData()
        form.append('uploadId', uploadId)
        form.append('chunkIndex', index)
        form.append('totalChunks', realTotalChunks)
        form.append('file', blob, `chunk_${index}`)

        const res = await uploadChunk(form)
        if (res.code === 0 && res.data?.received) {
          successCount++
          updateProgress()
          return // 成功
        }
        lastError = new Error(res.message || `切片 ${index} 上传失败`)
      } catch (e) {
        lastError = e
        if (e.response && e.response.status === 429) {
          // 429 直接抛，不重试（是限流，不是网络问题）
          throw new Error('429: 服务器上传繁忙，请稍后重试')
        }
        await new Promise(r => setTimeout(r, 1000 * (retry + 1))) // 等 1s/2s/3s
      }
    }
    throw lastError || new Error(`切片 ${index} 上传失败`)
  }

  // 并发池执行
  const queue = []
  for (let i = 0; i < realTotalChunks; i++) {
    const task = uploadSingleChunk(i).catch(err => {
      failedMsg = err
    })
    queue.push(task)

    // 控制并发窗口
    if (queue.length >= CHUNK_CONCURRENCY) {
      await Promise.race(queue)
      // 清理已完成的
      while (queue.length > 0) {
        const done = await Promise.race(queue.map((p, idx) => p.then(() => idx)))
        queue.splice(done, 1)
      }
    }
  }

  // 等待剩余任务完成
  await Promise.all(queue)

  if (failedMsg) {
    throw failedMsg
  }

  // ===== Step 3: 完成合片 =====
  uploadProgress.value = 99
  const completeRes = await completeChunkUpload({
    uploadId,
    totalChunks: realTotalChunks,
    finalObjectName,
  })

  if (completeRes.code !== 0 || !completeRes.data) {
    if (completeRes.code === 1004) {
      throw new Error('429: 服务器上传繁忙，请稍后重试')
    }
    throw new Error(completeRes.message || '合片失败')
  }

  const { taskId, status } = completeRes.data

  // ===== Step 4: 轮询合片进度 =====
  if (taskId && status === 'merging') {
    // 轮询最多 60 秒
    const POLL_INTERVAL = 2000
    const MAX_POLL_TIME = 60000
    const startTime = Date.now()

    while (Date.now() - startTime < MAX_POLL_TIME) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL))

      try {
        const progressRes = await getChunkMergeProgress(taskId)
        if (progressRes.code === 0 && progressRes.data) {
          const { status: mergeStatus, objectName: objName } = progressRes.data
          if (mergeStatus === 'completed' && objName) {
            uploadProgress.value = 100
            return objName
          } else if (mergeStatus === 'failed') {
            throw new Error('合片失败')
          }
          // merging 继续轮询
        }
      } catch (e) {
        if (e.response && e.response.status === 429) {
          throw new Error('429: 服务器上传繁忙，请稍后重试')
        }
        // 其他错误继续轮询
      }
    }
    throw new Error('合片超时，请重试')
  }

  // 如果 taskId 为空（理论上不会），直接返回 finalObjectName
  uploadProgress.value = 100
  return finalObjectName
}

// ==== 组件拖拽 ====
function onDragStart(e, type) {
  e.dataTransfer.setData('componentType', type)
  e.dataTransfer.effectAllowed = 'copy'
}

async function onDrop(e) {
  const type = e.dataTransfer.getData('componentType')
  if (!type) return
  const rect = canvasRef.value.getBoundingClientRect()
  const sf = zoom.value / 100
  let x = Math.round((e.clientX - rect.left) / sf)
  let y = Math.round((e.clientY - rect.top) / sf)
  const el = createElement(type, x, y)
  // 占位模式不能放置在已有占位组件上
  if (el.layoutMode === 'block') {
    const blocked = elements.value.some(other =>
      isLayoutBlock(other) && isOverlapping(
        { x: el.x, y: el.y, w: el.w, h: el.h },
        { x: other.x, y: other.y, w: other.w, h: other.h }
      )
    )
    if (blocked) {
      ElMessage.warning('该位置已有占位组件，请选择空白区域放置')
      return
    }
  }
  elements.value.push(el)
  selectedIdx.value = elements.value.length - 1
  dirty.value = true
  clampAllElements()
  startCarouselForElement(el)
}

function createElement(type, x, y) {
  const pw = pageWidth.value, ph = pageHeight.value
  const sizes = { video:[480,360], image:[480,360], carousel:[960,540], text:[400,100], scrollText:[900,80], clock:[250,100] }
  let defW = 300, defH = 200
  if (sizes[type]) { defW = sizes[type][0]; defH = sizes[type][1] }
  if (x === undefined) x = Math.round((pw - defW) / 2)
  if (y === undefined) y = Math.round((ph - defH) / 2)
  x = Math.max(0, Math.min(x, pw - defW))
  y = Math.max(0, Math.min(y, ph - defH))

  const base = { id: 'el_' + type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type, x, y, w: defW, h: defH, zIndex: 1, layoutMode: ['video','image','carousel'].includes(type) ? 'block' : 'float', label: componentTypes.find(c=>c.type===type)?.label || type }

  if (type === 'video') { base.src = ''; base.autoplay = true; base.loop = true; base.muted = true }
  else if (type === 'image') { base.src = ''; base.opacity = 1 }
  else if (type === 'carousel') { base.images = []; base.interval = 3 }
  else if (type === 'text') { base.content = ''; base.fontSize = 28; base.color = '#ffffff'; base.bold = false; base.textAlign = 'center'; base.fontFamily = '' }
  else if (type === 'scrollText') { base.content = ''; base.fontSize = 24; base.color = '#ffffff'; base.backgroundColor = 'transparent'; base.speed = 'medium'; base.fontFamily = '' }
  else if (type === 'clock') { base.fontSize = 36; base.color = '#00ffcc'; base.fontFamily = 'monospace'; base.clockStyle = 'digital'; base.showDate = true; base.backgroundColor = 'transparent' }

  return base
}

// ==== 拖拽移动 ====
function startDrag(idx, e) {
  if (e.button !== 0) return
  selectedIdx.value = idx
  const el = elements.value[idx]
  if (!el) return
  dragInfo = { idx, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, sf: zoom.value / 100 }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', stopDrag)
}

function isLayoutBlock(el) {
  return el && el.layoutMode === 'block'
}

function isOverlapping(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function onDragMove(e) {
  if (!dragInfo) return
  const info = dragInfo, el = elements.value[info.idx]
  if (!el) return
  const newX = Math.max(0, Math.min(info.origX + Math.round((e.clientX - info.startX) / info.sf), pageWidth.value - el.w))
  const newY = Math.max(0, Math.min(info.origY + Math.round((e.clientY - info.startY) / info.sf), pageHeight.value - el.h))
  // 占位模式（block）不能与其他占位组件重叠
  if (el.layoutMode === 'block') {
    const blocked = elements.value.some(other =>
      other.id !== el.id && isLayoutBlock(other) && isOverlapping(
        { x: newX, y: newY, w: el.w, h: el.h },
        { x: other.x, y: other.y, w: other.w, h: other.h }
      )
    )
    if (blocked) return
  }
  el.x = newX
  el.y = newY
  dirty.value = true
}

function stopDrag() {
  dragInfo = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
}

// ==== 缩放 ====
function startResize(idx, handle, e) {
  if (e.button !== 0) return
  selectedIdx.value = idx
  const el = elements.value[idx]
  if (!el) return
  resizeInfo = { idx, handle, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.w, origH: el.h, sf: zoom.value / 100 }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
}

function onResizeMove(e) {
  if (!resizeInfo) return
  const info = resizeInfo, el = elements.value[info.idx]
  if (!el) return
  const dx = Math.round((e.clientX - info.startX) / info.sf)
  const dy = Math.round((e.clientY - info.startY) / info.sf)
  const pw = pageWidth.value, ph = pageHeight.value
  let x = info.origX, y = info.origY, w = info.origW, h = info.origH

  if (info.handle.includes('r')) { w = Math.max(20, info.origW + dx); w = Math.min(w, pw - x) }
  if (info.handle.includes('l')) { const maxW = info.origW + info.origX; const dw = Math.min(dx, info.origW - 20); x = info.origX + dw; w = info.origW - dw; if (x < 0) { w += x; x = 0 }; w = Math.max(20, w) }
  if (info.handle.includes('b')) { h = Math.max(20, info.origH + dy); h = Math.min(h, ph - y) }
  if (info.handle.includes('t')) { const maxH = info.origH + info.origY; const dh = Math.min(dy, info.origH - 20); y = info.origY + dh; h = info.origH - dh; if (y < 0) { h += y; y = 0 }; h = Math.max(20, h) }

  el.x = x; el.y = y; el.w = w; el.h = h
  dirty.value = true
}

function stopResize() {
  resizeInfo = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

// ==== 边界检查 ====
function clampAllElements() {
  const pw = pageWidth.value, ph = pageHeight.value
  elements.value.forEach(el => {
    el.x = Math.max(0, Math.min(el.x, pw - el.w))
    el.y = Math.max(0, Math.min(el.y, ph - el.h))
    el.w = Math.min(el.w, pw - el.x)
    el.h = Math.min(el.h, ph - el.y)
  })
}

// ==== 元素操作 ====
function copyElement() {
  if (!selectedEl.value) return
  const src = selectedEl.value
  const copy = JSON.parse(JSON.stringify(src))
  copy.id = 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)
  copy.x += 20; copy.y += 20
  if (copy.x + copy.w > pageWidth.value) copy.x = pageWidth.value - copy.w
  if (copy.y + copy.h > pageHeight.value) copy.y = pageHeight.value - copy.h
  elements.value.push(copy)
  selectedIdx.value = elements.value.length - 1
  dirty.value = true
  startCarouselForElement(copy)
}

function removeElement() {
  if (selectedIdx.value < 0) return
  const el = elements.value[selectedIdx.value]
  if (el && allCarouselTimers[el.id]) { clearInterval(allCarouselTimers[el.id]); delete allCarouselTimers[el.id] }
  elements.value.splice(selectedIdx.value, 1)
  selectedIdx.value = Math.min(selectedIdx.value, elements.value.length - 1)
  dirty.value = true
}

function moveUp() {
  if (selectedIdx.value <= 0) return
  const idx = selectedIdx.value
  ;[elements.value[idx], elements.value[idx-1]] = [elements.value[idx-1], elements.value[idx]]
  selectedIdx.value = idx - 1
  dirty.value = true
}

function moveDown() {
  if (selectedIdx.value < 0 || selectedIdx.value >= elements.value.length - 1) return
  const idx = selectedIdx.value
  ;[elements.value[idx], elements.value[idx+1]] = [elements.value[idx+1], elements.value[idx]]
  selectedIdx.value = idx + 1
  dirty.value = true
}

// ==== 轮播 ====
function carouselIdx(elId) {
  return carouselState[elId] ?? 0
}

function startCarouselTimer() {
  // called on mount / element add
}

function startCarouselForElement(el) {
  if (el.type !== 'carousel') return
  if (allCarouselTimers[el.id]) clearInterval(allCarouselTimers[el.id])
  if (!carouselState[el.id]) carouselState[el.id] = 0
  const interval = (el.interval || 3) * 1000
  allCarouselTimers[el.id] = setInterval(() => {
    const arr = el.images || []
    if (!arr.length) return
    carouselState[el.id] = (carouselState[el.id] + 1) % arr.length
  }, interval)
}

// ==== 滚动文本速度 ====
function scrollDuration(el) {
  const map = { slow: '40s', medium: '20s', fast: '10s' }
  return map[el.speed] || '20s'
}

// ==== 加载/保存 ====
async function loadRecord(id) {
  // 后台静默加载：最多重试 3 次
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await getScreenDetail(id)
      if (res.code === 0 && res.data) {
        // 后端 V3 接口包了一层 ScreenDisplayVO（data.data），需要解包
        const d = res.data?.data || res.data
        publishTitle.value = d.title || ''
        targetGroupId.value = d.targetGroupId || ''
        pageWidth.value = d.pageWidth || 1920
        pageHeight.value = d.pageHeight || 1080
        backgroundColor.value = d.backgroundColor || '#000000'
        backgroundImage.value = d.backgroundImage || ''
        if (d.layoutJson) {
          try {
            elements.value = JSON.parse(d.layoutJson) || []
          } catch (e) { elements.value = [] }
        } else {
          elements.value = []
        }
        elements.value.forEach(el => { startCarouselForElement(el) })
        await nextTick()
        fitScreen()
        return  // 加载成功
      }
    } catch (e) {
      lastErr = e
      if (attempt < 3) {
        console.warn('[ScreenEditor] 大屏加载失败 第' + attempt + '次，即将重试:', e?.message || e)
        await new Promise(r => setTimeout(r, 2000 * attempt))  // 指数退避
      }
    }
  }
  // 3 次都失败，记录日志但不对用户弹窗（后台初始化）
  console.warn('[ScreenEditor] 大屏加载失败（已重试3次）:', lastErr?.message || lastErr)
}

async function handleSave() {
  if (!publishTitle.value) { ElMessage.warning('请输入大屏标题'); return }
  const layoutJson = JSON.stringify(elements.value)
  const payload = {
    title: publishTitle.value,
    pageWidth: pageWidth.value,
    pageHeight: pageHeight.value,
    backgroundColor: backgroundColor.value,
    backgroundImage: backgroundImage.value,
    layoutJson,
    targetGroupId: targetGroupId.value || null,
  }
  try {
    let res
    if (isNew.value) {
      res = await saveScreen(payload)
    } else {
      payload.id = recordId.value
      res = await updateScreen(payload)
    }
    if (res.code === 0 && res.data) {
      if (isNew.value) {
        const newId = res.data.id
        router.replace('/screen/editor/' + newId)
      }
      ElMessage.success('保存成功')
      dirty.value = false
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存异常')
  }
}

async function loadServerTerminals() {
  try {
    const res = await getServerTerminalList()
    if (res.code === 0) {
      serverTerminals.value = res.data || []
    }
  } catch (e) {
    console.warn('[ScreenEditor] 终端列表加载失败:', e?.message || e)
  }
}

function handlePreview() {
  if (!recordId.value) { ElMessage.warning('请先保存再预览'); handleSave(); return }
  if (dirty.value) { ElMessage.warning('请先保存再预览'); handleSave(); return }
  const url = router.resolve('/screen/preview/' + recordId.value).href
  window.open(url, '_blank')
}

function resetCanvas() {
  if (dirty.value) { ElMessageBox.confirm('当前有未保存的修改，确定新建？', '提示', { type: 'warning' }).then(() => doReset()).catch(() => {}) }
  else doReset()
}

function doReset() {
  Object.values(allCarouselTimers).forEach(t => clearInterval(t))
  allCarouselTimers = {}
  elements.value = []
  selectedIdx.value = -1
  publishTitle.value = ''
  pageWidth.value = 1920; pageHeight.value = 1080
  backgroundColor.value = '#000000'; backgroundImage.value = ''
  zoom.value = 100; dirty.value = false
  router.replace('/screen/editor')
}

function goBack() {
  router.push('/screen')
}

</script>

<style scoped>
.editor-layout {
  height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 13px;
}
.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  background: #16213e;
  border-bottom: 1px solid #2a2a5a;
  flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-right { display: flex; gap: 8px; }
.toolbar-title { font-size: 15px; font-weight: 600; color: #e0e0e0; margin-left: 8px; }
.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.editor-sidebar {
  width: 240px;
  background: #1a1a2e;
  border-right: 1px solid #2a2a5a;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.right-sidebar {
  border-right: none;
  border-left: 1px solid #2a2a5a;
  width: 280px;
}
.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  padding: 10px 12px 6px;
  color: #a0a0c0;
}
.component-list {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 2px;
  padding: 4px 8px;
}
.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  cursor: grab;
  border-radius: 6px;
  transition: background 0.15s;
  user-select: none;
}
.component-item:hover { background: #2a2a5a; }
.component-item:active { cursor: grabbing; }
.cp-icon { font-size: 22px; line-height: 1; }
.cp-label { font-size: 11px; color: #a0a0c0; margin-top: 4px; }
.canvas-settings { padding: 4px 12px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; margin: 4px 0; }
.setting-row label { font-size: 12px; color: #a0a0c0; flex-shrink: 0; margin-right: 8px; }
.canvas-scroll {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: #0f0f1a;
}
.canvas-stage {
  position: relative;
  transform-origin: center center;
  box-shadow: 0 0 20px rgba(0,0,0,0.6);
  background-size: 100% 100%;
  background-position: center;
  flex-shrink: 0;
}
.canvas-element {
  position: absolute;
  overflow: hidden;
  border: 1px solid transparent;
  box-sizing: border-box;
}
.canvas-element:hover { border-color: rgba(255,255,255,0.15); }
.canvas-element.selected {
  border-color: #409eff;
  box-shadow: 0 0 6px rgba(64,158,255,0.4);
}
.layout-block {
  border-color: rgba(64,224,208,0.5) !important;
  box-shadow: inset 0 0 0 2px rgba(64,224,208,0.25);
}
.layout-block.selected {
  border-color: #409eff !important;
  box-shadow: 0 0 6px rgba(64,158,255,0.4), inset 0 0 0 2px rgba(64,224,208,0.25) !important;
}
.block-overlay {
  position: absolute;
  top: 4px; right: 4px;
  background: rgba(64,224,208,0.7);
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  line-height: 1.4;
  pointer-events: none;
  z-index: 10;
}
.el-badge {
  position: absolute;
  top: -20px;
  left: 0;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  z-index: 10;
  pointer-events: none;
}
.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #409eff;
  border: 2px solid #fff;
  border-radius: 2px;
  z-index: 20;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
}
.resize-handle.tl { top: -6px; left: -6px; cursor: nw-resize; }
.resize-handle.tr { top: -6px; right: -6px; cursor: ne-resize; }
.resize-handle.bl { bottom: -6px; left: -6px; cursor: sw-resize; }
.resize-handle.br { bottom: -6px; right: -6px; cursor: se-resize; }
.placeholder-text {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 14px;
}
.carousel-wrap { position: relative; width: 100%; height: 100%; pointer-events: none; }
.el-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
  word-break: break-all;
  overflow: hidden;
  pointer-events: none;
}

.el-scroll-text { width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
.scroll-inner {
  display: inline-block;
  white-space: nowrap;
  animation: scrollText linear infinite;
  padding: 4px 0;
}
@keyframes scrollText {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}

.clock-digital { font-weight: bold; letter-spacing: 3px; text-shadow: 0 0 20px currentColor; }
.clock-simple { font-weight: 300; letter-spacing: 2px; }
.clock-flip { display: flex; align-items: center; justify-content: center; gap: 4px; }
.flip-num { display: inline-block; min-width: 0.6em; background: rgba(0,0,0,0.4); border-radius: 4px; padding: 0 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
.flip-sep { opacity: 0.6; }
.clock-date { font-size: 0.4em; opacity: 0.7; margin-top: 4px; text-align: center; }
.el-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-shadow: 0 0 10px rgba(0,255,204,0.3);
  pointer-events: none;
}

.prop-body { padding: 8px 12px; overflow-y: auto; flex: 1; }
.prop-body.no-selection { }
.no-select-hint { font-size: 12px; color: #666; text-align: center; padding: 20px 0; }
.prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.upload-preview { margin: 4px 0; border: 1px solid #2a2a5a; border-radius: 4px; overflow: hidden; }
.img-list { display: flex; flex-wrap: wrap; gap: 4px; }
.img-item { display: flex; align-items: center; gap: 4px; padding: 2px 4px; background: #2a2a5a; border-radius: 4px; }
</style>