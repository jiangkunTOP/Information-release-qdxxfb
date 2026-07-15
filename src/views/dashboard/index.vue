<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Odometer /></el-icon>
      系统概览
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-icon camera"><el-icon size="28"><VideoCamera /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ statistics.cameraOnlineCount }}</div>
          <div class="stat-label">在线摄像头</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon offline"><el-icon size="28"><CloseBold /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ statistics.cameraOfflineCount }}</div>
          <div class="stat-label">离线摄像头</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon server"><el-icon size="28"><Monitor /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ statistics.serverOnlineCount }}</div>
          <div class="stat-label">在线小终端</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon offline"><el-icon size="28"><CloseBold /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ statistics.serverOfflineCount }}</div>
          <div class="stat-label">离线小终端</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon alarm"><el-icon size="28"><WarningFilled /></el-icon></div>
        <div class="stat-body">
          <div class="stat-value">{{ statistics.todayAlarmCount }}</div>
          <div class="stat-label">今日告警</div>
        </div>
      </div>
    </div>

    <!-- 两列布局 -->
    <div class="dashboard-grid">
      <!-- 左：系统状态 -->
      <div class="page-card">
        <div class="card-title">系统状态</div>
        <div class="status-list">
          <div class="status-item">
            <span class="status-label">数据库连接状态</span>
            <div class="status-right">
              <el-tag :type="systemStatus.databaseStatus === '正常' ? 'success' : 'danger'" size="small">
                {{ systemStatus.databaseStatus }}
              </el-tag>
              <span class="status-latency">{{ systemStatus.databaseLatency }}</span>
            </div>
          </div>
          <div class="status-item">
            <span class="status-label">WebSocket 服务</span>
            <div class="status-right">
              <el-tag :type="systemStatus.websocketStatus === '正常' ? 'success' : 'danger'" size="small">
                {{ systemStatus.websocketStatus }}
              </el-tag>
              <span class="status-latency">{{ systemStatus.websocketLatency }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：近期告警 -->
      <div class="page-card">
        <div class="card-title">
          近期告警
          <el-button v-if="!userStore.isAuditor" link type="primary" size="small" @click="$router.push('/alarm')" style="margin-left: auto;">查看更多</el-button>
          <span v-else style="margin-left: auto; color: #909399; font-size: 12px;">仅展示近期</span>
        </div>
        <div v-if="recentAlarms.length === 0" class="empty-tip">暂无告警</div>
        <div v-else class="alarm-list">
          <div v-for="item in recentAlarms" :key="item.id" class="alarm-item">
            <div class="alarm-top">
              <span class="alarm-device">{{ item.equipmentName || '未知设备' }}</span>
              <el-tag
                :type="item.alarmLevel === 'HIGH' ? 'danger' : item.alarmLevel === 'MEDIUM' ? 'warning' : 'info'"
                size="small"
              >
                {{ item.alarmLevel === 'HIGH' ? '高' : item.alarmLevel === 'MEDIUM' ? '中' : '低' }}
              </el-tag>
            </div>
            <div class="alarm-content">{{ item.alarmContent }}</div>
            <div class="alarm-time">{{ item.createdDate }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Odometer, Monitor, VideoCamera, CloseBold, WarningFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'

const userStore = useUserStore()

const statistics = reactive({
  cameraOnlineCount: 0,
  cameraOfflineCount: 0,
  serverOnlineCount: 0,
  serverOfflineCount: 0,
  onlineCount: 0,
  offlineCount: 0,
  todayAlarmCount: 0
})

const systemStatus = reactive({
  databaseStatus: '检测中',
  databaseLatency: '-',
  websocketStatus: '检测中',
  websocketLatency: '-',
  websocketOnlineCount: 0
})

const recentAlarms = ref([])

async function fetchStatistics() {
  try {
    const res = await request.get('/api/dashboard/statistics')
    if (res.code === 0 && res.data) {
      statistics.cameraOnlineCount = res.data.cameraOnlineCount || 0
      statistics.cameraOfflineCount = res.data.cameraOfflineCount || 0
      statistics.serverOnlineCount = res.data.serverOnlineCount || 0
      statistics.serverOfflineCount = res.data.serverOfflineCount || 0
      statistics.onlineCount = res.data.onlineCount || 0
      statistics.offlineCount = res.data.offlineCount || 0
      statistics.todayAlarmCount = res.data.todayAlarmCount || 0
    }
  } catch (e) {
    console.error('获取统计数据失败', e)
  }
}

async function fetchSystemStatus() {
  try {
    const res = await request.get('/api/dashboard/system-status')
    if (res.code === 0 && res.data) {
      systemStatus.databaseStatus = res.data.databaseStatus || '异常'
      systemStatus.databaseLatency = res.data.databaseLatency || '-'
      systemStatus.websocketStatus = res.data.websocketStatus || '异常'
      systemStatus.websocketLatency = res.data.websocketLatency || '-'
      systemStatus.websocketOnlineCount = res.data.websocketOnlineCount || 0
    }
  } catch (e) {
    console.error('获取系统状态失败', e)
    systemStatus.databaseStatus = '异常'
    systemStatus.databaseLatency = '-'
    systemStatus.websocketStatus = '异常'
    systemStatus.websocketLatency = '-'
    systemStatus.websocketOnlineCount = 0
  }
}

async function fetchRecentAlarms() {
  try {
    const res = await request.get('/api/dashboard/recent-alarms')
    if (res.code === 0 && res.data) {
      recentAlarms.value = res.data
    }
  } catch (e) {
    console.error('获取近期告警失败', e)
  }
}

onMounted(() => {
  fetchStatistics()
  fetchSystemStatus()
  fetchRecentAlarms()
})
</script>

<style scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

/* 统计卡片 */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 22px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1px solid #edf2f7;
  transition: all 0.25s;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(43,108,176,0.08);
  transform: translateY(-2px);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.stat-icon.camera { background: linear-gradient(135deg, #48bb78, #68d391); }
.stat-icon.server { background: linear-gradient(135deg, #48bb78, #68d391); }
.stat-icon.offline { background: linear-gradient(135deg, #f56565, #fc8181); }
.stat-icon.alarm { background: linear-gradient(135deg, #e6a23c, #f4d19b); }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

/* 网格布局 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
}

.page-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1px solid #edf2f7;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

/* 系统状态 */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fc;
  border-radius: 6px;
}

.status-label {
  font-size: 14px;
  color: #606266;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-latency {
  font-size: 13px;
  color: #909399;
  font-family: 'Courier New', monospace;
}

/* 近期告警 */
.empty-tip {
  text-align: center;
  color: #c0c4cc;
  padding: 40px 0;
  font-size: 14px;
}

.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.alarm-item {
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  transition: background 0.2s;
}

.alarm-item:hover {
  background: #f5f7fa;
}

.alarm-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.alarm-device {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.alarm-content {
  font-size: 13px;
  color: #606266;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarm-time {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
