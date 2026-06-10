<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Bell /></el-icon>
      消息通知
    </div>

    <!-- 操作栏 -->
    <div class="filter-bar">
      <el-button type="primary" @click="handleMarkAllRead" :disabled="unreadCount === 0">
        全部已读
      </el-button>
      <span style="margin-left: 12px; color: #909399; font-size: 13px;">
        未读 {{ unreadCount }} 条，共 {{ total }} 条
      </span>
    </div>

    <!-- 通知列表 -->
    <div class="page-card" style="margin-top: 16px;">
      <div v-if="loading" class="empty-state" style="text-align: center; padding: 60px 0;">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>加载中...</p>
      </div>

      <div v-else-if="list.length === 0" class="empty-state" style="text-align: center; padding: 60px 0; color: #c0c4cc;">
        <el-icon :size="48"><Bell /></el-icon>
        <p>暂无通知</p>
      </div>

      <div v-else class="notification-list">
        <div
          v-for="item in list"
          :key="item.id"
          class="notification-item"
          :class="{ unread: item.isRead === '0' }"
          @click="handleMarkRead(item)"
        >
          <div class="notif-dot" v-if="item.isRead === '0'" />
          <div class="notif-icon">
            <el-icon :size="20" :color="item.type === 'ALARM' ? '#f56c6c' : '#409eff'">
              <WarningFilled v-if="item.type === 'ALARM'" />
              <Bell v-else />
            </el-icon>
          </div>
          <div class="notif-body">
            <div class="notif-title">{{ item.title }}</div>
            <div class="notif-content">{{ item.content }}</div>
          </div>
          <div class="notif-time">{{ formatTime(item.createdDate) }}</div>
        </div>
      </div>

      <div class="pagination-bar" v-if="total > 0">
        <el-pagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, WarningFilled, Loading } from '@element-plus/icons-vue'
import { getNotificationList, getNotificationOverview, markRead as apiMarkRead, markAllRead as apiMarkAllRead } from '@/api/notification'

const list = ref([])
const total = ref(0)
const unreadCount = ref(0)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(20)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getNotificationList(pageNum.value, pageSize.value)
    if (res.code === 0 && res.data) {
      list.value = res.data.records || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取通知列表失败:', err)
  } finally {
    loading.value = false
  }
}

const fetchOverview = async () => {
  try {
    const res = await getNotificationOverview()
    if (res.code === 0 && res.data) {
      unreadCount.value = res.data.unreadCount || 0
    }
  } catch (err) {
    console.error('获取通知总览失败:', err)
  }
}

function notifyUnreadChange() {
  window.postMessage({ type: 'notification_read' }, '*')
}

const handleMarkRead = async (item) => {
  if (item.isRead === '1') return
  try {
    await apiMarkRead(item.id)
    item.isRead = '1'
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    notifyUnreadChange()
  } catch (err) {
    console.error('标记已读失败:', err)
  }
}

const handleMarkAllRead = async () => {
  try {
    const res = await apiMarkAllRead()
    if (res.code === 0) {
      list.value.forEach(item => { item.isRead = '1' })
      unreadCount.value = 0
      notifyUnreadChange()
      ElMessage.success('已全部标记已读')
    }
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

function formatTime(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const route = useRoute()

onMounted(() => {
  fetchList()
  fetchOverview()
})

// 路由切换回本页面时重新加载数据（解决切页面空白问题）
watch(
  () => route.path,
  (path) => {
    if (path === '/notification') {
      pageNum.value = 1
      fetchList()
      fetchOverview()
    }
  }
)
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
}

.notification-list {
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: #f5f7fa;
}

.notification-item.unread {
  background: #fef0f0;
}

.notification-item.unread:hover {
  background: #fde2e2;
}

.notif-dot {
  position: absolute;
  left: 8px;
  top: 22px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f56c6c;
}

.notif-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  margin-top: 2px;
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.notif-content {
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif-time {
  flex-shrink: 0;
  font-size: 12px;
  color: #c0c4cc;
  margin-left: 16px;
  white-space: nowrap;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}
</style>

