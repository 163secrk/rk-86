<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { orderApi, reviewApi, type Order } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const { user, loading: authLoading, requireAuth } = useAuth()

const order = ref<Order | null>(null)
const loading = ref(false)
const submitting = ref(false)
const rating = ref(0)
const hoverRating = ref(0)
const content = ref('')
const error = ref('')

const orderId = Number(route.params.orderId)

const stars = [1, 2, 3, 4, 5]

const ratingLabels: Record<number, string> = {
  1: '非常差',
  2: '差',
  3: '一般',
  4: '好',
  5: '非常好',
}

onMounted(async () => {
  if (!requireAuth()) return
  if (!orderId || isNaN(orderId)) {
    router.push('/orders')
    return
  }
  await loadOrder()
})

async function loadOrder() {
  loading.value = true
  error.value = ''
  try {
    const res = await orderApi.get(orderId)
    if (res.success && res.data) {
      order.value = res.data
    } else {
      error.value = res.error || '订单不存在'
    }
  } catch (e) {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

function selectStar(value: number) {
  rating.value = value
}

function hoverStar(value: number) {
  hoverRating.value = value
}

function leaveStar() {
  hoverRating.value = 0
}

async function handleSubmit() {
  if (rating.value === 0) {
    error.value = '请选择评分'
    return
  }
  if (!order.value || !order.value.worker_id) {
    error.value = '订单信息不完整'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const res = await reviewApi.create({
      order_id: orderId,
      worker_id: order.value.worker_id,
      rating: rating.value,
      content: content.value.trim() || undefined,
    })
    if (res.success) {
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
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-gray-800">服务评价</h1>
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
          <div class="flex justify-between">
            <span class="text-gray-500">服务人员</span>
            <span class="text-gray-900 font-medium">{{ order.worker_name || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">预约时间</span>
            <span class="text-gray-900 font-medium">{{ formatDate(order.appointment_time) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">服务金额</span>
            <span class="text-gray-900 font-medium">¥{{ order.price }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">服务地址</span>
            <span class="text-gray-900 font-medium">{{ order.address }}</span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-6">评价服务</h2>

        <div class="text-center mb-8">
          <p class="text-gray-600 mb-4">请为本次服务打分</p>
          <div class="flex justify-center space-x-2 mb-2">
            <button
              v-for="star in stars"
              :key="star"
              type="button"
              @click="selectStar(star)"
              @mouseenter="hoverStar(star)"
              @mouseleave="leaveStar"
              class="focus:outline-none transition-transform hover:scale-110"
            >
              <svg
                class="w-10 h-10 transition-colors"
                :class="[
                  (hoverRating || rating) >= star
                    ? 'text-yellow-400'
                    : 'text-gray-300',
                ]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          </div>
          <p
            v-if="rating > 0"
            class="text-lg font-medium text-yellow-500"
          >
            {{ ratingLabels[rating] }} ({{ rating }}星)
          </p>
          <p v-else class="text-gray-400">点击星星进行评分</p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">
            评价内容 <span class="text-gray-400">(选填)</span>
          </label>
          <textarea
            v-model="content"
            rows="4"
            placeholder="请分享您的服务体验，帮助其他用户做出更好的选择..."
            class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
            :disabled="submitting"
          ></textarea>
          <p class="text-xs text-gray-400 text-right">{{ content.length }}/500</p>
        </div>

        <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{{ error }}</p>
        </div>

        <div class="mt-6 space-y-3">
          <button
            @click="handleSubmit"
            :disabled="rating === 0 || submitting"
            class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="submitting" class="flex items-center justify-center space-x-2">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>提交中...</span>
            </span>
            <span v-else>提交评价</span>
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
