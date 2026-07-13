<template>
  <div class="editor-layout">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button size="small" @click="goBack">← 返回</el-button>
        <el-button size="small" type="warning" @click="resetCanvas">新建</el-button>
        <span class="toolbar-title">{{ isNew ? '新建大屏' : '编辑大屏' }}</span>
        <el-input v-model="publishTitle" placeholder="大屏标题" style="width:200px;margin-left:12px;" @input="dirty=true" />
        <el-select v-model="pushType" style="width:120px;margin-left:8px;" :disabled="isEditMode" @change="dirty=true">
          <el-option label="普通发布" value="normal" />
          <el-option label="紧急插播" value="interrupt" />
        </el-select>
        <el-select v-model="targetGroupId" multiple collapse-tags placeholder="选择绑定终端(最多20个)" style="width:220px;margin-left:8px;" :disabled="isEditMode" clearable @change="onTargetGroupChange">
          <el-option v-for="t in serverTerminals" :key="t.id" :label="`${t.equipmentName} (${t.screenWidth || '?'}x${t.screenHeight || '?'})`" :value="t.id" />
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
        <div class="canvas-settings" v-if="targetGroupId.length > 0">
          <div class="setting-row"><label>宽度</label><el-input-number v-model="pageWidth" :min="800" :max="7680" :step="100" size="small" style="width:100px;" disabled /></div>
          <div class="setting-row"><label>高度</label><el-input-number v-model="pageHeight" :min="600" :max="4320" :step="100" size="small" style="width:100px;" disabled /></div>
        </div>
        <!-- 素材库：仅绑定单个终端时展示 -->
        <template v-if="targetGroupId.length === 1">
          <el-divider style="margin:8px 0;" />
          <div class="sidebar-title">素材库</div>
          <div class="material-lib">
            <div style="font-size:12px;color:#888;text-align:center;padding:20px 0;">在轮播组件中选择「素材库」使用</div>
          </div>
        </template>

        <!-- 轮播素材选择弹窗 -->
        <el-dialog v-model="showMaterialPicker" title="从素材库选择" width="550px" :close-on-click-modal="true" @open="onMaterialPickerOpen">
          <el-radio-group v-model="materialTab" size="small" style="margin-bottom:8px;">
            <el-radio-button value="image">图片</el-radio-button>
            <el-radio-button v-if="materialPickerType==='video'||materialPickerType==='doc'" value="video">视频</el-radio-button>
          </el-radio-group>
          <div style="max-height:200px;overflow-y:auto;margin-bottom:8px;">
            <div v-for="(item, idx) in materialTab==='image' ? materialImages : materialVideos" :key="idx" class="material-item" style="cursor:pointer;" :class="{ 'material-item-active': previewMaterial === item }" @click="previewMaterial = item" @dblclick="onMaterialPickerConfirm(item)">
              <img v-if="materialTab==='image'" :src="resolveMediaUrl(item.url)" class="material-thumb" />
              <video v-else-if="materialTab==='video'" :src="resolveMediaUrl(item.url)" class="material-thumb" muted />
              <span class="material-name">{{ item.file_name || item.name || '未命名' }}</span>
            </div>
            <div v-if="materialTab==='image' && materialImages.length===0" class="material-empty">暂无图片素材</div>
            <div v-if="materialTab==='video' && materialVideos.length===0" class="material-empty">暂无视频素材</div>
          </div>
          <div v-if="previewMaterial" class="material-picker-preview" style="height:200px;">
            <template v-if="materialTab==='image'">
              <img :src="resolveMediaUrl(previewMaterial.url || previewMaterial.file_hash || previewMaterial.id)" />
            </template>
            <template v-else-if="materialTab==='video'">
              <video :src="resolveMediaUrl(previewMaterial.url || previewMaterial.file_hash || previewMaterial.id)" controls autoplay muted />
            </template>
          </div>
          <div v-else class="material-picker-preview" style="height:200px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#555;font-size:13px;">点击素材预览</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#888;">单击预览 · 双击选择</div>
          <template #footer>
            <el-button @click="showMaterialPicker = false">关闭</el-button>
            <el-button type="primary" :disabled="!previewMaterial" @click="onMaterialPickerConfirm(previewMaterial)">选择</el-button>
          </template>
        </el-dialog>
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
            <video v-if="el.type==='video'" :key="'v_'+el.src" :src="resolveMediaUrl(el.src)" :autoplay="el.autoplay!==false" :muted="el.muted!==false" :loop="el.loop!==false" :style="{ width:'100%', height:'100%', objectFit: el.fullscreen ? 'fill' : 'contain', display:'block', pointerEvents:'none' }" @error="onMediaError"></video>
            <div v-if="el.type==='video' && !el.src" class="placeholder-text">🎬 视频组件<br><span style="font-size:11px;opacity:0.6;">上传视频后自动播放</span></div>
            <img v-else-if="el.type==='image'" :key="'i_'+el.src" :src="resolveMediaUrl(el.src)" :style="{ width:'100%', height:'100%', objectFit: el.fullscreen ? 'fill' : 'contain', display:'block', pointerEvents:'none', opacity: el.opacity ?? 1 }" @error="onMediaError" />
            <div v-else-if="el.type==='carousel'" class="carousel-wrap">
              <template v-for="(item, ci) in (el.images||[])" :key="ci">
                <img v-if="typeof item === 'string' || item.type==='image'" :src="resolveMediaUrl(typeof item === 'string' ? item : item.src)" :style="{ width:'100%', height:'100%', objectFit: el.fullscreen ? 'fill' : 'contain', position:'absolute', left:'0', top:'0', opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
                <img v-else-if="item.type==='docImage'" :src="resolveMediaUrl(item.src)" :style="{ width:'100%', height:'100%', objectFit: el.fullscreen ? 'fill' : 'contain', position:'absolute', left:'0', top:'0', opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
                <video v-else-if="item.type==='video'" :src="resolveMediaUrl(item.src)" autoplay muted loop :style="{ width:'100%', height:'100%', objectFit: el.fullscreen ? 'fill' : 'contain', position:'absolute', left:'0', top:'0', opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" @ended="onCarouselVideoEnded(el, item)"></video>
              </template>
              <div v-if="!el.images || !el.images.length" class="placeholder-text">📷 轮播图<br><span style="font-size:11px;opacity:0.6;">点击上传素材</span></div>
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

            <div v-else-if="['ppt','pdf','word'].includes(el.type)" class="el-doc" :style="{ backgroundImage: el.src ? 'url(' + resolveMediaUrl(el.src) + ')' : 'none', backgroundColor: el.src ? backgroundColor : 'transparent' }">
              <div v-if="el.src" class="doc-preview">
                <div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:13px;padding:2px 10px;border-radius:4px;z-index:10;">{{ (el.currentPage || 0) + 1 }} / {{ el.totalPages || 1 }}</div>
              </div>
              <div v-else class="placeholder-text">{{ el.type === 'ppt' ? '📊' : el.type === 'pdf' ? '📄' : '📝' }} {{ el.label }}<br><span style="font-size:11px;opacity:0.6;">点击右侧上传文件</span></div>
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
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <el-dropdown trigger="click" @command="(cmd)=>onSingleAddSource(cmd, 'video')">
                    <el-button size="small" type="primary">🎬 添加视频</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                        <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-upload ref="videoUploadRef" :auto-upload="false" :show-file-list="false" accept="video/*" @change="(f)=>handleFileUpload(f,'video')" class="single-upload-hidden"></el-upload>
                </div>
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
                <el-form-item label="全屏"><el-switch v-model="selectedEl.fullscreen" @change="onVideoFullscreenToggle" /></el-form-item>
              </div>
              <div v-if="selectedEl.src" class="upload-preview" style="max-height:80px;">
                <video :src="resolveMediaUrl(selectedEl.src)" :autoplay="selectedEl.autoplay!==false" :muted="selectedEl.muted!==false" :loop="selectedEl.loop!==false" style="width:100%;max-height:80px;border-radius:4px;" />
              </div>
            </template>

            <template v-if="selectedEl.type==='image'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="上传图片">
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <el-dropdown trigger="click" @command="(cmd)=>onSingleAddSource(cmd, 'image')">
                    <el-button size="small" type="primary">📁 添加图片</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                        <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-upload ref="imageUploadRef" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'image')" class="single-upload-hidden"></el-upload>
                </div>
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
              <el-form-item label="添加素材">
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <el-dropdown trigger="click" @command="(cmd)=>onCarouselAddSource('image', cmd)">
                    <el-button size="small" type="primary">🖼 图片</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                        <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-dropdown trigger="click" @command="(cmd)=>onCarouselAddSource('video', cmd)">
                    <el-button size="small" type="success">🎬 视频</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                        <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-upload ref="carouselUploadRef" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'carousel')" class="single-upload-hidden"></el-upload>
                  <el-upload ref="carouselVideoUploadRef" :auto-upload="false" :show-file-list="false" accept="video/*" @change="(f)=>handleFileUpload(f,'carousel-video')" class="single-upload-hidden"></el-upload>
                  <el-dropdown trigger="click" @command="(cmd)=>onCarouselAddSource('doc', cmd)">
                    <el-button size="small" type="warning">📄 文档</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                        <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-upload ref="carouselDocUploadRef" :auto-upload="false" :show-file-list="false" accept=".ppt,.pptx,.pdf,.doc,.docx" @change="(f)=>handleDocUpload(f, selectedEl, true)" class="single-upload-hidden"></el-upload>
                </div>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="切换间隔(秒)">
                <el-input-number v-model="selectedEl.interval" :min="1" :max="60" style="width:100%;" @change="emitChange" />
              </el-form-item>
              <el-form-item label="全屏"><el-switch v-model="selectedEl.fullscreen" @change="onCarouselFullscreenToggle" /></el-form-item>
              <div class="img-list">
                <div v-for="(item,ci) in selectedEl.images||[]" :key="ci" class="img-item">
                  <template v-if="typeof item === 'string'">
                    <img :src="resolveMediaUrl(item)" style="width:36px;height:24px;object-fit:contain;border-radius:2px;" />
                    <span>图片 {{ ci+1 }}</span>
                  </template>
                  <template v-else>
                    <img v-if="item.type==='image'" :src="resolveMediaUrl(item.src)" style="width:36px;height:24px;object-fit:contain;border-radius:2px;" />
                    <span v-else-if="item.type==='docImage'" style="font-size:18px;">📄</span>
                    <span v-else style="font-size:18px;">🎬</span>
                    <span>{{ item.type==='image' ? '图片' : item.type==='docImage' ? '文档' : '视频' }} {{ ci+1 }}</span>
                  </template>
                  <el-button size="small" type="danger" link @click="selectedEl.images.splice(ci,1);emitChange">×</el-button>
                </div>
                <div v-if="!selectedEl.images||!selectedEl.images.length" style="font-size:11px;color:#909399;padding:4px;">暂无素材</div>
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
            <template v-if="['ppt','pdf','word'].includes(selectedEl.type)">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="文件">
                <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
                  <el-dropdown trigger="click" @command="(cmd)=>onSingleAddSource(cmd, selectedEl.type, true)">
                    <el-button size="small" type="primary">📤 添加{{ selectedEl.type === 'ppt' ? 'PPT' : selectedEl.type === 'pdf' ? 'PDF' : 'Word' }}</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                        <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-upload ref="docUploadRef" :auto-upload="false" :show-file-list="false" :accept="selectedEl.type === 'ppt' ? '.ppt,.pptx' : selectedEl.type === 'pdf' ? '.pdf' : '.doc,.docx'" @change="(f)=>handleDocUpload(f, selectedEl)" class="single-upload-hidden"></el-upload>
                  <div v-if="uploadProgress > 0 && uploadProgress < 100" style="margin:2px 0;">
                    <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="6" />
                  </div>
                  <div v-if="selectedEl.fileName" class="upload-preview" style="padding:4px 8px;">
                    <span style="font-size:12px;color:#aaa;">📄 {{ selectedEl.fileName }}</span>
                    <span style="font-size:11px;color:#666;margin-left:8px;">{{ selectedEl.totalPages || '?' }}页</span>
                  </div>
                  <div v-if="selectedEl.totalPages > 0" class="upload-preview" style="max-height:100px;overflow:hidden;">
                    <img :src="resolveMediaUrl(selectedEl.src)" style="width:100%;height:80px;object-fit:contain;border-radius:4px;background:#111;" />
                  </div>
                </div>
              </el-form-item>
              <el-form-item label="播放速度">
                <el-select v-model="selectedEl.playSpeed" style="width:100%;" @change="emitChange">
                  <el-option label="2 秒/页" :value="2" />
                  <el-option label="3 秒/页" :value="3" />
                  <el-option label="5 秒/页" :value="5" />
                  <el-option label="8 秒/页" :value="8" />
                  <el-option label="10 秒/页" :value="10" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedEl.totalPages > 1" label="预览页">
                <div style="display:flex;align-items:center;gap:8px;">
                  <el-button size="small" :disabled="selectedEl.currentPage <= 0" @click="selectedEl.currentPage--; selectedEl.src = selectedEl.srcList[selectedEl.currentPage]; emitChange()">◀</el-button>
                  <span style="font-size:12px;color:#ccc;">{{ (selectedEl.currentPage || 0) + 1 }} / {{ selectedEl.totalPages }}</span>
                  <el-button size="small" :disabled="(selectedEl.currentPage || 0) >= selectedEl.totalPages - 1" @click="selectedEl.currentPage++; selectedEl.src = selectedEl.srcList[selectedEl.currentPage]; emitChange()">▶</el-button>
                </div>
              </el-form-item>
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
            <el-form-item label="背景图">
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                <el-dropdown trigger="click" @command="(cmd)=>onBgAddSource(cmd)">
                  <el-button size="small" type="primary">🖼 选择背景</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="upload">📁 本地上传</el-dropdown-item>
                      <el-dropdown-item v-if="targetGroupId.length===1" command="material">📚 选择素材库</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-upload ref="bgUploadRef" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'bg')" class="single-upload-hidden"></el-upload>
              </div>
            </el-form-item>
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
         requestUploadToken, terminalUploadSimple, terminalInitUpload,
         terminalUploadChunk, terminalCompleteUpload, recordUpload,
         terminalFetchResources } from '@/api/screen'

