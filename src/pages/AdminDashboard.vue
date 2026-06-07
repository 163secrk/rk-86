<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { orderApi, workerApi, type Order, type Worker } from '@/lib/api'

const { user, loading: authLoading, requireRole } = useAuth()

const activeTab = ref<'orders' | 'workers'>('orders')
const orders = ref<Order[]>([])
const workers = ref<Worker[]>([])
const loading = ref(false)
const statusFilter = ref<string>('')

const showAssignDialog = ref(false)
const assignOrderId = ref<number | null>(null)
const selectedWorkerId = ref<number | null>(null)
const availableWorkers = ref<Worker[]>([])
const assignLoading = ref(false)

const filteredOrders = computed(() => {
  if (!statusFilter.value) return orders.value
  return orders.value.filter(o => o.status === statusFilter.value)
})

const avgRating = computed(() => {
  const activeWorkers = workers.value.filter(w => w.status === 'available')
  if (activeWorkers.length === 0) return 0
  const sum = activeWorkers.reduce((acc, w) => acc + w.rating, 0)
  return (sum / activeWorkers.length).toFixed(1)
})

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待派单', color: 'bg-yellow-100 text-yellow-800' },
  assigned: { label: '已派单', color: 'bg-blue-100 text-blue-800' },
  processing: { label: '服务中', color: 'bg-purple-100 text-purple-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800' },
}

onMounted(async () => {
  if (!requireRole('admin')) return
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [ordersRes, workersRes] = await Promise.all([
      orderApi.list(),
      workerApi.list(),
    ])
    if (ordersRes.success) orders.value = ordersRes.data || []
    if (workersRes.success) workers.value = workersRes.data || []
  } finally {
    loading.value = false
  }
}

async function openAssignDialog(orderId: number) {
  assignOrderId.value = orderId
  selectedWorkerId.value = null
  showAssignDialog.value = true
  assignLoading.value = true
  try {
    const res = await workerApi.list()
    if (res.success) {
      availableWorkers.value = (res.data || []).filter(w => w.status === 'available')
    }
  } finally {
    assignLoading.value = false
  }
}

async function handleAssign() {
  if (!assignOrderId.value || !selectedWorkerId.value) return
  assignLoading.value = true
  try {
    const res = await orderApi.assign(assignOrderId.value, selectedWorkerId.value)
    if (res.success) {
      showAssignDialog.value = false
      await loadData()
    }
  } finally {
    assignLoading.value = false
  }
}

async function handleCancelOrder(orderId: number) {
  if (!confirm('确定要取消该订单吗？')) return
  try {
    const res = await orderApi.updateStatus(orderId, 'cancelled')
    if (res.success) {
      await loadData()
    }
  } catch (e) {
    // ignore
  }
}

