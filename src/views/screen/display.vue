<template>
  <div class="display-root" :style="bgStyle" ref="rootRef">
    <div v-if="safetyFallback" class="safety-fallback">
      <div class="fallback-icon">🔒</div>
      <div class="fallback-text">数据安全校验未通过</div>
      <div class="fallback-sub">请联系系统管理员</div>
    </div>
    <div v-else-if="loading" class="loading-text">加载大屏中...</div>
    <div v-else class="display-canvas" :style="canvasStyle">
      <div v-for="el in elements" :key="el.id" class="display-element" :style="elementStyle(el)">
        <video v-if="el.type==='video'" :src="resolveMediaUrl(el.src)" autoplay playsinline :loop="el.loop!==false" muted style="width:100%;height:100%;object-fit:contain;display:block;" />
        <img v-else-if="el.type==='image'" :src="resolveMediaUrl(el.src)" style="width:100%;height:100%;object-fit:contain;display:block;" :style="{ opacity: el.opacity ?? 1 }" />
        <div v-else-if="el.type==='carousel'" class="carousel-wrap">
          <img v-for="(img, ci) in (el.images||[])" :key="ci" :src="resolveMediaUrl(img)" style="width:100%;height:100%;object-fit:contain;position:absolute;left:0;top:0;" :style="{ opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
        </div>
        <div v-else-if="el.type==='text'" class="el-text" :style="{ fontSize: el.fontSize+'px', color: el.color, fontWeight: el.bold?'bold':'normal', textAlign: el.textAlign||'center', fontFamily: el.fontFamily||'inherit' }">{{ el.content || '' }}</div>
        <div v-else-if="el.type==='html'" class="el-html" v-html="el.html || ''"></div>
        <div v-else-if="el.type==='scrollText'" class="el-scroll-text">
          <div class="scroll-inner" :style="{ fontSize: el.fontSize+'px', color: el.color, fontFamily: el.fontFamily||'inherit', background: el.backgroundColor||'transparent', animationDuration: scrollDuration(el) }">{{ el.content || '' }}</div>
        </div>
        <div v-else-if="el.type==='marquee'" class="el-marquee">
          <div class="marquee-inner" :style="{ fontSize: el.fontSize+'px', color: el.color, fontFamily: el.fontFamily||'inherit', background: el.backgroundColor||'transparent', animationDuration: (el.speed||20)+'s' }" :class="{ 'marquee-left': el.direction!=='right', 'marquee-right': el.direction==='right' }">{{ el.content || '' }}</div>
        </div>
        <div v-else-if="el.type==='clock'" class="el-clock" :style="{ fontSize: el.fontSize+'px', color: el.color, fontFamily: el.fontFamily||'monospace', background: el.backgroundColor||'transparent' }" :class="'clock-'+(el.clockStyle||'digital')">
              <div v-if="el.clockStyle==='simple'" class="clock-simple">{{ currentTimeStr }}</div>
              <div v-else-if="el.clockStyle==='flip'" class="clock-flip"><span class="flip-num">{{ currentTimeStr.slice(0,2) }}</span><span class="flip-sep">:</span><span class="flip-num">{{ currentTimeStr.slice(3,5) }}</span><span class="flip-sep">:</span><span class="flip-num">{{ currentTimeStr.slice(6,8) }}</span></div>
              <div v-else class="clock-digital">{{ currentTimeStr }}</div>
              <div v-if="el.showDate!==false" class="clock-date">{{ currentDateStr }}</div>
            </div>
        <div v-else-if="el.type==='weather'" class="el-weather" :style="{ fontSize: el.fontSize+'px', color: el.color, background: el.backgroundColor||'transparent', fontFamily: el.fontFamily||'inherit' }" :class="'weather-'+(el.weatherStyle||'simple')">
          <div v-if="weatherData[el.id]" class="weather-card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 20px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.15); }
