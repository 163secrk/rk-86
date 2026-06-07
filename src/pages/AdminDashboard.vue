<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { orderApi, workerApi, followUpApi, packageApi, serviceApi, type Order, type Worker, type WorkerFollowUpStats, type Package, type Service, type OrderSubtask } from '@/lib/api'
import { MessageSquareHeart, AlertTriangle, CheckCircle, Clock, Package as PackageIcon, Settings, Edit, Trash2, X } from 'lucide-vue-next'

const { user, loading: authLoading, requireRole } = useAuth()

const activeTab = ref<'orders' | 'workers' | 'packages' | 'services'>('orders')
const orders = ref<Order[]>([])
const workers = ref<Worker[]>([])
const packages = ref<Package[]>([])
const services = ref<Service[]>([])
const loading = ref(false)
const statusFilter = ref<string>('')

const showAssignDialog = ref(false)
const assignOrderId = ref<number | null>(null)
const selectedWorkerId = ref<number | null>(null)
const availableWorkers = ref<Worker[]>([])
const assignLoading = ref(false)

const showSubtaskAssignDialog = ref(false)
const subtaskAssignOrder = ref<Order | null>(null)
const subtaskAssignLoading = ref(false)
const subtaskAssigningId = ref<number | null>(null)
const subtaskSelectedWorkerMap = ref<Record<number, number | null>>({})

const showServiceDialog = ref(false)
const serviceEditMode = ref(false)
const currentService = ref<Service | null>(null)
const serviceForm = ref({
  name: '',
  description: '',
  price: 0,
  unit: '次',
  duration: 60,
  category: '',
  image: '',
  status: 'active',
})
const serviceErrors = ref({
  name: '',
  price: '',
})

const workerStatsMap = ref<Record<number, WorkerFollowUpStats>>({})

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

const pendingFollowUpCount = computed(() => {
  return orders.value.filter(o => o.follow_up_status === 'pending' && !isFollowUpExpired(o)).length
})

const expiredFollowUpCount = computed(() => {
  return orders.value.filter(o => o.follow_up_status === 'pending' && isFollowUpExpired(o)).length
})

function isFollowUpExpired(order: Order): boolean {
  if (!order.follow_up_expire_at) return false
  return new Date(order.follow_up_expire_at) < new Date()
}

function getFollowUpStatusLabel(order: Order): { label: string; class: string; icon: any } {
  if (!order.follow_up_id) {
    return { label: '无', class: 'bg-gray-100 text-gray-500', icon: null }
  }
  if (order.follow_up_status === 'completed') {
    return { label: '已回访', class: 'bg-green-100 text-green-700', icon: CheckCircle }
  }
  if (order.follow_up_status === 'expired' || isFollowUpExpired(order)) {
    return { label: '已过期', class: 'bg-gray-100 text-gray-500', icon: Clock }
  }
  return { label: '待回访', class: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle }
}

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
    const [ordersRes, workersRes, packagesRes, servicesRes] = await Promise.all([
      orderApi.list(),
      workerApi.list(),
      packageApi.list(),
      serviceApi.list(),
    ])
    if (ordersRes.success) orders.value = ordersRes.data || []
    if (packagesRes.success) packages.value = packagesRes.data || []
    if (servicesRes.success) services.value = servicesRes.data || []
    if (workersRes.success) {
      workers.value = workersRes.data || []
      for (const worker of workers.value) {
        const statsRes = await followUpApi.getWorkerStats(worker.id)
        if (statsRes.success && statsRes.data) {
          workerStatsMap.value[worker.id] = statsRes.data
        }
      }
    }
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

async function openSubtaskAssignDialog(orderId: number) {
  subtaskAssignLoading.value = true
  try {
    const res = await orderApi.get(orderId)
    if (res.success && res.data) {
      subtaskAssignOrder.value = res.data
      subtaskSelectedWorkerMap.value = {}
      if (res.data.subtasks) {
        for (const subtask of res.data.subtasks) {
          subtaskSelectedWorkerMap.value[subtask.id] = subtask.worker_id
        }
      }
      showSubtaskAssignDialog.value = true
    }
  } finally {
    subtaskAssignLoading.value = false
  }
}

