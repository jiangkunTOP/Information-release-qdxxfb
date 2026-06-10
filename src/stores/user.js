import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '@/api/user'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => userInfo.value?.name || userInfo.value?.userName || '')
  const role = computed(() => userInfo.value?.role || '')
  const isAdmin = computed(() => role.value === '系统管理员')
  const isOperator = computed(() => role.value === '操作员')
  const isAuditor = computed(() => role.value === '审计员')

  // 角色辅助
  const canAccessAudit = computed(() => isAdmin.value || isAuditor.value)
  const canAccessArchive = computed(() => isAdmin.value || isAuditor.value)
  const canAccessUser = computed(() => isAdmin.value)

  // 登录
  async function login(loginData) {
    const res = await loginApi(loginData)
    if (res.code === 0 && res.data) {
      token.value = res.data.token
      userInfo.value = {
        userId: res.data.userId,
        userName: res.data.userName,
        name: res.data.name,
        role: res.data.role,
      }
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
    return res
  }

  // 退出
  function logout() {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    userName,
    role,
    isAdmin,
    isOperator,
    isAuditor,
    canAccessAudit,
    canAccessArchive,
    canAccessUser,
    login,
    logout,
  }
})
