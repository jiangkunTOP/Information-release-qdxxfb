<template>
  <div class="editor-layout">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button size="small" @click="goBack">← 返回</el-button>
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
        <!-- 树形素材库面板 -->
        <el-divider style="margin:8px 0;" />
        <div class="sidebar-title">素材库</div>
        <div class="tree-material-panel">
          <div class="tree-material-toolbar">
            <el-button size="small" type="primary" @click="onTreeUploadClick" :loading="treeUploading">⬆ 上传</el-button>
            <el-button size="small" @click="loadTreeMaterialList" :loading="treeLoading">🔄 刷新</el-button>
          </div>
          <!-- 上传 Dialog（完全照搬素材库页面） -->
          <el-dialog
            v-model="treeUploadVisible"
            title="上传素材"
            width="520px"
            :close-on-click-modal="false"
            @close="resetTreeUploadForm"
          >
            <el-form ref="treeUploadFormRef" :model="treeUploadForm" :rules="treeUploadRules" label-width="100px">
              <el-form-item label="素材类型" prop="type">
                <el-select v-model="treeUploadForm.type" style="width: 200px;">
                  <el-option label="图片" value="image" />
                  <el-option label="视频" value="video" />
                  <el-option label="PPT" value="ppt" />
                  <el-option label="PDF" value="pdf" />
                  <el-option label="Word" value="word" />
                </el-select>
              </el-form-item>
              <el-form-item label="素材文件" prop="file">
                <el-upload
                  ref="treeUploadRef"
                  :auto-upload="false"
                  :limit="1"
                  :accept="treeUploadAccept"
                  :on-change="onTreeFileChange"
                  :on-remove="onTreeFileRemove"
                >
                  <el-button type="primary">选择文件</el-button>
                  <template #tip>
                    <div class="el-upload__tip">{{ treeUploadTip }}</div>
                  </template>
                </el-upload>
              </el-form-item>
              <el-form-item label="素材名称" prop="name">
                <el-input v-model="treeUploadForm.name" placeholder="输入素材名称（不含扩展名）" />
              </el-form-item>
              <el-form-item v-if="treeUploading" label="上传进度">
                <el-progress :percentage="treeUploadProgress" :stroke-width="16" :text-inside="true" status="success" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button :disabled="treeUploading" @click="treeUploadVisible = false">取消</el-button>
              <el-button type="primary" :loading="treeUploading" @click="onTreeUploadSubmit">{{ treeUploading ? '上传中...' : '确定上传' }}</el-button>
            </template>
          </el-dialog>
          <div v-if="treeLoading" class="tree-material-loading">加载中...</div>
          <div v-else class="tree-material-scroll">
            <!-- 图片分类 -->
            <div class="tree-category">
              <div class="tree-category-header" @click="treeCollapsed.image = !treeCollapsed.image">
                <span class="tree-category-arrow">{{ treeCollapsed.image ? '▶' : '▼' }}</span>
                <span>📁 图片</span>
                <span class="tree-category-count">({{ groupedMaterials.image.length }})</span>
              </div>
              <div v-if="!treeCollapsed.image" class="tree-category-body">
                <div v-for="item in groupedMaterials.image" :key="item.id" class="tree-material-item" draggable="true" @dragstart="onTreeDragStart($event, item)" @contextmenu.prevent="onTreeContextMenu($event, item)" @click="onTreePreview(item)">
                  <img :src="resolveMaterialThumb(item)" class="tree-material-thumb" />
                  <span class="tree-material-name" :title="item.fileName || item.name">{{ item.fileName || item.name || '未命名' }}</span>
                </div>
                <div v-if="groupedMaterials.image.length === 0" class="tree-material-empty">暂无图片素材</div>
              </div>
            </div>
            <!-- 视频分类 -->
            <div class="tree-category">
              <div class="tree-category-header" @click="treeCollapsed.video = !treeCollapsed.video">
                <span class="tree-category-arrow">{{ treeCollapsed.video ? '▶' : '▼' }}</span>
                <span>📁 视频</span>
                <span class="tree-category-count">({{ groupedMaterials.video.length }})</span>
              </div>
              <div v-if="!treeCollapsed.video" class="tree-category-body">
                <div v-for="item in groupedMaterials.video" :key="item.id" class="tree-material-item" draggable="true" @dragstart="onTreeDragStart($event, item)" @contextmenu.prevent="onTreeContextMenu($event, item)" @click="onTreePreview(item)">
                  <video :src="resolveMaterialThumb(item)" class="tree-material-thumb" muted />
                  <span class="tree-material-name" :title="item.fileName || item.name">{{ item.fileName || item.name || '未命名' }}</span>
                </div>
                <div v-if="groupedMaterials.video.length === 0" class="tree-material-empty">暂无视频素材</div>
              </div>
            </div>
            <!-- PPT 分类 -->
            <div class="tree-category">
              <div class="tree-category-header" @click="treeCollapsed.ppt = !treeCollapsed.ppt">
                <span class="tree-category-arrow">{{ treeCollapsed.ppt ? '▶' : '▼' }}</span>
                <span>📁 PPT</span>
                <span class="tree-category-count">({{ groupedMaterials.ppt.length }})</span>
              </div>
              <div v-if="!treeCollapsed.ppt" class="tree-category-body">
                <!-- 二级：文档名称，可折叠展开三级图片 -->
                <div v-for="item in groupedMaterials.ppt" :key="item.id" class="tree-doc-material2">
                  <div class="tree-doc-header2" draggable="true" @dragstart="onTreeDocSecondaryDragStart($event, item, 'ppt')">
                    <span class="tree-doc-toggle2" @click.stop="onTreeDocToggle(item)">{{ item._expanded ? '▼' : '▶' }}</span>
                    <span class="tree-material-file-icon">📄</span>
                    <span class="tree-material-name tree-doc-name2" :title="item.fileName || item.name" @dblclick="onTreeRenameStart(item)">{{ editableRenameId === item.id ? '' : (item.fileName || item.name || '未命名') }}</span>
                    <el-input v-if="editableRenameId === item.id" v-model="editableRenameText" ref="renameInputRef" size="mini" style="width:80px;" @blur="onTreeRenameConfirm(item)" @keyup.enter="onTreeRenameConfirm(item)" @click.stop />
                    <el-button size="small" type="danger" link @click.stop="onTreeDeleteConfirm(item)">🗑</el-button>
                  </div>
                  <!-- 三级：该文档的所有预览图片 -->
                  <div v-if="item._expanded" class="tree-doc-pages2">
                    <div
                      v-for="pi in item.previewCount"
                      :key="pi-1"
                      class="tree-doc-page-item2"
                      @click.stop="onTreePreviewPage(item, pi-1)"
                    >
                      <img :src="resolveMaterialPageUrl(item, pi-1)" class="tree-doc-page-thumb2" draggable="false" />
                    </div>
                    <div v-if="item.previewCount === 0" class="tree-material-empty">暂无预览</div>
                  </div>
                </div>
                <div v-if="groupedMaterials.ppt.length === 0" class="tree-material-empty">暂无PPT素材</div>
              </div>
            </div>
            <!-- PDF 分类 -->
            <div class="tree-category">
              <div class="tree-category-header" @click="treeCollapsed.pdf = !treeCollapsed.pdf">
                <span class="tree-category-arrow">{{ treeCollapsed.pdf ? '▶' : '▼' }}</span>
                <span>📁 PDF</span>
                <span class="tree-category-count">({{ groupedMaterials.pdf.length }})</span>
              </div>
              <div v-if="!treeCollapsed.pdf" class="tree-category-body">
                <div v-for="item in groupedMaterials.pdf" :key="item.id" class="tree-doc-material2">
                  <div class="tree-doc-header2" draggable="true" @dragstart="onTreeDocSecondaryDragStart($event, item, 'pdf')">
                    <span class="tree-doc-toggle2" @click.stop="onTreeDocToggle(item)">{{ item._expanded ? '▼' : '▶' }}</span>
                    <span class="tree-material-file-icon">📄</span>
                    <span class="tree-material-name tree-doc-name2" :title="item.fileName || item.name" @dblclick="onTreeRenameStart(item)">{{ editableRenameId === item.id ? '' : (item.fileName || item.name || '未命名') }}</span>
                    <el-input v-if="editableRenameId === item.id" v-model="editableRenameText" ref="renameInputRef" size="mini" style="width:80px;" @blur="onTreeRenameConfirm(item)" @keyup.enter="onTreeRenameConfirm(item)" @click.stop />
                    <el-button size="small" type="danger" link @click.stop="onTreeDeleteConfirm(item)">🗑</el-button>
                  </div>
                  <div v-if="item._expanded" class="tree-doc-pages2">
                    <div
                      v-for="pi in item.previewCount"
                      :key="pi-1"
                      class="tree-doc-page-item2"
                      @click.stop="onTreePreviewPage(item, pi-1)"
                    >
                      <img :src="resolveMaterialPageUrl(item, pi-1)" class="tree-doc-page-thumb2" draggable="false" />
                    </div>
                    <div v-if="item.previewCount === 0" class="tree-material-empty">暂无预览</div>
                  </div>
                </div>
                <div v-if="groupedMaterials.pdf.length === 0" class="tree-material-empty">暂无PDF素材</div>
              </div>
            </div>
            <!-- Word 分类 -->
            <div class="tree-category">
              <div class="tree-category-header" @click="treeCollapsed.word = !treeCollapsed.word">
                <span class="tree-category-arrow">{{ treeCollapsed.word ? '▶' : '▼' }}</span>
                <span>📁 Word</span>
                <span class="tree-category-count">({{ groupedMaterials.word.length }})</span>
              </div>
              <div v-if="!treeCollapsed.word" class="tree-category-body">
                <div v-for="item in groupedMaterials.word" :key="item.id" class="tree-doc-material2">
                  <div class="tree-doc-header2" draggable="true" @dragstart="onTreeDocSecondaryDragStart($event, item, 'word')">
                    <span class="tree-doc-toggle2" @click.stop="onTreeDocToggle(item)">{{ item._expanded ? '▼' : '▶' }}</span>
                    <span class="tree-material-file-icon">📄</span>
                    <span class="tree-material-name tree-doc-name2" :title="item.fileName || item.name" @dblclick="onTreeRenameStart(item)">{{ editableRenameId === item.id ? '' : (item.fileName || item.name || '未命名') }}</span>
                    <el-input v-if="editableRenameId === item.id" v-model="editableRenameText" ref="renameInputRef" size="mini" style="width:80px;" @blur="onTreeRenameConfirm(item)" @keyup.enter="onTreeRenameConfirm(item)" @click.stop />
                    <el-button size="small" type="danger" link @click.stop="onTreeDeleteConfirm(item)">🗑</el-button>
                  </div>
                  <div v-if="item._expanded" class="tree-doc-pages2">
                    <div
                      v-for="pi in item.previewCount"
                      :key="pi-1"
                      class="tree-doc-page-item2"
                      @click.stop="onTreePreviewPage(item, pi-1)"
                    >
                      <img :src="resolveMaterialPageUrl(item, pi-1)" class="tree-doc-page-thumb2" draggable="false" />
                    </div>
                    <div v-if="item.previewCount === 0" class="tree-material-empty">暂无预览</div>
                  </div>
                </div>
                <div v-if="groupedMaterials.word.length === 0" class="tree-material-empty">暂无Word素材</div>
              </div>
            </div>
            <!-- 右键菜单 -->
            <div v-if="treeContextMenu.visible" class="tree-context-menu" :style="{ left: treeContextMenu.x + 'px', top: treeContextMenu.y + 'px' }" @click.stop>
              <div class="tree-context-item" @click="onTreeRename">✏️ 重命名</div>
              <div class="tree-context-item tree-context-item-danger" @click="onTreeDelete">🗑 删除</div>
            </div>
          </div>
          <div v-if="!treeLoading && allTreeMaterials.length === 0" class="tree-material-empty" style="padding:20px;text-align:center;">暂无素材，点击上传</div>
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
            <video v-if="el.type==='video'" :key="'v_'+el.src" :src="resolveMediaUrl(el.src)" :autoplay="el.autoplay!==false" :muted="el.muted!==false" :loop="el.loop!==false" :style="{ width:'100%', height:'100%', objectFit: el.objectFit || 'contain', display:'block', pointerEvents:'none' }" @error="onMediaError"></video>
            <div v-if="el.type==='video' && !el.src" class="placeholder-text">🎬 视频组件<br><span style="font-size:11px;opacity:0.6;">上传视频后自动播放</span></div>
            <img v-else-if="el.type==='image'" :key="'i_'+el.src" :src="resolveMediaUrl(el.src)" :style="{ width:'100%', height:'100%', objectFit: el.objectFit || 'contain', display:'block', pointerEvents:'none', opacity: el.opacity ?? 1 }" @error="onMediaError" />
            <div v-else-if="el.type==='carousel'" class="carousel-wrap">
              <template v-for="(item, ci) in (el.images||[])" :key="ci">
                <img v-if="typeof item === 'string' || item.type==='image'" :src="resolveMediaUrl(typeof item === 'string' ? item : item.src)" :style="{ width:'100%', height:'100%', objectFit: el.objectFit || 'contain', position:'absolute', left:'0', top:'0', opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
                <img v-else-if="item.type==='docImage'" :src="resolveMediaUrl(item.src)" :style="{ width:'100%', height:'100%', objectFit: el.objectFit || 'contain', position:'absolute', left:'0', top:'0', opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
                <video v-else-if="item.type==='video'" :src="resolveMediaUrl(item.src)" autoplay muted loop :style="{ width:'100%', height:'100%', objectFit: el.objectFit || 'contain', position:'absolute', left:'0', top:'0', opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" @ended="onCarouselVideoEnded(el, item)"></video>
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

            <div v-else-if="['ppt','pdf','word'].includes(el.type)" class="el-doc" :style="{ backgroundImage: el.src ? 'url(' + resolveMediaUrl(el.src) + ')' : 'none', backgroundColor: el.src ? backgroundColor : 'transparent', backgroundSize: (el.objectFit || 'contain') === 'fill' ? 'cover' : 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }">
              <div v-if="el.src" class="doc-preview">
                <div style="position:absolute;bottom:8px;right:40px;background:rgba(0,0,0,0.6);color:#fff;font-size:13px;padding:2px 10px;border-radius:4px;z-index:10;">{{ (el.currentPage || 0) + 1 }} / {{ el.totalPages || 1 }}</div>
                <div class="media-mini-fullscreen" @click.stop="onDocFullscreenToggle(el)" :title="(el.objectFit || 'contain') === 'fill' ? '退出全屏' : '全屏'" style="position:absolute;bottom:4px;right:4px;z-index:12;width:28px;height:28px;background:rgba(0,0,0,0.5);border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;color:#fff;">⛶</div>
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
                  <el-button size="small" type="primary" @click="onVideoSelectFromMaterial">📚 从素材库选择</el-button>
                  <el-upload ref="videoUploadRef" :auto-upload="false" :show-file-list="false" accept="video/*" @change="(f)=>handleFileUpload(f,'video')" class="single-upload-hidden"></el-upload>
                </div>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="视频URL">
                <div style="display:flex;gap:4px;">
                  <el-input v-model="selectedEl.src" placeholder="或直接输入URL" @input="emitChange" style="flex:1;" />
                  <el-button v-if="selectedEl.src" size="small" type="danger" @click="onVideoSrcRemove">删除</el-button>
                </div>
              </el-form-item>
              <div class="prop-grid" style="margin-top:8px;">
                <el-form-item label="自动播放"><el-switch v-model="selectedEl.autoplay" @change="emitChange" /></el-form-item>
                <el-form-item label="静音"><el-switch v-model="selectedEl.muted" @change="emitChange" /></el-form-item>
                <el-form-item label="循环播放"><el-switch v-model="selectedEl.loop" @change="emitChange" /></el-form-item>
                <el-form-item label="布局"><el-switch v-model="selectedEl.fullscreen" @click="onVideoFullscreenToggle()" /></el-form-item>
              </div>
              <el-form-item label="适配"><el-button size="small" :type="selectedEl.objectFit === 'contain' || !selectedEl.objectFit ? 'primary' : ''" @click="selectedEl.objectFit = 'contain'; emitChange()">等比</el-button><el-button size="small" :type="selectedEl.objectFit === 'fill' ? 'primary' : ''" @click="selectedEl.objectFit = 'fill'; emitChange()">全屏</el-button></el-form-item>
              <div v-if="selectedEl.src" class="upload-preview" style="max-height:80px;">
                <video :src="resolveMediaUrl(selectedEl.src)" :autoplay="selectedEl.autoplay!==false" :muted="selectedEl.muted!==false" :loop="selectedEl.loop!==false" style="width:100%;max-height:80px;border-radius:4px;" />
              </div>
            </template>

            <template v-if="selectedEl.type==='image'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="上传图片">
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <el-button size="small" type="primary" @click="onImageSelectFromMaterial">📚 从素材库选择</el-button>
                  <el-upload ref="imageUploadRef" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'image')" class="single-upload-hidden"></el-upload>
                </div>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="图片URL">
                <div style="display:flex;gap:4px;">
                  <el-input v-model="selectedEl.src" placeholder="或直接输入URL" @input="emitChange" style="flex:1;" />
                  <el-button v-if="selectedEl.src" size="small" type="danger" @click="onImageSrcRemove">删除</el-button>
                </div>
              </el-form-item>
              <div v-if="selectedEl.src" class="upload-preview" style="max-height:80px;">
                <img :src="resolveMediaUrl(selectedEl.src)" style="width:100%;max-height:80px;object-fit:contain;border-radius:4px;" />
              </div>
              <el-form-item label="布局"><el-switch v-model="selectedEl.fullscreen" @click="onImageFullscreenToggle()" /></el-form-item>
              <el-form-item label="适配"><el-button size="small" :type="selectedEl.objectFit === 'contain' || !selectedEl.objectFit ? 'primary' : ''" @click="selectedEl.objectFit = 'contain'; emitChange()">等比</el-button><el-button size="small" :type="selectedEl.objectFit === 'fill' ? 'primary' : ''" @click="selectedEl.objectFit = 'fill'; emitChange()">全屏</el-button></el-form-item>
              <el-form-item label="透明度">
                <el-slider v-model="selectedEl.opacity" :min="0.1" :max="1" :step="0.05" @change="emitChange" />
              </el-form-item>
            </template>

            <template v-if="selectedEl.type==='carousel'">
              <el-divider style="margin:4px 0;" />
              <el-form-item label="添加素材">
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <el-button size="small" type="primary" @click="onCarouselSelectFromMaterial">📚 从素材库选择</el-button>
                  <el-upload ref="carouselUploadRef" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'carousel')" class="single-upload-hidden"></el-upload>
                  <el-upload ref="carouselVideoUploadRef" :auto-upload="false" :show-file-list="false" accept="video/*" @change="(f)=>handleFileUpload(f,'carousel-video')" class="single-upload-hidden"></el-upload>
                  <el-upload ref="carouselDocUploadRef" :auto-upload="false" :show-file-list="false" accept=".ppt,.pptx,.pdf,.doc,.docx" @change="(f)=>handleDocUpload(f, selectedEl, true)" class="single-upload-hidden"></el-upload>
                </div>
              </el-form-item>
              <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="width:100%;" />
              </el-form-item>
              <el-form-item label="切换间隔(秒)">
                <el-input-number v-model="selectedEl.interval" :min="1" :max="60" style="width:100%;" @change="emitChange" />
              </el-form-item>
              <el-form-item label="布局"><el-switch v-model="selectedEl.fullscreen" @click="onCarouselFullscreenToggle()" /></el-form-item>
              <el-form-item label="适配"><el-button size="small" :type="selectedEl.objectFit === 'contain' || !selectedEl.objectFit ? 'primary' : ''" @click="selectedEl.objectFit = 'contain'; emitChange()">等比</el-button><el-button size="small" :type="selectedEl.objectFit === 'fill' ? 'primary' : ''" @click="selectedEl.objectFit = 'fill'; emitChange()">全屏</el-button></el-form-item>
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
                  <el-button size="small" type="danger" link @click="onCarouselRemoveItem(ci)">×</el-button>
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
                  <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <el-button size="small" type="primary" @click="onDocSelectFromMaterial(selectedEl.type)">📚 从素材库选择</el-button>
                  </div>
                  <div v-if="uploadProgress > 0 && uploadProgress < 100" style="margin:2px 0;">
                    <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="6" />
                  </div>
                  <div v-if="selectedEl.fileName" class="upload-preview" style="padding:4px 8px;">
                    <span style="font-size:12px;color:#aaa;">📄 {{ selectedEl.fileName }}</span>
                    <span style="font-size:11px;color:#666;margin-left:8px;">{{ selectedEl.totalPages || '?' }}页</span>
                    <el-button v-if="selectedEl.src" size="small" type="danger" link style="margin-left:auto;" @click="onDocRemove(selectedEl)">删除</el-button>
                  </div>
                  <div v-if="selectedEl.totalPages > 0" class="upload-preview" style="max-height:100px;overflow:hidden;">
                    <img :src="resolveMediaUrl(selectedEl.src)" style="width:100%;height:80px;object-fit:contain;border-radius:4px;background:#111;" />
                  </div>
                </div>
              </el-form-item>
              <el-form-item label="布局"><el-switch v-model="selectedEl.fullscreen" @click="onDocFullscreenToggle(selectedEl)" /></el-form-item>
              <el-form-item label="适配"><el-button size="small" :type="selectedEl.objectFit === 'contain' || !selectedEl.objectFit ? 'primary' : ''" @click="selectedEl.objectFit = 'contain'; emitChange()">等比</el-button><el-button size="small" :type="selectedEl.objectFit === 'fill' ? 'primary' : ''" @click="selectedEl.objectFit = 'fill'; emitChange()">全屏</el-button></el-form-item>
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
                <el-button size="small" type="primary" @click="onBgSelectFromMaterial">📚 从素材库选择</el-button>
                <el-upload ref="bgUploadRef" :auto-upload="false" :show-file-list="false" accept="image/*" @change="(f)=>handleFileUpload(f,'bg')" class="single-upload-hidden"></el-upload>
              </div>
            </el-form-item>
            <el-form-item v-if="uploadProgress > 0 && uploadProgress < 100" label="上传进度">
              <div style="display:flex;align-items:center;gap:8px;width:100%;">
                <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" :stroke-width="8" style="flex:1;" />
                <span v-if="uploadProgressText" style="font-size:12px;color:#909399;white-space:nowrap;">{{ uploadProgressText }}</span>
              </div>
            </el-form-item>
            <el-form-item label="背景图URL">
              <div style="display:flex;gap:4px;">
                <el-input v-model="backgroundImage" placeholder="或输入URL" @input="onSettingChange" style="flex:1;" />
                <el-button v-if="backgroundImage" size="small" type="danger" @click="onBgRemove">删除</el-button>
              </div>
            </el-form-item>
            <div v-if="backgroundImage" class="upload-preview"><img :src="resolveMediaUrl(backgroundImage)" style="width:100%;max-height:80px;object-fit:contain;border-radius:4px;" /></div>
            <el-form-item label="背景模式">
              <div style="display:flex;gap:4px;">
                <el-button size="small" :type="backgroundFit === 'contain' ? 'primary' : ''" @click="onBgFitChange('contain')">等比</el-button>
                <el-button size="small" :type="backgroundFit === 'fill' ? 'primary' : ''" @click="onBgFitChange('fill')">全屏</el-button>
              </div>
            </el-form-item>
            <div class="setting-row"><label>缩放</label><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;"><el-button size="small" :type="zoom===100?'primary':''" @click="zoom=100">100%</el-button><el-button size="small" :type="zoom===75?'primary':''" @click="zoom=75">75%</el-button><el-button size="small" :type="zoom===50?'primary':''" @click="zoom=50">50%</el-button><el-button size="small" :type="zoom===25?'primary':''" @click="zoom=25">25%</el-button><el-button size="small" type="success" @click="fitScreen">适应窗口</el-button></div></div>
          </el-form>
        </div>
      </div>
    </div>

          <!-- 背景图片选择弹窗 -->
          <el-dialog v-model="bgPickerVisible" title="选择背景图片" width="420px" destroy-on-close>
            <div style="max-height:50vh; overflow-y:auto; display:flex; flex-wrap:wrap; gap:8px;">
              <div
                v-for="img in (groupedMaterials?.image || [])"
                :key="img.id"
                class="bg-picker-item"
                @click="onBgPickConfirm(img)"
              >
                <img :src="resolveMaterialThumb(img)" style="width:60px;height:45px;object-fit:cover;border-radius:4px;" />
                <span style="font-size:11px;color:#999;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">{{ img.name || img.fileName || '未命名' }}</span>
              </div>
              <div v-if="!groupedMaterials?.image?.length" style="width:100%;text-align:center;color:#999;padding:20px;">暂无图片素材</div>
            </div>
          </el-dialog>
          <!-- 视频素材选择弹窗 -->
          <el-dialog v-model="videoPickerVisible" title="选择视频素材" width="420px" destroy-on-close>
            <div style="max-height:50vh; overflow-y:auto; display:flex; flex-wrap:wrap; gap:8px;">
              <div
                v-for="vid in (groupedMaterials?.video || groupedMaterials?.videos || [])"
                :key="vid.id"
                class="bg-picker-item"
                style="flex-direction:column;gap:4px;padding:6px;"
                @click="onVideoPickConfirm(vid)"
              >
                <video :src="resolveMaterialThumb(vid)" muted style="width:80px;height:56px;object-fit:cover;border-radius:4px;background:#000;" />
                <span style="font-size:11px;color:#999;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;">{{ vid.name || vid.fileName || '未命名' }}</span>
              </div>
              <div v-if="!groupedMaterials?.video?.length && !groupedMaterials?.videos?.length" style="width:100%;text-align:center;color:#999;padding:20px;">暂无视频素材</div>
            </div>
          </el-dialog>
          <!-- 图片素材选择弹窗（用于图片组件） -->
          <el-dialog v-model="imagePickerVisible" title="选择图片素材" width="420px" destroy-on-close>
            <div style="max-height:50vh; overflow-y:auto; display:flex; flex-wrap:wrap; gap:8px;">
              <div
                v-for="img in (groupedMaterials?.image || [])"
                :key="img.id"
                class="bg-picker-item"
                @click="onImagePickConfirm(img)"
              >
                <img :src="resolveMaterialThumb(img)" style="width:60px;height:45px;object-fit:cover;border-radius:4px;" />
                <span style="font-size:11px;color:#999;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">{{ img.name || img.fileName || '未命名' }}</span>
              </div>
              <div v-if="!groupedMaterials?.image?.length" style="width:100%;text-align:center;color:#999;padding:20px;">暂无图片素材</div>
            </div>
          </el-dialog>

    <!-- 树形面板预览弹窗（照搬素材库） -->
    <el-dialog
      v-model="treePreviewVisible"
      :title="treePreviewTitle"
      width="80vw"
      top="5vh"
      destroy-on-close
    >
      <div v-if="treePreviewType === 'image'" class="preview-content">
        <el-image :src="treePreviewImgUrl" fit="contain" style="max-height:75vh;width:100%;" :preview-teleported="false" />
      </div>
      <div v-else-if="treePreviewType === 'video'" class="preview-content">
        <video :src="treePreviewVideoUrl" controls autoplay style="max-height:75vh;width:100%;" />
      </div>
      <div v-else class="preview-content">
        <div class="preview-navigation">
          <el-button
            type="primary"
            :disabled="treePreviewTotalPages <= 0 || treePreviewCurrentIndex <= 0"
            @click="treePreviewCurrentIndex--"
            circle
          >◀</el-button>
          <div class="preview-image-wrap">
            <img
              v-if="!treePreviewLoading"
              :src="treePreviewImageUrlComputed"
              style="max-height:65vh;max-width:100%;"
              @load="treePreviewLoading = false"
              @error="treePreviewLoading = false"
            />
            <div v-else class="preview-loading">
              <el-icon class="is-loading" :size="32"><Loading /></el-icon>
              <p>加载中...</p>
            </div>
          </div>
          <el-button
            type="primary"
            :disabled="treePreviewTotalPages <= 0 || treePreviewCurrentIndex >= treePreviewTotalPages - 1"
            @click="treePreviewCurrentIndex++"
            circle
          >▶</el-button>
        </div>
      </div>
      <template #footer>
        <span v-if="treePreviewTotalPages > 0">第 {{ treePreviewCurrentIndex + 1 }} / {{ treePreviewTotalPages }} 页</span>
        <span v-else class="preview-not-ready">
          <el-icon style="vertical-align: middle; margin-right: 4px;"><WarningFilled /></el-icon>
          预览正在生成中，请稍后再试
        </span>
      </template>
    </el-dialog>

    <!-- 轮播素材选择弹窗（五种类型 Tab） -->
    <el-dialog v-model="carouselPickerVisible" title="从素材库选择添加到轮播" width="440px" destroy-on-close>
      <el-tabs v-model="carouselPickerType" style="margin-bottom:12px;">
        <el-tab-pane label="图片" name="image">
          <div style="max-height:45vh; overflow-y:auto; display:flex; flex-wrap:wrap; gap:8px;">
            <div v-for="item in (groupedMaterials?.image || [])" :key="item.id" class="bg-picker-item" @click="onCarouselPickConfirm(item, 'image')">
              <img :src="resolveMaterialThumb(item)" style="width:60px;height:45px;object-fit:cover;border-radius:4px;" />
              <span style="font-size:11px;color:#999;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">{{ item.name || item.fileName || '未命名' }}</span>
            </div>
            <div v-if="!groupedMaterials?.image?.length" style="width:100%;text-align:center;color:#999;padding:20px;">暂无图片素材</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="视频" name="video">
          <div style="max-height:45vh; overflow-y:auto; display:flex; flex-wrap:wrap; gap:8px;">
            <div v-for="item in (groupedMaterials?.video || groupedMaterials?.videos || [])" :key="item.id" class="bg-picker-item" style="flex-direction:column;gap:4px;padding:6px;" @click="onCarouselPickConfirm(item, 'video')">
              <video :src="resolveMaterialThumb(item)" muted style="width:80px;height:56px;object-fit:cover;border-radius:4px;background:#000;" />
              <span style="font-size:11px;color:#999;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;">{{ item.name || item.fileName || '未命名' }}</span>
            </div>
            <div v-if="!groupedMaterials?.video?.length && !groupedMaterials?.videos?.length" style="width:100%;text-align:center;color:#999;padding:20px;">暂无视频素材</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="PPT" name="ppt">
          <div style="max-height:45vh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
            <div v-for="item in (groupedMaterials?.ppt || [])" :key="item.id" class="bg-picker-item" style="flex-direction:row;gap:10px;padding:8px;" @click="onCarouselPickConfirm(item, 'doc')">
              <span style="font-size:18px;">📄</span>
              <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.fileName || item.name || '未命名' }}({{ item.previewCount || 0 }}页)</span>
            </div>
            <div v-if="!groupedMaterials?.ppt?.length" style="text-align:center;color:#999;padding:20px;">暂无PPT素材</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="PDF" name="pdf">
          <div style="max-height:45vh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
            <div v-for="item in (groupedMaterials?.pdf || [])" :key="item.id" class="bg-picker-item" style="flex-direction:row;gap:10px;padding:8px;" @click="onCarouselPickConfirm(item, 'doc')">
              <span style="font-size:18px;">📄</span>
              <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.fileName || item.name || '未命名' }}({{ item.previewCount || 0 }}页)</span>
            </div>
            <div v-if="!groupedMaterials?.pdf?.length" style="text-align:center;color:#999;padding:20px;">暂无PDF素材</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Word" name="word">
          <div style="max-height:45vh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
            <div v-for="item in (groupedMaterials?.word || [])" :key="item.id" class="bg-picker-item" style="flex-direction:row;gap:10px;padding:8px;" @click="onCarouselPickConfirm(item, 'doc')">
              <span style="font-size:18px;">📄</span>
              <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.fileName || item.name || '未命名' }}({{ item.previewCount || 0 }}页)</span>
            </div>
            <div v-if="!groupedMaterials?.word?.length" style="text-align:center;color:#999;padding:20px;">暂无Word素材</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- PPT 素材选择弹窗 -->
    <el-dialog v-model="pptPickerVisible" title="从素材库选择PPT" width="420px" destroy-on-close>
      <div style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
        <div v-for="item in (groupedMaterials?.ppt || [])" :key="item.id" class="bg-picker-item" style="flex-direction:row;gap:10px;padding:8px;" @click="onDocPickConfirm(item, 'ppt')">
          <span style="font-size:18px;">📄</span>
          <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.fileName || item.name || '未命名' }}({{ item.previewCount || 0 }}页)</span>
        </div>
        <div v-if="!groupedMaterials?.ppt?.length" style="text-align:center;color:#999;padding:20px;">暂无PPT素材</div>
      </div>
    </el-dialog>
    <!-- PDF 素材选择弹窗 -->
    <el-dialog v-model="pdfPickerVisible" title="从素材库选择PDF" width="420px" destroy-on-close>
      <div style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
        <div v-for="item in (groupedMaterials?.pdf || [])" :key="item.id" class="bg-picker-item" style="flex-direction:row;gap:10px;padding:8px;" @click="onDocPickConfirm(item, 'pdf')">
          <span style="font-size:18px;">📄</span>
          <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.fileName || item.name || '未命名' }}({{ item.previewCount || 0 }}页)</span>
        </div>
        <div v-if="!groupedMaterials?.pdf?.length" style="text-align:center;color:#999;padding:20px;">暂无PDF素材</div>
      </div>
    </el-dialog>
    <!-- Word 素材选择弹窗 -->
    <el-dialog v-model="wordPickerVisible" title="从素材库选择Word" width="420px" destroy-on-close>
      <div style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
        <div v-for="item in (groupedMaterials?.word || [])" :key="item.id" class="bg-picker-item" style="flex-direction:row;gap:10px;padding:8px;" @click="onDocPickConfirm(item, 'word')">
          <span style="font-size:18px;">📄</span>
          <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.fileName || item.name || '未命名' }}({{ item.previewCount || 0 }}页)</span>
        </div>
        <div v-if="!groupedMaterials?.word?.length" style="text-align:center;color:#999;padding:20px;">暂无Word素材</div>
      </div>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getScreenDetail, saveScreen, updateScreen, uploadFile, getServerTerminalList,
         requestUploadToken, terminalUploadSimple, terminalInitUpload,
         terminalUploadChunk, terminalCompleteUpload, recordUpload, terminalDeleteFile,
         pushToTerminal, proxyUploadSimple, proxyUploadInit,
         proxyUploadChunk, proxyUploadComplete } from '@/api/screen'
