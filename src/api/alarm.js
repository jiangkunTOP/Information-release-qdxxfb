import request from '@/utils/request'

/**
 * 分页查询告警列表
 */
export function getAlarmList(data) {
  return request.post('/api/alarm/list', data)
}

/**
 * 获取告警总览统计
 */
export function getAlarmOverview() {
  return request.get('/api/alarm/overview')
}

/**
 * 标记告警为处理中
 */
export function handleAlarm(id, handler) {
  return request.put(`/api/alarm/handle/${id}`, null, {
    params: { handler: handler || 'system' }
  })
}

/**
 * 标记告警为已处理
 */
export function resolveAlarm(id, handler, remark) {
  return request.put(`/api/alarm/resolve/${id}`, null, {
    params: { handler: handler || 'system', remark: remark || '' }
  })
}

/**
 * 一键完成（待处理→已处理）
 */
export function quickResolveAlarm(id, handler, remark) {
  return request.put(`/api/alarm/quick-resolve/${id}`, null, {
    params: { handler: handler || 'system', remark: remark || '' }
  })
}

/**
 * 获取布防告警的抓拍图片预览URL
 */
export function getAlarmSnapshot(id) {
  return request.get(`/api/alarm/snapshot/${id}`)
}
