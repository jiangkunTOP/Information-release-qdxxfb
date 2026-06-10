import request from '@/utils/request'

// 大屏列表（分页）
export function getScreenList(data) {
  return request.post('/api/screen/list', data)
}

// 大屏详情
export function getScreenDetail(id) {
  return request.get('/api/screen/detail', { params: { id } })
}

// 新建大屏
export function saveScreen(data) {
  return request.post('/api/screen/save', data)
}

// 更新大屏
export function updateScreen(data) {
  return request.post('/api/screen/update', data)
}

// 发布大屏
export function publishScreen(data) {
  return request.post('/api/screen/publish', data)
}

// 删除大屏
export function deleteScreen(data) {
  return request.post('/api/screen/delete', data)
}

// 上传文件
export function uploadScreenFile(data) {
  return request.post('/api/screen/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// 获取预览地址
export function getScreenPreviewUrl(objectName) {
  return request.get('/api/screen/preview-url', { params: { objectName } })
}

// 获取最新已发布大屏
export function getLatestPublishedScreen() {
  return request.get('/api/screen/latest')
}

// 根据ID获取大屏详情
export function getScreenById(id) {
  return request.get('/api/screen/detail', { params: { id } })
}

// 推送到小终端大屏
export function pushToTerminal(data) {
  return request.post('/api/screen/push-to-terminal', data)
}

// 获取所有小终端（大屏绑定选择用）
export function getServerTerminalList() {
  return request.get('/api/terminal/server-list')
}

// 定时发布大屏
export function schedulePublishScreen(data) {
  return request.post('/api/screen/schedule-publish', data)
}

// 取消定时发布
export function cancelSchedulePublish(data) {
  return request.post('/api/screen/cancel-schedule-publish', data)
}