async function handleAssignSubtask(subtaskId: number) {
  if (!subtaskAssignOrder.value) return
  const workerId = subtaskSelectedWorkerMap.value[subtaskId]
  if (!workerId) return
  subtaskAssigningId.value = subtaskId
  try {
    const res = await orderApi.assignSubtask(subtaskAssignOrder.value.id, subtaskId, workerId)
    if (res.success && res.data) {
      subtaskAssignOrder.value = res.data
      if (res.data.subtasks) {
        for (const subtask of res.data.subtasks) {
          subtaskSelectedWorkerMap.value[subtask.id] = subtask.worker_id
        }
      }
      await loadData()
    }
  } finally {
    subtaskAssigningId.value = null
  }
}

function getSubtaskStatusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '待派单', color: 'bg-yellow-100 text-yellow-800' },
    assigned: { label: '已派单', color: 'bg-blue-100 text-blue-800' },
    processing: { label: '服务中', color: 'bg-purple-100 text-purple-800' },
    completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
    cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800' },
  }
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
}

function openCreateServiceDialog() {
  serviceEditMode.value = false
  currentService.value = null
  serviceForm.value = {
    name: '',
    description: '',
    price: 0,
    unit: '次',
    duration: 60,
    category: '',
    image: '',
    status: 'active',
  }
  serviceErrors.value = { name: '', price: '' }
  showServiceDialog.value = true
}

function openEditServiceDialog(service: Service) {
  serviceEditMode.value = true
  currentService.value = service
  serviceForm.value = {
    name: service.name,
    description: service.description,
    price: service.price,
    unit: service.unit,
    duration: service.duration,
    category: service.category,
    image: service.image,
    status: service.status,
  }
  serviceErrors.value = { name: '', price: '' }
  showServiceDialog.value = true
}

function validateServiceForm(): boolean {
  let valid = true
  serviceErrors.value = { name: '', price: '' }
  if (!serviceForm.value.name.trim()) {
    serviceErrors.value.name = '请输入服务名称'
    valid = false
  }
  if (serviceForm.value.price <= 0) {
    serviceErrors.value.price = '请输入有效的服务价格'
    valid = false
  }
  return valid
}

async function handleServiceSubmit() {
  if (!validateServiceForm()) return
  try {
    loading.value = true
    if (serviceEditMode.value && currentService.value) {
      const res = await serviceApi.update(currentService.value.id, serviceForm.value)
      if (res.success) {
        showServiceDialog.value = false
        await loadData()
      } else {
        alert(res.error || '更新失败')
      }
    } else {
      const res = await serviceApi.create(serviceForm.value as any)
      if (res.success) {
        showServiceDialog.value = false
        await loadData()
      } else {
        alert(res.error || '创建失败')
      }
    }
  } catch (e) {
    alert('操作失败，请重试')
  } finally {
    loading.value = false
  }
}

