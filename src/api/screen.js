import request from '@/utils/request'

/**
 * 大屏相关 API
 */

/**
 * 分页查询大屏列表
 */
export function listScreen(data) {
  return request({
    url: '/api/screen/list',
    method: 'post',
    data,
  })
}

/**
 * 获取大屏详情
 * @param {string} id 大屏ID
 */
export function getScreenDetail(id) {
  return request({
    url: '/api/screen/detail',
    method: 'get',
    params: { id },
  })
}

/**
 * 新建大屏
 */
export function saveScreen(data) {
  return request({
    url: '/api/screen/save',
    method: 'post',
    data,
  })
}

/**
 * 更新大屏
 */
export function updateScreen(data) {
  return request({
    url: '/api/screen/update',
    method: 'post',
    data,
  })
}

/**
 * 发布大屏
 */
export function publishScreen(data) {
  return request({
    url: '/api/screen/publish',
    method: 'post',
    data,
  })
}

/**
 * 删除大屏
 */
export function deleteScreen(data) {
  return request({
    url: '/api/screen/delete',
    method: 'post',
    data,
  })
}

/**
 * 上传文件
 * @param {FormData} formData 包含file字段的FormData
 * @param {Function} onProgress 进度回调 (progressEvent) => void（可选）
 */
export function uploadFile(formData, onProgress) {
  const config = {
    url: '/api/screen/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }
  if (onProgress) {
    config.onUploadProgress = onProgress
  }
  return request(config)
}

/**
 * 获取文件预览URL
 */
export function getPreviewUrl(objectName) {
  return request({
    url: '/api/screen/public-preview',
    method: 'get',
    params: { objectName },
  })
}

// ==================== 异步推送 & 配置 ====================

/**
 * 获取前端配置（MinIO公网地址、bucket等）
 */
export function getScreenConfig() {
  return request({
    url: '/api/screen/config',
    method: 'get',
  })
}

/**
 * 异步推送到小终端
 * @param {{ screenId: string }} data
 */
export function asyncPushToTerminal(data) {
  return request({
    url: '/api/screen/async-push-to-terminal',
    method: 'post',
    data,
  })
}

/**
 * 查询推送任务进度
 * @param {string} taskId
 */
export function getPushTaskProgress(taskId) {
  return request({
    url: '/api/screen/push-task-progress',
    method: 'get',
    params: { taskId },
  })
}

// ==================== 推送（旧版同步，保留兼容） ====================

/**
 * 同步推送大屏到小终端（旧版JSON推送，用于兼容非离线终端）
 * @param {{ screenId: string }} data
 */
export function pushToTerminal(data) {
  return request({
    url: '/api/screen/push-to-terminal',
    method: 'post',
    data,
  })
}

/**
 * 获取最新已发布大屏
 */
export function getLatestPublished() {
  return request({
    url: '/api/screen/latest',
    method: 'get',
  })
}

/**
 * 定时发布
 */
export function schedulePublish(data) {
  return request({
    url: '/api/screen/schedule-publish',
    method: 'post',
    data,
  })
}

/**
 * 取消定时发布
 */
export function cancelSchedulePublish(data) {
  return request({
    url: '/api/screen/cancel-schedule-publish',
    method: 'post',
    data,
  })
}

/**
 * 获取所有小终端列表（供大屏绑定选择）
 * @returns {Promise}
 */
export function getServerTerminalList() {
  return request({
    url: '/api/terminal/server-list',
    method: 'get',
  })
}

// ==================== 切片上传相关 API ====================

/**
 * 切片上传初始化
 * @param {string} fileName 原始文件名
 * @param {number} fileSize 文件大小（字节）
 * @param {Function} onUploadProgress 进度回调（可选）
 * @returns {Promise<{uploadId, chunkSize, totalChunks, finalObjectName}>}
 */
export function initChunkUpload(data) {
  return request({
    url: '/api/screen/upload/chunk/init',
    method: 'post',
    data,
  })
}

/**
 * 上传单片切片
 * @param {FormData} formData 包含 uploadId, chunkIndex, totalChunks, file 字段
 * @returns {Promise}
 */
export function uploadChunk(formData) {
  return request({
    url: '/api/screen/upload/chunk',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

/**
 * 完成切片上传（合并所有切片）
 * @param {{ uploadId, totalChunks, finalObjectName }} data
 * @returns {Promise<{taskId, status}>}
 */
export function completeChunkUpload(data) {
  return request({
    url: '/api/screen/upload/chunk/complete',
    method: 'post',
    data,
  })
}

/**
 * 查询合片任务进度
 * @param {string} taskId
 * @returns {Promise}
 */
export function getChunkMergeProgress(taskId) {
  return request({
    url: '/api/screen/upload/chunk/progress',
    method: 'get',
    params: { taskId },
  })
}