.weather-icon-layout { display: flex; align-items: center; gap: 8px; }
.weather-icon { width: 48px; height: 48px; }
.weather-inner">
            <div v-if="el.weatherStyle==='card'" class="weather-card">
              <div class="weather-temp">{{ weatherData[el.id].temp }}°C</div>
              <div class="weather-info">{{ weatherData[el.id].text }} · {{ el.city||'' }}</div>
            </div>
            <div v-else-if="el.weatherStyle==='icon'" class="weather-icon-layout">
              <img v-if="weatherData[el.id].icon" :src="weatherData[el.id].icon" class="weather-icon" />
              <div><div class="weather-temp">{{ weatherData[el.id].temp }}°C</div><div class="weather-info">{{ weatherData[el.id].text }} · {{ el.city||'' }}</div></div>
            </div>
            <div v-else class="weather-simple">
              <div class="weather-temp">{{ weatherData[el.id].temp }}°C</div>
              <div class="weather-info">{{ weatherData[el.id].text }} · {{ el.city||'' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getLatestPublishedScreen, getScreenDetail } from '@/api/screen'

const route = useRoute()
const rootRef = ref(null)
const loading = ref(true)
const elements = ref([])
const pageWidth = ref(1920)
const pageHeight = ref(1080)
const backgroundColor = ref('#000000')
const backgroundImage = ref('')
const currentTimeStr = ref('')
const currentDateStr = ref('')
const weatherData = reactive({})
const carouselState = reactive({})
const scale = ref(1)
/** 轮播定时器集合 */
let allCarouselTimers = {}
/** 时钟定时器 */
let clockTimer = null
/** 天气轮询定时器 */
let weatherTimer = null
/** 容灾重试定时器 */
let retryTimer = null
/** D12: WebSocket 心跳定时器（每 25s 发 PING） */
let heartbeatTimer = null
/** D12: WebSocket 连接实例（/ws/alarm 告警推送 + 心跳保活） */
let displayWs = null

const bgStyle = computed(() => ({
  backgroundColor: backgroundColor.value,
  backgroundImage: backgroundImage.value ? 'url(' + resolveMediaUrl(backgroundImage.value) + ')' : 'none',
  backgroundSize: '100% 100%',
  backgroundPosition: 'center',
}))

const canvasStyle = computed(() => ({
  width: pageWidth.value + 'px',
  height: pageHeight.value + 'px',
  transform: 'translate(-50%,-50%) scale(' + scale.value + ')',
  transformOrigin: 'center center',
  position: 'absolute',
  left: '50%',
  top: '50%',
}))

function elementStyle(el) {
  return { position: 'absolute', left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px', zIndex: el.zIndex ?? 1, overflow: 'hidden' }
}

function resolveMediaUrl(name) {
  if (!name) return ''
  if (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('data:') || name.startsWith('blob:')) return name
  return '/api/screen/public-preview?objectName=' + encodeURIComponent(name)
}

function carouselIdx(elId) { return carouselState[elId] ?? 0 }

function startCarouselForElement(el) {
  if (el.type !== 'carousel') return
  if (allCarouselTimers[el.id]) clearInterval(allCarouselTimers[el.id])
  if (!carouselState[el.id]) carouselState[el.id] = 0
  const interval = (el.interval || 3) * 1000
  allCarouselTimers[el.id] = setInterval(() => {
    const arr = el.images || []
    if (!arr.length) return
    carouselState[el.id] = (carouselState[el.id] + 1) % arr.length
  }, interval)
}

function scrollDuration(el) { const m = { slow:'40s', medium:'20s', fast:'10s' }; return m[el.speed] || '20s' }

/** 天气组件数据拉取 */
async function fetchWeatherForElement(el) {
  if (el.type !== 'weather' || !el.city) return
  try {
    const res = await fetch('/api/screen/weather?city=' + encodeURIComponent(el.city))
    const data = await res.json()
    if (data.code === 0 && data.data) {
      weatherData[el.id] = data.data
    }
  } catch (e) {
    console.warn('[ScreenDisplay] 天气数据加载失败:', e?.message || e)
  }
}

/** 启动所有天气组件的轮询（30 分钟） */
function startWeatherPolling() {
  stopWeatherPolling()
  weatherTimer = setInterval(() => {
    elements.value.forEach(el => fetchWeatherForElement(el))
  }, 30 * 60 * 1000)
}

function stopWeatherPolling() {
  if (weatherTimer) {
    clearInterval(weatherTimer)
    weatherTimer = null
  }
}

function doScale() {
  const el = rootRef.value
  if (!el) return
  const w = el.clientWidth, h = el.clientHeight
  const pw = pageWidth.value, ph = pageHeight.value
  if (pw <= 0 || ph <= 0 || w <= 0 || h <= 0) return
  scale.value = Math.min(w / pw, h / ph)
}

function updateClock() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  currentTimeStr.value = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  currentDateStr.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
}

/** 时间窗有效期（毫秒），时效校验超时判定为过期重放数据 */
const TIME_WINDOW_MS = 60000

/** 是否已进入安全兜底模式 */
const safetyFallback = ref(false)

/** 加载大屏数据核心逻辑（D9: 双重安全校验 + 重试） */
async function loadScreenData() {
  const id = route.params.id
  try {
    let res
    if (id) {
      res = await getScreenDetail(id)
    } else {
      res = await getLatestPublishedScreen()
    }

    // res 是 axios 响应拦截器 unwrap 后的 Result 对象（{ code, data, message, ... }）
    // code 非 0 时拦截器已 reject，不会走到这里
    const displayData = res?.data   // ScreenDisplayVO { data, timestamp, sign }
    if (!displayData) {
      console.warn('[D9] 大屏数据为空，跳过完整性校验')
      return
    }

    const serverTimestamp = displayData.timestamp
    const serverSign = displayData.sign
    const dashboardData = displayData.data   // 真正的 ScreenDashboard 业务实体

    if (serverTimestamp && serverSign && dashboardData) {
      // 时效校验
      const nowMs = Date.now()
      const diff = Math.abs(nowMs - serverTimestamp)
      if (diff > TIME_WINDOW_MS) {
        console.error(`[D9] ⛔ 时间窗校验失败：时间差 ${diff / 1000}s 超过 ${TIME_WINDOW_MS / 1000}s 上限，数据可能为重放攻击`)
        enterSafetyFallback()
        return
      }
      console.info(`[D9] 时间窗校验通过：时间差 ${diff}ms`)

      // D9: 第二道防线 — 指纹完整性校验（SHA-256）
      const dataJson = JSON.stringify(dashboardData)
      const rawStr = dataJson + serverTimestamp

      try {
        const digestMatch = await verifySha256Hex(rawStr, serverSign)
        if (!digestMatch) {
          console.error('[D9] ⛔ 指纹校验失败：摘要不匹配，数据已被篡改或损坏')
          enterSafetyFallback()
          return
        }
        console.info('[D9] 指纹校验通过：数据完整性验证成功 ✅')
      } catch (cryptoErr) {
        // 浏览器不支持 Web Crypto API 时降级
        console.warn('[D9] 浏览器 Crypto API 不可用，跳过指纹校验:', cryptoErr)
      }

      // 两道防线全部通过，渲染数据
      renderScreenData(dashboardData)
    } else {
      // 旧版接口（无 sign）— 向下兼容
      // 如果是旧版直接返回 ScreenDashboard，res 本身是结果
      console.warn('[D9] 接口未返回完整性字段（timestamp/sign），跳过校验（兼容模式）')
      
      // 判断 res 是谁：旧版 Result.data = ScreenDashboard，新版 Result.data = ScreenDisplayVO
      // 如果 res 本身就是 dashboard（有 layoutJson 字段）
      if (res.layoutJson !== undefined) {
        renderScreenData(res)
      } else {
        renderScreenData(displayData)
      }
    }
  } catch (e) {
    console.warn('[ScreenDisplay] 大屏数据加载失败:', e?.message || e)
    // 容灾重试：防白屏
    if (!elements.value || elements.value.length === 0) {
      console.warn('[ScreenDisplay] 数据加载失败，10 秒后自动重试...')
      retryTimer = setTimeout(() => {
        console.warn('[ScreenDisplay] 正在进行容灾重试...')
        loadScreenData()
      }, 10000)
    }
  }
  loading.value = false
  setTimeout(doScale, 50)
}

/**
 * D9: 使用浏览器原生 Web Crypto API 计算 SHA-256 并比对 Hex 摘要
 *
 * @param {string} rawStr 待哈希的原始字符串（dataJson + timestamp）
 * @param {string} expectedSign 期望的 Hex 摘要值
 * @returns {Promise<boolean>} 是否匹配
 */
async function verifySha256Hex(rawStr, expectedSign) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API 不可用')
  }
  // UTF-8 编码
  const encoder = new TextEncoder()
  const data = encoder.encode(rawStr)
  // SHA-256 摘要
  const digestBuffer = await crypto.subtle.digest('SHA-256', data)
  // ArrayBuffer → Hex string
  const hashArray = Array.from(new Uint8Array(digestBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // 比对
  return hashHex === expectedSign
}

/**
 * D9: 进入安全兜底模式
 * 拒绝渲染任何有毒数据，展示安全占位画面
 */
function enterSafetyFallback() {
  safetyFallback.value = true
  loading.value = true
  console.error('[D9] ⛔ 数据完整性校验未通过，已进入安全兜底模式')
}

/**
 * 渲染大屏数据（将原始 ScreenDashboard 数据渲染到组件）
 */
function renderScreenData(data) {
  if (!data) return
  pageWidth.value = data.pageWidth || 1920
  pageHeight.value = data.pageHeight || 1080
  backgroundColor.value = data.backgroundColor || '#000000'
  backgroundImage.value = data.backgroundImage || ''
  if (data.layoutJson) {
    try { elements.value = JSON.parse(data.layoutJson) || [] } catch (e) { elements.value = [] }
    elements.value.forEach(el => { startCarouselForElement(el) })
    // 非阻塞加载天气
    Promise.all(elements.value.map(el => fetchWeatherForElement(el)))
  }
}

/** 加载大屏背景图（如配置了 backgroundImage） */
async function loadBackgroundMaterial(url) {
  if (!url) return
  try {
    const resp = await fetch(resolveMediaUrl(url), { method: 'HEAD' })
    if (!resp.ok) {
      console.warn('[ScreenDisplay] 背景物料不可达:', url, '状态码:', resp.status)
    }
  } catch (e) {
    console.warn('[ScreenDisplay] 背景物料检查失败:', e?.message || e)
  }
}

// ==================== D12: WebSocket 心跳保活 ====================

/**
 * D12: 大屏端 WebSocket 连接，用于接收告警推送 + 维持心跳保持连接活跃
 * <p>
 * 连接成功后立即启动 25s 周期的 PING 心跳定时器。
 * 断开后自动重连（指数退避）。
 */
function connectDisplayWs() {
  if (displayWs && (displayWs.readyState === WebSocket.OPEN || displayWs.readyState === WebSocket.CONNECTING)) {
    return
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = protocol + '//' + location.host + '/ws/alarm'
  try {
    displayWs = new WebSocket(url)
    displayWs.onopen = function () {
      console.info('[D12] WebSocket 连接建立成功')
      // 启动心跳定时器：每 25s 发一次 PING
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
      }
      heartbeatTimer = setInterval(function () {
        if (displayWs && displayWs.readyState === WebSocket.OPEN) {
          displayWs.send('PING')
        }
      }, 25000)
    }
    displayWs.onmessage = function (event) {
      // PONG 是心跳回复，不需要处理
      if (event.data === 'PONG') {
        return
      }
      // 其他消息是告警推送（JSON），大屏端可以选择静默丢弃或展示
      // 目前不做处理，保持大屏纯净
    }
    displayWs.onerror = function () {
      console.warn('[D12] WebSocket 连接异常')
    }
    displayWs.onclose = function () {
      console.warn('[D12] WebSocket 连接关闭')
      // 清理心跳
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
      displayWs = null
      // 5 秒后自动重连
      setTimeout(connectDisplayWs, 5000)
    }
  } catch (e) {
    console.warn('[D12] WebSocket 创建失败:', e?.message || e)
    setTimeout(connectDisplayWs, 5000)
  }
}

onMounted(async () => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  window.addEventListener('resize', doScale)

  await loadScreenData()

  // 启动天气轮询
  startWeatherPolling()
  // 预检背景物料可用性
  if (backgroundImage.value) {
    loadBackgroundMaterial(backgroundImage.value)
  }
  // D12: 连接 WebSocket（告警推送 + 心跳保活）
  connectDisplayWs()
})

