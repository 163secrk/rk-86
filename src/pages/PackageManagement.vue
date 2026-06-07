<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { packageApi, serviceApi, type Package, type Service } from '@/lib/api'
import { Plus, Edit, Trash2, X, Check, Package as PackageIcon } from 'lucide-vue-next'

const { user, loading: authLoading, requireRole } = useAuth()

const packages = ref<Package[]>([])
const services = ref<Service[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editMode = ref(false)
const currentPackage = ref<Package | null>(null)

const form = ref({
  name: '',
  description: '',
  price: 0,
  image: '',
  status: 'active',
  services: [] as { service_id: number; quantity: number }[],
})

const errors = ref({
  name: '',
  price: '',
  services: '',
})

const activeServices = computed(() => services.value.filter(s => s.status === 'active'))

const selectedServiceIds = computed(() => form.value.services.map(s => s.service_id))

const originalPrice = computed(() => {
  let total = 0
  for (const ps of form.value.services) {
    const service = services.value.find(s => s.id === ps.service_id)
    if (service) {
      total += service.price * ps.quantity
    }
  }
  return total
})

const savings = computed(() => {
  return Math.round((originalPrice.value - form.value.price) * 100) / 100
})

onMounted(async () => {
  if (!requireRole('admin')) return
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [pkgRes, svcRes] = await Promise.all([
      packageApi.list(),
      serviceApi.list(),
    ])
    if (pkgRes.success) packages.value = pkgRes.data || []
    if (svcRes.success) services.value = svcRes.data || []
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editMode.value = false
  currentPackage.value = null
  form.value = {
    name: '',
    description: '',
    price: 0,
    image: '',
    status: 'active',
    services: [],
  }
  errors.value = { name: '', price: '', services: '' }
  showDialog.value = true
}

function openEditDialog(pkg: Package) {
  editMode.value = true
  currentPackage.value = pkg
  form.value = {
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    image: pkg.image,
    status: pkg.status,
    services: pkg.services.map(s => ({ service_id: s.service_id, quantity: s.quantity })),
  }
  errors.value = { name: '', price: '', services: '' }
  showDialog.value = true
}

function addService(serviceId: number) {
  if (selectedServiceIds.value.includes(serviceId)) return
  form.value.services.push({ service_id, quantity: 1 })
}

function removeService(serviceId: number) {
  form.value.services = form.value.services.filter(s => s.service_id !== serviceId)
}

function updateQuantity(serviceId: number, quantity: number) {
  const item = form.value.services.find(s => s.service_id === serviceId)
  if (item && quantity > 0) {
    item.quantity = quantity
  }
}

function validateForm(): boolean {
  let valid = true
  errors.value = { name: '', price: '', services: '' }

  if (!form.value.name.trim()) {
    errors.value.name = '请输入套餐名称'
    valid = false
  }

  if (form.value.price <= 0) {
    errors.value.price = '请输入有效的套餐价格'
    valid = false
  }

  if (form.value.services.length === 0) {
    errors.value.services = '请至少选择一项服务'
    valid = false
  } else if (form.value.price >= originalPrice.value) {
    errors.value.price = '套餐价格必须低于单项服务累加价格'
    valid = false
  }

  return valid
}

async function handleSubmit() {
  if (!validateForm()) return

  try {
    loading.value = true
    if (editMode.value && currentPackage.value) {
      const res = await packageApi.update(currentPackage.value.id, form.value)
      if (res.success) {
        showDialog.value = false
        await loadData()
      } else {
        alert(res.error || '更新失败')
      }
    } else {
      const res = await packageApi.create(form.value as any)
      if (res.success) {
        showDialog.value = false
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

async function handleDelete(pkg: Package) {
  if (!confirm(`确定要删除套餐"${pkg.name}"吗？`)) return
  try {
    const res = await packageApi.delete(pkg.id)
    if (res.success) {
      await loadData()
    } else {
      alert(res.error || '删除失败')
    }
  } catch (e) {
    alert('删除失败，请重试')
  }
}

function getServiceName(serviceId: number): string {
  return services.value.find(s => s.id === serviceId)?.name || '-'
}

function getServicePrice(serviceId: number): number {
  return services.value.find(s => s.id === serviceId)?.price || 0
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
      <h1 class="text-2xl font-bold text-gray-800">套餐管理</h1>
      <button
        @click="openCreateDialog"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus class="w-4 h-4" />
        新建套餐
      </button>
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

          <div class="flex gap-2">
            <button
              @click="openEditDialog(pkg)"
              class="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Edit class="w-4 h-4" />
              编辑
            </button>
            <button
              @click="handleDelete(pkg)"
              class="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
            >
              <Trash2 class="w-4 h-4" />
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="showDialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="showDialog = false"
  >
    <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
      <div class="p-4 border-b flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-800">
          {{ editMode ? '编辑套餐' : '新建套餐' }}
        </h3>
        <button
          @click="showDialog = false"
          class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              套餐名称 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="请输入套餐名称"
              class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              :class="{ 'border-red-500': errors.name }"
            />
            <p v-if="errors.name" class="mt-1 text-sm text-red-500">{{ errors.name }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              套餐描述
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="请输入套餐描述"
              class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              套餐图片
            </label>
            <input
              v-model="form.image"
              type="text"
              placeholder="请输入图片URL"
              class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              包含服务 <span class="text-red-500">*</span>
            </label>
            <div class="mb-3">
              <div class="flex flex-wrap gap-2 mb-3">
                <button
                  v-for="svc in activeServices"
                  :key="svc.id"
                  @click="addService(svc.id)"
                  :disabled="selectedServiceIds.includes(svc.id)"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    selectedServiceIds.includes(svc.id)
                      ? 'bg-blue-600 text-white cursor-default'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  ]"
                >
                  <Check v-if="selectedServiceIds.includes(svc.id)" class="w-3 h-3 inline mr-1" />
                  {{ svc.name }} (¥{{ svc.price }})
                </button>
              </div>
              <p v-if="errors.services" class="text-sm text-red-500">{{ errors.services }}</p>
            </div>

            <div v-if="form.services.length > 0" class="bg-gray-50 rounded-lg p-3">
              <div class="space-y-2">
                <div
                  v-for="ps in form.services"
                  :key="ps.service_id"
                  class="flex items-center justify-between bg-white p-2 rounded border"
                >
                  <div class="flex items-center gap-3">
                    <span class="font-medium text-gray-800">{{ getServiceName(ps.service_id) }}</span>
                    <span class="text-sm text-gray-500">¥{{ getServicePrice(ps.service_id) }}/{{ getServiceName(ps.service_id).includes('保洁') ? '次' : '次' }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1">
                      <button
                        @click="updateQuantity(ps.service_id, ps.quantity - 1)"
                        class="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                      >
                        -
                      </button>
                      <input
                        :value="ps.quantity"
                        @input="updateQuantity(ps.service_id, Number(($event.target as HTMLInputElement).value))"
                        type="number"
                        min="1"
                        class="w-14 px-1 py-1 text-center border rounded"
                      />
                      <button
                        @click="updateQuantity(ps.service_id, ps.quantity + 1)"
                        class="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                      >
                        +
                      </button>
                    </div>
                    <button
                      @click="removeService(ps.service_id)"
                      class="text-red-500 hover:text-red-700"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="mt-3 pt-3 border-t text-sm">
                <div class="flex justify-between text-gray-600">
                  <span>单项累加价格</span>
                  <span>¥{{ originalPrice.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              套餐价格 <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
              <input
                v-model.number="form.price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                :class="{ 'border-red-500': errors.price }"
              />
            </div>
            <p v-if="errors.price" class="mt-1 text-sm text-red-500">{{ errors.price }}</p>
            <div v-if="form.services.length > 0" class="mt-2 text-sm">
              <span v-if="savings > 0" class="text-green-600">
                可节省 ¥{{ savings.toFixed(2) }}
              </span>
              <span v-else class="text-red-500">
                套餐价格必须低于单项累加价格 ¥{{ originalPrice.toFixed(2) }}
              </span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              状态
            </label>
            <select
              v-model="form.status"
              class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="active">上架</option>
              <option value="inactive">下架</option>
            </select>
          </div>
        </div>
      </div>
      <div class="p-4 border-t flex justify-end gap-3">
        <button
          @click="showDialog = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {{ loading ? '提交中...' : (editMode ? '保存' : '创建') }}
        </button>
      </div>
    </div>
  </div>
</template>
