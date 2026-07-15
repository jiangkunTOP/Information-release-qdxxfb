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

    <!-- 定时亮屏规则（每个终端分组只有一条规则） -->
    <div style="margin-bottom:10px;">
      <span style="font-size:14px;font-weight:bold;">定时亮屏规则</span>
    </div>
    <div style="border:1px solid #e4e7ed;border-radius:6px;padding:20px;">
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
        <el-form-item label="开始时间" prop="startTime" v-if="scheduleForm.ruleType !== 'fulltime'">
          <el-time-picker v-model="scheduleForm.startTime" format="HH:mm" placeholder="开始时间" style="width:100%;" />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime" v-if="scheduleForm.ruleType !== 'fulltime'">
          <el-time-picker v-model="scheduleForm.endTime" format="HH:mm" placeholder="结束时间" style="width:100%;" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="scheduleForm.remark" placeholder="备注（可选）" maxlength="200" />
        </el-form-item>
      </el-form>
      <div v-if="scheduleHint" style="margin-top:12px;font-size:12px;color:#909399;">
        {{ scheduleHint }}
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="scheduleLoading" @click="submitSchedule">{{ scheduleForm.id ? '保存规则' : '保存规则' }}</el-button>
      <el-button v-if="scheduleForm.id" type="danger" plain :loading="deleteLoading" @click="handleDelete">重置为全天</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick } from 'vue'
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
const deleteLoading = ref(false)
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
  startTime: [{ required: false, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: false, message: '请选择结束时间', trigger: 'change' }],
}

const scheduleHint = computed(() => {
  const rule = scheduleForm
  if (!rule.ruleType) return ''
  const start = fmtTime(rule.startTime)
  const end = fmtTime(rule.endTime)
  if (rule.ruleType === 'fulltime') return '全天 00:00 — 23:59 亮屏'
  if (rule.ruleType === 'daily') return start && end ? `每天 ${start} — ${end} 亮屏，其余时间黑屏` : ''
  if (rule.ruleType === 'weekly') {
    const dw = weeklyDays.value.length ? formatDaysOfWeek(weeklyDays.value.join(',')) : '?'
    return start && end ? `每周 ${dw} ${start} — ${end} 亮屏，其余时间黑屏` : ''
  }
  if (rule.ruleType === 'date') return rule.specifyDate && start && end ? `${rule.specifyDate} ${start} — ${end} 亮屏` : ''
  return ''
})

function show() {
  visible.value = true
}

function initData() {
  scheduleForm.terminalId = props.terminalId
  fetchCurrentRule()
}

function handleClosed() {
  emit('close')
}

async function fetchCurrentRule() {
  try {
    const res = await request.post('/api/terminal/screen-schedule/list', { terminalId: props.terminalId })
    if (res.code === 0) {
      const list = res.data || []
      // 取第一条启用的规则（每个终端分组只有一条规则）
      const rule = list.find(r => r.enabled === 1) || list[0]
      if (rule) {
        scheduleForm.id = rule.id
        scheduleForm.ruleType = rule.ruleType || 'daily'
        scheduleForm.daysOfWeek = rule.daysOfWeek || ''
        scheduleForm.specifyDate = rule.specifyDate || null
        scheduleForm.remark = rule.remark || ''

        if (rule.startTime && /^\d{2}:\d{2}$/.test(rule.startTime)) {
          const [h, m] = rule.startTime.split(':')
          const d = new Date()
          d.setHours(parseInt(h), parseInt(m), 0, 0)
          scheduleForm.startTime = d
        } else {
          scheduleForm.startTime = ''
        }
        if (rule.endTime && /^\d{2}:\d{2}$/.test(rule.endTime)) {
          const [h, m] = rule.endTime.split(':')
          const d = new Date()
          d.setHours(parseInt(h), parseInt(m), 0, 0)
          scheduleForm.endTime = d
        } else {
          scheduleForm.endTime = ''
        }

        if (rule.ruleType === 'weekly' && rule.daysOfWeek) {
          weeklyDays.value = rule.daysOfWeek.split(',')
        } else {
          weeklyDays.value = []
        }
      } else {
        resetForm()
      }
    } else {
      resetForm()
    }
  } catch (e) {
    console.error('[ScreenControl] 查询规则失败', e)
    resetForm()
  }
}

function resetForm() {
  Object.assign(scheduleForm, { ...defaultScheduleForm, terminalId: props.terminalId })
  weeklyDays.value = []
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

function fmtTime(v) {
  if (!v) return ''
  if (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) return v
  if (v instanceof Date && !isNaN(v)) {
    return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0')
  }
  return String(v)
}

async function submitSchedule() {
  const valid = await scheduleFormRef.value.validate().catch(() => false)
  if (!valid) return

  const payload = {
    id: scheduleForm.id || undefined,
    terminalId: props.terminalId,
    ruleType: scheduleForm.ruleType,
    daysOfWeek: scheduleForm.ruleType === 'weekly' ? weeklyDays.value.join(',') : '',
    specifyDate: scheduleForm.ruleType === 'date' ? scheduleForm.specifyDate : null,
    startTime: scheduleForm.ruleType === 'fulltime' ? '00:00' : fmtTime(scheduleForm.startTime),
    endTime: scheduleForm.ruleType === 'fulltime' ? '23:59' : fmtTime(scheduleForm.endTime),
    remark: scheduleForm.remark || '',
  }

  if (scheduleForm.ruleType !== 'fulltime' && (!payload.startTime || !payload.endTime)) {
    ElMessage.warning('请选择亮屏时段')
    return
  }

  scheduleLoading.value = true
  try {
    const res = await request.post('/api/terminal/screen-schedule/add', payload)
    if (res.code === 0) {
      ElMessage.success({ message: res.message || '保存成功', duration: 2000 })
      fetchCurrentRule()
    } else {
      ElMessage.error({ message: res.message || '保存失败', duration: 3000 })
    }
  } catch (e) {
    ElMessage.error({ message: '网络错误', duration: 3000 })
  } finally {
    scheduleLoading.value = false
  }
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm('重置为全天规则？当前定时规则将被删除', '确认', { type: 'warning' })
  } catch {
    return
  }
  deleteLoading.value = true
  try {
    const res = await request.post('/api/terminal/screen-schedule/delete', { id: scheduleForm.id })
    if (res.code === 0) {
      ElMessage.success({ message: res.message || '已重置为全天', duration: 2000 })
      fetchCurrentRule()
    } else {
      ElMessage.error({ message: res.message || '操作失败', duration: 3000 })
    }
  } catch (e) {
    ElMessage.error({ message: '网络错误', duration: 3000 })
  } finally {
    deleteLoading.value = false
  }
}

function formatDaysOfWeek(str) {
  if (!str) return ''
  const map = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日' }
  return str.split(',').map(d => '周' + (map[d] || d)).join('、')
}

defineExpose({ show })
</script>
