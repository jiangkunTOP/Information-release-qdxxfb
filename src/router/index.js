import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { title: '登录', noAuth: true },
  },
  {
    path: '/',
    component: () => import('@/layout/BaseLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '首页', icon: 'Odometer' },
      },
      // {
      //   path: 'content',
      //   name: 'Content',
      //   component: () => import('@/views/content/index.vue'),
      //   meta: { title: '内容发布', icon: 'FolderOpened', roles: ['系统管理员', '操作员'] },
      // },
      {
        path: 'terminal',
        name: 'Terminal',
        component: () => import('@/views/terminal/index.vue'),
        meta: { title: '终端分组', icon: 'Monitor', roles: ['系统管理员', '操作员'] },
      },
      {
        path: 'heartbeat',
        name: 'Heartbeat',
        component: () => import('@/views/heartbeat/index.vue'),
        meta: { title: '设备心跳', icon: 'Connection', roles: ['系统管理员', '操作员'] },
      },
      {
        path: 'snapshot',
        name: 'Snapshot',
        component: () => import('@/views/snapshot/index.vue'),
        meta: { title: '抓拍回传', icon: 'Camera', roles: ['系统管理员', '操作员'] },
      },
      {
        path: 'audit',
        name: 'Audit',
        component: () => import('@/views/audit/index.vue'),
        meta: { title: '操作审计', icon: 'Document', roles: ['系统管理员', '审计员'] },
      },
      {
        path: 'user',
        name: 'User',
        component: () => import('@/views/user/index.vue'),
        meta: { title: '用户管理', icon: 'UserFilled', roles: ['系统管理员'] },
      },
      {
        path: 'archive',
        name: 'Archive',
        component: () => import('@/views/archive/index.vue'),
        meta: { title: '异地归档', icon: 'Files', roles: ['系统管理员', '审计员'] },
      },
      {
        path: 'alarm',
        name: 'Alarm',
        component: () => import('@/views/alarm/index.vue'),
        meta: { title: '异常告警', icon: 'WarningFilled' },
      },
      {
        path: 'notification',
        name: 'Notification',
        component: () => import('@/views/notification/index.vue'),
        meta: { title: '消息通知', icon: 'Bell', roles: ['系统管理员', '操作员'] },
      },
      // ===== 大屏发布 =====
      {
        path: 'screen',
        name: 'Screen',
        component: () => import('@/views/screen/index.vue'),
        meta: { title: '大屏发布', icon: 'Monitor' },
      },
      {
        path: 'screen/editor/:id?',
        name: 'ScreenEditor',
        component: () => import('@/views/screen/editor.vue'),
        meta: { title: '大屏编辑', icon: 'Edit' },
      },
      {
        path: 'screen/preview/:id',
        name: 'ScreenPreview',
        component: () => import('@/views/screen/preview.vue'),
        meta: { title: '大屏预览', icon: 'View' },
      },
    ],
  },
  // 大屏展示页（独立路由，不在BaseLayout内）
  {
    path: '/display',
    name: 'Display',
    component: () => import('@/views/screen/display.vue'),
    meta: { title: '大屏展示', noAuth: true },
  },
  {
    path: '/display/:id',
    name: 'DisplayById',
    component: () => import('@/views/screen/display.vue'),
    meta: { title: '大屏展示', noAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫 - 未登录跳转登录页
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.noAuth) {
    next()
  } else if (!token) {
    next('/login')
  } else {
    // 角色鉴权
    if (to.meta.roles) {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
      const role = userInfo.role || ''
      if (!to.meta.roles.includes(role)) {
        // 无权限，跳首页
        next('/dashboard')
        return
      }
    }
    next()
  }
})

export default router