import { listMaterial, uploadMaterial, updateMaterial, deleteMaterial } from '@/api/material'

const route = useRoute()
const router = useRouter()
const recordId = computed(() => route.params.id || '')
const isNew = computed(() => !recordId.value)
const isEditMode = ref(false)

// ==== 画布 ====
const pageWidth = ref(1920)
const pageHeight = ref(1080)
const backgroundColor = ref('#aaaaaa')
const backgroundImage = ref('')
const backgroundFit = ref('fill') // contain=等比, fill=全屏
const publishTitle = ref('')
const targetGroupId = ref([])        // 多选终端ID数组
const pushType = ref('normal')
const serverTerminals = ref([])
const zoom = ref(80)
const elements = ref([])
const selectedIdx = ref(-1)
const dirty = ref(false)

// ===== 上传进度 =====
// ==== 树形素材库面板 ====
const allTreeMaterials = ref([])
const treeLoading = ref(false)
// 树形面板上传 Dialog（与素材库页面一致）
const treeUploadVisible = ref(false)
const treeUploading = ref(false)
const treeUploadProgress = ref(0)
const treeUploadFormRef = ref(null)
const treeUploadRef = ref(null)
const treeRefreshTimer = ref(null)
const treeUploadForm = reactive({
  type: 'image',
  name: '',
  file: null,
})

