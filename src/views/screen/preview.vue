<template>
  <div class="preview-root" :style="bgStyle">
    <div v-if="loading" class="loading-text">加载中...</div>
    <div v-else class="preview-canvas" :style="canvasStyle">
      <div v-for="el in elements" :key="el.id" class="preview-element" :style="elementStyle(el)">
        <video v-if="el.type==='video'"
               :src="resolveMediaUrl(el.src)"
               :autoplay="el.autoplay!==false" :loop="el.loop!==false" :muted="el.muted!==false"
               style="width:100%;height:100%;object-fit:contain;display:block;" />
        <img v-else-if="el.type==='image'"
             :src="resolveMediaUrl(el.src)"
             style="width:100%;height:100%;object-fit:contain;display:block;"
             :style="{ opacity: el.opacity ?? 1 }" />
        <div v-else-if="el.type==='carousel'" class="carousel-wrap">
          <img v-for="(img, ci) in (el.images||[])" :key="ci"
               :src="resolveMediaUrl(img)"
               style="width:100%;height:100%;object-fit:contain;position:absolute;left:0;top:0;"
               :style="{ opacity: carouselIdx(el.id)===ci ? 1 : 0, transition: 'opacity .6s' }" />
        </div>
        <div v-else-if="el.type==='text'" class="el-text"
             :style="{ fontSize: el.fontSize+'px', color: el.color, fontWeight: el.bold?'bold':'normal', textAlign: el.textAlign||'center', fontFamily: el.fontFamily||'inherit' }">
          {{ el.content || '' }}
        </div>
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
          <div v-if="weatherData[el.id]" class="weather-inner">
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
import { getScreenDetail } from '@/api/screen'

const route = useRoute()
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
let allCarouselTimers = {}
let clockTimer = null

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

async function fetchWeatherForElement(el) {
  if (el.type !== 'weather' || !el.city) return
  try {
    const res = await fetch('/api/screen/weather?city=' + encodeURIComponent(el.city))
    const data = await res.json()
    if (data.code === 0 && data.data) weatherData[el.id] = data.data
  } catch (e) { /* silent */ }
}

function doScale() {
  const pw = pageWidth.value, ph = pageHeight.value
  if (pw <= 0 || ph <= 0) return
  scale.value = Math.min(window.innerWidth / pw, window.innerHeight / ph)
}

function updateClock() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  currentTimeStr.value = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  currentDateStr.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
}

onMounted(async () => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  window.addEventListener('resize', doScale)

  const id = route.params.id
  if (id) {
    try {
      const res = await getScreenDetail(id)
      if (res.code === 0 && res.data) {
        // 兼容两种数据结构：
        // 新版接口: res.data = ScreenDisplayVO => { data: ScreenDashboard, timestamp, sign }
        // 旧版接口: res.data = ScreenDashboard（直接包含 layoutJson 等字段）
        const raw = res.data
        const d = (raw.data && raw.data.layoutJson !== undefined) ? raw.data : raw
        pageWidth.value = d.pageWidth || 1920
        pageHeight.value = d.pageHeight || 1080
        backgroundColor.value = d.backgroundColor || '#000000'
        backgroundImage.value = d.backgroundImage || ''
        if (d.layoutJson) {
          try { elements.value = JSON.parse(d.layoutJson) || [] } catch (e) { elements.value = [] }
          elements.value.forEach(el => { startCarouselForElement(el) })
          // 并行发起所有天气请求
          await Promise.all(elements.value.map(el => fetchWeatherForElement(el)))
        }
      }
    } catch (e) { /* ignore */ }
  }
  loading.value = false
  setTimeout(doScale, 100)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  Object.values(allCarouselTimers).forEach(t => clearInterval(t))
  window.removeEventListener('resize', doScale)
})
</script>

<style>
.preview-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 1000;
}
.loading-text { color: #999; font-size: 24px; }
.preview-canvas { position: absolute; }
.preview-element { box-sizing: border-box; }
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
.clock-digital { font-weight: bold; letter-spacing: 3px; text-shadow: 0 0 20px currentColor; }
.clock-simple { font-weight: 300; letter-spacing: 2px; }
.clock-flip { display: flex; align-items: center; justify-content: center; gap: 4px; }
.flip-num { display: inline-block; min-width: 0.6em; background: rgba(0,0,0,0.4); border-radius: 4px; padding: 0 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
.flip-sep { opacity: 0.6; }
.clock-date { font-size: 0.4em; opacity: 0.7; margin-top: 4px; text-align: center; }
.el-weather { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.weather-card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 20px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.15); }
.weather-icon-layout { display: flex; align-items: center; gap: 8px; }
.weather-icon { width: 48px; height: 48px; }
.weather-inner { text-align: center; }
.weather-temp { font-size: 1.5em; font-weight: bold; }
.weather-info { font-size: 0.7em; opacity: 0.8; margin-top: 4px; }
</style>
