import request from '@/utils/request'

// 用户登录
export function login(data) {
  return request.post('/api/user/login', data)
}

// 用户列表（分页）
export function getUserList(data) {
  return request.post('/api/user/list', data)
}

// 用户详情
export function getUserDetail(id) {
  return request.get('/api/user/detail', { params: { id } })
}

// 新增用户
export function addUser(data) {
  return request.post('/api/user/add', data)
}

// 修改用户
export function updateUser(data) {
  return request.post('/api/user/update', data)
}

// 删除用户（逻辑删除）
export function deleteUser(data) {
  return request.post('/api/user/delete', data)
}

// 启用用户
 export function enableUser(data) {
   return request.post('/api/user/enable', data)
 }
