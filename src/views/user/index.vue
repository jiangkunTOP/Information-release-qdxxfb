<template>
  <div class="page-container">
    <div class="page-title">
      <el-icon><UserFilled /></el-icon>
      用户管理
    </div>

    <!-- 搜索/筛选行 -->
    <div class="filter-bar">
      <div class="filter-bar-left">
        <el-input v-model="query.keyword" placeholder="用户名 / 姓名 / 部门" clearable style="width: 220px;" @keyup.enter="handleSearch" />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-bar-right">
        <el-button type="primary" @click="handleAdd">新增用户</el-button>
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
        <el-table-column type="index" label="序号" width="55" align="center" :resizable="false" />
        <el-table-column prop="userName" label="用户名" min-width="110" align="center" />
        <el-table-column prop="name" label="姓名" min-width="110" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '启用' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色" min-width="120" align="center" />
        <el-table-column prop="dept" label="部门" min-width="130" align="center" show-overflow-tooltip />
        <el-table-column prop="email" label="邮箱" min-width="170" align="center" show-overflow-tooltip />
        <el-table-column label="最后登录时间" min-width="170" align="center">
          <template #default="{ row }">
            {{ row.lastTime || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right" :resizable="false">
          <template #header>
            <span>操作</span>
          </template>
          <template #default="{ row }">
            <template v-if="row.status === '启用'">
              <el-button link type="primary" size="small" @click="handleEdit(row)">修改</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">禁用</el-button>
            </template>
            <template v-else>
              <el-button link type="success" size="small" @click="handleEnable(row)">启用</el-button>
            </template>
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
      :title="isEdit ? '修改用户' : '新增用户'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="用户名" prop="userName" v-if="!isEdit">
          <el-input v-model="form.userName" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="密码" prop="passWord" v-if="!isEdit">
          <el-input v-model="form.passWord" type="password" placeholder="密码" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" placeholder="请选择角色" style="width: 100%">
            <el-option label="系统管理员" value="系统管理员" />
            <el-option label="操作员" value="操作员" />
            <el-option label="审计员" value="审计员" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="dept">
          <el-input v-model="form.dept" placeholder="部门" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="邮箱" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUserList, addUser, updateUser, deleteUser, enableUser } from '@/api/user'
import { UserFilled } from '@element-plus/icons-vue'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
})

const defaultForm = {
  id: '',
  userName: '',
  name: '',
  passWord: '',
  role: '',
  dept: '',
  email: '',
}

const form = reactive({ ...defaultForm })

const formRules = {
  userName: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  passWord: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getUserList({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword,
    })
    if (res.code === 0 && res.data) {
      list.value = res.data.records || []
      total.value = res.data.total || 0
    }
  } catch (err) {
    console.error('获取用户列表失败:', err)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.pageNum = 1
  fetchList()
}

const handleReset = () => {
  query.keyword = ''
  query.pageNum = 1
  fetchList()
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, { ...defaultForm })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    userName: row.userName,
    name: row.name,
    role: row.role,
    dept: row.dept,
    email: row.email,
  })
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要禁用用户「${row.name}」吗？`, '提示', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await deleteUser({ id: row.id })
      if (res.code === 0) {
        ElMessage.success('用户已禁用')
        fetchList()
      }
    } catch (err) {
      console.error('禁用失败:', err)
    }
  }).catch(() => {})
}

const handleEnable = (row) => {
  ElMessageBox.confirm(`确定要启用用户「${row.name}」吗？`, '提示', {
    type: 'info',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      const res = await enableUser({ id: row.id })
      if (res.code === 0) {
        ElMessage.success('用户已启用')
        fetchList()
      }
    } catch (err) {
      console.error('启用失败:', err)
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
      if (isEdit.value) {
        res = await updateUser({
          id: form.id,
          name: form.name,
          role: form.role,
          dept: form.dept,
          email: form.email,
        })
      } else {
        res = await addUser({
          userName: form.userName,
          name: form.name,
          passWord: form.passWord,
          role: form.role,
          dept: form.dept,
          email: form.email,
        })
      }
      if (res.code === 0) {
        ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
        dialogVisible.value = false
        fetchList()
      }
    } catch (err) {
      console.error('提交失败:', err)
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped lang="scss">
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
  gap: 8px;
  flex-wrap: wrap;
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
</style>
