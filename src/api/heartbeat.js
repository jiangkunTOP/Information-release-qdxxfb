import request from '@/utils/request'

// 心跳状态列表（分页）
export function getHeartbeatList(data) {
  return request.post('/api/heartbeat/list', data)
}

// 心跳统计（全量）
export function getHeartbeatSummary() {
  return request.get('/api/heartbeat/summary')
}

// 设置心跳间隔
export function setHeartbeatInterval(seconds) {
  return request.post('/api/heartbeat/interval/set', null, { params: { seconds } })
}

// 获取当前心跳间隔
export function getHeartbeatInterval() {
  return request.get('/api/heartbeat/interval/get')
}
