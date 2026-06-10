import request from '@/utils/request'

// 抓拍主列表（分页，每行显示设备+最新抓拍预览）
export function getSnapshotList(data) {
  return request.post('/api/snapshot/list', data)
}

// 抓拍历史记录（分页）
export function getSnapshotHistory(data) {
  return request.post('/api/snapshot/history', data)
}

// 单台设备抓拍
export function captureOne(equipmentId) {
  return request.post('/api/snapshot/capture/one', null, { params: { equipmentId } })
}

// 所有设备抓拍
export function captureAll() {
  return request.post('/api/snapshot/capture/all')
}

// 单张抓拍图片下载
export function downloadSnapshot(id) {
  return request({
    url: '/api/snapshot/download/' + id,
    method: 'get',
    responseType: 'blob'
  })
}

// 按设备批量下载
export function downloadBatch(equipmentId) {
  return request.get('/api/snapshot/download/batch/' + equipmentId, { responseType: 'blob' })
}

// 全部下载
export function downloadAll() {
  return request.get('/api/snapshot/download/all', { responseType: 'blob' })
}
