import request from '@/utils/request'

// 审计日志列表（分页）
export function getAuditList(data) {
  return request.post('/api/audit/list', data)
}

// 导出审计日志
export function exportAudit(data) {
  return request.post('/api/audit/export', data, { responseType: 'blob' })
}
