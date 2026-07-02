import request from '@/utils/request'

/**
 * 分页查询通知列表
 */
export function getNotificationList(pageNum, pageSize) {
  return request.get('/api/notification/list', {
    params: { pageNum, pageSize }
  })
}

/**
 * 通知总览
 */
export function getNotificationOverview() {
  return request.get('/api/notification/overview')
}

/**
 * 标记已读
 */
export function markRead(id) {
  return request.post(`/api/notification/read/${id}`)
}

/**
 * 全部已读
 */
export function markAllRead() {
  return request.post('/api/notification/read-all')
}

/**
 * 最近未读通知
 */
export function getRecentUnread(limit) {
  return request.get('/api/notification/recent-unread', {
    params: { limit: limit || 5 }
  })
}