const route = useRoute()
const router = useRouter()
const recordId = computed(() => route.params.id || '')
const isNew = computed(() => !recordId.value)
const isEditMode = ref(false)

// ==== 画布 ====
const pageWidth = ref(1920)
const pageHeight = ref(1080)
const backgroundColor = ref('#000000')
const backgroundImage = ref('')
const publishTitle = ref('')
const targetGroupId = ref([])        // 多选终端ID数组
const pushType = ref('normal')
const serverTerminals = ref([])
const zoom = ref(80)
const elements = ref([])
const selectedIdx = ref(-1)
const dirty = ref(false)

// ===== 上传进度 =====
// ==== 素材库 ====
const showMaterialPicker = ref(false)  // 轮播从素材库选择弹窗
const materialPickerType = ref('image')  // 当前从素材库选择的类型
const previewMaterial = ref(null)  // 弹窗中当前预览的素材
const materialTab = ref('image')
const materialImages = ref([])
const materialVideos = ref([])
const materialFiles = ref([])
const hoveredMaterial = ref(null)  // 当前鼠标悬浮的素材（预览弹窗）

/**
 * 加载终端素材列表（绑定单个终端时调用）
 */
async function loadMaterialList() {
  const ids = targetGroupId.value
  if (ids.length !== 1) return
  const term = serverTerminals.value.find(t => t.id === ids[0])
  if (!term?.ipAddress) return
  try {
    // 不传 screenId 让终端返回全部素材（素材上传时 screen_ids 存的是 temp，传真实 ID 查不到）
    const res = await terminalFetchResources(term.ipAddress, '')
    const list = res.resources || []
    materialImages.value = list.filter(i => i.category === 'image').map(i => ({ ...i, url: i.file_hash || i.id }))
    materialVideos.value = list.filter(i => i.category === 'video').map(i => ({ ...i, url: i.file_hash || i.id }))
    materialFiles.value = list.filter(i => i.category === 'file').map(i => ({ ...i, url: i.file_hash || i.id }))
  } catch (e) {
    console.warn('[ScreenEditor] 素材列表加载失败:', e?.message || e)
  }
}

