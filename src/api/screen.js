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
 * 异步推送到小终端（v5 增量推送）
 * @param {{ screenId: string, publishType?: string, interruptWindowStart?: number, interruptWindowEnd?: number }} data
 *   - publishType: 'normal' | 'interrupt'（默认 normal）
 *   - interruptWindowStart: 插播开始时间毫秒时间戳
 *   - interruptWindowEnd: 插播结束时间毫秒时间戳
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

export function getPublishLogList(screenIds) {
  return request({
    url: '/api/screen/publish-log-list',
    method: 'get',
    params: { screenIds },
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

// ==================== v5 直连终端上传（不走服务器中转）====================
//
// 设计原则：所有直连终端 3001 端口的请求，一律使用 fetch 原生 API，
// 绕过 axios 实例。原因：
//   1. axios 实例默认 withCredentials: true，跨域直连终端 3001 会被浏览器 CORS 拦截
//   2. axios 拦截器自动注入 X-Trace-Id / X-Request-Id 等无关 header
//   3. multipart/form-data 手动设 Content-Type 会丢失 boundary
//   4. fetch 请求体传 Blob 即为纯二进制 body，终端 _read_body() 直接读盘，协议干净
//
// 所有直连请求统一走 terminalFetch 函数。

/**
 * 请求上传令牌（由后端签发，直连终端时携带）
 * @param {{ terminalIp: string, screenId: string }} data
 */
export function requestUploadToken(data) {
  return request({
    url: '/api/terminal/upload-token',
    method: 'post',
    data,
  })
}

/**
 * 直连终端 3001 — 统一 fetch 收发（内部函数，不导出）
 *
 * @param {string} terminalIp 终端 IP
 * @param {string} path 路由路径，如 '/upload'、'/upload/init'
 * @param {BodyInit|null} body 请求体（终端直接读 raw body）
 * @param {string} uploadToken 上传令牌
 * @param {object} [extraHeaders] 额外请求头
 * @param {AbortSignal} [signal] 取消信号
 * @returns {Promise<object>} 终端返回的 JSON
 */
async function terminalFetch(terminalIp, path, body, uploadToken, extraHeaders = {}, signal) {
  const url = `http://${terminalIp}:3001${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Upload-Token': uploadToken,
      ...extraHeaders,
    },
    body,
    signal,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error('上传令牌无效，请刷新页面重试')
    if (res.status === 429) throw new Error('429: 服务器上传繁忙，请稍后重试')
    throw new Error(`终端返回 HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * 直连终端 3001 — 小文件直传
 *
 * 直接将 File/Blob 作为 request body 发送（非 multipart）:
 *   - 终端 _handle_upload_simple 调用 _read_body() 读到纯二进制文件内容
 *   - 文件名通过 URL query 参数 fileName 传递
 *
 * @param {string} terminalIp 终端 IP
 * @param {File} file 文件对象
 * @param {string} uploadToken 上传令牌
 * @returns {Promise<{id, fileName, fileSize, fileHash, mimeType, zone}>}
 */
export async function terminalUploadSimple(terminalIp, file, uploadToken) {
  return terminalFetch(
    terminalIp,
    `/upload?fileName=${encodeURIComponent(file.name)}`,
    file,
    uploadToken,
  )
}

/**
 * 直连终端 3001 — 初始化切片上传会话
 *
 * @param {string} terminalIp 终端 IP
 * @param {{ fileName: string, fileSize: number }} data
 * @param {string} uploadToken 上传令牌
 * @returns {Promise<{uploadId, resumedChunks, chunkSize}>}
 */
export async function terminalInitUpload(terminalIp, data, uploadToken) {
  return terminalFetch(
    terminalIp,
    '/upload/init',
    JSON.stringify(data),
    uploadToken,
    { 'Content-Type': 'application/json' },
  )
}

/**
 * 直连终端 3001 — 上传单一切片
 *
 * 直接将 Blob 作为 request body 发送：
 *   - 终端 _handle_upload_chunk 调用 _read_body() 读到纯切片二进制
 *   - uploadId / chunkIndex 通过 URL query 传递
 *
 * @param {string} terminalIp 终端 IP
 * @param {Blob} chunkBlob 切片二进制
 * @param {string} uploadId 上传会话 ID
 * @param {number} chunkIndex 切片序号
 * @param {string} uploadToken 上传令牌
 * @returns {Promise<{ok, chunkIndex, received, total}>}
 */
export async function terminalUploadChunk(terminalIp, chunkBlob, uploadId, chunkIndex, uploadToken) {
  return terminalFetch(
    terminalIp,
    `/upload/chunk?uploadId=${uploadId}&chunkIndex=${chunkIndex}`,
    chunkBlob,
    uploadToken,
  )
}

/**
 * 直连终端 3001 — 完成合片
 *
 * @param {string} terminalIp 终端 IP
 * @param {{ uploadId: string, totalChunks: number }} data
 * @param {string} uploadToken 上传令牌
 * @returns {Promise<{id, fileName, fileSize, fileHash, mimeType, zone}>}
 */
export async function terminalCompleteUpload(terminalIp, data, uploadToken) {
  return terminalFetch(
    terminalIp,
    '/upload/complete',
    JSON.stringify(data),
    uploadToken,
    { 'Content-Type': 'application/json' },
  )
}

/**
 * 直连终端 3001 - 上传后通知后端记录
 * @param {{ screenId: string, terminalIp: string, resourceId: string, fileHash: string, fileName: string, fileSize: number }} data
 */
export function recordUpload(data) {
  return request({
    url: '/api/screen/upload-record',
    method: 'post',
    data,
  })
}

/**
 * 直连终端资源列表
 */
/**
 * 直连终端资源列表（GET 请求）
 */
export function terminalFetchResources(terminalIp, screenId) {
  const url = 'http://' + terminalIp + ':3001/resources/list?screenId=' + (screenId || '')
  return fetch(url, { method: 'GET' }).then(r => r.json())
}
