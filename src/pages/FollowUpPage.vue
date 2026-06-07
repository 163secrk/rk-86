<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { orderApi, followUpApi, type Order, type FollowUp } from '@/lib/api'
import {
  ArrowLeft,
  Clock,
  Phone,
  MapPin,
  User,
  Star,
  Loader2,
  MessageSquareHeart,
  CheckCircle,
  AlertTriangle,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { user, loading: authLoading, requireAuth } = useAuth()

const order = ref<Order | null>(null)
const followUp = ref<FollowUp | null>(null)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const form = reactive({
  attitude_rating: 0,
  quality_rating: 0,
  punctuality_rating: 0,
  feedback: '',
})

const hoverRatings = reactive({
  attitude: 0,
  quality: 0,
  punctuality: 0,
})

const orderId = Number(route.params.orderId)

const stars = [1, 2, 3, 4, 5]

const ratingLabels: Record<number, string> = {
  1: '非常差',
  2: '差',
  3: '一般',
  4: '好',
  5: '非常好',
}

const ratingCategories = [
  { key: 'attitude', label: '服务态度', desc: '家政人员的服务态度是否友好、耐心' },
  { key: 'quality', label: '服务质量', desc: '服务完成的质量是否符合预期' },
  { key: 'punctuality', label: '准时性', desc: '是否按照约定时间准时到达' },
]

function getRatingValue(key: string): number {
  switch (key) {
    case 'attitude':
      return form.attitude_rating
    case 'quality':
      return form.quality_rating
    case 'punctuality':
      return form.punctuality_rating
    default:
      return 0
  }
}

function setRatingValue(key: string, value: number) {
  switch (key) {
    case 'attitude':
      form.attitude_rating = value
      break
    case 'quality':
      form.quality_rating = value
      break
    case 'punctuality':
      form.punctuality_rating = value
      break
  }
}

function getHoverRating(key: string): number {
  switch (key) {
    case 'attitude':
      return hoverRatings.attitude
    case 'quality':
      return hoverRatings.quality
    case 'punctuality':
      return hoverRatings.punctuality
    default:
      return 0
  }
}

function setHoverRating(key: string, value: number) {
  switch (key) {
    case 'attitude':
      hoverRatings.attitude = value
      break
    case 'quality':
      hoverRatings.quality = value
      break
    case 'punctuality':
      hoverRatings.punctuality = value
      break
  }
}

function getRemainingTime(expireAt: string): string {
  const now = new Date().getTime()
  const expire = new Date(expireAt).getTime()
  const diff = expire - now
  if (diff <= 0) return '已过期'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

function isExpired(expireAt: string): boolean {
  return new Date(expireAt) < new Date()
}

onMounted(async () => {
  if (!requireAuth()) return
  if (!orderId || isNaN(orderId)) {
    router.push('/orders')
    return
  }
  await loadData()
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [orderRes, followUpRes] = await Promise.all([
      orderApi.get(orderId),
      followUpApi.getByOrder(orderId),
    ])

    if (orderRes.success && orderRes.data) {
      order.value = orderRes.data
    } else {
      error.value = orderRes.error || '订单不存在'
    }

    if (followUpRes.success && followUpRes.data) {
      followUp.value = followUpRes.data
    }
  } catch (e) {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (form.attitude_rating === 0 || form.quality_rating === 0 || form.punctuality_rating === 0) {
    error.value = '请完成所有评分项'
    return
  }

  if (!followUp.value) {
    error.value = '回访记录不存在'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const res = await followUpApi.submit(followUp.value.id, {
      attitude_rating: form.attitude_rating,
      quality_rating: form.quality_rating,
      punctuality_rating: form.punctuality_rating,
      feedback: form.feedback.trim() || undefined,
    })
    if (res.success) {
      followUp.value = res.data
      router.push('/orders')
    } else {
      error.value = res.error || '提交失败，请重试'
    }
  } catch (e) {
    error.value = '提交失败，请重试'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/orders')
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN')
}

function getOverallRating(): number {
  if (!followUp.value || followUp.value.status !== 'completed') return 0
  const ratings = [
    followUp.value.attitude_rating || 0,
    followUp.value.quality_rating || 0,
    followUp.value.punctuality_rating || 0,
  ]
  return ratings.reduce((a, b) => a + b, 0) / ratings.length
}
</script>

<template>
  <div v-if="authLoading" class="flex justify-center items-center py-20">
    <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>

  <div v-else-if="!user" class="text-center py-20">
    <p class="text-gray-500">请先登录</p>
  </div>

  <div v-else class="max-w-2xl mx-auto space-y-6">
    <div class="flex items-center space-x-4">
      <button
        @click="goBack"
        class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ArrowLeft class="w-5 h-5 text-gray-600" />
      </button>
      <h1 class="text-2xl font-bold text-gray-800">服务回访</h1>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else-if="error && !order" class="text-center py-12 bg-white rounded-xl border">
      <p class="text-red-500">{{ error }}</p>
      <button @click="goBack" class="mt-4 text-blue-600 hover:text-blue-800">
        返回订单列表
      </button>
    </div>

    <div v-else-if="order" class="space-y-6">
      <div v-if="followUp && followUp.status === 'pending' && !isExpired(followUp.expire_at)" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div class="flex items-start space-x-3">
          <AlertTriangle class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-yellow-800">请在有效期内完成回访</p>
            <p class="text-sm text-yellow-600 mt-1">
              回访有效期剩余 <span class="font-semibold">{{ getRemainingTime(followUp.expire_at) }}</span>
            </p>
          </div>
        </div>
      </div>

      <div v-if="followUp && (followUp.status === 'expired' || (followUp.status === 'pending' && isExpired(followUp.expire_at)))" class="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div class="flex items-start space-x-3">
          <AlertTriangle class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-gray-600">回访已过期</p>
            <p class="text-sm text-gray-500 mt-1">
              该订单的回访已超过24小时有效期，无法再提交回访
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">订单信息</h2>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">订单号</span>
            <span class="text-gray-900 font-medium">{{ order.order_no }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">服务项目</span>
            <span class="text-gray-900 font-medium">{{ order.service_name || '-' }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500 flex items-center">
              <User class="w-4 h-4 mr-1" />
              服务人员
            </span>
            <span class="text-gray-900 font-medium">{{ order.worker_name || '-' }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500 flex items-center">
              <Clock class="w-4 h-4 mr-1" />
              预约时间
            </span>
            <span class="text-gray-900 font-medium">{{ formatDate(order.appointment_time) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">服务金额</span>
            <span class="text-gray-900 font-medium">¥{{ order.price }}</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-gray-500 flex items-center">
              <MapPin class="w-4 h-4 mr-1 flex-shrink-0" />
              服务地址
            </span>
            <span class="text-gray-900 font-medium text-right max-w-xs">{{ order.address }}</span>
          </div>
        </div>
      </div>

      <div v-if="followUp && followUp.status === 'completed'" class="bg-white rounded-xl border p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-800 flex items-center">
            <CheckCircle class="w-5 h-5 text-green-500 mr-2" />
            回访已完成
          </h2>
          <div class="text-right">
            <p class="text-sm text-gray-500">综合评分</p>
            <p class="text-3xl font-bold text-yellow-500">{{ getOverallRating().toFixed(1) }}</p>
          </div>
        </div>

        <div class="space-y-6">
          <div
            v-for="category in ratingCategories"
            :key="category.key"
            class="p-4 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-gray-700">{{ category.label }}</span>
              <span class="text-yellow-500 font-semibold">
                ★ {{ followUp[`${category.key}_rating` as keyof FollowUp] }}
              </span>
            </div>
            <div class="flex space-x-1">
              <Star
                v-for="star in stars"
                :key="star"
                class="w-5 h-5"
                :class="[
                  star <= (followUp[`${category.key}_rating` as keyof FollowUp] as number)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300',
                ]"
              />
            </div>
          </div>
        </div>

        <div v-if="followUp.feedback" class="mt-6 pt-6 border-t">
          <h3 class="font-medium text-gray-700 mb-2">文字反馈</h3>
          <p class="text-gray-600 bg-gray-50 p-4 rounded-lg">{{ followUp.feedback }}</p>
        </div>

        <div class="mt-4 text-xs text-gray-400 text-right">
          回访时间：{{ formatDate(followUp.completed_at!) }}
        </div>
      </div>

      <div
        v-else-if="followUp && followUp.status === 'pending' && !isExpired(followUp.expire_at)"
        class="bg-white rounded-xl border p-6"
      >
        <h2 class="text-lg font-semibold text-gray-800 mb-2 flex items-center">
          <MessageSquareHeart class="w-5 h-5 text-blue-500 mr-2" />
          服务回访
        </h2>
        <p class="text-sm text-gray-500 mb-6">
          请对本次服务进行评价，您的反馈将帮助我们提升服务质量
        </p>

        <div class="space-y-6">
          <div
            v-for="category in ratingCategories"
            :key="category.key"
            class="p-4 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <span class="font-medium text-gray-700">{{ category.label }}</span>
                <p class="text-xs text-gray-400 mt-0.5">{{ category.desc }}</p>
              </div>
              <span
                v-if="getRatingValue(category.key) > 0"
                class="text-yellow-500 font-semibold"
              >
                {{ ratingLabels[getRatingValue(category.key)] }} ({{ getRatingValue(category.key) }}星)
              </span>
            </div>
            <div class="flex space-x-2">
              <button
                v-for="star in stars"
                :key="star"
                type="button"
                @click="setRatingValue(category.key, star)"
                @mouseenter="setHoverRating(category.key, star)"
                @mouseleave="setHoverRating(category.key, 0)"
                class="focus:outline-none transition-transform hover:scale-110"
                :disabled="submitting"
              >
                <Star
                  class="w-8 h-8 transition-colors"
                  :class="[
                    (getHoverRating(category.key) || getRatingValue(category.key)) >= star
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300',
                  ]"
                />
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            文字反馈 <span class="text-gray-400">(选填)</span>
          </label>
          <textarea
            v-model="form.feedback"
            rows="4"
            placeholder="请分享您的服务体验，帮助我们改进服务质量..."
            class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
            :disabled="submitting"
            maxlength="500"
          ></textarea>
          <p class="text-xs text-gray-400 text-right mt-1">{{ form.feedback.length }}/500</p>
        </div>

        <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{{ error }}</p>
        </div>

        <div class="mt-6 space-y-3">
          <button
            @click="handleSubmit"
            :disabled="form.attitude_rating === 0 || form.quality_rating === 0 || form.punctuality_rating === 0 || submitting"
            class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
            <span>{{ submitting ? '提交中...' : '提交回访' }}</span>
          </button>
          <button
            @click="goBack"
            :disabled="submitting"
            class="w-full py-3 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
