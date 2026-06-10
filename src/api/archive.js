import request from '@/utils/request'

// 归档列表（分页）
export function getArchiveList(params) {
  return request.get('/api/archive/list', { params })
}

// 新建归档
export function createArchive(data) {
  return request.post('/api/archive/create', data)
}

// 修改归档
export function updateArchive(data) {
  return request.post('/api/archive/update', data)
}

// 删除归档
export function deleteArchive(id) {
  return request.post(`/api/archive/delete/${id}`)
}

// 下载归档Excel
// 返回 Blob（前端自行拼文件名）
export function downloadArchive(id) {
  return request.get(`/api/archive/download/${id}`, { responseType: 'blob' }).then(res => {
    // 拦截器返回的是整个 axios response（详见 request.js）
    return res.data
  })
}
