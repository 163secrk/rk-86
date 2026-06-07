<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { memberApi, type Member, type PointsRecord, type Order, type MemberLevel } from '@/lib/api'
import { Crown, Coins, ShoppingBag, TrendingUp, Calendar, ChevronDown, ChevronUp, Award, Star, Loader2 } from 'lucide-vue-next'

const { requireRole, user } = useAuth()

const member = ref<Member | null>(null)
const pointsRecords = ref<PointsRecord[]>([])
const orders = ref<Order[]>([])
const levels = ref<MemberLevel[]>([])
const loading = ref(true)
const activeTab = ref<'overview' | 'points' | 'orders'>('overview')
const pointsPage = ref(1)
const ordersPage = ref(1)
const pageSize = 10
const hasMorePoints = ref(true)
const hasMoreOrders = ref(true)
const expandedOrderId = ref<number | null>(null)

const levelColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  '普通': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', gradient: 'from-gray-400 to-gray-500' },
  '银卡': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-400', gradient: 'from-slate-400 to-slate-500' },
  '金卡': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400', gradient: 'from-amber-400 to-amber-600' },
  '钻石': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-400', gradient: 'from-cyan-400 to-cyan-600' },
}

const currentLevelColor = computed(() => {
  return member.value ? levelColors[member.value.level] || levelColors['普通'] : levelColors['普通']
})

async function loadMember() {
  const res = await memberApi.profile()
  if (res.success && res.data) {
    member.value = res.data
  }
}

async function loadLevels() {
  const res = await memberApi.levels()
  if (res.success && res.data) {
    levels.value = res.data
  }
}

async function loadPointsRecords(loadMore = false) {
  if (loadMore) {
    pointsPage.value++
  } else {
    pointsPage.value = 1
    pointsRecords.value = []
  }
  const res = await memberApi.points({ page: pointsPage.value, pageSize })
  if (res.success && res.data) {
    pointsRecords.value = [...pointsRecords.value, ...res.data.records]
    hasMorePoints.value = pointsRecords.value.length < res.data.total
  }
}

