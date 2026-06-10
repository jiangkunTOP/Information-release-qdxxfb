import request from '@/utils/request'

// 内容发布列表（分页）
export function getContentList(data) {
  return request.post('/api/content/list', data)
}

// 内容发布详情
export function getContentDetail(id) {
  return request.get('/api/content/detail', { params: { id } })
}

// 新增内容发布
export function addContent(data) {
  return request.post('/api/content/add', data)
}

// 修改内容发布
export function updateContent(data) {
  return request.post('/api/content/update', data)
}

// 删除内容发布
export function deleteContent(data) {
  return request.post('/api/content/delete', data)
}

// 上传文件
export function uploadFile(data) {
  return request.post('/api/content/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// 获取预览地址
export function getPreviewUrl(objectName) {
  return request.get('/api/content/preview-url', { params: { objectName } })
}

// 获取下载地址
export function getDownloadUrl(objectName) {
  return request.get('/api/content/download-url', { params: { objectName } })
}

// 发布内容
export function publishContent(data) {
  return request.post('/api/content/publish', data)
}

// 下架内容
export function unpublishContent(data) {
  return request.post('/api/content/unpublish', data)
}