const treeUploadAccept = computed(() => {
  const m = { image: 'image/*', video: 'video/*', ppt: '.ppt,.pptx', pdf: '.pdf', word: '.doc,.docx' }
  return m[treeUploadForm.type] || '*'
})

const treeUploadTip = computed(() => {
  const m = { image: '支持 JPG/PNG/GIF 等图片格式', video: '支持 MP4/AVI/MOV 等视频格式', ppt: '支持 .ppt/.pptx 格式', pdf: '支持 .pdf 格式', word: '支持 .doc/.docx 格式' }
  return m[treeUploadForm.type] || '支持常见文件格式'
})

const treeUploadRules = {
  type: [{ required: true, message: '请选择素材类型', trigger: 'change' }],
  name: [{ required: true, message: '请输入素材名称', trigger: 'blur' }],
}

// 树形面板预览弹窗变量
const treePreviewVisible = ref(false)
const treePreviewTitle = ref('')
const treePreviewId = ref('')
const treePreviewType = ref('')
const treePreviewCurrentIndex = ref(0)
const treePreviewTotalPages = ref(0)
const treePreviewLoading = ref(false)

const treePreviewImageUrlComputed = computed(() => {
  return `/api/storage/fetch?objectName=preview%2F${treePreviewId.value}%2Fpage_${treePreviewCurrentIndex.value}.jpg`
})

const treePreviewImgUrl = computed(() => {
  if (treePreviewCustomUrl.value) return treePreviewCustomUrl.value
  if (!treePreviewId.value) return ''
  return `/api/storage/fetch?objectName=${encodeURIComponent(treePreviewId.value)}`
})

const treePreviewVideoUrl = computed(() => {
  if (!treePreviewId.value) return ''
  return `/api/storage/fetch/range?objectName=${encodeURIComponent(treePreviewId.value)}`
})

function onTreePreview(item) {
  treePreviewCustomUrl.value = ''
  if (item.type === 'image') {
    treePreviewType.value = 'image'
    treePreviewTitle.value = item.name || item.fileName || '图片'
    treePreviewId.value = item.minioPath
    treePreviewVisible.value = true
    return
  }
  if (item.type === 'video') {
    treePreviewType.value = 'video'
    treePreviewTitle.value = item.name || item.fileName || '视频'
    treePreviewId.value = item.minioPath
    treePreviewVisible.value = true
    return
  }
  // PDF/PPT/Word 走预生成预览图
  treePreviewType.value = 'doc'
  treePreviewTitle.value = item.name || item.fileName || '文档'
  treePreviewId.value = item.id
  treePreviewCurrentIndex.value = 0
  treePreviewTotalPages.value = 0
  treePreviewLoading.value = true
  treePreviewVisible.value = true
  // 获取真实页数
  treeGetPreviewPageCount(item.id)
}

async function treeGetPreviewPageCount(id) {
  try {
    const resp = await fetch(`/api/storage/fetch?objectName=preview%2F${id}%2F.count`)
    if (resp.ok) {
      const text = await resp.text()
      const count = parseInt(text, 10)
      treePreviewTotalPages.value = !isNaN(count) && count > 0 ? count : 0
    } else {
      treePreviewTotalPages.value = 0
    }
  } catch (e) {
    treePreviewTotalPages.value = 0
  }
  treePreviewLoading.value = false
}

watch(treePreviewCurrentIndex, () => {
  treePreviewLoading.value = true
})

const treeCollapsed = reactive({ image: false, video: false, ppt: true, pdf: true, word: true })
const treeContextMenu = reactive({ visible: false, x: 0, y: 0, item: null })

// 文档二级编辑名称
const editableRenameId = ref(null)
const editableRenameText = ref('')
const renameInputRef = ref(null)