function onMaterialDragStart(e, item) {
  e.dataTransfer.setData('materialUrl', item.url)
  e.dataTransfer.setData('materialType', item.category || item.type || 'image')
  e.dataTransfer.setData('materialName', item.file_name || item.name || '')
  e.dataTransfer.effectAllowed = 'copy'
}

function onBgAddSource(command) {
  if (command === 'upload') {
    if (bgUploadRef.value) {
      bgUploadRef.value.$el.querySelector('input')?.click()
    }
  } else if (command === 'material') {
    materialPickerType.value = 'image'
    showMaterialPicker.value = true
  }
}

function onSingleAddSource(command, type, isDoc) {
  const uploadRefs = { image: imageUploadRef, video: videoUploadRef, ppt: docUploadRef, pdf: docUploadRef, word: docUploadRef }
  if (command === 'upload') {
    const ref = uploadRefs[type]
    if (ref && ref.value) {
      ref.value.$el.querySelector('input')?.click()
    }
  } else if (command === 'material') {
    materialPickerType.value = 'image'  // 单组件素材库只显示图片/视频
    showMaterialPicker.value = true
  }
}

function onCarouselAddSource(type, command) {
  if (command === 'upload') {
    // 触发隐藏的 el-upload 选择文件
    if (type === 'image' && carouselUploadRef.value) {
      carouselUploadRef.value.$el.querySelector('input')?.click()
    } else if (type === 'video' && carouselVideoUploadRef.value) {
      carouselVideoUploadRef.value.$el.querySelector('input')?.click()
    } else if (type === 'doc' && carouselDocUploadRef.value) {
      carouselDocUploadRef.value.$el.querySelector('input')?.click()
    }
  } else if (command === 'material') {
    materialPickerType.value = type
    showMaterialPicker.value = true
  }
}

