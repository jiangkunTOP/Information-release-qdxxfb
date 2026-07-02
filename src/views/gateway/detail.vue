<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Monitor /></el-icon>
      终端详情
      <span style="font-size: 14px; color: #909399; margin-left: 12px;">{{ deviceId }}</span>
    </div>

    <!-- 基本信息和状态 -->
    <div class="page-card">
      <div class="section-title">基本信息</div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="设备 ID">{{ detail.deviceId || '--' }}</el-descriptions-item>
        <el-descriptions-item label="设备名称">{{ detail.deviceName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="IP 地址">{{ detail.ip || '--' }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ detail.version || '--' }}</el-descriptions-item>
        <el-descriptions-item label="在线状态">
          <el-tag :type="detail.online ? 'success' : 'danger'" size="small">
            {{ detail.online ? '在线' : '离线' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="网络延迟">
          {{ detail.latencyMs ?? '--' }} <span style="color:#909399;font-size:12px;">ms</span>
        </el-descriptions-item>
        <el-descriptions-item label="最后心跳">
          {{ formatTime(detail.lastHeartbeatTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="连接时间">
          {{ formatTime(detail.connectedTime) }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 返回按钮 -->
    <div style="margin-top: 20px; text-align: right;">
      <el-button @click="$router.back()">返回列表</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getGatewayTerminalDetail } from '@/api/gateway'

const route = useRoute()
const deviceId = route.params.deviceId || ''
const detail = ref({})
function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function fetchDetail() {
  try {
    const res = await getGatewayTerminalDetail(deviceId)
    if (res.code === 0) {
      detail.value = res.data || {}
    }
  } catch (e) {
    console.error('获取终端详情失败:', e)
  }
}

onMounted(fetchDetail)
</script>

<style scoped>
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}
</style>
