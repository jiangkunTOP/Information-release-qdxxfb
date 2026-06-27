import request from '@/utils/request'

// ==================== 网关管理 ====================

// 获取在线终端列表
export function getGatewayTerminals() {
  return request.get('/api/gateway/terminals')
}

// 获取终端详情
export function getGatewayTerminalDetail(deviceId) {
  return request.get('/api/gateway/terminals/' + deviceId)
}

// 获取网关统计指标
export function getGatewayMetrics() {
  return request.get('/api/gateway/metrics')
}

// 下发指令到终端
export function sendGatewayCommand(deviceId, data) {
  return request.post('/api/gateway/terminals/' + deviceId + '/command', data)
}

// 获取网关同步间隔
export function getGatewayGroupSyncInterval() {
  return request.get('/api/gateway/config/group-sync-interval')
}

// 修改网关同步间隔
export function updateGatewayGroupSyncInterval(intervalMs) {
  return request.put('/api/gateway/config/group-sync-interval', { intervalMs })
}
