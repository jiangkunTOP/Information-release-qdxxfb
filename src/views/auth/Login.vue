<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-left">
        <div class="welcome">
          <div class="welcome-icon">
            <el-icon :size="48"><Promotion /></el-icon>
          </div>
          <h2>信息发布系统</h2>
          <p>终端信息发布管理平台</p>
          <ul>
            <li>
              <el-icon><FolderOpened /></el-icon>
              内容统一管理发布
            </li>
            <li>
              <el-icon><Monitor /></el-icon>
              终端设备实时监控
            </li>
            <li>
              <el-icon><Camera /></el-icon>
              抓拍回传与审计
            </li>
          </ul>
        </div>
      </div>

      <div class="login-right">
        <div class="form-wrap">
          <div class="form-header">
            <h3>用户登录</h3>
            <p>请输入您的账号信息</p>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            size="large"
            autocomplete="off"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="userName">
              <el-input
                v-model="form.userName"
                placeholder="请输入用户名"
                :prefix-icon="User"
                autocomplete="new-password"
                data-login-field="userName"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                show-password
                autocomplete="new-password"
                data-login-field="password"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                class="login-btn"
                :loading="loading"
                @click="handleLogin"
              >
                登 录
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { User, Lock, Promotion, FolderOpened, Monitor, Camera } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  userName: '',
  password: '',
})

// 页面加载后强制清空浏览器自动填充（浏览器在 DOM 渲染后还会填一次，所以延迟执行）
onMounted(() => {
  setTimeout(() => {
    const pwd = document.querySelector('[data-login-field="password"]')
    const usr = document.querySelector('[data-login-field="userName"]')
    if (pwd) { pwd.value = ''; form.password = '' }
    if (usr) { usr.value = ''; form.userName = '' }
  }, 100)
})

const rules = {
  userName: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      // 手动取输入框真实值，避免浏览器自动填充的脏数据
      const userNameInput = document.querySelector('[data-login-field="userName"]')
      const passwordInput = document.querySelector('[data-login-field="password"]')
      const realUserName = userNameInput ? userNameInput.value : form.userName
      const realPassword = passwordInput ? passwordInput.value : form.password

      const res = await userStore.login({
        userName: realUserName,
        password: realPassword,
      })
      if (res.code === 0) {
        ElMessage.success('登录成功')
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('登录异常:', err)
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
}

.login-card {
  display: flex;
  width: 820px;
  min-height: 480px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.login-left {
  width: 45%;
  background: linear-gradient(135deg, #3a7bd5 0%, #00d2ff 100%);
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;

  .welcome {
    .welcome-icon {
      margin-bottom: 16px;
    }

    h2 {
      font-size: 22px;
      margin-bottom: 8px;
    }

    p {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 40px;
    }

    ul {
      list-style: none;
      padding: 0;

      li {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        margin-bottom: 20px;

        .el-icon {
          font-size: 18px;
          background: rgba(255, 255, 255, 0.2);
          padding: 8px;
          border-radius: 50%;
        }
      }
    }
  }
}

.login-right {
  width: 55%;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .form-wrap {
    width: 100%;
    max-width: 340px;
    margin: 0 auto;

    .form-header {
      margin-bottom: 32px;

      h3 {
        font-size: 22px;
        color: #303133;
        margin-bottom: 8px;
      }

      p {
        font-size: 14px;
        color: #909399;
      }
    }

    .login-btn {
      width: 100%;
      height: 44px;
      font-size: 16px;
      border-radius: 8px;
    }
  }
}
</style>