onBeforeUnmount(() => {
  // 清理时钟
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
  // 清理轮播
  Object.values(allCarouselTimers).forEach(t => clearInterval(t))
  allCarouselTimers = {}
  // 清理天气轮询
  stopWeatherPolling()
  // 清理容灾重试
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  // D12: 清理 WebSocket 心跳定时器
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  // D12: 断开 WebSocket 连接
  if (displayWs) {
    displayWs.close()
    displayWs = null
  }
  // 清理 resize 监听
  window.removeEventListener('resize', doScale)
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { width: 100%; height: 100%; overflow: hidden; }
.display-root { width: 100vw; height: 100vh; position: relative; display: flex; align-items: center; justify-content: center; }
.loading-text { color: #999; font-size: 24px; }
.display-canvas { position: absolute; }
.display-element { box-sizing: border-box; }
.carousel-wrap { position: relative; width: 100%; height: 100%; }
.el-text { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 8px; box-sizing: border-box; word-break: break-all; }
.el-html { width: 100%; height: 100%; overflow: auto; }
.el-scroll-text { width: 100%; height: 100%; overflow: hidden; }
.scroll-inner { display: inline-block; white-space: nowrap; animation: scrollText linear infinite; padding: 4px 0; }
@keyframes scrollText { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
.el-marquee { width: 100%; height: 100%; overflow: hidden; white-space: nowrap; }
.marquee-inner { display: inline-block; white-space: nowrap; padding: 4px 0; }
.marquee-left { animation: marqueeLeft linear infinite; }
.marquee-right { animation: marqueeRight linear infinite; }
@keyframes marqueeLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
@keyframes marqueeRight { 0% { transform: translateX(0); } 100% { transform: translateX(100%); } }
.el-clock { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; }
.el-weather { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.weather-card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 20px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.15); }
.weather-icon-layout { display: flex; align-items: center; gap: 8px; }
.weather-icon { width: 48px; height: 48px; }
.weather-inner { text-align: center; }
.weather-temp { font-size: 1.5em; font-weight: bold; }
.weather-info { font-size: 0.7em; opacity: 0.8; margin-top: 4px; }

/* D9: 安全兜底模式 */
.safety-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: #1a1a2e;
  color: #e94560;
  font-family: 'Microsoft YaHei', sans-serif;
}
.fallback-icon { font-size: 64px; margin-bottom: 20px; }
.fallback-text { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
.fallback-sub { font-size: 14px; opacity: 0.7; color: #aaa; }
</style>