async function handleDeleteService(service: Service) {
  if (!confirm(`确定要删除服务"${service.name}"吗？`)) return
  try {
    const res = await serviceApi.delete(service.id)
    if (res.success) {
      await loadData()
    } else {
      alert(res.error || '删除失败')
    }
  } catch (e) {
    alert('删除失败，请重试')
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
        <button
          @click="activeTab = 'packages'"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'packages'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
        >
          套餐管理
        </button>
        <button
          @click="activeTab = 'services'"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'services'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
        >
          服务管理
        </button>
      </nav>
    </div>

    <div v-if="activeTab === 'orders'" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl border p-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquareHeart class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500">总订单数</p>
              <p class="text-xl font-bold text-gray-800">{{ orders.length }}</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border p-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle class="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500">待回访</p>
              <p class="text-xl font-bold text-yellow-600">{{ pendingFollowUpCount }}</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border p-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock class="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p class="text-sm text-gray-500">已过期</p>
              <p class="text-xl font-bold text-gray-500">{{ expiredFollowUpCount }}</p>
            </div>
          </div>
        </div>
      </div>

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
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务/套餐</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系人</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">回访状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr
                v-for="order in filteredOrders"
                :key="order.id"
                class="hover:bg-gray-50"
                :class="{
                  'bg-yellow-50': order.follow_up_status === 'pending' && !isFollowUpExpired(order),
                  'bg-red-50': order.follow_up_status === 'pending' && isFollowUpExpired(order),
                  'bg-blue-50': order.is_package_order,
                }"
              >
                <td class="px-4 py-4 text-sm text-gray-900">
                  <div class="flex items-center gap-2">
                    <span>{{ order.order_no }}</span>
                    <span
                      v-if="order.is_package_order"
                      class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                    >
                      套餐订单
                    </span>
                  </div>
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">
                  <template v-if="order.is_package_order">
                    <div class="flex items-center gap-1">
                      <PackageIcon class="w-4 h-4 text-purple-500" />
                      <span class="font-medium text-purple-700">{{ order.package_name || '套餐' }}</span>
                    </div>
                  </template>
                  <template v-else>
                    {{ order.service_name || '-' }}
                  </template>
                </td>
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
                <td class="px-4 py-4">
                  <span
                    v-if="getFollowUpStatusLabel(order).icon"
                    :class="['inline-flex items-center px-2 py-1 rounded-full text-xs font-medium space-x-1', getFollowUpStatusLabel(order).class]"
                  >
                    <component :is="getFollowUpStatusLabel(order).icon" class="w-3 h-3" />
                    <span>{{ getFollowUpStatusLabel(order).label }}</span>
                  </span>
                  <span
                    v-else
                    :class="['px-2 py-1 rounded-full text-xs font-medium', getFollowUpStatusLabel(order).class]"
                  >
                    {{ getFollowUpStatusLabel(order).label }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-gray-500">{{ formatDate(order.created_at) }}</td>
                <td class="px-4 py-4 text-sm space-x-2">
                  <button
                    v-if="order.status === 'pending' && order.is_package_order"
                    @click="openSubtaskAssignDialog(order.id)"
                    class="text-purple-600 hover:text-purple-800 font-medium"
                  >
                    子任务派单
                  </button>
                  <button
                    v-if="order.status === 'pending' && !order.is_package_order"
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
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="bg-blue-50 rounded-xl p-4 flex items-center space-x-4">
          <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span class="text-white text-xl font-bold">{{ avgRating }}</span>
          </div>
          <div>
            <p class="text-sm text-gray-600">平均评分</p>
            <p class="text-2xl font-bold text-blue-600">{{ avgRating }} / 5.0</p>
          </div>
        </div>
        <div class="bg-green-50 rounded-xl p-4 flex items-center space-x-4">
          <div class="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
            <MessageSquareHeart class="w-6 h-6 text-white" />
          </div>
          <div>
            <p class="text-sm text-gray-600">总回访数</p>
            <p class="text-2xl font-bold text-green-600">
              {{ Object.values(workerStatsMap).reduce((sum, s) => sum + s.completed_count, 0) }}
            </p>
          </div>
        </div>
        <div class="bg-yellow-50 rounded-xl p-4 flex items-center space-x-4">
          <div class="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
            <AlertTriangle class="w-6 h-6 text-white" />
          </div>
          <div>
            <p class="text-sm text-gray-600">待回访</p>
            <p class="text-2xl font-bold text-yellow-600">
              {{ Object.values(workerStatsMap).reduce((sum, s) => sum + s.pending_count, 0) }}
            </p>
          </div>
        </div>
        <div class="bg-gray-50 rounded-xl p-4 flex items-center space-x-4">
          <div class="w-12 h-12 bg-gray-500 rounded-xl flex items-center justify-center">
            <Clock class="w-6 h-6 text-white" />
          </div>
          <div>
            <p class="text-sm text-gray-600">已过期</p>
            <p class="text-2xl font-bold text-gray-600">
              {{ Object.values(workerStatsMap).reduce((sum, s) => sum + s.expired_count, 0) }}
            </p>
          </div>
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
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">综合评分</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务态度</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务质量</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">准时性</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">回访数</th>
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
                <td class="px-4 py-4 text-sm">
                  <span class="text-yellow-500 font-medium">★ {{ worker.rating }}</span>
                </td>
                <td class="px-4 py-4 text-sm text-gray-600">
                  {{ workerStatsMap[worker.id]?.avg_attitude?.toFixed(1) || '-' }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-600">
                  {{ workerStatsMap[worker.id]?.avg_quality?.toFixed(1) || '-' }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-600">
                  {{ workerStatsMap[worker.id]?.avg_punctuality?.toFixed(1) || '-' }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">
                  {{ workerStatsMap[worker.id]?.completed_count || 0 }}
                </td>
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

    <div v-if="activeTab === 'packages'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-gray-800">套餐列表</h2>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="packages.length === 0" class="text-center py-12 bg-white rounded-xl border">
        <PackageIcon class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p class="text-gray-500">暂无套餐</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="pkg in packages"
          :key="pkg.id"
          class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div class="aspect-[4/3] overflow-hidden relative">
            <img
              :src="pkg.image"
              :alt="pkg.name"
              class="w-full h-full object-cover"
            />
            <div
              :class="[
                'absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium',
                pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              ]"
            >
              {{ pkg.status === 'active' ? '上架' : '下架' }}
            </div>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ pkg.name }}</h3>
            <p class="text-sm text-gray-500 mb-3 line-clamp-2">{{ pkg.description }}</p>

            <div class="mb-3">
              <div class="flex flex-wrap gap-1 mb-2">
                <span
                  v-for="s in pkg.services"
                  :key="s.package_service_id"
                  class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
                >
                  {{ s.name }} × {{ s.quantity }}
                </span>
              </div>
            </div>

            <div class="flex items-baseline gap-2 mb-4">
              <span class="text-sm text-gray-400 line-through">
                ¥{{ pkg.original_price_calculated.toFixed(2) }}
              </span>
              <span class="text-2xl font-bold text-orange-500">
                ¥{{ pkg.price.toFixed(2) }}
              </span>
              <span class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                省 ¥{{ pkg.savings.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'services'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-gray-800">服务列表</h2>
        <button
          @click="openCreateServiceDialog"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Settings class="w-4 h-4" />
          新建服务
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="services.length === 0" class="text-center py-12 bg-white rounded-xl border">
        <Settings class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p class="text-gray-500">暂无服务</p>
      </div>

      <div v-else class="bg-white rounded-xl border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务名称</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时长</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="service in services" :key="service.id" class="hover:bg-gray-50">
                <td class="px-4 py-4 text-sm font-medium text-gray-900">
                  <div class="flex items-center gap-3">
                    <img :src="service.image" :alt="service.name" class="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p>{{ service.name }}</p>
                      <p class="text-gray-500 text-xs line-clamp-1">{{ service.description }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">{{ service.category || '-' }}</td>
                <td class="px-4 py-4 text-sm text-gray-900">¥{{ service.price }}/{{ service.unit }}</td>
                <td class="px-4 py-4 text-sm text-gray-900">{{ service.duration }}分钟</td>
                <td class="px-4 py-4">
                  <span
                    :class="[
                      'px-2 py-1 rounded-full text-xs font-medium',
                      service.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800',
                    ]"
                  >
                    {{ service.status === 'active' ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-gray-500">{{ formatDate(service.created_at) }}</td>
                <td class="px-4 py-4 text-sm space-x-2">
                  <button
                    @click="openEditServiceDialog(service)"
                    class="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    <Edit class="w-3 h-3" />
                    编辑
                  </button>
                  <button
                    @click="handleDeleteService(service)"
                    class="text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1"
                  >
                    <Trash2 class="w-3 h-3" />
                    删除
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

    <div
      v-if="showSubtaskAssignDialog && subtaskAssignOrder"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showSubtaskAssignDialog = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center">
          <div>
            <h3 class="text-lg font-semibold text-gray-800">子任务派单</h3>
            <p class="text-sm text-gray-500 mt-1">
              订单号：{{ subtaskAssignOrder.order_no }} | 
              套餐：{{ subtaskAssignOrder.package_name }}
            </p>
          </div>
          <button
            @click="showSubtaskAssignDialog = false"
            class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 max-h-[calc(90vh-140px)] overflow-y-auto">
          <div v-if="subtaskAssignLoading" class="flex justify-center py-8">
            <div class="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!subtaskAssignOrder.subtasks || subtaskAssignOrder.subtasks.length === 0" class="text-center py-8">
            <p class="text-gray-500">暂无子任务</p>
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="subtask in subtaskAssignOrder.subtasks"
              :key="subtask.id"
              class="border rounded-lg p-4"
              :class="{ 'bg-blue-50 border-blue-200': subtask.status === 'assigned' }"
            >
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h4 class="font-medium text-gray-900">{{ subtask.service_name }}</h4>
                  <p class="text-sm text-gray-500">{{ subtask.service_description }}</p>
                </div>
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    getSubtaskStatusLabel(subtask.status).color,
                  ]"
                >
                  {{ getSubtaskStatusLabel(subtask.status).label }}
                </span>
              </div>

              <div v-if="subtask.worker_name" class="mb-3 text-sm">
                <span class="text-gray-500">已派单家政人员：</span>
                <span class="font-medium text-gray-900">{{ subtask.worker_name }}</span>
              </div>

              <div v-if="subtask.status === 'pending'" class="space-y-3">
                <div class="flex gap-3">
                  <select
                    v-model="subtaskSelectedWorkerMap[subtask.id]"
                    class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option :value="null">请选择家政人员</option>
                    <option
                      v-for="worker in workers.filter(w => w.status === 'available')"
                      :key="worker.id"
                      :value="worker.id"
                    >
                      {{ worker.name }} (★{{ worker.rating }})
                    </option>
                  </select>
                  <button
                    @click="handleAssignSubtask(subtask.id)"
                    :disabled="!subtaskSelectedWorkerMap[subtask.id] || subtaskAssigningId === subtask.id"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {{ subtaskAssigningId === subtask.id ? '派单中...' : '派单' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t flex justify-end">
          <button
            @click="showSubtaskAssignDialog = false"
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showServiceDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showServiceDialog = false"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-800">
            {{ serviceEditMode ? '编辑服务' : '新建服务' }}
          </h3>
          <button
            @click="showServiceDialog = false"
            class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                服务名称 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="serviceForm.name"
                type="text"
                placeholder="请输入服务名称"
                class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                :class="{ 'border-red-500': serviceErrors.name }"
              />
              <p v-if="serviceErrors.name" class="mt-1 text-sm text-red-500">{{ serviceErrors.name }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                服务描述
              </label>
              <textarea
                v-model="serviceForm.description"
                rows="3"
                placeholder="请输入服务描述"
                class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  价格 <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                  <input
                    v-model.number="serviceForm.price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    class="w-full pl-8 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    :class="{ 'border-red-500': serviceErrors.price }"
                  />
                </div>
                <p v-if="serviceErrors.price" class="mt-1 text-sm text-red-500">{{ serviceErrors.price }}</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  计价单位
                </label>
                <input
                  v-model="serviceForm.unit"
                  type="text"
                  placeholder="如：次、小时"
                  class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  服务时长（分钟）
                </label>
                <input
                  v-model.number="serviceForm.duration"
                  type="number"
                  min="0"
                  placeholder="60"
                  class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  分类
                </label>
                <input
                  v-model="serviceForm.category"
                  type="text"
                  placeholder="如：保洁、保姆"
                  class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                服务图片
              </label>
              <input
                v-model="serviceForm.image"
                type="text"
                placeholder="请输入图片URL"
                class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                状态
              </label>
              <select
                v-model="serviceForm.status"
                class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </div>
        </div>
        <div class="p-4 border-t flex justify-end gap-3">
          <button
            @click="showServiceDialog = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            取消
          </button>
          <button
            @click="handleServiceSubmit"
            :disabled="loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {{ loading ? '提交中...' : (serviceEditMode ? '保存' : '创建') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