function onMaterialPickerOpen() {
  previewMaterial.value = null
  // 根据调用来源设置默认 Tab
  if (materialPickerType.value === 'video' || materialPickerType.value === 'doc') {
    materialTab.value = 'image'
  } else {
    materialTab.value = 'image'
  }
}

function onMaterialPickerConfirm(item) {
  const el = selectedEl.value
  const cat = item.category || item.type
  const src = item.url || item.file_hash || item.src
  if (!src) return

  // 背景图：没有选中组件时直接赋值 backgroundImage
  if (!el) {
    backgroundImage.value = src
    showMaterialPicker.value = false
    onSettingChange()
    return
  }

  if (el.type === 'carousel') {
    // 轮播：添加到 images 数组
    if (!el.images) el.images = []
    if (cat === 'image') {
      el.images.push(src)
    } else if (cat === 'video') {
      el.images.push({ type: 'video', src })
    } else {
      el.images.push(src)
    }
    if (el.fullscreen) {
      el.w = pageWidth.value
      el.h = pageHeight.value
      el.x = 0
      el.y = 0
    }
  } else if (el.type === 'image' || el.type === 'video') {
    // 图片/视频：直接设置 src
    el.src = src
    el.fileName = item.file_name || item.name || ''
  } else if (['ppt','pdf','word'].includes(el.type)) {
    // 文档：设置 src 为首图
    if (cat === 'image' || cat === 'file') {
      el.src = src
      el.fileName = item.file_name || item.name || ''
      el.srcList = [src]
      el.totalPages = 1
    }
  }
  showMaterialPicker.value = false
  emitChange()
}

function addMaterialToCarousel(item) {
  if (!selectedEl.value || selectedEl.value.type !== 'carousel') return
  const el = selectedEl.value
  if (!el.images) el.images = []
  const cat = item.category || item.type
  const src = item.url || item.file_hash || item.src
  if (!src) return
  if (cat === 'image') {
    el.images.push(src)
  } else if (cat === 'video') {
    el.images.push({ type: 'video', src })
  } else if (cat === 'file') {
    el.images.push(src)
  }
  showMaterialPicker.value = false
  // 如果全屏已开，触发全屏尺寸更新
  if (el.fullscreen) {
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  }
  emitChange()
}

function insertMaterialToCanvas(item) {
  // 根据素材类型创建对应组件插入画布
  let type = item.category || item.type
  if (type === 'image' || type === 'video') { /* ok */ }
  else return // 文件暂不支持直接插入画布
  const ph = pageHeight.value
  const pw = pageWidth.value
  const w = Math.min(400, pw * 0.4)
  const h = type === 'video' ? Math.round(w * 9/16) : Math.round(w * 9/16)
  const el = {
    id: 'el_' + type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    type,
    x: Math.max(0, (pw - w) / 2),
    y: Math.max(0, (ph - h) / 2),
    w, h,
    zIndex: elements.value.length + 1,
    layoutMode: 'block',
    src: item.url,
    label: type === 'image' ? '图片' : '视频',
  }
  if (type === 'video') {
    el.autoplay = true; el.loop = true; el.muted = true
  }
  if (type === 'image') {
    el.opacity = 1
  }
  elements.value.push(el)
  selectedIdx.value = elements.value.length - 1
  dirty.value = true
}