function onTreeRenameStart(item) {
  editableRenameId.value = item.id
  editableRenameText.value = item.name || item.fileName || ''
  nextTick(() => {
    const el = document.querySelector('.rename-input-2')
    if (el) el.focus()
  })
}

async function onTreeRenameConfirm(item) {
  if (!editableRenameId.value || !editableRenameText.value.trim()) {
    editableRenameId.value = null
    return
  }
  try {
    const res = await updateMaterial({ id: item.id, name: editableRenameText.value.trim() })
    if (res.code === 0) {
      item.name = editableRenameText.value.trim()
      item.fileName = editableRenameText.value.trim()
    } else {
      ElMessage.error(res.message || '重命名失败')
    }
  } catch (e) {
    ElMessage.error('重命名失败')
  }
  editableRenameId.value = null
}

function onTreeDeleteConfirm(item) {
  ElMessageBox.confirm(`确定删除素材「${item.name || item.fileName || '未命名'}」？`, '确认删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await deleteMaterial(item.id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        await loadTreeMaterialList()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (e) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 拖拽二级文档到画布（对应组件）
async function fetchDocPreviewCount(materialId) {
  try {
    const r = await fetch(`/api/storage/fetch?objectName=preview%2F${materialId}%2F.count`)
    if (!r.ok) return 0
    const text = await r.text()
    const count = parseInt(text, 10)
    return !isNaN(count) && count > 0 ? count : 0
  } catch (e) {
    return 0
  }
}

function onTreeDocSecondaryDragStart(e, item, docType) {
  e.dataTransfer.setData('componentType', docType)
  e.dataTransfer.setData('materialId', item.id)
  e.dataTransfer.setData('materialName', item.name || item.fileName || '文档')
  // 传递所有预览图片 URL
  const urls = []
  for (let i = 0; i < item.previewCount; i++) {
    urls.push(resolveMaterialPageUrl(item, i))
  }
  e.dataTransfer.setData('materialUrls', JSON.stringify(urls))
  e.dataTransfer.setData('materialType', 'doc')
  e.dataTransfer.effectAllowed = 'copy'
}

// 三级预览图片点击查看大图
function onTreePreviewPage(item, pageIndex) {
  const url = resolveMaterialPageUrl(item, pageIndex)
  treePreviewType.value = 'image'
  treePreviewTitle.value = `${item.name || item.fileName || '文档'} - 第 ${pageIndex + 1} 页`
  treePreviewId.value = item.id
  treePreviewVisible.value = true
  // 覆盖 imgUrl computed 直接使用 url
  treePreviewCustomUrl.value = url
}

const treePreviewCustomUrl = ref('')

const groupedMaterials = computed(() => {
  const groups = { image: [], video: [], ppt: [], pdf: [], word: [] }
  for (const item of allTreeMaterials.value) {
    const cat = (item.type || '').toLowerCase()
    if (groups[cat]) {
      groups[cat].push(item)
    }
  }
  // 每个类型内部按 createdAt 倒序
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
  })
  return groups
})

async function loadTreeMaterialList() {
  // 树形素材无感刷新时不要每次显示loading
  const isRefresh = treeLoading.value
  if (!isRefresh) treeLoading.value = true
  try {
    const res = await listMaterial({ pageSize: 999, pageNum: 1 })
    if (res.code === 0 && res.data) {
      const list = res.data.records || res.data.list || res.data || []
      allTreeMaterials.value = list.map(item => ({
        ...item,
        previewCount: 0,
        _expanded: false,
      }))
      // 异步获取文档类素材的真实预览页数
      const docItems = allTreeMaterials.value.filter(i => ['ppt','pdf','word'].includes(i.type))
      docItems.forEach(item => {
        fetch(`/api/storage/fetch?objectName=preview%2F${item.id}%2F.count`)
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(text => {
            const count = parseInt(text, 10)
            if (!isNaN(count) && count > 0) {
              item.previewCount = count
            }
          })
          .catch(() => {})
      })
    } else {
      allTreeMaterials.value = []
    }
  } catch (e) {
    if (!isRefresh) console.warn('[TreeMaterial] 加载素材库失败:', e?.message || e)
    allTreeMaterials.value = []
  } finally {
    if (!isRefresh) treeLoading.value = false
  }
}

function resolveMaterialThumb(item) {
  if (!item) return ''
  const cat = (item.type || '').toLowerCase()
  // 图片直接用源文件
  if (cat === 'image') {
    return '/api/storage/fetch?objectName=' + encodeURIComponent(item.minioPath || item.path || '')
  }
  // 视频用/range路径以便流式播放
  if (cat === 'video') {
    return '/api/storage/fetch/range?objectName=' + encodeURIComponent(item.minioPath || item.path || '')
  }
  // 文档类：有预览图则用 page_0.jpg
  if (['ppt', 'pdf', 'word'].includes(cat)) {
    if (item.previewCount > 0) {
      return '/api/storage/fetch?objectName=' + encodeURIComponent('preview/' + item.id + '/page_0.jpg')
    }
  }
  return ''
}

function resolveMaterialPageUrl(item, pageIndex) {
  if (!item) return ''
  return '/api/storage/fetch?objectName=' + encodeURIComponent('preview/' + item.id + '/page_' + pageIndex + '.jpg')
}

function onTreeDragStart(e, item) {
  const cat = (item.type || '').toLowerCase()
  if (cat === 'image') {
    e.dataTransfer.setData('componentType', cat)
    e.dataTransfer.setData('materialUrl', '/api/storage/fetch?objectName=' + encodeURIComponent(item.minioPath || item.path || ''))
    e.dataTransfer.setData('materialType', cat)
    e.dataTransfer.setData('materialName', item.fileName || item.name || '')
    e.dataTransfer.effectAllowed = 'copy'
  } else if (cat === 'video') {
    e.dataTransfer.setData('componentType', cat)
    e.dataTransfer.setData('materialUrl', '/api/storage/fetch/range?objectName=' + encodeURIComponent(item.minioPath || item.path || ''))
    e.dataTransfer.setData('materialType', cat)
    e.dataTransfer.setData('materialName', item.fileName || item.name || '')
    e.dataTransfer.effectAllowed = 'copy'
  } else {
    e.preventDefault()
  }
}

function onTreeDocToggle(item) {
  item._expanded = !item._expanded
  // 首次展开时刷新预览页数
  if (item._expanded && item.previewCount === 0) {
    fetch(`/api/storage/fetch?objectName=preview%2F${item.id}%2F.count`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        const count = parseInt(text, 10)
        if (!isNaN(count) && count > 0) {
          item.previewCount = count
        }
      })
      .catch(() => {})
  }
}

// 点击文档类的某个预览图片，拖到画布创建图片组件
function onTreeDocPageClick(item, pageIndex) {
  const url = resolveMaterialPageUrl(item, pageIndex)
  const newEl = createImageComponent(url, `${item.fileName || item.name || '文档'}_p${pageIndex + 1}`)
  if (newEl) {
    elements.value.push(newEl)
    selectedIdx.value = elements.value.length - 1
    emitChange()
  }
}

function onTreeDocPageDragStart(e, item, pageIndex) {
  const url = resolveMaterialPageUrl(item, pageIndex)
  e.dataTransfer.setData('componentType', 'image')
  e.dataTransfer.setData('materialUrl', url)
  e.dataTransfer.setData('materialType', 'image')
  e.dataTransfer.setData('materialName', item.fileName || item.name + '_page_' + pageIndex)
  e.dataTransfer.effectAllowed = 'copy'
}

function onTreeContextMenu(e, item) {
  treeContextMenu.visible = true
  treeContextMenu.x = e.clientX
  treeContextMenu.y = e.clientY
  treeContextMenu.item = item
  // 点击其他地方关闭
  const closeMenu = () => {
    treeContextMenu.visible = false
    document.removeEventListener('click', closeMenu)
  }
  document.addEventListener('click', closeMenu)
}

function onTreeFileChange(uploadFile) {
  treeUploadForm.file = uploadFile.raw
}

function onTreeFileRemove() {
  treeUploadForm.file = null
}

function onTreeRename() {
  const item = treeContextMenu.item
  if (!item) return
  treeContextMenu.visible = false
  ElMessageBox.prompt('请输入新名称', '重命名', {
    inputValue: item.fileName || item.name || '',
    inputPlaceholder: '素材名称',
  }).then(async ({ value }) => {
    if (!value || value.trim() === '') return
    try {
      const res = await updateMaterial({ id: item.id, fileName: value.trim() })
      if (res.code === 0) {
        ElMessage.success('重命名成功')
        await loadTreeMaterialList()
      } else {
        ElMessage.error(res.message || '重命名失败')
      }
    } catch (e) {
      ElMessage.error('重命名失败: ' + (e?.message || '未知错误'))
    }
  }).catch(() => {})
}

