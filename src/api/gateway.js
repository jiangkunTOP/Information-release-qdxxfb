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
