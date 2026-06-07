<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { orderApi } from '@/lib/api'
import type { Order } from '@/lib/api'
import {
  Package,
  Clock,
  CheckCircle,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User,
} from 'lucide-vue-next'

const { requireRole, loading: authLoading } = useAuth()

const tabs = [
  { key: '', label: '全部', icon: Package },
  { key: 'assigned', label: '待服务', icon: Clock },
  { key: 'processing', label: '服务中', icon: Play },
  { key: 'completed', label: '已完成', icon: CheckCircle },
]

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: '待派单', class: 'bg-gray-100 text-gray-600' },
  assigned: { label: '待服务', class: 'bg-blue-100 text-blue-600' },
  processing: { label: '服务中', class: 'bg-orange-100 text-orange-600' },
  completed: { label: '已完成', class: 'bg-green-100 text-green-600' },
  cancelled: { label: '已取消', class: 'bg-red-100 text-red-600' },
}

const activeTab = ref('')
const orders = ref<Order[]>([])
const loading = ref(false)
const actionLoading = ref<number | null>(null)
const expandedOrderId = ref<number | null>(null)

async function loadOrders() {
  if (!requireRole('worker')) return

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

async function handleStartService(orderId: number) {
  actionLoading.value = orderId
  try {
    const res = await orderApi.updateStatus(orderId, 'processing')
    if (res.success) {
      await loadOrders()
    }
  } finally {
    actionLoading.value = null
  }
}

async function handleCompleteService(orderId: number) {
  actionLoading.value = orderId
  try {
    const res = await orderApi.updateStatus(orderId, 'completed')
    if (res.success) {
      await loadOrders()
    }
  } finally {
    actionLoading.value = null
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

onMounted(() => {
  loadOrders()
})

const isExpanded = (orderId: number) => expandedOrderId.value === orderId
</script>

<template>
  <div v-if="!authLoading" class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">我的工单</h1>
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
        <p class="text-lg">暂无工单</p>
        <p class="text-sm mt-1">等待分配新的订单~</p>
      </div>

      <div v-else class="divide-y">
        <div
          v-for="order in orders"
          :key="order.id"
          class="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
        >
          <div
            class="cursor-pointer"
            @click="toggleExpand(order.id)"
          >
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <span class="text-sm text-gray-500">订单号: {{ order.order_no }}</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="statusConfig[order.status].class"
              >
                {{ statusConfig[order.status].label }}
              </span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-800 text-lg mb-3">
                  {{ order.service_name }}
                </h3>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div class="flex items-center text-gray-600">
                    <User class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                    <span class="truncate">{{ order.customer_name || order.contact_name }}</span>
                  </div>
                  <div class="flex items-center text-gray-600">
                    <Phone class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                    <span>{{ order.contact_phone }}</span>
                  </div>
                  <div class="flex items-start text-gray-600 sm:col-span-2">
                    <MapPin class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span class="break-all">{{ order.address }}</span>
                  </div>
                  <div class="flex items-center text-gray-600">
                    <Clock class="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                    <span>{{ formatTime(order.appointment_time) }}</span>
                  </div>
                  <div class="text-lg font-semibold text-orange-500">
                    ¥{{ order.price.toFixed(2) }}
                  </div>
                </div>

                <div v-if="order.remark" class="mt-3 text-sm text-gray-500">
                  <span class="text-gray-400">备注：</span>{{ order.remark }}
                </div>
              </div>

              <div class="flex items-center space-x-2 sm:flex-col sm:items-stretch sm:space-x-0 sm:space-y-2">
                <button
                  v-if="order.status === 'assigned'"
                  @click.stop="handleStartService(order.id)"
                  :disabled="actionLoading === order.id"
                  class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                >
                  <Loader2 v-if="actionLoading === order.id" class="w-4 h-4 animate-spin" />
                  <Play v-else class="w-4 h-4" />
                  <span>开始服务</span>
                </button>
                <button
                  v-if="order.status === 'processing'"
                  @click.stop="handleCompleteService(order.id)"
                  :disabled="actionLoading === order.id"
                  class="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                >
                  <Loader2 v-if="actionLoading === order.id" class="w-4 h-4 animate-spin" />
                  <CheckCircle v-else class="w-4 h-4" />
                  <span>完成服务</span>
                </button>
                <component
                  :is="isExpanded(order.id) ? ChevronUp : ChevronDown"
                  class="w-5 h-5 text-gray-400 sm:hidden"
                />
              </div>
            </div>
          </div>

          <div v-show="isExpanded(order.id)" class="mt-4 pt-4 border-t">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">创建时间：</span>
                <span class="text-gray-800">{{ formatTime(order.created_at) }}</span>
              </div>
              <div>
                <span class="text-gray-500">更新时间：</span>
                <span class="text-gray-800">{{ formatTime(order.updated_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