async function toggleWorkerStatus(worker: Worker) {
  const newStatus = worker.status === 'available' ? 'disabled' : 'available'
  const action = newStatus === 'available' ? '启用' : '禁用'
  if (!confirm(`确定要${action}该家政人员吗？`)) return
  try {
    const res = await workerApi.update(worker.id, { status: newStatus })
    if (res.success) {
      await loadData()
    }
  } catch (e) {
    // ignore
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<template>
  <div v-if="authLoading" class="flex justify-center items-center py-20">
    <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>

  <div v-else-if="!user || user.role !== 'admin'" class="text-center py-20">
    <p class="text-gray-500">无权限访问</p>
  </div>

  <div v-else class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800">管理员后台</h1>
    </div>

    <div class="border-b border-gray-200">
      <nav class="flex space-x-8">
        <button
          @click="activeTab = 'orders'"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
        >
          订单管理
        </button>
        <button
          @click="activeTab = 'workers'"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'workers'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
        >
          家政人员管理
        </button>
      </nav>
    </div>

    <div v-if="activeTab === 'orders'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          @click="statusFilter = ''"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            !statusFilter
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
        >
          全部
        </button>
        <button
          v-for="(item, key) in statusMap"
          :key="key"
          @click="statusFilter = key"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            statusFilter === key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="filteredOrders.length === 0" class="text-center py-12 bg-white rounded-xl border">
        <p class="text-gray-500">暂无订单</p>
      </div>

      <div v-else class="bg-white rounded-xl border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系人</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-gray-50">
                <td class="px-4 py-4 text-sm text-gray-900">{{ order.order_no }}</td>
                <td class="px-4 py-4 text-sm text-gray-900">{{ order.service_name || '-' }}</td>
                <td class="px-4 py-4 text-sm text-gray-900">
                  <p>{{ order.contact_name }}</p>
                  <p class="text-gray-500 text-xs">{{ order.contact_phone }}</p>
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">¥{{ order.price }}</td>
                <td class="px-4 py-4">
                  <span :class="['px-2 py-1 rounded-full text-xs font-medium', statusMap[order.status].color]">
                    {{ statusMap[order.status].label }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-gray-500">{{ formatDate(order.created_at) }}</td>
                <td class="px-4 py-4 text-sm space-x-2">
                  <button
                    v-if="order.status === 'pending'"
                    @click="openAssignDialog(order.id)"
                    class="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    派单
                  </button>
                  <button
                    v-if="order.status === 'pending'"
                    @click="handleCancelOrder(order.id)"
                    class="text-red-600 hover:text-red-800 font-medium"
                  >
                    取消
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'workers'" class="space-y-4">
      <div class="bg-blue-50 rounded-xl p-4 flex items-center space-x-4">
        <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
          <span class="text-white text-xl font-bold">{{ avgRating }}</span>
        </div>
        <div>
          <p class="text-sm text-gray-600">平均评分</p>
          <p class="text-2xl font-bold text-blue-600">{{ avgRating }} / 5.0</p>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="workers.length === 0" class="text-center py-12 bg-white rounded-xl border">
        <p class="text-gray-500">暂无家政人员</p>
      </div>

      <div v-else class="bg-white rounded-xl border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">电话</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">技能</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">经验</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">评分</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单数</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="worker in workers" :key="worker.id" class="hover:bg-gray-50">
                <td class="px-4 py-4 text-sm font-medium text-gray-900">{{ worker.name }}</td>
                <td class="px-4 py-4 text-sm text-gray-900">{{ worker.phone }}</td>
                <td class="px-4 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="skill in worker.skills"
                      :key="skill"
                      class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      {{ skill }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">{{ worker.experience }}年</td>
                <td class="px-4 py-4 text-sm">
                  <span class="text-yellow-500 font-medium">{{ worker.rating }}</span>
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">{{ worker.order_count }}</td>
                <td class="px-4 py-4">
                  <span
                    :class="[
                      'px-2 py-1 rounded-full text-xs font-medium',
                      worker.status === 'available'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800',
                    ]"
                  >
                    {{ worker.status === 'available' ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm">
                  <button
                    @click="toggleWorkerStatus(worker)"
                    :class="[
                      'font-medium',
                      worker.status === 'available'
                        ? 'text-red-600 hover:text-red-800'
                        : 'text-green-600 hover:text-green-800',
                    ]"
                  >
                    {{ worker.status === 'available' ? '禁用' : '启用' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-if="showAssignDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showAssignDialog = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold text-gray-800">选择家政人员</h3>
        </div>
        <div class="p-4 max-h-96 overflow-y-auto">
          <div v-if="assignLoading" class="flex justify-center py-8">
            <div class="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div v-else-if="availableWorkers.length === 0" class="text-center py-8">
            <p class="text-gray-500">暂无可用家政人员</p>
          </div>
          <div v-else class="space-y-2">
            <label
              v-for="worker in availableWorkers"
              :key="worker.id"
              class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
              :class="{ 'bg-blue-50 border-blue-500': selectedWorkerId === worker.id }"
            >
              <input
                type="radio"
                :value="worker.id"
                v-model="selectedWorkerId"
                class="w-4 h-4 text-blue-600"
              />
              <div class="ml-3 flex-1">
                <p class="font-medium text-gray-900">{{ worker.name }}</p>
                <p class="text-sm text-gray-500">{{ worker.phone }}</p>
                <div class="flex items-center mt-1 space-x-2">
                  <span class="text-yellow-500 text-sm">★ {{ worker.rating }}</span>
                  <span class="text-gray-400 text-sm">{{ worker.order_count }}单</span>
                </div>
                <div class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="skill in worker.skills.slice(0, 3)"
                    :key="skill"
                    class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {{ skill }}
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>
        <div class="p-4 border-t flex justify-end space-x-3">
          <button
            @click="showAssignDialog = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            取消
          </button>
          <button
            @click="handleAssign"
            :disabled="!selectedWorkerId || assignLoading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {{ assignLoading ? '派单中...' : '确认派单' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
