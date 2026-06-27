<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="brand">
        <img src="/logo.png" class="brand-logo" alt="logo" />
        <span class="brand-text" v-show="!isCollapsed">信息发布平台</span>
      </div>

      <el-menu
        :default-active="route.path"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
        unique-opened
        class="sidebar-menu"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <template #title>首页</template>
        </el-menu-item>

        <!-- 内容发布（已隐藏）-->

        <!-- 网关管理（M6）：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/gateway">
          <el-icon><Connection /></el-icon>
          <template #title>网关管理</template>
        </el-menu-item>

        <!-- 终端设备分组：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/terminal">
          <el-icon><Monitor /></el-icon>
          <template #title>终端设备分组</template>
        </el-menu-item>

        <!-- 设备心跳：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/heartbeat">
          <el-icon><Connection /></el-icon>
          <template #title>设备心跳</template>
        </el-menu-item>

        <!-- 抓拍回传：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/snapshot">
          <el-icon><Camera /></el-icon>
          <template #title>抓拍回传</template>
        </el-menu-item>

        <!-- 操作审计：管理员 + 审计员 -->
        <el-menu-item v-if="userStore.canAccessAudit" index="/audit">
          <el-icon><Document /></el-icon>
          <template #title>操作审计</template>
        </el-menu-item>

        <!-- 用户管理：仅管理员 -->
        <el-menu-item v-if="userStore.canAccessUser" index="/user">
          <el-icon><UserFilled /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>

        <!-- 异地归档：管理员 + 审计员 -->
        <el-menu-item v-if="userStore.canAccessArchive" index="/archive">
          <el-icon><Files /></el-icon>
          <template #title>异地归档</template>
        </el-menu-item>

        <!-- 大屏发布：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/screen">
          <el-icon><Monitor /></el-icon>
          <template #title>大屏发布</template>
        </el-menu-item>

        <!-- 异常告警：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/alarm">
          <el-icon><WarningFilled /></el-icon>
          <template #title>异常告警</template>
        </el-menu-item>

        <!-- 消息通知：管理员 + 操作员 -->
        <el-menu-item v-if="!userStore.isAuditor" index="/notification">
          <el-icon><Bell /></el-icon>
          <template #title>
            <span>消息通知</span>
            <el-badge v-if="unreadCount > 0" :value="unreadCount" :max="99" class="menu-badge" />
          </template>
        </el-menu-item>
      </el-menu>

      <div class="collapse-btn" @click="isCollapsed = !isCollapsed">
        <el-icon>
          <Fold v-if="!isCollapsed" />
          <Expand v-else />
        </el-icon>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="main-area">
      <!-- 顶部导航 -->
      <header class="navbar">
        <div class="nav-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title && route.meta.title !== '首页'">{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="nav-right">

          <div v-if="!userStore.isAuditor" class="notification-bell" @click="router.push('/notification')" title="消息通知">
            <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" class="notif-badge">
              <el-icon :size="20"><Bell /></el-icon>
            </el-badge>
          </div>

          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" class="user-avatar">{{ avatarText }}</el-avatar>
              <span class="user-name">{{ userStore.userName }}</span>
              <el-icon class="arrow"><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout" style="color: #f56c6c">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 底部 -->
      <footer class="footer">
        版权所有 &copy; {{ new Date().getFullYear() }} 上海具友信息技术有限公司
      </footer>
    </div>

    <div v-if="!userStore.isAuditor && popupNotif" class="notif-popup" @click="handlePopupClick">
      <div class="notif-popup-inner">
        <div class="notif-popup-icon">
          <el-icon :size="18" color="#fff"><WarningFilled /></el-icon>
        </div>
        <div class="notif-popup-body">
          <div class="notif-popup-title">{{ popupNotif.title }}</div>
          <div class="notif-popup-content">{{ popupNotif.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Odometer, FolderOpened, Monitor, Connection, Camera,
  Document, UserFilled, Files, WarningFilled,
  Fold, Expand, CaretBottom, Bell,
} from '@element-plus/icons-vue'
import { getNotificationOverview } from '@/api/notification'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isCollapsed = ref(false)
const unreadCount = ref(0)
let notifWs = null
let wsReconnectTimer = null
let popupTimer = null
/** D12: WebSocket 心跳定时器（每 25s 发 PING） */
let heartbeatTimer = null
const popupNotif = ref(null)

const avatarText = computed(() => {
  const name = userStore.userName
  return name ? name.charAt(0) : 'U'
})

const handleResize = () => {
  if (window.innerWidth < 992) {
    isCollapsed.value = true
  }
}

// ============ 通知 WebSocket ============

function connectNotifWs() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/ws/alarm`

  try {
    notifWs = new WebSocket(wsUrl)
  } catch (e) {
    scheduleReconnect()
    return
  }

  notifWs.onopen = () => {
    // D12: 启动心跳定时器：每 25s 发一次 PING
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
    }
    heartbeatTimer = setInterval(() => {
      if (notifWs && notifWs.readyState === WebSocket.OPEN) {
        notifWs.send('PING')
      }
    }, 25000)
  }

  notifWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'new_notification') {
        // 更新未读数
        unreadCount.value++

        // 弹窗提示
        showPopup({
          title: data.title || '新通知',
          content: data.content || '',
          sourceId: data.sourceId,
          sourceType: data.sourceType,
        })
      }
    } catch (e) {
      // ignore
    }
  }

  notifWs.onclose = () => {
    scheduleReconnect()
  }

  notifWs.onerror = () => {
    try { if (notifWs) notifWs.close() } catch(e) {}
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
  wsReconnectTimer = setTimeout(() => {
    connectNotifWs()
  }, 5000)
}

// ============ 通知弹窗 ============

function showPopup(notif) {
  popupNotif.value = notif
  if (popupTimer) clearTimeout(popupTimer)
  popupTimer = setTimeout(() => {
    popupNotif.value = null
  }, 5000)
}

function handlePopupClick() {
  if (popupTimer) clearTimeout(popupTimer)
  popupNotif.value = null
  router.push('/notification')
}

// ============ 获取未读数 ============

async function fetchUnreadCount() {
  try {
    const res = await getNotificationOverview()
    if (res.code === 0 && res.data) {
      unreadCount.value = res.data.unreadCount || 0
    }
  } catch (err) {
    // ignore
  }
}

// 监听通知标记已读事件（来自 notification 页面的 postMessage）
function onNotifReadChange(event) {
  if (event.data?.type === 'notification_read') {
    fetchUnreadCount()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('message', onNotifReadChange)
  // 审计员无通知功能，不拉取未读数也不连接 WebSocket — 2026-06-11
  if (!userStore.isAuditor) {
    fetchUnreadCount()
    connectNotifWs()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('message', onNotifReadChange)
  if (notifWs) {
    notifWs.onclose = null
    notifWs.close()
    notifWs = null
  }
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
  if (popupTimer) clearTimeout(popupTimer)
  // D12: 清理心跳
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
})

const handleCommand = (command) => {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消',
    }).then(() => {
      userStore.logout()
      router.push('/login')
      ElMessage.success('已退出登录')
    }).catch(() => {})
  }
}
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  height: 100vh;
  background-color: #f0f2f5;
}

/* ---- 侧边栏 ---- */
.sidebar {
  width: var(--sidebar-width);
  background: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  box-shadow: 2px 0 12px rgba(43, 108, 176, 0.06);
  z-index: 100;
  overflow: hidden;

  &.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .brand {
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: linear-gradient(135deg, #f7fafc, #fff);
    border-bottom: 1px solid #e2e8f0;

    .brand-logo {
      height: 36px;
      width: auto;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .brand-text {
      font-size: 16px;
      font-weight: 600;
      margin-left: 12px;
      color: #1a365d;
      white-space: nowrap;
      letter-spacing: 1px;
    }
  }

  .sidebar-menu {
    flex: 1;
    border-right: none;
    padding: 12px 10px;
    --el-menu-base-level-padding: 16px;

    .el-menu-item,
    .el-sub-menu__title {
      height: 42px;
      line-height: 42px;
      margin-bottom: 2px;
      border-radius: 8px;
      color: var(--text-regular);
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        background: var(--color-primary-bg);
        color: var(--color-primary);
      }

      &.is-active {
        background: var(--color-primary-bg);
        color: var(--color-primary);
        font-weight: 600;
      }

      .el-icon {
        font-size: 18px;
      }
    }
  }

  .collapse-btn {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid #edf2f7;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 18px;
    transition: color 0.2s;

    &:hover {
      color: var(--color-primary);
    }
  }

  :deep(.menu-badge .el-badge__content) {
    top: 50%;
    transform: translateY(-50%);
    right: -4px;
  }
}

/* ---- 主区域 ---- */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 顶部导航 */
.navbar {
  height: var(--navbar-height);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  z-index: 10;

  .nav-left {
    flex: 1;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    .notification-bell {
      padding: 6px 10px;
      border-radius: 8px;
      transition: background 0.2s;
      cursor: pointer;

      &:hover {
        background: #f5f7fa;
      }

      :deep(.el-badge__content) {
        top: 6px;
        right: 6px;
        transform: translate(50%, -50%);
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 8px;
      transition: background 0.2s;

      &:hover {
        background: #f5f7fa;
      }

      .user-avatar {
        background: linear-gradient(135deg, #3a7bd5, #00d2ff);
        color: #fff;
        font-size: 14px;
        font-weight: 500;
      }

      .user-name {
        font-size: 14px;
        color: var(--text-primary);
      }

      .arrow {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }
}

/* 内容区 */
.content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  background: var(--bg-page);
}

/* 底部 */
.footer {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-secondary);
  background: #fff;
  border-top: 1px solid var(--border-light);
}

/* WebSocket 通知弹窗 */
.notif-popup {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 9999;
  cursor: pointer;
  animation: slideInRight 0.3s ease;
}

.notif-popup-inner {
  display: flex;
  align-items: flex-start;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 14px 18px;
  min-width: 280px;
  max-width: 380px;
  border-left: 4px solid #f56c6c;
}

.notif-popup-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #f56c6c;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}

.notif-popup-body {
  flex: 1;
  min-width: 0;
}

.notif-popup-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.notif-popup-content {
  font-size: 13px;
  color: #909399;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>

