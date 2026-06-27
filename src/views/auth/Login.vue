<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-left">
        <div class="welcome">
          <div class="welcome-logo">
            <img src="/logo.png" alt="logo" />
          </div>
          <h2 class="welcome-title">信息发布平台</h2>
          <p class="welcome-en">Information Release Platform</p>
          <div class="welcome-divider"></div>
          <p class="welcome-motto">务本求实 · 明理创新</p>
        </div>
      </div>

      <div class="login-right">
        <div class="form-wrap">
          <div class="form-header">
            <h3>用户登录</h3>
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

          <div class="form-footer">
            <span>首次使用请与管理员联系获取账号</span>
          </div>
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
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  userName: '',
  password: '',
})

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
  background: #f0f4f8;
  padding: 24px;
}

.login-card {
  display: flex;
  width: 860px;
  min-height: 520px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

/* ====== 左侧：学校品牌区 ====== */
.login-left {
  width: 44%;
  background: linear-gradient(160deg, #1a365d 0%, #2b6cb0 50%, #4299e1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  position: relative;
  overflow: hidden;

  /* 背景装饰 */
  &::before {
    content: '';
    position: absolute;
    top: -60%;
    right: -30%;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.03);
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -40%;
    left: -20%;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
  }

  .welcome {
    text-align: center;
    position: relative;
    z-index: 1;
    color: #fff;

    .welcome-logo {
      margin-bottom: 20px;

      img {
        width: auto;
        height: 88px;
        border-radius: 8px;
      }
    }

    .welcome-title {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 3px;
      margin-bottom: 8px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .welcome-en {
      font-size: 12px;
      opacity: 0.5;
      letter-spacing: 2px;
      font-weight: 300;
      text-transform: uppercase;
      margin-bottom: 28px;
    }

    .welcome-divider {
      width: 40px;
      height: 2px;
      background: rgba(255, 255, 255, 0.3);
      margin: 0 auto 20px;
      border-radius: 1px;
    }

    .welcome-motto {
      font-size: 14px;
      opacity: 0.65;
      letter-spacing: 4px;
      font-weight: 300;
    }
  }
}

/* ====== 右侧：登录表单 ====== */
.login-right {
  width: 56%;
  padding: 56px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .form-wrap {
    width: 100%;
    max-width: 360px;
    margin: 0 auto;

    .form-header {
      margin-bottom: 32px;

      h3 {
        font-size: 22px;
        font-weight: 600;
        color: #1a202c;
        margin-bottom: 28px;
      }
    }

    :deep(.el-input__wrapper) {
      border-radius: 8px;
      box-shadow: 0 0 0 1px #e2e8f0 inset;
      transition: box-shadow 0.25s;
      padding: 2px 12px;

      &:hover {
        box-shadow: 0 0 0 1px #4299e1 inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 2px #2b6cb0 inset;
      }
    }

    .login-btn {
      width: 100%;
      height: 46px;
      font-size: 16px;
      font-weight: 500;
      border-radius: 8px;
      background: linear-gradient(135deg, #2b6cb0, #4299e1);
      border: none;
      letter-spacing: 6px;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(43, 108, 176, 0.25);
      }

      &:active {
        transform: translateY(0);
      }
    }

    .form-footer {
      margin-top: 24px;
      text-align: center;

      span {
        font-size: 12px;
        color: #cbd5e0;
      }
    }
  }
}
</style>