function onTreeDelete() {
  const item = treeContextMenu.item
  if (!item) return
  treeContextMenu.visible = false
  ElMessageBox.confirm('确定要删除「' + (item.fileName || item.name || '未命名') + '」吗？', '确认删除', {
    type: 'warning',
  }).then(async () => {
    try {
      const res = await deleteMaterial(item.id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        await loadTreeMaterialList()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (e) {
      ElMessage.error('删除失败: ' + (e?.message || '未知错误'))
    }
  }).catch(() => {})
}

function onTreeUploadClick() {
  treeUploadVisible.value = true
}

function resetTreeUploadForm() {
  treeUploadForm.type = 'image'
  treeUploadForm.name = ''
  treeUploadForm.file = null
  treeUploadProgress.value = 0
  treeUploading.value = false
  if (treeUploadRef.value) treeUploadRef.value.clearFiles()
}

async function onTreeUploadSubmit() {
  if (!treeUploadForm.file) {
    ElMessage.warning('请选择上传文件')
    return
  }
  const file = treeUploadForm.file
  treeUploading.value = true
  treeUploadProgress.value = 1
  try {
    // 分片上传逻辑（照搬素材库）
    const chunkSize = CHUNK_SIZE
    const totalChunks = Math.ceil(file.size / chunkSize)
    const chunks = []
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      chunks.push(file.slice(start, end))
    }
    // 小文件（单分片或小于100MB）直接上传
    if (totalChunks <= 1 || file.size <= CHUNK_SIZE * 20) {
      // 手动进度条：模拟上传进度（80%后等实际结果）
      const progressTimer = setInterval(() => {
        if (treeUploadProgress.value < 80) {
          treeUploadProgress.value += Math.round(Math.random() * 5) + 1
        }
      }, 300)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', treeUploadForm.name)
      formData.append('type', treeUploadForm.type)
      try {
        const res = await uploadMaterial(formData)
        clearInterval(progressTimer)
        if (res.code === 0) {
          treeUploadProgress.value = 100
          ElMessage.success('上传成功')
          treeUploadVisible.value = false
          await loadTreeMaterialList()
        } else {
          clearInterval(progressTimer)
          treeUploadProgress.value = 0
          ElMessage.error(res.message || '上传失败')
        }
      } catch (e) {
        clearInterval(progressTimer)
        treeUploadProgress.value = 0
        throw e
      }
    } else {
      // >100MB 分片上传（先跑模拟进度动画）
      const simTimer = setInterval(() => {
        if (treeUploadProgress.value < 60) {
          treeUploadProgress.value += Math.round(Math.random() * 3) + 1
        }
      }, 500)
      const chunkFileName = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${file.name.split('.').pop() || ''}`
      const fileSize = file.size
      const mimeType = file.type || ''
      const name = treeUploadForm.name
      const type = treeUploadForm.type

      clearInterval(simTimer)
      for (let i = 0; i < totalChunks; i++) {
        const formData = new FormData()
        formData.append('chunk', chunks[i], `chunk_${i}`)
        formData.append('chunkNumber', String(i + 1))
        formData.append('totalChunks', String(totalChunks))
        formData.append('chunkFileName', chunkFileName)
        formData.append('name', name)
        formData.append('type', type)
        formData.append('fileSize', String(fileSize))
        formData.append('mimeType', mimeType)
        const res = await uploadMaterial(formData)
        if (res.code !== 0) {
          throw new Error(res.message || `分片 ${i + 1}/${totalChunks} 上传失败`)
        }
        const pct = Math.round(((i + 1) / totalChunks) * 90)
        if (pct > treeUploadProgress.value) {
          treeUploadProgress.value = pct
        }
      }

      // 合并
      const mergeFormData = new FormData()
      mergeFormData.append('chunkFileName', chunkFileName)
      mergeFormData.append('totalChunks', String(totalChunks))
      mergeFormData.append('name', name)
      mergeFormData.append('type', type)
      mergeFormData.append('fileSize', String(fileSize))
      mergeFormData.append('mimeType', mimeType)
      const res = await uploadMaterial(mergeFormData)
      if (res.code === 0) {
        treeUploadProgress.value = 100
        ElMessage.success('上传成功')
        treeUploadVisible.value = false
        await loadTreeMaterialList()
      } else {
        ElMessage.error(res.message || '分片合并失败')
      }
    }
  } catch (e) {
    ElMessage.error('上传失败: ' + (e?.message || '未知错误'))
  } finally {
    treeUploading.value = false
  }
}

const bgPickerVisible = ref(false)

const videoPickerVisible = ref(false)
const imagePickerVisible = ref(false)

function onImagePickConfirm(item) {
  imagePickerVisible.value = false
  const url = item.minioPath || item.path || ''
  if (!url) {
    ElMessage.warning('素材路径无效')
    return
  }
  uploadProgressText.value = '正在下载素材...'
  uploadProgress.value = 5
  uploading.value = true
  fetch('/api/storage/fetch?objectName=' + encodeURIComponent(url))
    .then(r => {
      if (!r.ok) throw new Error('下载失败')
      const disposition = r.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
      const fileName = match ? decodeURIComponent(match[1]) : (item.name || item.fileName || 'image')
      const contentType = r.headers.get('Content-Type') || 'image/jpeg'
      return r.blob().then(blob => ({ blob, fileName, contentType }))
    })
    .then(({ blob, fileName, contentType }) => {
      uploadProgressText.value = '正在上传到终端...'
      uploadProgress.value = 20
      const rawFile = new File([blob], fileName, { type: contentType })
      return handleFileUploadComponent(rawFile, 'image')
    })
    .then(hash => {
      if (hash && selectedEl.value) {
        selectedEl.value.src = hash
        emitChange()
        uploadProgressText.value = ''
      }
    })
    .catch(e => {
      uploadProgressText.value = ''
      uploadProgress.value = 0
      uploading.value = false
      ElMessage.error('图片上传失败: ' + (e.message || e))
    })
}

function onVideoSelectFromMaterial() {
  console.log('[VideoPicker] onVideoSelectFromMaterial called')
  if (!targetGroupId.value || targetGroupId.value.length === 0) {
    ElMessage.warning('请先绑定终端')
    return
  }
  const videos = groupedMaterials.value?.video || groupedMaterials.value?.videos || []
  if (videos.length === 0) {
    ElMessage.warning('素材库中暂无视频，请先上传')
    return
  }
  videoPickerVisible.value = true
}

function onVideoPickConfirm(item) {
  videoPickerVisible.value = false
  const url = item.minioPath || item.path || ''
  if (!url) {
    ElMessage.warning('素材路径无效')
    return
  }
  uploadProgressText.value = '正在下载素材...'
  uploadProgress.value = 5
  uploading.value = true
  fetch('/api/storage/fetch?objectName=' + encodeURIComponent(url))
    .then(r => {
      if (!r.ok) throw new Error('下载失败')
      const disposition = r.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
      const fileName = match ? decodeURIComponent(match[1]) : (item.name || item.fileName || 'video')
      const contentType = r.headers.get('Content-Type') || 'video/mp4'
      return r.blob().then(blob => ({ blob, fileName, contentType }))
    })
    .then(({ blob, fileName, contentType }) => {
      uploadProgressText.value = '正在上传到终端...'
      uploadProgress.value = 20
      const rawFile = new File([blob], fileName, { type: contentType })
      return handleFileUploadComponent(rawFile, 'video')
    })
    .then(hash => {
      if (hash && selectedEl.value) {
        selectedEl.value.src = hash
        emitChange()
        uploadProgressText.value = ''
      }
    })
    .catch(e => {
      uploadProgressText.value = ''
      uploadProgress.value = 0
      uploading.value = false
      ElMessage.error('视频上传失败: ' + (e.message || e))
    })
}

/**
 * 专用于组件素材的上传（图片/视频），返回终端 fileHash
 */
async function handleFileUploadComponent(rawFile, targetType) {
  if (!rawFile) return null

  const terminalIds = targetGroupId.value
  if (!terminalIds || terminalIds.length === 0) {
    ElMessage.warning('请先绑定至少一个终端再上传')
    return null
  }
  const terminalList = []
  for (const id of terminalIds) {
    const t = serverTerminals.value.find(x => x.id === id)
    if (t && t.ipAddress) terminalList.push(t)
  }
  if (terminalList.length === 0) {
    ElMessage.warning('绑定的终端信息不完整')
    return null
  }

  if (rawFile.size > UPLOAD_FILE_SIZE_LIMIT) {
    ElMessage.error('文件大小不能超过 500MB')
    return null
  }

  let objectName
  const totalTerminals = terminalList.length
  const useChunks = rawFile.size > chunkEnabledThreshold

  for (let ti = 0; ti < totalTerminals; ti++) {
    const term = terminalList[ti]
    const termIp = term.ipAddress
    if (useChunks) {
      objectName = await uploadByChunks(rawFile, targetType, termIp, ti, totalTerminals)
    } else {
      objectName = await uploadDirect(rawFile, targetType, termIp, ti, totalTerminals)
    }
  }

  uploadProgress.value = 100
  if (objectName && typeof objectName === 'object' && objectName.fileHash) {
    return objectName.fileHash
  }
  if (typeof objectName === 'string') {
    return objectName
  }
  return null
}

function onBgSelectFromMaterial() {
  if (!targetGroupId.value || targetGroupId.value.length === 0) {
    ElMessage.warning('请先绑定终端')
    return
  }
  const images = groupedMaterials.value?.image || []
  if (images.length === 0) {
    ElMessage.warning('素材库中暂无图片，请先上传')
    return
  }
  bgPickerVisible.value = true
}

function onImageSelectFromMaterial() {
  if (!targetGroupId.value || targetGroupId.value.length === 0) {
    ElMessage.warning('请先绑定终端')
    return
  }
  const images = groupedMaterials.value?.image || []
  if (images.length === 0) {
    ElMessage.warning('素材库中暂无图片，请先上传')
    return
  }
  imagePickerVisible.value = true
}

function onBgPickConfirm(item) {
  bgPickerVisible.value = false
  const url = item.minioPath || item.path || ''
  if (!url) {
    ElMessage.warning('素材路径无效')
    return
  }
  // 从 MinIO 下载文件，再通过分片上传推送到终端
  uploadProgressText.value = '正在下载素材...'
  uploadProgress.value = 5
  uploading.value = true
  fetch('/api/storage/fetch?objectName=' + encodeURIComponent(url))
    .then(r => {
      if (!r.ok) throw new Error('下载失败')
      const disposition = r.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
      const fileName = match ? decodeURIComponent(match[1]) : (item.name || item.fileName || 'background')
      const contentType = r.headers.get('Content-Type') || 'image/jpeg'
      return r.blob().then(blob => ({ blob, fileName, contentType }))
    })
    .then(({ blob, fileName, contentType }) => {
      uploadProgressText.value = '正在上传到终端...'
      uploadProgress.value = 20
      const rawFile = new File([blob], fileName, { type: contentType })
      // 复用 handleFileUpload 的分片上传逻辑
      return handleFileUploadBg({ raw: rawFile })
    })
    .then(hash => {
      if (hash) {
        backgroundImage.value = hash
        onSettingChange()
        uploadProgressText.value = ''
      }
    })
    .catch(e => {
      uploadProgressText.value = ''
      uploadProgress.value = 0
      uploading.value = false
      ElMessage.error('背景图上传失败: ' + (e.message || e))
    })
}

/**
 * 专用于背景图的上传（不含更新 selectedEl，只推送到终端、返回 fileHash）
 */
async function handleFileUploadBg(fileInfo) {
  const rawFile = fileInfo.raw || fileInfo.file || fileInfo
  if (!rawFile) return null

  const terminalIds = targetGroupId.value
  if (!terminalIds || terminalIds.length === 0) {
    ElMessage.warning('请先绑定至少一个终端再上传')
    return null
  }
  const terminalList = []
  for (const id of terminalIds) {
    const t = serverTerminals.value.find(x => x.id === id)
    if (t && t.ipAddress) terminalList.push(t)
  }
  if (terminalList.length === 0) {
    ElMessage.warning('绑定的终端信息不完整')
    return null
  }

  if (rawFile.size > UPLOAD_FILE_SIZE_LIMIT) {
    ElMessage.error('文件大小不能超过 500MB')
    return null
  }

  let objectName
  const totalTerminals = terminalList.length
  const useChunks = rawFile.size > chunkEnabledThreshold

  for (let ti = 0; ti < totalTerminals; ti++) {
    const term = terminalList[ti]
    const termIp = term.ipAddress
    if (useChunks) {
      objectName = await uploadByChunks(rawFile, 'image', termIp, ti, totalTerminals)
    } else {
      objectName = await uploadDirect(rawFile, 'image', termIp, ti, totalTerminals)
    }
  }

  uploadProgress.value = 100
  if (objectName && typeof objectName === 'object' && objectName.fileHash) {
    return objectName.fileHash
  }
  if (typeof objectName === 'string') {
    return objectName
  }
  return null
}

function onBgFitChange(mode) {
  backgroundFit.value = mode
  onSettingChange()
}

async function onVideoSrcRemove() {
  if (!selectedEl.value || !selectedEl.value.src) return
  const fileHash = selectedEl.value.src
  selectedEl.value.src = ''
  emitChange()
  dirty.value = true
  // 通知绑定的终端删除文件
  const terminalIds = targetGroupId.value
  if (terminalIds && terminalIds.length > 0) {
    const terminalList = []
    for (const id of terminalIds) {
      const t = serverTerminals.value.find(x => x.id === id)
      if (t && t.ipAddress) terminalList.push(t)
    }
    for (const term of terminalList) {
      try {
        await terminalDeleteFile(term.ipAddress, fileHash)
      } catch (e) {
        console.warn('[VideoRemove] 终端删除失败:', term.ipAddress, e?.message || e)
      }
    }
  }
  ElMessage.success('视频已删除')
}

async function onImageSrcRemove() {
  if (!selectedEl.value || !selectedEl.value.src) return
  const fileHash = selectedEl.value.src
  selectedEl.value.src = ''
  emitChange()
  dirty.value = true
  const terminalIds = targetGroupId.value
  if (terminalIds && terminalIds.length > 0) {
    const terminalList = []
    for (const id of terminalIds) {
      const t = serverTerminals.value.find(x => x.id === id)
      if (t && t.ipAddress) terminalList.push(t)
    }
    for (const term of terminalList) {
      try {
        await terminalDeleteFile(term.ipAddress, fileHash)
      } catch (e) {
        console.warn('[ImageRemove] 终端删除失败:', term.ipAddress, e?.message || e)
      }
    }
  }
  ElMessage.success('图片已删除')
}

async function onBgRemove() {
  if (!backgroundImage.value) return
  ElMessageBox.confirm('删除背景图后，画布背景将恢复为纯色，同时删除终端上的文件，确定？', '删除背景图', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(async () => {
    const fileHash = backgroundImage.value
    backgroundImage.value = ''
    onSettingChange()
    dirty.value = true
    // 通知绑定的终端删除文件
    const terminalIds = targetGroupId.value
    if (terminalIds && terminalIds.length > 0) {
      const terminalList = []
      for (const id of terminalIds) {
        const t = serverTerminals.value.find(x => x.id === id)
        if (t && t.ipAddress) terminalList.push(t)
      }
      for (const term of terminalList) {
        try {
          await terminalDeleteFile(term.ipAddress, fileHash)
        } catch (e) {
          console.warn('[BgRemove] 终端删除失败:', term.ipAddress, e?.message || e)
        }
      }
    }
    ElMessage.success('背景图已删除')
  }).catch(() => {})
}

function onSingleAddSource(command, type, isDoc) {
  const uploadRefs = { image: imageUploadRef, video: videoUploadRef, ppt: docUploadRef, pdf: docUploadRef, word: docUploadRef }
  if (command === 'upload') {
    const ref = uploadRefs[type]
    if (ref && ref.value) {
      ref.value.$el.querySelector('input')?.click()
    }
  }
  // 移除「material」路径
}

function onCarouselAddSource(type, command) {
  if (command === 'upload') {
    if (type === 'image' && carouselUploadRef.value) {
      carouselUploadRef.value.$el.querySelector('input')?.click()
    } else if (type === 'video' && carouselVideoUploadRef.value) {
      carouselVideoUploadRef.value.$el.querySelector('input')?.click()
    } else if (type === 'doc' && carouselDocUploadRef.value) {
      carouselDocUploadRef.value.$el.querySelector('input')?.click()
    }
  }
  // 移除「material」路径
}

const carouselPickerVisible = ref(false)
const carouselPickerType = ref('image')

function onCarouselSelectFromMaterial() {
  if (!targetGroupId.value || targetGroupId.value.length === 0) {
    ElMessage.warning('请先绑定终端')
    return
  }
  // 检查素材库是否有任何素材
  const hasAny = groupedMaterials.value?.image?.length
    || groupedMaterials.value?.video?.length
    || groupedMaterials.value?.ppt?.length
    || groupedMaterials.value?.pdf?.length
    || groupedMaterials.value?.word?.length
  if (!hasAny) {
    ElMessage.warning('素材库中暂无素材，请先上传')
    return
  }
  carouselPickerVisible.value = true
}

async function onCarouselPickConfirm(item, mediaType) {
  carouselPickerVisible.value = false
  if (!selectedEl.value) return

  if (mediaType === 'image') {
    const url = item.minioPath || item.path || ''
    if (!url) return
    uploadProgressText.value = '正在下载图片...'
    uploadProgress.value = 5
    uploading.value = true
    try {
      const r = await fetch('/api/storage/fetch?objectName=' + encodeURIComponent(url))
      if (!r.ok) throw new Error('下载失败')
      const disposition = r.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
      const fileName = match ? decodeURIComponent(match[1]) : (item.name || item.fileName || 'image')
      const ct = r.headers.get('Content-Type') || 'image/jpeg'
      const blob = await r.blob()
      uploadProgressText.value = '正在上传到终端...'
      uploadProgress.value = 30
      const rawFile = new File([blob], fileName, { type: ct })
      const hash = await handleFileUploadComponent(rawFile, 'image')
      if (hash) {
        if (!selectedEl.value.images) selectedEl.value.images = []
        selectedEl.value.images.push({ src: hash, type: 'image' })
        dirty.value = true
        emitChange()
      }
    } catch (e) {
      ElMessage.error('添加图片失败: ' + (e.message || e))
    }
    uploadProgressText.value = ''
    uploadProgress.value = 0
    uploading.value = false
    return
  }

  if (mediaType === 'video') {
    const url = item.minioPath || item.path || ''
    if (!url) return
    uploadProgressText.value = '正在下载视频...'
    uploadProgress.value = 5
    uploading.value = true
    try {
      const r = await fetch('/api/storage/fetch?objectName=' + encodeURIComponent(url))
      if (!r.ok) throw new Error('下载失败')
      const disposition = r.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
      const fileName = match ? decodeURIComponent(match[1]) : (item.name || item.fileName || 'video')
      const ct = r.headers.get('Content-Type') || 'video/mp4'
      const blob = await r.blob()
      uploadProgressText.value = '正在上传到终端...'
      uploadProgress.value = 30
      const rawFile = new File([blob], fileName, { type: ct })
      const hash = await handleFileUploadComponent(rawFile, 'video')
      if (hash) {
        if (!selectedEl.value.images) selectedEl.value.images = []
        selectedEl.value.images.push({ src: hash, type: 'video' })
        dirty.value = true
        emitChange()
      }
    } catch (e) {
      ElMessage.error('添加视频失败: ' + (e.message || e))
    }
    uploadProgressText.value = ''
    uploadProgress.value = 0
    uploading.value = false
    return
  }

  // 文档类型（ppt/pdf/word）— 逐页处理
  const count = item.previewCount || 0
  if (count === 0) {
    ElMessage.warning('该文档暂无预览图片')
    return
  }
  uploadProgressText.value = '正在处理文档...'
  uploadProgress.value = 5
  uploading.value = true
  const docGroupId = 'doc_' + (item.id || Date.now()) + '_' + Math.random().toString(36).slice(2,6)
  let successCount = 0
  for (let i = 0; i < count; i++) {
    const pageUrl = resolveMaterialPageUrl(item, i)
    uploadProgressText.value = `正在下载第 ${i+1}/${count} 页...`
    uploadProgress.value = Math.round((i / count) * 60) + 5
    try {
      const r = await fetch(pageUrl.startsWith('/api/') ? pageUrl : '/api/storage/fetch?objectName=' + encodeURIComponent(pageUrl))
      if (!r.ok) continue
      const blob = await r.blob()
      uploadProgressText.value = `正在上传第 ${i+1}/${count} 页...`
      uploadProgress.value = Math.round((i / count) * 30) + 65
      const rawFile = new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' })
      const hash = await handleFileUploadComponent(rawFile, 'image')
      if (hash) {
        if (!selectedEl.value.images) selectedEl.value.images = []
        selectedEl.value.images.push({ src: hash, type: 'image', groupId: docGroupId, totalInGroup: count })
        successCount++
      }
    } catch (e) {
      console.warn('[CarouselDoc] 第' + (i+1) + '页失败:', e)
    }
  }
  if (successCount > 0) {
    dirty.value = true
    emitChange()
    ElMessage.success(`成功添加 ${successCount} 页`)
  } else {
    ElMessage.warning('没有成功添加任何页面')
  }
  uploadProgressText.value = ''
  uploadProgress.value = 0
  uploading.value = false
}

function onCarouselRemoveItem(index) {
  if (!selectedEl.value || !selectedEl.value.images) return
  const item = selectedEl.value.images[index]
  if (!item) return

  // 如果是对象且有 groupId → 属于文档组
  if (typeof item === 'object' && item.groupId) {
    const groupId = item.groupId
    const groupItems = selectedEl.value.images.filter(
      x => typeof x === 'object' && x.groupId === groupId
    )
    if (groupItems.length > 1) {
      // 组内有多条 → 弹窗确认整组删除
      ElMessageBox.confirm(
        '该素材属于文档的一部分（共 ' + (item.totalInGroup || groupItems.length) + ' 页），无法单独删除。是否整组删除？',
        '文档整组删除',
        { confirmButtonText: '整组删除', cancelButtonText: '取消', type: 'warning' }
      ).then(() => {
        // 整组删除：收集所有 hash → 通知终端删除
        const hashes = groupItems.map(x => (typeof x === 'object' ? x.src : x)).filter(Boolean)
        // 先删除再删除文件
        selectedEl.value.images = selectedEl.value.images.filter(
          x => !(typeof x === 'object' && x.groupId === groupId)
        )
        dirty.value = true
        emitChange()
        // 异步通知终端删除
        const terminalIds = targetGroupId.value
        if (terminalIds && terminalIds.length > 0 && hashes.length > 0) {
          const terminalList = []
          for (const id of terminalIds) {
            const t = serverTerminals.value.find(x => x.id === id)
            if (t && t.ipAddress) terminalList.push(t)
          }
          for (const term of terminalList) {
            for (const h of hashes) {
              terminalDeleteFile(term.ipAddress, h).catch(e => {
                console.warn('[CarouselRemoveGroup] 删除文件失败:', term.ipAddress, h, e?.message || e)
              })
            }
          }
        }
        ElMessage.success('整组文档已删除')
      }).catch(() => {})
      return
    }
    // 只剩一条时直接走下面的删除逻辑
  }

  // 普通单条删除（图片/视频/文档最后一页）
  const src = typeof item === 'object' ? item.src : item
  selectedEl.value.images.splice(index, 1)
  dirty.value = true
  emitChange()
  // 通知终端删除文件
  if (src && src.length > 5) {
    const terminalIds = targetGroupId.value
    if (terminalIds && terminalIds.length > 0) {
      const terminalList = []
      for (const id of terminalIds) {
        const t = serverTerminals.value.find(x => x.id === id)
        if (t && t.ipAddress) terminalList.push(t)
      }
      for (const term of terminalList) {
        terminalDeleteFile(term.ipAddress, src).catch(e => {
          console.warn('[CarouselRemove] 删除文件失败:', term.ipAddress, src, e?.message || e)
        })
      }
    }
  }
}

// ===== PPT / PDF / Word 从素材库选择 =====
const pptPickerVisible = ref(false)
const pdfPickerVisible = ref(false)
const wordPickerVisible = ref(false)

function onDocSelectFromMaterial(docType) {
  if (!targetGroupId.value || targetGroupId.value.length === 0) {
    ElMessage.warning('请先绑定终端')
    return
  }
  const list = groupedMaterials.value?.[docType] || []
  if (list.length === 0) {
    ElMessage.warning('素材库中暂无该类型素材，请先上传')
    return
  }
  if (docType === 'ppt') pptPickerVisible.value = true
  else if (docType === 'pdf') pdfPickerVisible.value = true
  else if (docType === 'word') wordPickerVisible.value = true
}

async function onDocPickConfirm(item, docType) {
  if (docType === 'ppt') pptPickerVisible.value = false
  else if (docType === 'pdf') pdfPickerVisible.value = false
  else if (docType === 'word') wordPickerVisible.value = false
  if (!selectedEl.value) return
  const el = selectedEl.value
  const count = item.previewCount || 0
  if (count === 0) {
    ElMessage.warning('该文档暂无预览图片')
    return
  }
  uploadProgressText.value = '正在处理文档...'
  uploadProgress.value = 5
  uploading.value = true
  const urls = []
  let successCount = 0
  for (let i = 0; i < count; i++) {
    const pageUrl = resolveMaterialPageUrl(item, i)
    uploadProgressText.value = `正在下载第 ${i+1}/${count} 页...`
    uploadProgress.value = Math.round((i / count) * 60) + 5
    try {
      const r = await fetch(pageUrl.startsWith('/api/') ? pageUrl : '/api/storage/fetch?objectName=' + encodeURIComponent(pageUrl))
      if (!r.ok) continue
      const blob = await r.blob()
      uploadProgressText.value = `正在上传第 ${i+1}/${count} 页...`
      uploadProgress.value = Math.round((i / count) * 30) + 65
      const rawFile = new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' })
      const hash = await handleFileUploadComponent(rawFile, 'image')
      if (hash) {
        urls.push(hash)
        successCount++
      }
    } catch (e) {
      console.warn('[DocPick] 第' + (i+1) + '页失败:', e)
    }
  }
  if (successCount > 0) {
    // 先删除旧的终端文件
    const oldHashes = (el.srcList || []).filter(h => h && h.length > 5)
    const terminalIds = targetGroupId.value
    if (terminalIds && terminalIds.length > 0 && oldHashes.length > 0) {
      const terminalList = []
      for (const id of terminalIds) {
        const t = serverTerminals.value.find(x => x.id === id)
        if (t && t.ipAddress) terminalList.push(t)
      }
      for (const term of terminalList) {
        for (const oh of oldHashes) {
          terminalDeleteFile(term.ipAddress, oh).catch(() => {})
        }
      }
    }
    el.src = urls[0]
    el.srcList = urls
    el.totalPages = urls.length
    el.fileName = item.fileName || item.name || (docType.toUpperCase())
    el.currentPage = 0
    dirty.value = true
    emitChange()
    ElMessage.success(`成功加载 ${successCount} 页`)
  } else {
    ElMessage.warning('没有成功加载任何页面')
  }
  uploadProgressText.value = ''
  uploadProgress.value = 0
  uploading.value = false
}

function onDocFullscreenToggle(el) {
  if (!el) el = selectedEl.value
  if (!el) return
  if (el.fullscreen) {
    el._origW = el._origW || el.w
    el._origH = el._origH || el.h
    el._origX = el._origX || el.x
    el._origY = el._origY || el.y
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  } else {
    if (el._origW !== undefined) el.w = el._origW
    if (el._origH !== undefined) el.h = el._origH
    if (el._origX !== undefined) el.x = el._origX
    if (el._origY !== undefined) el.y = el._origY
  }
  dirty.value = true
  emitChange()
}

function onDocRemove(el) {
  if (!el) el = selectedEl.value
  if (!el || !el.src) return
  const allHashes = (el.srcList || []).filter(h => h && h.length > 5)
  // 清理组件
  el.src = ''
  el.srcList = []
  el.totalPages = 0
  el.currentPage = 0
  el.fileName = ''
  dirty.value = true
  emitChange()
  // 通知终端删除所有页
  if (allHashes.length > 0) {
    const terminalIds = targetGroupId.value
    if (terminalIds && terminalIds.length > 0) {
      const terminalList = []
      for (const id of terminalIds) {
        const t = serverTerminals.value.find(x => x.id === id)
        if (t && t.ipAddress) terminalList.push(t)
      }
      for (const term of terminalList) {
        for (const h of allHashes) {
          terminalDeleteFile(term.ipAddress, h).catch(e => {
            console.warn('[DocRemove] 删除文件失败:', term.ipAddress, h, e?.message || e)
          })
        }
      }
    }
  }
  ElMessage.success('文件已删除')
}

const bgUploadRef = ref(null)
const imageUploadRef = ref(null)
const videoUploadRef = ref(null)
const docUploadRef = ref(null)
const carouselUploadRef = ref(null)
const carouselVideoUploadRef = ref(null)
const carouselDocUploadRef = ref(null)
const uploadProgress = ref(0)           // 当前上传进度百分比（0-100）
const uploadProgressText = ref('')      // 上传状态描述文字
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
    s.backgroundSize = backgroundFit.value === 'contain' ? 'contain' : '100% 100%'
    s.backgroundPosition = 'center'
    s.backgroundRepeat = 'no-repeat'
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
  } else {
    elements.value = []; startCarouselTimer()
    fitScreen()
  }
  loadTreeMaterialList()
  // 树形素材库无感刷新：每15秒刷新，检测文档预览图是否生成完成
  treeRefreshTimer.value = setInterval(() => {
    loadTreeMaterialList()
  }, 15000)
  nextTick(() => setTimeout(fitScreen, 200))
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (treeRefreshTimer.value) {
    clearInterval(treeRefreshTimer.value)
    treeRefreshTimer.value = null
  }
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
    // 保存全屏前的位置大小
    el._origW = el._origW || el.w
    el._origH = el._origH || el.h
    el._origX = el._origX || el.x
    el._origY = el._origY || el.y
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  } else {
    // 恢复全屏前的位置大小
    if (el._origW !== undefined) el.w = el._origW
    if (el._origH !== undefined) el.h = el._origH
    if (el._origX !== undefined) el.x = el._origX
    if (el._origY !== undefined) el.y = el._origY
  }
  dirty.value = true
}

function onCarouselFullscreenToggle() {
  if (!selectedEl.value) return
  const el = selectedEl.value
  if (el.fullscreen) {
    el._origW = el._origW || el.w
    el._origH = el._origH || el.h
    el._origX = el._origX || el.x
    el._origY = el._origY || el.y
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  } else {
    if (el._origW !== undefined) el.w = el._origW
    if (el._origH !== undefined) el.h = el._origH
    if (el._origX !== undefined) el.x = el._origX
    if (el._origY !== undefined) el.y = el._origY
  }
  dirty.value = true
}

function onImageFullscreenToggle() {
  if (!selectedEl.value) return
  const el = selectedEl.value
  if (el.fullscreen) {
    el._origW = el._origW || el.w
    el._origH = el._origH || el.h
    el._origX = el._origX || el.x
    el._origY = el._origY || el.y
    el.w = pageWidth.value
    el.h = pageHeight.value
    el.x = 0
    el.y = 0
  } else {
    if (el._origW !== undefined) el.w = el._origW
    if (el._origH !== undefined) el.h = el._origH
    if (el._origX !== undefined) el.x = el._origX
    if (el._origY !== undefined) el.y = el._origY
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
  // v5.1: 纯 fileHash（16位以上 hex）且已绑定终端 → 走后端代理媒体文件（解决VPN无法直连终端3001）
  if (targetGroupId.value.length > 0 && /^[a-f0-9]{16,}$/.test(name)) {
    const ids = targetGroupId.value
    for (const id of ids) {
      const t = serverTerminals.value.find(x => x.id === id)
      if (t && t.ipAddress) {
        return '/api/terminal/proxy-media/' + name + '?terminalIp=' + t.ipAddress
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
  uploadProgressText.value = '正在上传到终端...'

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
 * 小文件上传（走后端代理 → 终端，解决VPN无法直连终端3001端口的问题）
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

      // 3. 走后端代理上传（后端在内网中直连终端 3001 端口）
      const res = await proxyUploadSimple(rawFile, terminalIp, uploadToken, (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded / progressEvent.total) * 80)
          uploadProgress.value = Math.max(uploadProgress.value, Math.round(termProgress + 10 / totalTerminals + pct / totalTerminals))
        }
      })

      if (res && res.code === 0 && res.data) {
        const resultData = res.data
        uploadProgress.value = Math.round(termProgress + 99 / totalTerminals)
        // 通知后端记录上传
        recordUpload({
          screenId: recordId.value || 'temp',
          terminalIp: terminalIp,
          resourceId: resultData.id || '',
          resourceHash: resultData.fileHash,
          fileName: resultData.fileName || rawFile.name,
          fileSize: resultData.fileSize || rawFile.size,
        }).catch(() => {})
        // v5: 存纯 fileHash，渲染时由 resolveMediaUrl 自动拼完整 URL
        if (targetType === 'bg') {
          backgroundImage.value = resultData.fileHash
        }
        // 文档上传时返回完整对象（带 docImages），否则返回 fileHash 字符串
        if (targetType === 'doc') {
          resolve(resultData)
        } else {
          resolve(resultData.fileHash)
        }
      } else {
        const errMsg = (res && res.message) || (res && res.msg) || '上传失败'
        reject(new Error(errMsg))
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
 * 大文件切片上传（走后端代理 → 终端，保持断点续传能力）
 * <p>
 * v5.1 变更：上传切片不再直连终端3001，改为走后端代理分片接口。
 * 后端在内网中透传每个切片到终端，不受VPN网络限制。
 * 分片逻辑、断点续传、并发控制与 v5 保持一致，仅替换调用的API函数。
 */
async function uploadByChunks(rawFile, targetType, terminalIp, ti, totalTerminals) {
  console.log('[uploadByChunks] terminalIp=', terminalIp, 'rawFile=', rawFile?.name)
  const termProgress = (ti / totalTerminals) * 100
  const totalChunks = Math.ceil(rawFile.size / CHUNK_SIZE)

  // ===== 获取上传令牌（与直连时流程一致） =====
  const tokenRes = await requestUploadToken({
    terminalIp: terminalIp,
    screenId: recordId.value || 'temp',
  })
  if (tokenRes.code !== 0 || !tokenRes.data?.uploadToken) {
    throw new Error('获取上传令牌失败')
  }
  const uploadToken = tokenRes.data.uploadToken

  uploadProgress.value = Math.max(uploadProgress.value, Math.round(termProgress + 5 / totalTerminals))

  // ===== Step 1: 后端代理分片初始化（断点续传） =====
  const totalUploadChunks = Math.ceil(rawFile.size / CHUNK_SIZE)
  const initRes = await proxyUploadInit(terminalIp, uploadToken, {
    fileName: rawFile.name,
    fileSize: rawFile.size,
    totalChunks: totalUploadChunks,
  })
  if (initRes.code !== 0 || !initRes.data?.uploadId) {
    throw new Error((initRes.data?.error || '初始化失败'))
  }

  const { uploadId, resumedChunks } = initRes.data

  // ===== Step 2: 并发上传切片（每批3片） =====
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

        const res = await proxyUploadChunk(blob, terminalIp, uploadToken, uploadId, index)
        if (res.code === 0 && res.data && res.data.ok) {
          successCount++
          updateProgress()
          return // 成功
        }
        lastError = new Error(res.message || `切片 ${index} 上传失败`)
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

  // ===== Step 3: 后端代理完成合片 =====
  uploadProgress.value = 99
  const completeRes = await proxyUploadComplete(terminalIp, uploadToken, {
    uploadId,
    totalChunks: totalUploadChunks,
  })

  if (completeRes.code !== 0 || !completeRes.data?.id || !completeRes.data?.fileHash) {
    throw new Error(completeRes.message || '合片失败')
  }

  const resultData = completeRes.data

  // v5: 存纯 fileHash，渲染时由 resolveMediaUrl 自动拼完整 URL
  uploadProgress.value = 100
  if (targetType === 'bg') {
    backgroundImage.value = resultData.fileHash
  }
  // 通知后端记录上传
  recordUpload({
    screenId: recordId.value || 'temp',
    terminalIp: terminalIp,
    resourceId: resultData.id || '',
    resourceHash: resultData.fileHash,
    fileName: resultData.fileName || rawFile.name,
    fileSize: resultData.fileSize || rawFile.size,
  }).catch(() => {})
  // 文档上传时返回完整对象
  if (targetType === 'doc') {
    return resultData
  }
  return resultData.fileHash
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
  const materialUrlsRaw = e.dataTransfer.getData('materialUrls')
  const materialId = e.dataTransfer.getData('materialId')

  // 从素材库拖来的（文档二级：一组图片）
  if (materialUrlsRaw && materialId) {
    let urls = JSON.parse(materialUrlsRaw)
    // 如果 urls 为空，尝试重新获取 previewCount
    if (!urls || urls.length === 0) {
      const count = await fetchDocPreviewCount(materialId)
      if (count > 0) {
        urls = []
        for (let i = 0; i < count; i++) {
          urls.push(resolveMaterialPageUrl({ id: materialId }, i))
        }
      } else {
        ElMessage.warning('该文档暂无预览图片')
        return
      }
    }
    // 获取文档类型（从 componentType 或文件名推断）
    const docType = type || 'ppt'
    // 先检查是否拖到了轮播图组件上
    const rect2 = canvasRef.value.getBoundingClientRect()
    const sf2 = zoom.value / 100
    const dropX2 = (e.clientX - rect2.left) / sf2
    const dropY2 = (e.clientY - rect2.top) / sf2
    const carouselEl2 = findElementAtPoint(dropX2, dropY2, 'carousel')
    if (carouselEl2) {
      // 拖到轮播图上 → 下载所有页 → 同步到终端本地
      uploadProgressText.value = '正在处理文档...'
      uploadProgress.value = 5
      uploading.value = true
      const docGroupId = 'doc_' + (materialId || Date.now()) + '_' + Math.random().toString(36).slice(2,6)
      let successCount = 0
      ;(async () => {
        for (let i = 0; i < urls.length; i++) {
          const pageUrl = urls[i]
          uploadProgressText.value = `正在下载第 ${i+1}/${urls.length} 页...`
          uploadProgress.value = Math.round((i / urls.length) * 60) + 5
          try {
            const r = await fetch(pageUrl.startsWith('/api/') ? pageUrl : '/api/storage/fetch?objectName=' + encodeURIComponent(pageUrl))
            if (!r.ok) continue
            const blob = await r.blob()
            uploadProgressText.value = `正在同步第 ${i+1}/${urls.length} 页...`
            uploadProgress.value = Math.round((i / urls.length) * 30) + 65
            const rawFile = new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' })
            const hash = await handleFileUploadComponent(rawFile, 'image')
            if (hash) {
              if (!carouselEl2.images) carouselEl2.images = []
              carouselEl2.images.push({ src: hash, type: 'image', groupId: docGroupId, totalInGroup: urls.length })
              successCount++
            }
          } catch (e) {
            console.warn('[DropDocToCarousel] 第' + (i+1) + '页失败:', e)
          }
        }
        uploadProgressText.value = ''
        uploadProgress.value = 0
        uploading.value = false
        if (successCount > 0) {
          dirty.value = true
          ElMessage.success(`文档已添加到轮播，共 ${successCount} 页`)
        } else {
          ElMessage.warning('没有成功添加任何页面')
        }
      })()
      return
    }
    // 检查是否拖到了同类型的文档组件上
    const rectDoc = canvasRef.value.getBoundingClientRect()
    const sfDoc = zoom.value / 100
    const dropXDoc = (e.clientX - rectDoc.left) / sfDoc
    const dropYDoc = (e.clientY - rectDoc.top) / sfDoc
    const targetDocEl = findElementAtPoint(dropXDoc, dropYDoc, null)
    if (targetDocEl) {
      if (targetDocEl.type === 'carousel') {
        // 已处理
      } else if (['ppt','pdf','word'].includes(targetDocEl.type)) {
        // 拖到文档组件上 → 整组替换
        if (targetDocEl.type === docType) {
          uploadProgressText.value = '正在下载文档...'
          uploadProgress.value = 5
          uploading.value = true
          ;(async () => {
            const newUrls = []
            let sc = 0
            for (let i = 0; i < urls.length; i++) {
              uploadProgressText.value = `正在下载第 ${i+1}/${urls.length} 页...`
              uploadProgress.value = Math.round((i / urls.length) * 60) + 5
              try {
                const r = await fetch(urls[i].startsWith('/api/') ? urls[i] : '/api/storage/fetch?objectName=' + encodeURIComponent(urls[i]))
                if (!r.ok) continue
                const blob = await r.blob()
                uploadProgressText.value = `正在同步第 ${i+1}/${urls.length} 页...`
                uploadProgress.value = Math.round((i / urls.length) * 30) + 65
                const rawFile = new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' })
                const hash = await handleFileUploadComponent(rawFile, 'image')
                if (hash) { newUrls.push(hash); sc++ }
              } catch (e) {
                console.warn('[DropDocToDoc] 第' + (i+1) + '页失败:', e)
              }
            }
            if (sc > 0) {
              targetDocEl.src = newUrls[0]
              targetDocEl.srcList = newUrls
              targetDocEl.totalPages = newUrls.length
              targetDocEl.fileName = materialName
              targetDocEl.currentPage = 0
              dirty.value = true
              ElMessage.success(`文档已替换，共 ${sc} 页`)
            } else {
              ElMessage.warning('没有成功加载任何页面')
            }
            uploadProgressText.value = ''
            uploadProgress.value = 0
            uploading.value = false
          })()
          return
        } else {
          ElMessage.warning('只能拖拽同类型文档到该组件上')
          return
        }
      } else {
        // 落到其他类型组件上 → 继续创建新文档组件
      }
    }
    const rect = canvasRef.value.getBoundingClientRect()
    const sf = zoom.value / 100
    let x = Math.round((e.clientX - rect.left) / sf)
    let y = Math.round((e.clientY - rect.top) / sf)
    const el = createElement(docType, x, y)
    // 从素材库 URL 提取 objectName（如 preview/xxx/page_0.jpg）
    // 这样后端 parseResourcesFromLayout 能正确识别资源 hash
    const firstObjMatch = urls[0] ? urls[0].match(/objectName=([^&]+)/) : null
    const firstObjName = firstObjMatch ? decodeURIComponent(firstObjMatch[1]) : (urls[0] || '')
    el.src = firstObjName
    el.fileName = materialName
    el.srcList = urls.map(u => {
      const m = u.match(/objectName=([^&]+)/)
      return m ? decodeURIComponent(m[1]) : u
    })
    el.totalPages = urls.length
    el.currentPage = 0
    elements.value.push(el)
    selectedIdx.value = elements.value.length - 1
    dirty.value = true
    clampAllElements()
    startCarouselForElement(el)
    return
  }

  // 从素材库拖来的（单张图片/视频）
  if (materialUrl) {
    if (!materialType || (materialType !== 'image' && materialType !== 'video' && materialType !== 'ppt' && materialType !== 'pdf' && materialType !== 'word')) {
      ElMessage.warning('该素材类型暂不支持拖入画布')
      return
    }
    // 检查是否拖到了已有的同类型组件上
    const rect = canvasRef.value.getBoundingClientRect()
    const sf = zoom.value / 100
    const dropX = (e.clientX - rect.left) / sf
    const dropY = (e.clientY - rect.top) / sf
    // 先检查是否拖到了轮播图组件上（图片/视频都可以添加到轮播）
    const carouselEl = findElementAtPoint(dropX, dropY, 'carousel')
    if (carouselEl) {
      // 拖到轮播图上 → 下载 → 上传到终端 → 加入 images
      uploadProgressText.value = '正在下载素材...'
      uploadProgress.value = 5
      uploading.value = true
      fetch(materialUrl.startsWith('/api/') ? materialUrl : '/api/storage/fetch?objectName=' + encodeURIComponent(materialUrl))
        .then(r => {
          if (!r.ok) throw new Error('下载失败')
          const disposition = r.headers.get('Content-Disposition') || ''
          const match2 = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
          const fName = match2 ? decodeURIComponent(match2[1]) : (materialName || 'media')
          const ct = r.headers.get('Content-Type') || (materialType === 'video' ? 'video/mp4' : 'image/jpeg')
          return r.blob().then(blob => ({ blob, fileName: fName, contentType: ct }))
        })
        .then(({ blob, fileName, contentType }) => {
          uploadProgressText.value = '正在上传到终端...'
          uploadProgress.value = 20
          const rawFile = new File([blob], fileName, { type: contentType })
          return handleFileUploadComponent(rawFile, materialType).then(hash => ({ hash }))
        })
        .then(({ hash }) => {
          if (hash) {
            if (!carouselEl.images) carouselEl.images = []
            carouselEl.images.push({ src: hash, type: materialType })
            dirty.value = true
          }
          uploadProgressText.value = ''
          uploadProgress.value = 0
          uploading.value = false
          ElMessage.success('素材已添加到轮播')
        })
        .catch(err => {
          uploadProgressText.value = ''
          uploadProgress.value = 0
          uploading.value = false
          ElMessage.error('素材上传终端失败: ' + (err.message || err))
        })
      return
    }
    // 检查是否拖到了已有的组件上（任何类型）
    const targetEl = findElementAtPoint(dropX, dropY, null)
    if (targetEl) {
      if (targetEl.type === 'carousel') {
        // carousel 已经在上面的检查中处理了，这里不可能走到，但以防万一
        ElMessage.warning('图片/视频不能直接拖到轮播图组件')
        return
      }
      if (targetEl.type !== materialType) {
        // 拖到了不兼容的组件上 → 拒绝
        ElMessage.warning('该素材类型不能拖到 ' + (targetEl.label || targetEl.type) + ' 组件上')
        return
      }
      // 拖到同类型组件上 → 替换该组件的 src
      uploadProgressText.value = '正在下载素材...'
      uploadProgress.value = 5
      uploading.value = true
      fetch(materialUrl.startsWith('/api/') ? materialUrl : '/api/storage/fetch?objectName=' + encodeURIComponent(materialUrl))
        .then(r => {
          if (!r.ok) throw new Error('下载失败')
          const disposition = r.headers.get('Content-Disposition') || ''
          const match2 = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
          const fName = match2 ? decodeURIComponent(match2[1]) : (materialName || 'media')
          const ct = r.headers.get('Content-Type') || (materialType === 'video' ? 'video/mp4' : 'image/jpeg')
          return r.blob().then(blob => ({ blob, fileName: fName, contentType: ct }))
        })
        .then(({ blob, fileName, contentType }) => {
          uploadProgressText.value = '正在上传到终端...'
          uploadProgress.value = 20
          const rawFile = new File([blob], fileName, { type: contentType })
          return handleFileUploadComponent(rawFile, materialType).then(hash => ({ hash }))
        })
        .then(({ hash }) => {
          if (hash) {
            targetEl.src = hash
            targetEl.srcList = [hash]
            dirty.value = true
          }
          uploadProgressText.value = ''
          uploadProgress.value = 0
          uploading.value = false
          ElMessage.success('素材已添加到组件')
        })
        .catch(err => {
          uploadProgressText.value = ''
          uploadProgress.value = 0
          uploading.value = false
          ElMessage.error('素材上传终端失败: ' + (err.message || err))
        })
      return
    }
    // 拖到空白处 → 创建新组件
    let x = Math.round(dropX)
    let y = Math.round(dropY)
    const el = createElement(materialType, x, y)
    // 先用 MinIO 代理 URL 占位，让画布能显示
    el.src = materialUrl
    el.fileName = materialName
    el.srcList = [materialUrl]
    el._isUploading = true
    elements.value.push(el)
    selectedIdx.value = elements.value.length - 1
    dirty.value = true
    clampAllElements()
    startCarouselForElement(el)
    // 异步上传到终端
    uploadProgressText.value = '正在下载素材...'
    uploadProgress.value = 5
    uploading.value = true
    fetch(materialUrl.startsWith('/api/') ? materialUrl : '/api/storage/fetch?objectName=' + encodeURIComponent(materialUrl))
      .then(r => {
        if (!r.ok) throw new Error('下载失败')
        const disposition = r.headers.get('Content-Disposition') || ''
        const match2 = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i) || disposition.match(/filename="([^"]+)"/i)
        const fName = match2 ? decodeURIComponent(match2[1]) : (materialName || 'media')
        const ct = r.headers.get('Content-Type') || (materialType === 'video' ? 'video/mp4' : 'image/jpeg')
        return r.blob().then(blob => ({ blob, fileName: fName, contentType: ct, el: el }))
      })
      .then(({ blob, fileName, contentType, el }) => {
        uploadProgressText.value = '正在上传到终端...'
        uploadProgress.value = 20
        const rawFile = new File([blob], fileName, { type: contentType })
        return handleFileUploadComponent(rawFile, materialType).then(hash => ({ hash, el }))
      })
      .then(({ hash, el }) => {
        if (hash) {
          el.src = hash
          el.srcList = [hash]
          el._isUploading = false
        }
        uploadProgressText.value = ''
        uploadProgress.value = 0
        uploading.value = false
      })
      .catch(err => {
        console.warn('[DropUpload] 上传失败:', err)
        el._isUploading = false
        uploadProgressText.value = ''
        uploadProgress.value = 0
        uploading.value = false
        ElMessage.error('素材上传终端失败: ' + (err.message || err))
      })
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
  const sizes = { video:[480,360], image:[480,360], carousel:[960,540], text:[400,100], scrollText:[900,80], clock:[250,100], iframe:[800,600], ppt:[600,420], pdf:[600,420], word:[600,420] }
  let defW = 300, defH = 200
  if (sizes[type]) { defW = sizes[type][0]; defH = sizes[type][1] }
  if (x === undefined) x = Math.round((pw - defW) / 2)
  if (y === undefined) y = Math.round((ph - defH) / 2)
  x = Math.max(0, Math.min(x, pw - defW))
  y = Math.max(0, Math.min(y, ph - defH))

  const lmode = ['ppt','pdf','word'].includes(type) ? 'block' : (['video','image','carousel'].includes(type) ? 'block' : 'float')
  const base = { id: 'el_' + type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), type, x, y, w: defW, h: defH, zIndex: 1, layoutMode: lmode, label: componentTypes.find(c=>c.type===type)?.label || type }

  if (type === 'video') { base.src = ''; base.autoplay = true; base.loop = true; base.muted = true; base.objectFit = 'contain'; base.fullscreen = false }
  else if (type === 'image') { base.src = ''; base.opacity = 1; base.objectFit = 'contain'; base.fullscreen = false }
  else if (type === 'carousel') { base.images = []; base.interval = 3; base.objectFit = 'contain'; base.fullscreen = false }
  else if (type === 'text') { base.content = ''; base.fontSize = 28; base.color = '#ffffff'; base.bold = false; base.textAlign = 'center'; base.fontFamily = '' }
  else if (type === 'scrollText') { base.content = ''; base.fontSize = 24; base.color = '#ffffff'; base.backgroundColor = 'transparent'; base.speed = 'medium'; base.fontFamily = '' }
  else if (type === 'clock') { base.fontSize = 36; base.color = '#00ffcc'; base.fontFamily = 'monospace'; base.clockStyle = 'digital'; base.showDate = true; base.backgroundColor = 'transparent' }
  else if (['ppt','pdf','word'].includes(type)) { base.src = ''; base.fileName = ''; base.srcList = []; base.currentPage = 0; base.playSpeed = 3; base.totalPages = 0; base.objectFit = 'contain'; base.fullscreen = false }

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
function findElementAtPoint(x, y, type) {
  const els = elements.value || []
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i]
    if (type !== null && el.type !== type) continue
    const left = el.x !== undefined ? el.x : el.left || 0
    const top = el.y !== undefined ? el.y : el.top || 0
    const w = el.w !== undefined ? el.w : el.width || 0
    const h = el.h !== undefined ? el.h : el.height || 0
    if (x >= left && x <= left + w && y >= top && y <= top + h) {
      return el
    }
  }
  return null
}

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
        backgroundFit.value = d.backgroundFit || 'fill'
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
              if (parsed.backgroundFit) backgroundFit.value = parsed.backgroundFit
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
    backgroundFit: backgroundFit.value,
    pageWidth: pageWidth.value,
    pageHeight: pageHeight.value
  })
  const payload = {
    title: publishTitle.value,
    pageWidth: pageWidth.value,
    pageHeight: pageHeight.value,
    backgroundColor: backgroundColor.value,
    backgroundImage: backgroundImage.value,
    backgroundFit: backgroundFit.value,
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

async function handlePush() {
  if (!recordId.value) {
    ElMessage.warning('请先保存再推送')
    return
  }
  if (dirty.value) {
    ElMessage.warning('当前有未保存的更改，请先保存再推送')
    return
  }

  const terminalIds = targetGroupId.value
  if (!terminalIds || terminalIds.length === 0) {
    ElMessage.warning('请先绑定终端')
    return
  }

  try {
    const res = await pushToTerminal({
      screenId: recordId.value,
      terminalIds: terminalIds,
      publishType: pushType.value || 'normal',
    })
    if (res.code === 0) {
      ElMessage.success('推送任务已提交')
    } else {
      ElMessage.error(res.message || '推送失败')
    }
  } catch (e) {
    ElMessage.error('推送失败: ' + (e.message || e))
  }
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
  router.replace('/screen')
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
  /* 棋盘格背景（PS透明效果） */
  background-image:
    linear-gradient(45deg, #555 25%, transparent 25%),
    linear-gradient(-45deg, #555 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #555 75%),
    linear-gradient(-45deg, transparent 75%, #555 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
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

/* ===== 树形素材库面板 ===== */
.tree-material-panel {
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.tree-material-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-shrink: 0;
}
.tree-material-toolbar .el-button {
  font-size: 12px;
  padding: 4px 10px;
}
.tree-material-loading {
  text-align: center;
  color: #888;
  padding: 12px;
  font-size: 12px;
}
.tree-material-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.tree-category {
  margin-bottom: 4px;
}
.tree-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #c0c0e0;
  border-radius: 4px;
  transition: background 0.15s;
  user-select: none;
}
.tree-category-header:hover {
  background: #2a2a5a;
}
.tree-category-arrow {
  font-size: 10px;
  width: 14px;
  text-align: center;
}
.tree-category-count {
  font-size: 11px;
  color: #888;
  font-weight: 400;
  margin-left: auto;
}
.tree-category-body {
  padding-left: 12px;
}
.tree-material-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.tree-material-item:hover {
  background: #2a2a5a;
}
.tree-material-item[draggable="true"] {
  cursor: grab;
}
.tree-material-item[draggable="true"]:active {
  cursor: grabbing;
}
.tree-material-thumb {
  width: 36px;
  height: 26px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
  background: #222;
}
.tree-material-name {
  font-size: 12px;
  color: #ccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.tree-material-file-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 36px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tree-material-empty {
  font-size: 11px;
  color: #666;
  text-align: center;
  padding: 8px 0;
}
.tree-doc-expand-btn {
  font-size: 14px !important;
  padding: 0 2px !important;
  flex-shrink: 0;
}

.tree-doc-material2 {
  margin: 2px 0;
}

.tree-doc-header2 {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  border-radius: 4px;
  cursor: grab;
  transition: background 0.15s;
}

.tree-doc-header2:hover {
  background: #eef1f6;
}

.tree-doc-header2:active {
  cursor: grabbing;
}

.tree-doc-toggle2 {
  flex-shrink: 0;
  font-size: 10px;
  width: 14px;
  text-align: center;
  cursor: pointer;
  opacity: 0.5;
}

.tree-doc-toggle2:hover {
  opacity: 1;
}

.tree-doc-name2 {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.tree-doc-name2[draggable] {
  cursor: grab;
}

.tree-doc-pages2 {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 4px 0 4px 20px;
  width: 100%;
}

.tree-doc-page-item2 {
  width: 52px;
  height: 36px;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #ddd;
  transition: border-color 0.15s;
}

.tree-doc-page-item2:hover {
  border-color: #409eff;
}

.tree-doc-page-item2:active {
  cursor: grabbing;
}

.tree-doc-page-thumb2 {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tree-doc-pages {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0 4px 20px;
  width: 100%;
}
.tree-doc-page-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 3px;
  cursor: grab;
  transition: background 0.15s;
}
.tree-doc-page-item:hover {
  background: #333366;
}
.tree-doc-page-item:active {
  cursor: grabbing;
}
.tree-doc-page-thumb {
  width: 32px;
  height: 22px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
  background: #222;
}
.tree-doc-page-label {
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右键菜单 */
.tree-context-menu {
  position: fixed;
  z-index: 10000;
  background: #1e1e3a;
  border: 1px solid #3a3a6a;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  min-width: 130px;
  padding: 4px 0;
}
.tree-context-item {
  padding: 8px 14px;
  font-size: 13px;
  color: #e0e0e0;
  cursor: pointer;
  transition: background 0.12s;
}
.tree-context-item:hover {
  background: #2a2a5a;
}
.tree-context-item-danger {
  color: #f56c6c;
}
.tree-context-item-danger:hover {
  background: #3a1a1a;
}

.bg-picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: background 0.15s;
}

.bg-picker-item:hover {
  background: #f0f5ff;
}
</style>