const bgUploadRef = ref(null)
const imageUploadRef = ref(null)
const videoUploadRef = ref(null)
const docUploadRef = ref(null)
const carouselUploadRef = ref(null)
const carouselVideoUploadRef = ref(null)
const carouselDocUploadRef = ref(null)
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
  { type: 'ppt', icon: '📊', label: 'PPT' },
  { type: 'pdf', icon: '📄', label: 'PDF' },
  { type: 'word', icon: '📝', label: 'Word' },
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
onMounted(async () => {
  isEditMode.value = !!recordId.value
  await loadServerTerminals()
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  if (recordId.value) {
    loadRecord(recordId.value)
    // 编辑模式下等大屏数据加载完再加载素材库
    setTimeout(() => loadMaterialList(), 3000)
  } else {
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

function onVideoFullscreenToggle() {
  if (!selectedEl.value) return
  const el = selectedEl.value
  if (el.fullscreen) {
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  }
  dirty.value = true
}

function onCarouselFullscreenToggle() {
  if (!selectedEl.value) return
  const el = selectedEl.value
  if (el.fullscreen) {
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  }
  dirty.value = true
}

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
  // v5: 纯 fileHash（16位以上 hex）且已绑定终端 → 直连首个终端 3001 媒体地址
  if (targetGroupId.value.length > 0 && /^[a-f0-9]{16,}$/.test(name)) {
    const ids = targetGroupId.value
    for (const id of ids) {
      const t = serverTerminals.value.find(x => x.id === id)
      if (t && t.ipAddress) {
        return 'http://' + t.ipAddress + ':3001/media/' + name
      }
    }
  }
  return '/api/screen/public-preview?objectName=' + encodeURIComponent(name)
}

function onMediaError(e) {
  console.warn('[ScreenEditor] 媒体资源加载失败:', e?.message || e)
}

// ==== 文档上传（PPT/PDF/Word -> 直连终端转换）====
/**
 * 上传文档文件到终端，终端自动转换为图片序列
 */
async function handleDocUpload(fileInfo, el, appendToCarousel) {
  const rawFile = fileInfo.raw || fileInfo.file || fileInfo
  if (!rawFile) {
    console.log('[handleDocUpload] 没有文件', fileInfo)
    return
  }
  console.log('[handleDocUpload] 开始上传', rawFile.name, 'appendToCarousel=', appendToCarousel)

  const terminalIds = targetGroupId.value
  if (!terminalIds || terminalIds.length === 0) {
    ElMessage.warning('请先绑定至少一个终端再上传')
    return
  }
  const firstTerm = serverTerminals.value.find(x => x.id === terminalIds[0])
  if (!firstTerm || !firstTerm.ipAddress) {
    ElMessage.warning('终端信息不完整')
    return
  }

  if (rawFile.size > UPLOAD_FILE_SIZE_LIMIT) {
    ElMessage.error('文件大小不能超过 500MB')
    return
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    // 上传到第一个终端（多个终端则同步到所有终端）
    const termIp = firstTerm.ipAddress
    let uploadResult = null

    // 获取上传令牌
    const tokenRes = await requestUploadToken({ terminalIp: termIp, screenId: recordId.value || 'temp' })
    if (tokenRes.code !== 0 || !tokenRes.data?.uploadToken) {
      throw new Error('获取上传令牌失败')
    }
    const uploadToken = tokenRes.data.uploadToken

    // 上传文件
    if (rawFile.size > chunkEnabledThreshold) {
      uploadResult = await uploadByChunks(rawFile, 'doc', termIp, 0, 1)
    } else {
      uploadResult = await uploadDirect(rawFile, 'doc', termIp, 0, 1)
    }

    // 同步到其他终端
    for (let ti = 1; ti < terminalIds.length; ti++) {
      const term = serverTerminals.value.find(x => x.id === terminalIds[ti])
      if (term && term.ipAddress && term.ipAddress !== termIp) {
        try {
          const tr = await requestUploadToken({ terminalIp: term.ipAddress, screenId: recordId.value || 'temp' })
          if (tr.code === 0 && tr.data?.uploadToken) {
            if (rawFile.size > chunkEnabledThreshold) {
              await uploadByChunks(rawFile, 'doc', term.ipAddress, ti, terminalIds.length)
            } else {
              await uploadDirect(rawFile, 'doc', term.ipAddress, ti, terminalIds.length)
            }
          }
        } catch (e2) {
          console.warn('[upload] 同步到终端', term.ipAddress, '失败:', e2?.message)
        }
      }
    }

    // 上传完成，检查转换结果
    uploadProgress.value = 95
    if (uploadResult && uploadResult.docConvertError) {
      console.warn('[handleDocUpload] 转换异常:', uploadResult.docConvertError)
    }

    // 如果终端同步返回了 docImages，不需要等待；否则等 2 秒兜底
    if (!(uploadResult && uploadResult.docImages && uploadResult.docImages.length > 0)) {
      await new Promise(r => setTimeout(r, 2000))
    }
    uploadProgress.value = 99

    // 更新组件属性
    el.fileName = rawFile.name
    if (uploadResult && uploadResult.docImages && uploadResult.docImages.length > 0) {
      if (appendToCarousel) {
        // 追加到轮播（每页作为图片，标记为文档图片类型，始终 contain 不裁剪）
        if (!el.images) el.images = []
        uploadResult.docImages.forEach(h => {
          el.images.push({ type: 'docImage', src: h })
        })
      } else {
        el.src = uploadResult.docImages[0]
        el.srcList = uploadResult.docImages
        el.totalPages = uploadResult.docTotalPages || uploadResult.docImages.length
      }
    } else if (typeof uploadResult === 'string') {
      el.src = uploadResult
      el.srcList = [uploadResult]
      el.totalPages = 1
    } else if (uploadResult && uploadResult.fileHash) {
      el.src = uploadResult.fileHash
      el.srcList = [uploadResult.fileHash]
      el.totalPages = 1
    } else {
      // 兜底：没有任何转换结果时先设一个占位值
      console.warn('[handleDocUpload] 未收到 docImages，可能终端未安装转换依赖', uploadResult)
      el.src = uploadResult?.fileHash || ''
      el.srcList = []
      el.totalPages = 0
    }
    el.currentPage = 0
    dirty.value = true

    uploadProgress.value = 100
    ElMessage.success('文件上传并转换成功')
  } catch (e) {
    ElMessage.error('上传失败: ' + (e?.message || '未知错误'))
  } finally {
    uploading.value = false
    setTimeout(() => { uploadProgress.value = 0 }, 1000)
  }
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

  // ===== v5: 必须绑定至少一个终端才能上传 =====
  const terminalIds = targetGroupId.value
  if (!terminalIds || terminalIds.length === 0) {
    ElMessage.warning('请先绑定至少一个终端再上传')
    return
  }
  const terminalList = []
  for (const id of terminalIds) {
    const t = serverTerminals.value.find(x => x.id === id)
    if (t && t.ipAddress) terminalList.push(t)
  }
  if (terminalList.length === 0) {
    ElMessage.warning('绑定的终端信息不完整')
    return
  }

  // ===== 文件大小检查 =====
  if (rawFile.size > UPLOAD_FILE_SIZE_LIMIT) {
    ElMessage.error('文件大小不能超过 500MB')
    return
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    let objectName
    const totalTerminals = terminalList.length
    const useChunks = rawFile.size > chunkEnabledThreshold

    for (let ti = 0; ti < totalTerminals; ti++) {
      const term = terminalList[ti]
      const termIp = term.ipAddress
      console.log(`[upload] 终端 ${ti+1}/${totalTerminals}: ${termIp}`)

      if (useChunks) {
        objectName = await uploadByChunks(rawFile, targetType, termIp, ti, totalTerminals)
      } else {
        objectName = await uploadDirect(rawFile, targetType, termIp, ti, totalTerminals)
      }
    }

    // ===== 所有终端上传完成，更新编辑器中的引用 =====
    if (objectName) {
      if (targetType === 'video' && selectedEl.value) {
        selectedEl.value.src = objectName
      } else if (targetType === 'image' && selectedEl.value) {
        selectedEl.value.src = objectName
      } else if (targetType === 'carousel' && selectedEl.value) {
        if (!selectedEl.value.images) selectedEl.value.images = []
        selectedEl.value.images.push(objectName)
      } else if (targetType === 'carousel-video' && selectedEl.value) {
        if (!selectedEl.value.images) selectedEl.value.images = []
        selectedEl.value.images.push({ type: 'video', src: objectName })
      } else if (targetType === 'bg') {
        backgroundImage.value = objectName
      }
      dirty.value = true
      ElMessage.success(`上传成功（已同步 ${totalTerminals} 个终端）`)
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
function uploadDirect(rawFile, targetType, terminalIp, ti, totalTerminals) {
  console.log('[uploadDirect] terminalIp=', terminalIp, 'rawFile=', rawFile?.name)
  const termProgress = (ti / totalTerminals) * 100
  return new Promise(async (resolve, reject) => {
    try {
      // 1. 获取上传令牌
      uploadProgress.value = Math.max(uploadProgress.value, Math.round(termProgress + 5 / totalTerminals))
      const tokenRes = await requestUploadToken({
        terminalIp: terminalIp,
        screenId: recordId.value || 'temp',
      })
      if (tokenRes.code !== 0 || !tokenRes.data?.uploadToken) {
        reject(new Error('获取上传令牌失败'))
        return
      }
      const uploadToken = tokenRes.data.uploadToken

      // 2. 上传进度提示
      uploadProgress.value = Math.max(uploadProgress.value, Math.round(termProgress + 10 / totalTerminals))

      // 3. 直连终端上传（纯二进制 body，绕过 axios）
      const res = await terminalUploadSimple(terminalIp, rawFile, uploadToken)
      if (res && res.fileHash) {
        uploadProgress.value = Math.round(termProgress + 99 / totalTerminals)
        // 3. 通知后端记录上传
        recordUpload({
          screenId: recordId.value || 'temp',
          terminalIp: terminalIp,
          resourceId: res.id || '',
          resourceHash: res.fileHash,
          fileName: res.fileName || rawFile.name,
          fileSize: res.fileSize || rawFile.size,
        }).catch(() => {})
        // v5: 存纯 fileHash，渲染时由 resolveMediaUrl 自动拼完整 URL
        if (targetType === 'bg') {
          backgroundImage.value = res.fileHash
        }
        // 文档上传时返回完整对象（带 docImages），否则返回 fileHash 字符串
        if (targetType === 'doc') {
          resolve(res)
        } else {
          resolve(res.fileHash)
        }
      } else {
        reject(new Error((res && res.error) || '上传失败'))
      }
    } catch (e) {
      if (e.message && e.message.includes('令牌无效')) {
        reject(new Error('上传令牌无效，请刷新页面重试'))
      } else {
        reject(e)
      }
    }
  })
}

/**
 * 大文件切片上传（含进度条 + 并发窗口 + 失败重试）
 */
async function uploadByChunks(rawFile, targetType, terminalIp, ti, totalTerminals) {
  console.log('[uploadByChunks] terminalIp=', terminalIp, 'rawFile=', rawFile?.name)
  const termProgress = (ti / totalTerminals) * 100
  const totalChunks = Math.ceil(rawFile.size / CHUNK_SIZE)

  // ===== v5: 直连终端，先获取上传令牌 =====
  const tokenRes = await requestUploadToken({
    terminalIp: terminalIp,
    screenId: recordId.value || 'temp',
  })
  if (tokenRes.code !== 0 || !tokenRes.data?.uploadToken) {
    throw new Error('获取上传令牌失败')
  }
  const uploadToken = tokenRes.data.uploadToken

  uploadProgress.value = Math.max(uploadProgress.value, Math.round(termProgress + 5 / totalTerminals))

  // ===== Step 1: 直连终端初始化（断点续传）=====
  const totalUploadChunks = Math.ceil(rawFile.size / CHUNK_SIZE)
  const initRes = await terminalInitUpload(terminalIp, {
    fileName: rawFile.name,
    fileSize: rawFile.size,
    totalChunks: totalUploadChunks,
  }, uploadToken)
  if (!initRes.uploadId) {
    throw new Error((initRes.error || '初始化失败'))
  }

  const { uploadId, resumedChunks } = initRes

  // ===== Step 2: 并发上传切片（每批3片）=----
  let successCount = 0
  let failedMsg = null

  // 进度更新函数（多终端：当前终端占 1/totalTerminals 权重）
  const updateProgress = () => {
    const termWeight = 99 / totalTerminals
    uploadProgress.value = Math.round(termProgress + (successCount / totalUploadChunks) * termWeight)
  }

  // 上传单片（含重试 + 断点续传）
  async function uploadSingleChunk(index) {
    // 断点续传：如果终端已有此切片，直接跳过
    if (resumedChunks && resumedChunks.includes(index)) {
      successCount++
      updateProgress()
      return
    }
    let lastError = null
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const start = index * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, rawFile.size)
        const blob = rawFile.slice(start, end)

        const res = await terminalUploadChunk(terminalIp, blob, uploadId, index, uploadToken)
        if (res.ok && res.received) {
          successCount++
          updateProgress()
          return // 成功
        }
        lastError = new Error(res.error || `切片 ${index} 上传失败`)
      } catch (e) {
        lastError = e
        if (e.message && e.message.includes('429')) {
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
  for (let i = 0; i < totalUploadChunks; i++) {
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
  const completeRes = await terminalCompleteUpload(terminalIp, {
    uploadId,
    totalChunks: totalUploadChunks,
  }, uploadToken)

  if (!completeRes.id || !completeRes.fileHash) {
    throw new Error(completeRes.error || '合片失败')
  }

  // v5: 存纯 fileHash，渲染时由 resolveMediaUrl 自动拼完整 URL
  uploadProgress.value = 100
  if (targetType === 'bg') {
    backgroundImage.value = completeRes.fileHash
  }
  // 通知后端记录上传
  recordUpload({
    screenId: recordId.value || 'temp',
    terminalIp: terminalIp,
    resourceId: completeRes.id || '',
    resourceHash: completeRes.fileHash,
    fileName: completeRes.fileName || rawFile.name,
    fileSize: completeRes.fileSize || rawFile.size,
  }).catch(() => {})
  // 文档上传时返回完整对象
  if (targetType === 'doc') {
    return completeRes
  }
  return completeRes.fileHash
}

// ==== 组件拖拽 ====
function onDragStart(e, type) {
  e.dataTransfer.setData('componentType', type)
  e.dataTransfer.effectAllowed = 'copy'
}

async function onDrop(e) {
  const type = e.dataTransfer.getData('componentType')
  const materialType = e.dataTransfer.getData('materialType')
  const materialUrl = e.dataTransfer.getData('materialUrl')
  const materialName = e.dataTransfer.getData('materialName') || ''

  // 从素材库拖来的
  if (materialUrl) {
    if (!materialType || (materialType !== 'image' && materialType !== 'video')) {
      ElMessage.warning('该素材类型暂不支持拖入画布')
      return
    }
    const rect = canvasRef.value.getBoundingClientRect()
    const sf = zoom.value / 100
    let x = Math.round((e.clientX - rect.left) / sf)
    let y = Math.round((e.clientY - rect.top) / sf)
    const el = createElement(materialType, x, y)
    el.src = materialUrl
    el.fileName = materialName
    el.srcList = [materialUrl]
    elements.value.push(el)
    selectedIdx.value = elements.value.length - 1
    dirty.value = true
    clampAllElements()
    startCarouselForElement(el)
    return
  }

  // 从组件库拖来的
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
  const sizes = { video:[480,360], image:[480,360], carousel:[960,540], text:[400,100], scrollText:[900,80], clock:[250,100], iframe:[800,600] }
  let defW = 300, defH = 200
  if (sizes[type]) { defW = sizes[type][0]; defH = sizes[type][1] }
  // 文档组件（PPT/PDF/Word）默认铺满全屏
  if (['ppt','pdf','word'].includes(type)) { defW = pw; defH = ph }
  if (x === undefined) x = Math.round((pw - defW) / 2)
  if (y === undefined) y = Math.round((ph - defH) / 2)
  x = Math.max(0, Math.min(x, pw - defW))
  y = Math.max(0, Math.min(y, ph - defH))
  // 文档组件始终从 (0,0) 撑满
  if (['ppt','pdf','word'].includes(type)) { x = 0; y = 0 }

  const lmode = ['ppt','pdf','word'].includes(type) ? 'block' : (['video','image','carousel'].includes(type) ? 'block' : 'float')
  const base = { id: 'el_' + type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type, x, y, w: defW, h: defH, zIndex: 1, layoutMode: lmode, label: componentTypes.find(c=>c.type===type)?.label || type }

  if (type === 'video') { base.src = ''; base.autoplay = true; base.loop = true; base.muted = true }
  else if (type === 'image') { base.src = ''; base.opacity = 1 }
  else if (type === 'carousel') { base.images = []; base.interval = 3; base.fullscreen = false }
  else if (type === 'text') { base.content = ''; base.fontSize = 28; base.color = '#ffffff'; base.bold = false; base.textAlign = 'center'; base.fontFamily = '' }
  else if (type === 'scrollText') { base.content = ''; base.fontSize = 24; base.color = '#ffffff'; base.backgroundColor = 'transparent'; base.speed = 'medium'; base.fontFamily = '' }
  else if (type === 'clock') { base.fontSize = 36; base.color = '#00ffcc'; base.fontFamily = 'monospace'; base.clockStyle = 'digital'; base.showDate = true; base.backgroundColor = 'transparent' }
  else if (['ppt','pdf','word'].includes(type)) { base.src = ''; base.fileName = ''; base.srcList = []; base.currentPage = 0; base.playSpeed = 3; base.totalPages = 0 }

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
  clearCarouselTimer(el.id)
  allCarouselTimers[el.id] = setInterval(() => {
    const arr = el.images || []
    if (!arr.length) return
    const ci = carouselState[el.id]
    const item = arr[ci]
    // 如果是视频，不要用 interval 自动切，等 ended 事件
    if (item && typeof item === 'object' && item.type === 'video') return
    carouselState[el.id] = (ci + 1) % arr.length
  }, interval)
}

function clearCarouselTimer(elId) {
  if (allCarouselTimers[elId]) {
    clearInterval(allCarouselTimers[elId])
    delete allCarouselTimers[elId]
  }
}

function onCarouselVideoEnded(el, item) {
  if (!el || !el.images) return
  const ci = carouselState[el.id]
  // 找到当前视频索引，切到下一个
  const arr = el.images
  let nextIdx = 0
  if (ci !== undefined) {
    nextIdx = (ci + 1) % arr.length
  }
  carouselState[el.id] = nextIdx
  // 如果下一个是视频，不用 timer，等它的 ended 事件
  const nextItem = arr[nextIdx]
  if (nextItem && typeof nextItem === 'object' && nextItem.type === 'video') {
    // 清除 timer 防止干扰
    clearCarouselTimer(el.id)
  }
  // 触发 Vue 响应式
  dirty.value = true
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
        targetGroupId.value = d.targetGroupId ? d.targetGroupId.split(',').filter(Boolean) : []
        pushType.value = d.publishType || 'normal'
        pageWidth.value = d.pageWidth || 1920
        pageHeight.value = d.pageHeight || 1080
        backgroundColor.value = d.backgroundColor || '#000000'
        backgroundImage.value = d.backgroundImage || ''
        if (d.layoutJson) {
          try {
            const parsed = JSON.parse(d.layoutJson)
            if (Array.isArray(parsed)) {
              elements.value = parsed
            } else if (parsed && parsed.elements) {
              elements.value = parsed.elements
              // 从 layoutJson 中提取背景色和背景图（若无单独字段）
              if (parsed.backgroundColor && !d.backgroundColor) backgroundColor.value = parsed.backgroundColor
              if (parsed.backgroundImage && !d.backgroundImage) backgroundImage.value = parsed.backgroundImage
            } else {
              elements.value = []
            }
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
  // 保存前校验终端分辨率一致性
  if (!checkResolutionConflict()) { return }
  if (!publishTitle.value) { ElMessage.warning('请输入大屏标题'); return }
  const layoutJson = JSON.stringify({
    elements: elements.value,
    title: publishTitle.value,
    backgroundColor: backgroundColor.value,
    backgroundImage: backgroundImage.value,
    pageWidth: pageWidth.value,
    pageHeight: pageHeight.value
  })
  const payload = {
    title: publishTitle.value,
    pageWidth: pageWidth.value,
    pageHeight: pageHeight.value,
    backgroundColor: backgroundColor.value,
    backgroundImage: backgroundImage.value,
    layoutJson,
    targetGroupId: targetGroupId.value.length > 0 ? targetGroupId.value.join(',') : null,
    publishType: pushType.value,
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

function onTargetGroupChange() {
  if (targetGroupId.value.length > 20) {
    ElMessage.warning('最多只能选择20个终端')
    targetGroupId.value = targetGroupId.value.slice(0, 20)
  }
  // 校验所有选中终端的分辨率是否一致
  if (targetGroupId.value.length > 1) {
    const terms = targetGroupId.value.map(id => serverTerminals.value.find(t => t.id === id)).filter(Boolean)
    const first = terms[0]
    const diff = terms.find(t => t.screenWidth !== first.screenWidth || t.screenHeight !== first.screenHeight)
    if (diff) {
      ElMessage.warning('所选终端的屏幕分辨率不一致，无法同时绑定，请重新选择分辨率相同的终端')
      targetGroupId.value = []
      return
    }
  }
  // 选取第一个终端，自动填入分辨率到画布
  if (targetGroupId.value.length > 0) {
    const firstId = targetGroupId.value[0]
    const firstTerm = serverTerminals.value.find(t => t.id === firstId)
    if (firstTerm && firstTerm.screenWidth && firstTerm.screenHeight) {
      pageWidth.value = firstTerm.screenWidth
      pageHeight.value = firstTerm.screenHeight
    }
  }
  // 加载素材库
  nextTick(() => loadMaterialList())
  dirty.value = true
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
  // v5: 必须绑定终端才能预览（直连终端 3001）
  const terminalIds = targetGroupId.value
  if (!terminalIds || terminalIds.length === 0) {
    ElMessage.warning('请先绑定终端再预览')
    return
  }
  const firstTerm = serverTerminals.value.find(t => t.id === terminalIds[0])
  if (!firstTerm || !firstTerm.ipAddress) {
    ElMessage.warning('绑定的终端信息不完整')
    return
  }
  // 在新窗口打开终端 3001 预览页
  const url = `http://${firstTerm.ipAddress}:3001/preview/${recordId.value}`
  window.open(url, '_blank')
}

/**
 * 校验已选终端的分辨率是否一致
 * @returns {boolean} true-校验通过 false-校验不通过
 */
function checkResolutionConflict() {
  const ids = targetGroupId.value
  if (!ids || ids.length === 0) {
    ElMessage.warning('请先绑定终端')
    return false
  }
  // 以第一个终端为基准
  const firstId = ids[0]
  const firstTerm = serverTerminals.value.find(t => t.id === firstId)
  if (!firstTerm || !firstTerm.screenWidth || !firstTerm.screenHeight) {
    ElMessage.warning('第一个绑定的终端分辨率信息不完整，请确认终端已设置分辨率')
    return false
  }
  const baseW = firstTerm.screenWidth
  const baseH = firstTerm.screenHeight
  const conflictList = []
  for (let i = 1; i < ids.length; i++) {
    const t = serverTerminals.value.find(x => x.id === ids[i])
    if (t && (t.screenWidth !== baseW || t.screenHeight !== baseH)) {
      conflictList.push(`${t.equipmentName} (${t.screenWidth || '?'}x${t.screenHeight || '?'})`)
    }
  }
  if (conflictList.length > 0) {
    ElMessage.warning(`以下终端分辨率与画布设置(${baseW}x${baseH})不一致，无法保存/发布：<br>${conflictList.join('<br>')}`, { dangerouslyUseHTMLString: true, duration: 5000 })
    return false
  }
  return true
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

/* 素材库 */
.material-lib { padding: 0 4px; }
.material-list { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.material-empty { font-size: 12px; color: #888; text-align: center; padding: 12px 0; }
.material-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; background: #1e1e3a; border-radius: 4px; cursor: grab; transition: background 0.15s; }
.material-item:hover { background: #2a2a5a; }
.material-thumb { width: 40px; height: 28px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
.material-name { font-size: 12px; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.material-file-icon { font-size: 18px; flex-shrink: 0; }

/* 悬浮预览弹窗（覆盖画布） */
.material-hover-preview {
  position: fixed;
  z-index: 9999;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 70vw;
  max-width: 960px;
  height: 80vh;
  max-height: 640px;
  background: #0d0d2b;
  border: 1px solid #3a3a6a;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
}
.material-hover-preview img,
.material-hover-preview video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.material-hover-preview-close {
  position: absolute;
  top: 6px;
  right: 10px;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  z-index: 10;
  opacity: 0.7;
}
.material-hover-preview-close:hover {
  opacity: 1;
}

.single-upload-hidden { display: inline-block; width:0; height:0; overflow:hidden; }

/* 素材选择弹窗预览 */
.material-picker-preview {
  width: 240px;
  min-height: 180px;
  background: #111;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.material-picker-preview img,
.material-picker-preview video {
  width: 100%;
  max-height: 280px;
  object-fit: contain;
}
.material-item-active {
  background: #3a3a7a !important;
  border: 1px solid #6a6aff;
}

/* 文档组件（PPT/PDF/Word）*/
.el-doc { width: 100%; height: 100%; position: relative; overflow: hidden; background-size: contain; background-position: center; background-repeat: no-repeat; }
.doc-preview { width: 100%; height: 100%; position: relative; }
.doc-page-indicator { position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; padding: 1px 6px; border-radius: 3px; }
</style>