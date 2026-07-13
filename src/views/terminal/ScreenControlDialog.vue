<template>
  <el-dialog
    v-model="visible"
    :title="`设备控制 — ${terminalName}`"
    width="700px"
    :close-on-click-modal="false"
    @open="initData"
    @closed="handleClosed"
  >
    <!-- 即时控制 -->
    <div style="margin-bottom:20px;">
      <div style="font-size:14px;font-weight:bold;margin-bottom:10px;">即时控制</div>
      <el-button type="danger" :loading="ctrlLoading" @click="handleControl('screen_off')" plain>
        <el-icon style="margin-right:4px;"><Monitor /></el-icon>息屏
      </el-button>
      <el-button type="success" :loading="ctrlLoading" @click="handleControl('screen_on')" plain>
        <el-icon style="margin-right:4px;"><View /></el-icon>唤醒
      </el-button>
    </div>

    <!-- 定时规则 -->
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:14px;font-weight:bold;">定时亮屏规则</span>
        <el-button type="primary" size="small" @click="openAddDialog">新增规则</el-button>
      </div>

      <el-table :data="scheduleList" style="width:100%;" size="small" max-height="320">
        <el-table-column prop="ruleType" label="类型" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.ruleType === 'fulltime'" size="small">全天</el-tag>
            <el-tag v-else-if="row.ruleType === 'daily'" type="success" size="small">每天</el-tag>
            <el-tag v-else-if="row.ruleType === 'weekly'" type="warning" size="small">每周</el-tag>
            <el-tag v-else-if="row.ruleType === 'date'" type="info" size="small">指定日期</el-tag>
            <span v-else>{{ row.ruleType }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="daysOfWeek" label="生效日" width="120">
          <template #default="{ row }">
            <span v-if="row.ruleType === 'weekly'">{{ formatDaysOfWeek(row.daysOfWeek) }}</span>
            <span v-else-if="row.ruleType === 'date'">{{ row.specifyDate }}</span>
            <span v-else style="color:#909399;">—</span>
          </template>
        </el-table-column>
        <el-table-column label="亮屏时段" width="130">
          <template #default="{ row }">
            {{ row.startTime }} — {{ row.endTime }}
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="60">
          <template #default="{ row }">
            <el-tag v-if="row.enabled === 1" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">禁用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑 子对话框 -->
    <el-dialog
      :title="scheduleForm.id ? '编辑定时规则' : '新增定时规则'"
      v-model="scheduleDialogVisible"
      width="480px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form :model="scheduleForm" :rules="scheduleRules" ref="scheduleFormRef" label-width="100px">
        <el-form-item label="规则类型" prop="ruleType">
          <el-select v-model="scheduleForm.ruleType" placeholder="选择类型" style="width:100%;">
            <el-option label="全天" value="fulltime" />
            <el-option label="每天" value="daily" />
            <el-option label="每周" value="weekly" />
            <el-option label="指定日期" value="date" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效星期" prop="daysOfWeek" v-if="scheduleForm.ruleType === 'weekly'">
          <el-checkbox-group v-model="weeklyDays">
            <el-checkbox label="1">周一</el-checkbox>
            <el-checkbox label="2">周二</el-checkbox>
            <el-checkbox label="3">周三</el-checkbox>
            <el-checkbox label="4">周四</el-checkbox>
            <el-checkbox label="5">周五</el-checkbox>
            <el-checkbox label="6">周六</el-checkbox>
            <el-checkbox label="7">周日</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="指定日期" prop="specifyDate" v-if="scheduleForm.ruleType === 'date'">
          <el-date-picker v-model="scheduleForm.specifyDate" type="date" placeholder="选择日期" style="width:100%;" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-time-picker v-model="scheduleForm.startTime" format="HH:mm" placeholder="开始时间" style="width:100%;" />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-time-picker v-model="scheduleForm.endTime" format="HH:mm" placeholder="结束时间" style="width:100%;" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="scheduleForm.remark" placeholder="备注（可选）" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="scheduleLoading" @click="submitSchedule">确认</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, View } from '@element-plus/icons-vue'
import request from '@/utils/request'

