<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { orderApi } from '@/lib/api'
import type { Order } from '@/lib/api'
import { Package, Clock, CheckCircle, XCircle, Star, Loader2, ChevronDown, ChevronUp } from 'lucide-vue-next'

const router = useRouter()
const { requireRole, loading: authLoading } = useAuth()

const tabs = [
  { key: '', label: '全部', icon: Package },
  { key: 'pending', label: '待派单', icon: Clock },
  { key: 'assigned', label: '已派单', icon: Package },
  { key: 'processing', label: '服务中', icon: Clock },
  { key: 'completed', label: '已完成', icon: CheckCircle },
  { key: 'cancelled', label: '已取消', icon: XCircle },
]

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: '待派单', class: 'bg-gray-100 text-gray-600' },
  assigned: { label: '已派单', class: 'bg-blue-100 text-blue-600' },
  processing: { label: '服务中', class: 'bg-orange-100 text-orange-600' },
  completed: { label: '已完成', class: 'bg-green-100 text-green-600' },
  cancelled: { label: '已取消', class: 'bg-red-100 text-red-600' },
}

const activeTab = ref('')
const orders = ref<Order[]>([])
const loading = ref(false)
const expandedOrderId = ref<number | null>(null)

async function loadOrders() {
  if (!requireRole('customer')) return

  loading.value = true
  try {
    const params = activeTab.value ? { status: activeTab.value } : undefined
    const res = await orderApi.list(params)
    if (res.success && res.data) {
      orders.value = res.data
    }
  } finally {
    loading.value = false
  }
}

function formatTime(time: string) {
  const d = new Date(time)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toggleExpand(orderId: number) {
  expandedOrderId.value = expandedOrderId.value === orderId ? null : orderId
}

function goToReview(orderId: number) {
  router.push(`/review/${orderId}`)
}

onMounted(() => {
  loadOrders()
})

const isExpanded = (orderId: number) => expandedOrderId.value === orderId
</script>

<template>
  <div v-if="!authLoading" class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">我的订单</h1>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="flex overflow-x-auto border-b">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key; loadOrders()"
          class="flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px"
          :class="[
            activeTab === tab.key
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700',
          ]"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-blue-600 animate-spin" />
        <span class="ml-3 text-gray-500">加载中...</span>
      </div>

      <div v-else-if="orders.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <Package class="w-16 h-16 mb-4" />
        <p class="text-lg">暂无订单</p>
        <p class="text-sm mt-1">快去下单吧~</p>
      </div>

      <div v-else class="divide-y">
        <div
          v-for="order in orders"
          :key="order.id"
          class="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
        >
          <div
            class="flex items-center justify-between cursor-pointer"
            @click="toggleExpand(order.id)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <span class="text-sm text-gray-500">订单号: {{ order.order_no }}</span>
                <span
                  class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="statusConfig[order.status].class"
                >
                  {{ statusConfig[order.status].label }}
                </span>
              </div>
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-gray-800 truncate">
                    {{ order.service_name }}
                  </h3>
                  <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                    <span class="flex items-center">
                      <Clock class="w-4 h-4 mr-1" />
                      {{ formatTime(order.appointment_time) }}
                    </span>
                    <span class="text-lg font-semibold text-orange-500">
                      ¥{{ order.price.toFixed(2) }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    v-if="order.status === 'completed'"
                    @click.stop="goToReview(order.id)"
                    class="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-1"
                  >
                    <Star class="w-4 h-4" />
                    <span>去评价</span>
                  </button>
                  <component
                    :is="isExpanded(order.id) ? ChevronUp : ChevronDown"
                    class="w-5 h-5 text-gray-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-show="isExpanded(order.id)" class="mt-4 pt-4 border-t">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">联系人：</span>
                <span class="text-gray-800">{{ order.contact_name }}</span>
              </div>
              <div>
                <span class="text-gray-500">联系电话：</span>
                <span class="text-gray-800">{{ order.contact_phone }}</span>
              </div>
              <div class="sm:col-span-2">
                <span class="text-gray-500">服务地址：</span>
                <span class="text-gray-800">{{ order.address }}</span>
              </div>
              <div v-if="order.worker_name" class="sm:col-span-2">
                <span class="text-gray-500">服务人员：</span>
                <span class="text-gray-800">{{ order.worker_name }}</span>
              </div>
              <div v-if="order.remark" class="sm:col-span-2">
                <span class="text-gray-500">备注：</span>
                <span class="text-gray-800">{{ order.remark }}</span>
              </div>
              <div class="sm:col-span-2">
                <span class="text-gray-500">创建时间：</span>
                <span class="text-gray-800">{{ formatTime(order.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
