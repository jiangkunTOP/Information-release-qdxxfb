import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 60000,
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

// 请求拦截器 - traceId + requestId + Token
request.interceptors.request.use(
  (config) => {
    // 1. Token 注入
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 2. 写操作注入 X-Trace-Id 和 X-Request-Id（遵循《前后端接口开发统一规范》）
    if (isWriteMethod(config.method)) {
      const traceId = config.headers['X-Trace-Id'] || genTraceId()
      const requestId = config.headers['X-Request-Id'] || genRequestId()
      config.headers['X-Trace-Id'] = traceId
      config.headers['X-Request-Id'] = requestId

      // 3. 对于 POST 写操作，后端通过 TraceIdInterceptor 从 Header 和 MDC 获取 traceId，
      //    不走 RequestWrapper 包装；请求体直接发送普通 DTO 对象即可。
    }

    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 统一错误处理
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 后端约定: code 为 0 表示成功，非 0 表示失败
    // 下载接口返回 blob 时，返回整个 response（前端需要取 Content-Disposition 头）
    if (res instanceof Blob) {
      return response
    }
    if (res.code !== undefined && res.code !== 0) {
      // 按照规范错误码分段处理
      const code = res.code
      const msg = res.message || '请求失败'

      if (code >= 2001 && code <= 2003) {
        // Token 过期/无效，跳转登录
        ElMessage.error(msg)
        localStorage.removeItem('token')
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
  (error) => {
    if (error.response) {
      const { status } = error.response
      switch (status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录')
          localStorage.removeItem('token')
          localStorage.removeItem('userInfo')
          router.push('/login')
          break
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
