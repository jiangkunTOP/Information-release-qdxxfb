import request from '@/utils/request'

// 素材库：上传素材（form-data，大文件超时300秒）
export function uploadMaterial(formData) {
  return request.post('/api/material/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
}

// 素材库：分页列表
export function listMaterial(data) {
  return request.post('/api/material/list', data)
}

// 素材库：修改素材（重命名）
export function updateMaterial(data) {
  return request.post('/api/material/update', data)
}

// 素材库：删除素材
export function deleteMaterial(id) {
  return request.post('/api/material/delete', null, { params: { id } })
}
