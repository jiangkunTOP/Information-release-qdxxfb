<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><Monitor /></el-icon>
      终端分组
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.keyword" placeholder="设备名称 / IP" clearable style="width: 200px;" />
        <el-select v-model="query.scbj" style="width: 110px;" @change="fetchList">
          <el-option label="未删除" value="0" />
          <el-option label="已删除" value="1" />
          <el-option label="全部" value="" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="handleAdd">新增终端</el-button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="page-card" style="margin-top: 16px;">
      <el-table
        :data="list"
        v-loading="loading"
        stripe
        border
        :resizable="false"
        style="width: 100%;"
        empty-text=""
        max-height="calc(100vh - 280px)"
      >
        <el-table-column prop="equipmentId" label="设备ID" min-width="120" align="center" />
        <el-table-column prop="equipmentName" label="设备名称" min-width="120" align="center" show-overflow-tooltip />
        <el-table-column label="设备类型" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.deviceType === 'server'" type="warning" size="small">小终端</el-tag>
            <el-tag v-else type="primary" size="small">摄像头</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="品牌" min-width="70" align="center">
          <template #default="{ row }">
            <template v-if="row.deviceType === 'server'">—</template>
            <el-tag v-else-if="row.manufacturer === 'dahua'" type="success" size="small">大华</el-tag>
            <el-tag v-else type="info" size="small">海康</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ipAddress" label="设备IP" min-width="130" align="center" />
        <el-table-column prop="port" label="端口" min-width="80" align="center" />
        <el-table-column prop="group" label="分组" min-width="120" align="center" />
        <el-table-column label="最后同步" min-width="160" align="center">
          <template #default="{ row }">
            {{ formatTime(row.lastTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="设备在线状态" min-width="110" align="center" />
        <el-table-column label="设备登录状态" min-width="110" align="center">
          <template #default="{ row }">
            <!-- 小终端不展示登录状态 -->
            <template v-if="row.deviceType === 'server'">—</template>
            <template v-else-if="row.equipmentStatus">
              <el-tag
                :type="row.equipmentStatus === '登录中' ? 'success' : 'info'"
                size="small"
              >
                {{ row.equipmentStatus }}
              </el-tag>
            </template>
            <template v-else>—</template>
          </template>
        </el-table-column>
        <el-table-column label="布防状态" min-width="100" align="center">
          <template #default="{ row }">
            <!-- 小终端不展示布防状态 -->
            <template v-if="row.deviceType === 'server'">—</template>
            <template v-else>
              <el-tag
                v-if="row.alarmStatus === 'ARMED'"
                type="success"
                size="small"
              >布防中</el-tag>
              <el-tag
                v-else-if="row.alarmStatus === 'DISARMED'"
                type="info"
                size="small"
              >已撤防</el-tag>
              <el-tag
                v-else
                type="warning"
                size="small"
              >未布防</el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right" align="center" :resizable="false">
          <template #default="{ row }">
            <!-- 仅摄像头显示登录/登出/布防/撤防 -->
            <template v-if="row.deviceType !== 'server'">
              <el-button
                v-if="row.equipmentStatus !== '登录中'"
                link
                type="primary"
                size="small"
                :disabled="row.status === '离线'"
                @click="handleLogin(row)"
              >登录</el-button>
              <el-button v-if="row.equipmentStatus === '登录中'" link type="warning" size="small" @click="handleLogout(row)">
                登出
              </el-button>
              <!-- 布防 / 撤防 -->
              <el-button
                v-if="row.alarmStatus !== 'ARMED'"
                link
                type="success"
                size="small"
                :disabled="row.status === '离线'"
                @click="handleArm(row)"
              >布防</el-button>
              <el-button
                v-if="row.alarmStatus === 'ARMED'"
                link
                type="danger"
                size="small"
                @click="handleDisarm(row)"
              >撤防</el-button>
            </template>
            <el-button link type="default" size="small" @click="handleView(row)">查看</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">修改</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '修改终端' : '新增终端'"
      width="550px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px">
        <el-form-item label="设备类型" prop="deviceType">
          <el-radio-group v-model="form.deviceType" @change="onDeviceTypeChange">
            <el-radio value="camera">摄像头</el-radio>
            <el-radio value="server">小终端</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="品牌" prop="manufacturer" v-if="form.deviceType === 'camera'">
          <el-radio-group v-model="form.manufacturer" @change="onManufacturerChange">
            <el-radio value="hikvision">海康威视</el-radio>
            <el-radio value="dahua">大华</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="设备名称" prop="equipmentName">
          <el-input v-model="form.equipmentName" placeholder="请输入设备名称" />
        </el-form-item>
        <el-form-item label="设备ID" prop="equipmentId" v-if="!isEdit">
          <el-input v-model="form.equipmentId" placeholder="请输入设备ID" />
        </el-form-item>
        <el-form-item label="IP地址" prop="ipAddress">
          <el-input v-model="form.ipAddress" placeholder="请输入IP地址" />
        </el-form-item>
        <el-form-item label="端口" prop="port">
          <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 200px;" />
        </el-form-item>
        <el-form-item label="登录用户名" prop="equipmentAccount">
          <el-input v-model="form.equipmentAccount" placeholder="设备登录用户名"  />
        </el-form-item>
        <el-form-item label="登录密码" prop="equipmentPassword">
          <el-input v-model="form.equipmentPassword" type="password" placeholder="设备登录密码" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="分组" prop="group">
          <el-input v-model="form.group" placeholder="分组名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 查看详情弹窗 -->
    <el-dialog v-model="viewVisible" title="终端详情" width="500px" :close-on-click-modal="false">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="设备类型">
          <el-tag v-if="viewData.deviceType === 'server'" type="warning" size="small">小终端</el-tag>
          <el-tag v-else type="primary" size="small">摄像头</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="品牌">
          <template v-if="viewData.deviceType === 'server'">—</template>
          <el-tag v-else-if="viewData.manufacturer === 'dahua'" type="success" size="small">大华</el-tag>
          <el-tag v-else type="info" size="small">海康</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="设备ID">{{ viewData.equipmentId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="设备名称">{{ viewData.equipmentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="分组">{{ viewData.group || '-' }}</el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ viewData.ipAddress || '-' }}</el-descriptions-item>
        <el-descriptions-item label="端口">{{ viewData.port || '-' }}</el-descriptions-item>
        <el-descriptions-item label="登录用户名">{{ viewData.equipmentAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="登录密码">{{ viewData.equipmentPassword || '-' }}</el-descriptions-item>
        <el-descriptions-item label="设备在线状态">{{ viewData.status || '-' }}</el-descriptions-item>
        <el-descriptions-item label="设备登录状态">
          {{ viewData.deviceType === 'server' ? '-' : (viewData.equipmentStatus || '-') }}
        </el-descriptions-item>
        <el-descriptions-item label="布防状态">
          {{ viewData.deviceType === 'server' ? '-' : (viewData.alarmStatus === 'ARMED' ? '布防中' : viewData.alarmStatus === 'DISARMED' ? '已撤防' : '未布防') }}
        </el-descriptions-item>
        <el-descriptions-item label="最近在线时间">{{ formatTime(viewData.lastTime) }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="viewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTerminalList, getTerminalDetail, addTerminal, updateTerminal, deleteTerminal, loginDevice, logoutDevice, armDevice, disarmDevice } from '@/api/terminal'
import { Monitor } from '@element-plus/icons-vue'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

// 自动刷新
let autoRefreshTimer = null
const AUTO_REFRESH_INTERVAL = 5000 // 5秒

onUnmounted(() => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
})
const dialogVisible = ref(false)
const viewVisible = ref(false)
const viewData = ref({})
const isEdit = ref(false)
const formRef = ref(null)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  scbj: '0',
})

const defaultForm = {
  id: '',
  equipmentId: '',
  equipmentName: '',
  deviceType: 'camera',
  manufacturer: 'hikvision',
  ipAddress: '',
  port: 22,
  equipmentAccount: '',
  equipmentPassword: '',
  group: '',
}

const form = reactive({ ...defaultForm })

const formRules = {
  equipmentName: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  equipmentId: [{ required: true, message: '请输入设备ID', trigger: 'blur' }],
  ipAddress: [{ required: true, message: '请输入IP地址', trigger: 'blur' }],
}

const fetchList = async (isManual = false) => {
  if (isManual) loading.value = true
  try {
    const res = await getTerminalList({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword,
      scbj: query.scbj,
    })
    if (res.code === 0 && res.data) {
      list.value = res.data.records || res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取终端列表失败:', err)
  } finally {
    if (isManual) loading.value = false
  }
}

function formatTime(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const handleSearch = () => {
  query.pageNum = 1
  fetchList(true)
}

const handleReset = () => {
  query.keyword = ''
  query.scbj = '0'
  query.pageNum = 1
  fetchList(true)
}

const onDeviceTypeChange = (val) => {
  if (val === 'server') {
    form.manufacturer = ''
    form.port = 22
  } else {
    form.manufacturer = 'hikvision'
    form.port = 8000
  }
}

const onManufacturerChange = (val) => {
  if (val === 'dahua') {
    form.port = 37777
  } else if (val === '') {
    form.port = 22
  } else {
    form.port = 8000
  }
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, { ...defaultForm })
  // 新增摄像头默认海康，端口8000
  form.manufacturer = 'hikvision'
  form.port = 8000
  dialogVisible.value = true
}

const handleView = async (row) => {
  try {
    const res = await getTerminalDetail(row.id)
    if (res.code === 0 && res.data) {
      viewData.value = res.data
      viewVisible.value = true
    }
  } catch (err) {
    console.error('获取终端详情失败:', err)
  }
}

const handleEdit = async (row) => {
  isEdit.value = true
  try {
    const res = await getTerminalDetail(row.id)
    if (res.code === 0 && res.data) {
      const d = res.data
      Object.assign(form, {
        id: d.id,
        equipmentId: d.equipmentId,
        equipmentName: d.equipmentName,
        deviceType: d.deviceType || 'camera',
        manufacturer: d.manufacturer || (d.deviceType === 'server' ? '' : 'hikvision'),
        ipAddress: d.ipAddress,
        port: d.port,
        equipmentAccount: d.equipmentAccount,
        equipmentPassword: d.equipmentPassword,
        group: d.group,
      })
    } else {
      Object.assign(form, {
        id: row.id,
        equipmentId: row.equipmentId,
        equipmentName: row.equipmentName,
        deviceType: row.deviceType || 'camera',
        manufacturer: row.manufacturer || (row.deviceType === 'server' ? '' : 'hikvision'),
        ipAddress: row.ipAddress,
        port: row.port,
        equipmentAccount: row.equipmentAccount || '',
        equipmentPassword: row.equipmentPassword || '',
        group: row.group || '',
      })
    }
    dialogVisible.value = true
  } catch (err) {
    console.error('获取终端详情失败:', err)
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除此终端吗？', '提示', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await deleteTerminal({ id: row.id })
      if (res.code === 0) {
        ElMessage.success('删除成功')
        fetchList(true)
      }
    } catch (err) {
      console.error('删除失败:', err)
    }
  }).catch(() => {})
}

const handleLogin = async (row) => {
  try {
    const res = await loginDevice(row.equipmentId)
    if (res.code === 0) {
      ElMessage.success('设备登录成功')
      fetchList(true)
    }
  } catch (err) {
    console.error('设备登录失败:', err)
  }
}

const handleLogout = async (row) => {
  try {
    const res = await logoutDevice(row.equipmentId)
    if (res.code === 0) {
      ElMessage.success('设备登出成功')
      fetchList(true)
    }
  } catch (err) {
    console.error('设备登出失败:', err)
  }
}

const handleArm = async (row) => {
  ElMessageBox.confirm(
    `确定对设备 "${row.equipmentName}" 执行布防吗？${row.equipmentStatus !== '登录中' ? '（设备未登录，将自动先登录再布防）' : ''}`,
    '提示',
    { type: 'info', confirmButtonText: '确定', cancelButtonText: '取消' }
  ).then(async () => {
    try {
      const res = await armDevice({ equipmentId: row.equipmentId })
      if (res.code === 0) {
        ElMessage.success('布防成功，设备已进入监控状态，触发报警时将自动抓拍')
        fetchList(true)
      } else {
        ElMessage.error(res.msg || '布防失败')
      }
    } catch (err) {
      console.error('设备布防失败:', err)
      ElMessage.error(err.message || '设备布防失败')
    }
  }).catch(() => {})
}

const handleDisarm = async (row) => {
  ElMessageBox.confirm(
    `确定对设备 "${row.equipmentName}" 执行撤防吗？`,
    '提示',
    { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
  ).then(async () => {
    try {
      const res = await disarmDevice({ equipmentId: row.equipmentId })
      if (res.code === 0) {
        ElMessage.success('设备撤防成功')
        fetchList(true)
      }
    } catch (err) {
      console.error('设备撤防失败:', err)
      ElMessage.error('设备撤防失败')
    }
  }).catch(() => {})
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      let res
      const payload = {
        equipmentName: form.equipmentName,
        deviceType: form.deviceType,
        manufacturer: form.manufacturer,
        ipAddress: form.ipAddress,
        port: form.port,
        equipmentAccount: form.equipmentAccount,
        equipmentPassword: form.equipmentPassword,
        group: form.group,
      }
      if (isEdit.value) {
        payload.id = form.id
        res = await updateTerminal(payload)
      } else {
        payload.equipmentId = form.equipmentId
        res = await addTerminal(payload)
      }
      if (res.code === 0) {
        ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
        dialogVisible.value = false
        fetchList(true)
      }
    } catch (err) {
      console.error('提交失败:', err)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchList(true)
  // 启动自动刷新（弹窗打开时不刷新，不影响操作）
  autoRefreshTimer = setInterval(() => {
    if (!dialogVisible.value) {
      fetchList()
    }
  }, AUTO_REFRESH_INTERVAL)
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-bar-right {
  display: flex;
  align-items: center;
}

.pagination-bar {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table) {
  font-size: 13px;
  table-layout: fixed;
}

:deep(.el-table .cell) {
  padding-left: 10px;
  padding-right: 10px;
}

:deep(.el-table__empty-text) {
  display: none;
}

.page-card {
  overflow-x: auto;
}
</style>