async function loadOrders(loadMore = false) {
  if (loadMore) {
    ordersPage.value++
  } else {
    ordersPage.value = 1
    orders.value = []
  }
  const res = await memberApi.orders({ page: ordersPage.value, pageSize })
  if (res.success && res.data) {
    orders.value = [...orders.value, ...res.data.orders]
    hasMoreOrders.value = orders.value.length < res.data.total
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadMember(), loadLevels()])
    if (activeTab.value === 'points') {
      await loadPointsRecords()
    } else if (activeTab.value === 'orders') {
      await loadOrders()
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

function formatPrice(price: number) {
  return '¥' + price.toFixed(2)
}

function toggleExpand(orderId: number) {
  expandedOrderId.value = expandedOrderId.value === orderId ? null : orderId
}

const isExpanded = (orderId: number) => expandedOrderId.value === orderId

onMounted(() => {
  if (!requireRole('customer')) return
  loadAll()
})
</script>

<template>
  <div v-if="!loading || member" class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">会员中心</h1>
      <div v-if="user" class="flex items-center gap-2">
        <span class="text-gray-600">您好，</span>
        <span class="font-medium text-gray-800">{{ user.name }}</span>
      </div>
    </div>

    <div v-if="member" :class="['relative overflow-hidden rounded-2xl shadow-lg p-6 text-white', `bg-gradient-to-r ${currentLevelColor.gradient}`]">
      <div class="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      
      <div class="relative z-10">
        <div class="flex items-start justify-between mb-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <Crown class="w-6 h-6" />
              <span class="text-xl font-bold">{{ member.level }}会员</span>
            </div>
            <p class="text-white/80 text-sm">享 {{ (member.discount * 10).toFixed(1) }} 折优惠</p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold mb-1">{{ member.points }}</div>
            <p class="text-white/80 text-sm flex items-center justify-end gap-1">
              <Coins class="w-4 h-4" />
              可用积分
            </p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
            <div class="text-2xl font-bold">{{ member.total_orders }}</div>
            <p class="text-white/80 text-xs">累计订单</p>
          </div>
          <div class="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
            <div class="text-2xl font-bold">¥{{ member.total_spent.toFixed(0) }}</div>
            <p class="text-white/80 text-xs">累计消费</p>
          </div>
          <div class="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
            <div class="text-2xl font-bold">{{ (member.discount * 10).toFixed(1) }}折</div>
            <p class="text-white/80 text-xs">当前折扣</p>
          </div>
        </div>

        <div v-if="member.nextLevel" class="bg-white/20 rounded-xl p-4 backdrop-blur-sm">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm">距离 {{ member.nextLevel.level }} 还需</span>
            <span class="text-sm font-medium">
              ¥{{ (member.nextLevel.minSpent - member.total_spent).toFixed(0) }}
            </span>
          </div>
          <div class="w-full bg-white/30 rounded-full h-2">
            <div
              class="bg-white rounded-full h-2 transition-all duration-500"
              :style="{ width: `${member.progress}%` }"
            ></div>
          </div>
          <div class="flex justify-between mt-1 text-xs text-white/70">
            <span>¥{{ member.currentLevelConfig?.minSpent || 0 }}</span>
            <span>¥{{ member.nextLevel.minSpent }}</span>
          </div>
        </div>
        <div v-else class="bg-white/20 rounded-xl p-4 backdrop-blur-sm text-center">
          <Award class="w-8 h-8 mx-auto mb-2" />
          <p class="text-sm">恭喜您已达到最高等级！</p>
        </div>
      </div>
    </div>

    <div v-if="levels.length > 0" class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Star class="w-5 h-5 text-amber-500" />
        会员等级权益
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="level in levels"
          :key="level.level"
          :class="[
            'rounded-xl p-4 border-2 transition-all',
            member?.level === level.level
              ? `${levelColors[level.level].border} ${levelColors[level.level].bg}`
              : 'border-gray-100 bg-gray-50',
          ]"
        >
          <div class="flex items-center gap-2 mb-2">
            <Crown :class="['w-5 h-5', levelColors[level.level].text]" />
            <span :class="['font-semibold', levelColors[level.level].text]">{{ level.level }}</span>
          </div>
          <div class="space-y-1 text-sm">
            <p class="text-gray-600">
              <span class="text-gray-400">门槛：</span>
              ¥{{ level.minSpent }}{{ level.maxSpent !== Infinity ? ` - ¥${level.maxSpent}` : ' 以上' }}
            </p>
            <p class="text-gray-600">
              <span class="text-gray-400">折扣：</span>
              {{ (level.discount * 10).toFixed(1) }}折
            </p>
            <p class="text-gray-600">
              <span class="text-gray-400">积分倍率：</span>
              {{ level.pointsRate }}x
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="flex border-b">
        <button
          @click="activeTab = 'overview'; loadAll()"
          :class="[
            'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'overview'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700',
          ]"
        >
          <TrendingUp class="w-4 h-4 inline mr-2" />
          概览
        </button>
        <button
          @click="activeTab = 'points'; loadPointsRecords()"
          :class="[
            'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'points'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700',
          ]"
        >
          <Coins class="w-4 h-4 inline mr-2" />
          积分明细
        </button>
        <button
          @click="activeTab = 'orders'; loadOrders()"
          :class="[
            'flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'orders'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700',
          ]"
        >
          <ShoppingBag class="w-4 h-4 inline mr-2" />
          消费记录
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-blue-600 animate-spin" />
        <span class="ml-3 text-gray-500">加载中...</span>
      </div>

      <div v-else-if="activeTab === 'overview'" class="p-6">
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <h4 class="text-sm font-medium text-gray-500 mb-4">最近积分变动</h4>
            <div v-if="pointsRecords.length === 0" class="text-center py-8 text-gray-400">
              <Coins class="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无积分记录</p>
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="record in pointsRecords.slice(0, 5)"
                :key="record.id"
                class="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div class="flex items-center gap-3">
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    record.type === 'earn' ? 'bg-green-100' : 'bg-red-100',
                  ]">
                    <span :class="['text-lg font-bold', record.type === 'earn' ? 'text-green-600' : 'text-red-600']">
                      {{ record.type === 'earn' ? '+' : '-' }}
                    </span>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-800">{{ record.description }}</p>
                    <p class="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar class="w-3 h-3" />
                      {{ formatTime(record.created_at) }}
                    </p>
                  </div>
                </div>
                <span :class="['font-semibold', record.type === 'earn' ? 'text-green-600' : 'text-red-600']">
                  {{ record.type === 'earn' ? '+' : '' }}{{ record.points }}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="text-sm font-medium text-gray-500 mb-4">最近消费</h4>
            <div v-if="orders.length === 0" class="text-center py-8 text-gray-400">
              <ShoppingBag class="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无消费记录</p>
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="order in orders.slice(0, 5)"
                :key="order.id"
                class="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <img
                      v-if="(order as any).service_image"
                      :src="(order as any).service_image"
                      :alt="order.service_name"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                      <ShoppingBag class="w-6 h-6" />
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ order.service_name }}</p>
                    <p class="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar class="w-3 h-3" />
                      {{ formatTime(order.created_at) }}
                    </p>
                  </div>
                </div>
                <span class="font-semibold text-orange-500 whitespace-nowrap">
                  {{ formatPrice(order.price) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'points'" class="divide-y">
        <div v-if="pointsRecords.length === 0" class="text-center py-16 text-gray-400">
          <Coins class="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p class="text-lg">暂无积分记录</p>
        </div>
        <div v-else>
          <div
            v-for="record in pointsRecords"
            :key="record.id"
            class="p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  record.type === 'earn' ? 'bg-green-100' : 'bg-red-100',
                ]">
                  <Coins :class="['w-5 h-5', record.type === 'earn' ? 'text-green-600' : 'text-red-600']" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-800">{{ record.description }}</p>
                  <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span class="flex items-center gap-1">
                      <Calendar class="w-3 h-3" />
                      {{ formatTime(record.created_at) }}
                    </span>
                    <span v-if="record.order_no">订单号: {{ record.order_no }}</span>
                  </div>
                </div>
              </div>
              <div class="text-right flex-shrink-0 ml-4">
                <div :class="['font-semibold text-lg', record.type === 'earn' ? 'text-green-600' : 'text-red-600']">
                  {{ record.type === 'earn' ? '+' : '' }}{{ record.points }}
                </div>
                <div class="text-xs text-gray-400">余额: {{ record.balance }}</div>
              </div>
            </div>
          </div>
          <div v-if="hasMorePoints" class="p-4 text-center">
            <button
              @click="loadPointsRecords(true)"
              class="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              加载更多
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'orders'" class="divide-y">
        <div v-if="orders.length === 0" class="text-center py-16 text-gray-400">
          <ShoppingBag class="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p class="text-lg">暂无消费记录</p>
        </div>
        <div v-else>
          <div
            v-for="order in orders"
            :key="order.id"
            class="p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center justify-between cursor-pointer" @click="toggleExpand(order.id)">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <img
                    v-if="(order as any).service_image"
                    :src="(order as any).service_image"
                    :alt="order.service_name"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <ShoppingBag class="w-7 h-7" />
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-gray-800 truncate">{{ order.service_name }}</p>
                  <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span class="flex items-center gap-1">
                      <Calendar class="w-4 h-4" />
                      {{ formatTime(order.appointment_time) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="text-right flex-shrink-0 ml-4">
                <div class="text-lg font-semibold text-orange-500">{{ formatPrice(order.price) }}</div>
                <component
                  :is="isExpanded(order.id) ? ChevronUp : ChevronDown"
                  class="w-5 h-5 text-gray-400 mt-1 mx-auto"
                />
              </div>
            </div>

            <div v-show="isExpanded(order.id)" class="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">订单号：</span>
                <span class="text-gray-800">{{ order.order_no }}</span>
              </div>
              <div>
                <span class="text-gray-500">联系人：</span>
                <span class="text-gray-800">{{ order.contact_name }}</span>
              </div>
              <div>
                <span class="text-gray-500">联系电话：</span>
                <span class="text-gray-800">{{ order.contact_phone }}</span>
              </div>
              <div>
                <span class="text-gray-500">服务地址：</span>
                <span class="text-gray-800">{{ order.address }}</span>
              </div>
              <div v-if="order.remark" class="col-span-2">
                <span class="text-gray-500">备注：</span>
                <span class="text-gray-800">{{ order.remark }}</span>
              </div>
              <div class="col-span-2">
                <span class="text-gray-500">下单时间：</span>
                <span class="text-gray-800">{{ formatTime(order.created_at) }}</span>
              </div>
            </div>
          </div>
          <div v-if="hasMoreOrders" class="p-4 text-center">
            <button
              @click="loadOrders(true)"
              class="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              加载更多
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
