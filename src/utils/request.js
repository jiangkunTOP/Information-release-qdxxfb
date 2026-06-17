import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 60000,
  withCredentials: true,  // D4: 跨域携带 httpOnly Cookie（与 allowedOriginPatterns + allowCredentials 配合）
})

/**
 * 生成 UUID v4 格式的 traceId
 */
function genTraceId() {
  return (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 生成请求唯一标识 requestId（幂等key）
 * 每次写操作生成唯一UUID，网络重试时浏览器/应用层应复用同一个requestId
 */
function genRequestId() {
  return (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 判断是否为 POST/PUT/PATCH/DELETE 写操作
 */
function isWriteMethod(method) {
  const m = (method || 'get').toLowerCase()
  return ['post', 'put', 'patch', 'delete'].includes(m)
}

// ====================================================================
// D4: 无感刷新核心状态（isRefreshing 并发锁 + 请求重放队列）
// ====================================================================
/** 是否正在刷新 Token */
let isRefreshing = false
/** 等待刷新完成后重放的请求队列 */
let requestsQueue = []

// ====================================================================
// 请求拦截器 - traceId + requestId
// ====================================================================
// 注意：C7 已移除 Authorization Header 手动注入，
//       Token 由浏览器通过 httpOnly Cookie 自动携带。
request.interceptors.request.use(
  (config) => {
    // 写操作注入 X-Trace-Id 和 X-Request-Id（遵循《前后端接口开发统一规范》）
    if (isWriteMethod(config.method)) {
      const traceId = config.headers['X-Trace-Id'] || genTraceId()
      const requestId = config.headers['X-Request-Id'] || genRequestId()
      config.headers['X-Trace-Id'] = traceId
      config.headers['X-Request-Id'] = requestId
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ====================================================================
// 响应拦截器 - 统一错误处理 + D4 无感刷新
// ====================================================================
request.interceptors.response.use(
  (response) => {
    const res = response.data

    // 下载接口返回 blob 时，返回整个 response（前端需要取 Content-Disposition 头）
    if (res instanceof Blob) {
      return response
    }

    // 后端约定: code 为 0 表示成功，非 0 表示失败
    if (res.code !== undefined && res.code !== 0) {
      const code = res.code
      const msg = res.message || '请求失败'

      // 按错误码分段处理
      if (code >= 2001 && code <= 2003) {
        // Token 过期/无效/签名错误
        // 正常情况下 JwtAuthenticationFilter 会拦截并返回 HTTP 401，
        // 这条线走到这里的概率很低（filter 优先于 controller），
        // 但保留兜底逻辑：如果某接口没经过 filter，直接跳登录
        ElMessage.error(msg)
        localStorage.removeItem('userInfo')
        router.push('/login')
      } else if (code === 2004) {
        // 无权限
        ElMessage.error('无权限访问')
      } else if (code === 1004) {
        // 限流
        ElMessage.warning('请求过于频繁，请稍后重试')
      } else if (code >= 1001 && code <= 1006) {
        // 通用参数错误
        ElMessage.error(msg)
      } else if (code >= 5000) {
        // 系统异常
        ElMessage.error('系统繁忙，请稍后重试')
        console.error(`[${res.traceId || '-'}] 系统异常: ${msg}`)
      } else {
        ElMessage.error(msg)
      }

      return Promise.reject(new Error(msg))
    }

    return res
  },
  async (error) => {
    const { config, response } = error

    // ================================================================
    // D4: 无感刷新核心逻辑
    // 当后端返回 HTTP 401（AccessToken 过期）时：
    //   1. 第一个 401 → isRefreshing = true，调 /api/user/refresh
    //   2. 后续并发 401 → 挂起到 requestsQueue
    //   3. 刷新成功 → 消费队列，重放所有挂起请求
    //   4. 刷新失败（RefreshToken 也过期）→ 清空队列，跳登录
    // ================================================================
    if (response?.status === 401 && !config.url.includes('/api/user/refresh')) {
      // 这条路径不走响应拦截器的 error 拦截（防止重复处理），
      // 把 error 信息打印到控制台用于调试
      console.warn('[D4] 捕获 401，启动无感刷新流程:', config.url)

      // 第一个 401 → 发起刷新
      if (!isRefreshing) {
        isRefreshing = true

        try {
          // 调 refresh 接口（浏览器自动携带 refresh_token Cookie）
          // 这个 Cookie 的 path="/api/user/refresh"，仅在此接口携带
          const refreshRes = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/api/user/refresh`,
            {},
            { withCredentials: true }
          )

          // 刷新成功（HTTP 200）
          console.info('[D4] AccessToken 无感刷新成功')

          // 消费请求队列：重放所有在刷新期间挂起的请求
          requestsQueue.forEach(cb => cb())
          requestsQueue = []

          // 重放当前请求（刷新成功后新 Cookie 已经自动写回，浏览器自动携带）
          return request(config)

        } catch (refreshError) {
          // 刷新失败 — RefreshToken 也失效（HTTP 401）
          console.warn('[D4] 刷新失败，双 Token 全部失效:', refreshError.message)

          // 清空等待队列，不再重放任何请求
          requestsQueue = []

          // 清空本地用户信息
          localStorage.removeItem('userInfo')

          // 判断环境：如果是大屏展示页（URL 含 screen/display），静默降级不弹框
          // 否则正常跳登录页
          const isScreenDisplay = window.location.pathname.includes('/screen/display')
          if (isScreenDisplay) {
            // 大屏 7x24 场景：不弹框、不跳转，静默保持现有界面
            console.warn('[D4] 大屏展示模式：双 Token 失效，静默等待手动刷新...')
            // 不抛 Error 也不弹 Toast，保持界面不中断
          } else {
            // 办公端：弹提示 + 跳登录
            ElMessage.error('登录已过期，请重新登录')
            router.push('/login')
          }

          return Promise.reject(refreshError)

        } finally {
          isRefreshing = false
        }
      } else {
        // 已经有刷新在进行中 → 将当前请求挂起到队列
        return new Promise((resolve) => {
          requestsQueue.push(() => resolve(request(config)))
        })
      }
    }

    // ================================================================
    // 非 401 异常处理
    // ================================================================
    if (response) {
      const { status } = response
      switch (status) {
        case 403:
          ElMessage.error('无权限访问')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          ElMessage.error(error.message || '网络错误')
      }
    } else {
      ElMessage.error('网络连接失败，请检查网络')
    }

    return Promise.reject(error)
  }
)

export default request
