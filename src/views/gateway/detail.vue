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

    <!-- 指令下发 -->
    <div class="page-card" style="margin-top: 16px;">
      <div class="section-title">指令下发</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <el-button type="danger" :loading="cmdLoading" :disabled="!detail.online" @click="sendCmd('reboot')">
          系统重启
        </el-button>
      </div>
      <div v-if="!detail.online" style="margin-top: 8px; color: #909399; font-size: 12px;">
        ⚠ 终端离线，不可下发指令
      </div>
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
import { getGatewayTerminalDetail, sendGatewayCommand } from '@/api/gateway'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const deviceId = route.params.deviceId || ''
const detail = ref({})
const cmdLoading = ref(false)

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

async function sendCmd(command) {
  try {
    await ElMessageBox.confirm(
      `确定对终端 ${deviceId} 执行「系统重启」？此操作将重启终端系统！`,
      '确认指令',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'error' }
    )

    cmdLoading.value = true
    const res = await sendGatewayCommand(deviceId, { command })
    if (res.code === 0) {
      ElMessage.success('指令已下发至网关')
    } else {
      ElMessage.error(res.message || '指令下发失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error('指令下发异常:', e)
    }
  } finally {
    cmdLoading.value = false
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