const props = defineProps({
  terminalId: { type: String, default: '' },
  terminalName: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const visible = ref(false)
const ctrlLoading = ref(false)
const scheduleList = ref([])
const scheduleLoading = ref(false)
const scheduleDialogVisible = ref(false)
const scheduleFormRef = ref(null)
const weeklyDays = ref([])

const defaultScheduleForm = {
  id: '',
  terminalId: '',
  ruleType: 'daily',
  daysOfWeek: '',
  specifyDate: null,
  startTime: '',
  endTime: '',
  remark: '',
}

const scheduleForm = reactive({ ...defaultScheduleForm })

const scheduleRules = {
  ruleType: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
}

function show() {
  visible.value = true
}

function initData() {
  scheduleForm.terminalId = props.terminalId
  fetchSchedules()
}

function handleClosed() {
  emit('close')
}

async function fetchSchedules() {
  try {
    const res = await request.post('/api/terminal/screen-schedule/list', { terminalId: props.terminalId })
    if (res.code === 0) {
      scheduleList.value = res.data || []
    }
  } catch (e) {
    console.error('[ScreenControl] 查询规则失败', e)
  }
}

async function handleControl(action) {
  ctrlLoading.value = true
  try {
    const res = await request.post('/api/terminal/screen-control', {
      terminalId: props.terminalId,
      action,
    })
    if (res.code === 0) {
      ElMessage.success({ message: res.message || (action === 'screen_off' ? '息屏指令已下发' : '唤醒指令已下发'), duration: 2000 })
    } else {
      ElMessage.error({ message: res.message || '控制失败', duration: 3000 })
    }
  } catch (e) {
    ElMessage.error({ message: '网络错误', duration: 3000 })
  } finally {
    ctrlLoading.value = false
  }
}

function openAddDialog() {
  Object.assign(scheduleForm, { ...defaultScheduleForm, terminalId: props.terminalId })
  weeklyDays.value = []
  scheduleDialogVisible.value = true
}

function openEditDialog(row) {
  Object.assign(scheduleForm, {
    id: row.id,
    terminalId: row.terminalId,
    ruleType: row.ruleType,
    daysOfWeek: row.daysOfWeek || '',
    specifyDate: row.specifyDate || null,
    startTime: row.startTime,
    endTime: row.endTime,
    remark: row.remark || '',
  })
  // 将字符串时间转换为 Date 对象（el-time-picker 需要 Date 才能正常渲染）
  if (row.startTime && typeof row.startTime === 'string' && /^\d{2}:\d{2}$/.test(row.startTime)) {
    const [h, m] = row.startTime.split(':')
    const d = new Date()
    d.setHours(parseInt(h), parseInt(m), 0, 0)
    scheduleForm.startTime = d
  }
  if (row.endTime && typeof row.endTime === 'string' && /^\d{2}:\d{2}$/.test(row.endTime)) {
    const [h, m] = row.endTime.split(':')
    const d = new Date()
    d.setHours(parseInt(h), parseInt(m), 0, 0)
    scheduleForm.endTime = d
  }
  if (row.ruleType === 'weekly' && row.daysOfWeek) {
    weeklyDays.value = row.daysOfWeek.split(',')
  } else {
    weeklyDays.value = []
  }
  scheduleDialogVisible.value = true
}

async function submitSchedule() {
  const valid = await scheduleFormRef.value.validate().catch(() => false)
  if (!valid) return

  // 格式化时间为 HH:mm 字符串（el-time-picker 返回 Date，后端需要 HH:mm）
  function fmtTime(v) {
    if (!v) return ''
    if (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) return v
    if (v instanceof Date && !isNaN(v)) {
      return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0')
    }
    return String(v)
  }
  // 组装参数
  const payload = {
    id: scheduleForm.id || undefined,
    terminalId: props.terminalId,
    ruleType: scheduleForm.ruleType,
    daysOfWeek: scheduleForm.ruleType === 'weekly' ? weeklyDays.value.join(',') : '',
    specifyDate: scheduleForm.ruleType === 'date' ? scheduleForm.specifyDate : null,
    startTime: fmtTime(scheduleForm.startTime),
    endTime: fmtTime(scheduleForm.endTime),
    remark: scheduleForm.remark || '',
  }

  scheduleLoading.value = true
  try {
    const api = scheduleForm.id ? '/api/terminal/screen-schedule/update' : '/api/terminal/screen-schedule/add'
    const res = await request.post(api, payload)
    if (res.code === 0) {
      ElMessage.success({ message: res.message || '操作成功', duration: 2000 })
      scheduleDialogVisible.value = false
      fetchSchedules()
    } else {
      ElMessage.error({ message: res.message || '操作失败', duration: 3000 })
    }
  } catch (e) {
    ElMessage.error({ message: '网络错误', duration: 3000 })
  } finally {
    scheduleLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除这条定时规则？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    const res = await request.post('/api/terminal/screen-schedule/delete', { id: row.id })
    if (res.code === 0) {
      ElMessage.success({ message: res.message || '删除成功', duration: 2000 })
      fetchSchedules()
    } else {
      ElMessage.error({ message: res.message || '删除失败', duration: 3000 })
    }
  } catch (e) {
    ElMessage.error({ message: '网络错误', duration: 3000 })
  }
}

function formatDaysOfWeek(str) {
  if (!str) return ''
  const map = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日' }
  return str.split(',').map(d => '周' + (map[d] || d)).join('、')
}

// 暴露 show 方法给父组件
defineExpose({ show })
</script>
