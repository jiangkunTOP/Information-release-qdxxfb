import request from '@/utils/request'

// 终端分组列表（分页）
export function getTerminalList(data) {
  return request.post('/api/terminal/list', data)
}

// 终端详情
export function getTerminalDetail(id) {
  return request.get('/api/terminal/detail', { params: { id } })
}

// 新增终端
export function addTerminal(data) {
  return request.post('/api/terminal/add', data)
}

// 修改终端
export function updateTerminal(data) {
  return request.post('/api/terminal/update', data)
}

// 删除终端
export function deleteTerminal(data) {
  return request.post('/api/terminal/delete', data)
}

// 设备登录（后端接收 @RequestParam，需用 params 传）
export function loginDevice(equipmentId) {
  return request.post('/api/terminal/login', null, { params: { equipmentId } })
}

// 设备登出（后端接收 @RequestParam，需用 params 传）
export function logoutDevice(equipmentId) {
  return request.post('/api/terminal/logout', null, { params: { equipmentId } })
}

// 设备布防
export function armDevice(data) {
  return request.post('/api/terminal/arm', data)
}

// 设备撤防
export function disarmDevice(data) {
  return request.post('/api/terminal/disarm', data)
}
