import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '@/api/user'

export const useUserStore = defineStore('user', () => {
  // 状态
  // token 不再存入 localStorage（C7: httpOnly Cookie 方案，由浏览器自动管理）
  const token = ref('')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))

  // 计算属性
  // token 空不代表未登录，httpOnly Cookie 由浏览器自动携带
  // 通过登录时保存的 userInfo 判断登录状态
  const isLoggedIn = computed(() => !!userInfo.value?.userId)
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
      // Token 由后端通过 httpOnly Cookie 写入，前端不需要手动存
      userInfo.value = {
        userId: res.data.userId,
        userName: res.data.userName,
        name: res.data.name,
        role: res.data.role,
      }
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
    return res
  }

  // 退出
  function logout() {
    token.value = ''
    userInfo.value = {}
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
