<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { serviceApi, orderApi, memberApi, packageApi, type Service, type Package, type Member, type PointsDeductionResult } from '@/lib/api'
import { useAuth } from '@/composables/useAuth'
import Empty from '@/components/Empty.vue'
import { Crown, Coins, Info, Minus, Plus } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { requireAuth, user } = useAuth()

const service = ref<Service | null>(null)
const package_ = ref<Package | null>(null)
const member = ref<Member | null>(null)
const loading = ref(true)
const submitting = ref(false)
const usePoints = ref(false)
const pointsToUse = ref(0)
const deductionResult = ref<PointsDeductionResult | null>(null)
const calculatingDeduction = ref(false)

const form = reactive({
  contact_name: '',
  contact_phone: '',
  address: '',
  appointment_time: '',
  remark: '',
})

const errors = reactive({
  contact_name: '',
  contact_phone: '',
  address: '',
  appointment_time: '',
})

const serviceId = computed(() => Number(route.params.serviceId))
const packageId = computed(() => Number(route.params.packageId))

const isPackageBooking = computed(() => !!packageId.value && !serviceId.value)

const levelColors: Record<string, { bg: string; text: string }> = {
  '普通': { bg: 'bg-gray-100', text: 'text-gray-600' },
  '银卡': { bg: 'bg-slate-100', text: 'text-slate-600' },
  '金卡': { bg: 'bg-amber-100', text: 'text-amber-700' },
  '钻石': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
}

const originalPrice = computed(() => {
  if (isPackageBooking.value) {
    return package_.value?.package_original_price || 0
  }
  return service.value?.price || 0
})

const packagePrice = computed(() => {
  return package_.value?.package_price || 0
})

const discountedPrice = computed(() => {
  if (isPackageBooking.value) {
    return packagePrice.value
  }
  if (!member.value) return originalPrice.value
  return Math.round(originalPrice.value * member.value.discount * 100) / 100
})

const discountAmount = computed(() => {
  if (isPackageBooking.value) {
    return 0
  }
  return Math.round((originalPrice.value - discountedPrice.value) * 100) / 100
})

const packageSavings = computed(() => {
  if (!isPackageBooking.value) return 0
  return Math.round((originalPrice.value - packagePrice.value) * 100) / 100
})

const finalPrice = computed(() => {
  if (!usePoints.value || !deductionResult.value) return discountedPrice.value
  return Math.max(0, Math.round((discountedPrice.value - deductionResult.value.deduction_amount) * 100) / 100)
})

const totalSavings = computed(() => {
  return Math.round((packageSavings.value + discountAmount.value + (deductionResult.value?.deduction_amount || 0)) * 100) / 100
})

const maxPointsToUse = computed(() => {
  if (!member.value) return 0
  const maxByHalfPrice = Math.floor(discountedPrice.value * 0.5) * 100
  return Math.min(member.value.points, maxByHalfPrice)
})

watch([usePoints, pointsToUse, service, package_], async () => {
  if (usePoints.value && pointsToUse.value > 0 && discountedPrice.value > 0) {
    await calculateDeduction()
  } else {
    deductionResult.value = null
  }
}, { deep: true })

async function calculateDeduction() {
  if (pointsToUse.value <= 0) return
  calculatingDeduction.value = true
  try {
    const res = await memberApi.calculateDeduction({
      points: pointsToUse.value,
      order_amount: discountedPrice.value,
    })
    if (res.success && res.data) {
      deductionResult.value = res.data
      pointsToUse.value = res.data.points_used
    }
  } catch (e) {
    console.error('Failed to calculate deduction:', e)
  } finally {
    calculatingDeduction.value = false
  }
}

function adjustPoints(delta: number) {
  const newValue = pointsToUse.value + delta
  if (newValue >= 0 && newValue <= maxPointsToUse.value) {
    pointsToUse.value = newValue
  }
}

function useMaxPoints() {
  pointsToUse.value = maxPointsToUse.value
}

function validateForm(): boolean {
  let valid = true

  if (!form.contact_name.trim()) {
    errors.contact_name = '请输入联系人姓名'
    valid = false
  } else {
    errors.contact_name = ''
  }

  if (!form.contact_phone.trim()) {
    errors.contact_phone = '请输入联系电话'
    valid = false
  } else if (!/^1[3-9]\d{9}$/.test(form.contact_phone)) {
    errors.contact_phone = '请输入正确的手机号码'
    valid = false
  } else {
    errors.contact_phone = ''
  }

  if (!form.address.trim()) {
    errors.address = '请输入服务地址'
    valid = false
  } else {
    errors.address = ''
  }

  if (!form.appointment_time) {
    errors.appointment_time = '请选择预约时间'
    valid = false
  } else {
    const selectedTime = new Date(form.appointment_time)
    if (selectedTime < new Date()) {
      errors.appointment_time = '预约时间不能早于当前时间'
      valid = false
    } else {
      errors.appointment_time = ''
    }
  }

  return valid
}

async function loadBookingData() {
  try {
    loading.value = true
    const memberRes = await memberApi.profile().catch(() => null)
    
    if (isPackageBooking.value) {
      const packageRes = await packageApi.get(packageId.value)
      if (packageRes.success && packageRes.data) {
        package_.value = packageRes.data
        if (user.value) {
          form.contact_name = user.value.name
          form.contact_phone = user.value.phone || ''
        }
      }
    } else {
      const serviceRes = await serviceApi.get(serviceId.value)
      if (serviceRes.success && serviceRes.data) {
        service.value = serviceRes.data
        if (user.value) {
          form.contact_name = user.value.name
          form.contact_phone = user.value.phone || ''
        }
      }
    }
    
    if (memberRes && memberRes.success && memberRes.data) {
      member.value = memberRes.data
    }
  } catch (e) {
    console.error('Failed to load booking data:', e)
  } finally {
    loading.value = false
  }
}

function formatDateTimeLocal(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:00`
}

async function handleSubmit() {
  if (!validateForm()) return
  if (isPackageBooking.value && !package_.value) return
  if (!isPackageBooking.value && !service.value) return

  try {
    submitting.value = true
    const orderData: any = {
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      address: form.address,
      appointment_time: formatDateTimeLocal(form.appointment_time),
      price: finalPrice.value,
      remark: form.remark,
      use_points: usePoints.value && deductionResult.value ? deductionResult.value.points_used : 0,
    }

    if (isPackageBooking.value) {
      orderData.package_id = package_.value!.id
    } else {
      orderData.service_id = service.value!.id
    }

    const res = await orderApi.create(orderData)

    if (res.success) {
      router.push('/orders')
    } else {
      alert(res.error || '提交失败，请重试')
    }
  } catch (e) {
    console.error('Failed to create order:', e)
    alert('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (!requireAuth()) return
  loadBookingData()
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold text-gray-800 mb-6">{{ isPackageBooking ? '预约套餐' : '预约服务' }}</h1>

    <div v-if="loading" class="grid md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-4 animate-pulse">
        <div class="aspect-[4/3] bg-gray-200 rounded-lg mb-4"></div>
        <div class="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div class="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-4 bg-gray-200 rounded w-full"></div>
      </div>
      <div class="space-y-4">
        <div v-for="i in 5" :key="i" class="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    </div>

    <Empty v-else-if="isPackageBooking ? !package_ : !service" />

    <div v-else class="grid md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <img
          :src="isPackageBooking ? package_.image : service.image"
          :alt="isPackageBooking ? package_.name : service.name"
          class="w-full aspect-[4/3] object-cover"
        />
        <div class="p-4">
          <div class="flex items-start justify-between mb-2">
            <h2 class="text-xl font-semibold text-gray-800">{{ isPackageBooking ? package_.name : service.name }}</h2>
            <div
              v-if="member"
              :class="[
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                levelColors[member.level]?.bg || 'bg-gray-100',
                levelColors[member.level]?.text || 'text-gray-600',
              ]"
            >
              <Crown class="w-3 h-3" />
              <span>{{ member.level }}会员</span>
            </div>
          </div>

          <template v-if="isPackageBooking">
            <div class="mb-3">
              <div class="flex items-baseline gap-2">
                <span class="text-sm text-gray-400 line-through">
                  ¥{{ originalPrice.toFixed(2) }}
                </span>
                <span class="text-2xl font-bold text-orange-500">
                  ¥{{ packagePrice.toFixed(2) }}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">
                  套餐优惠
                </span>
                <span class="text-xs text-green-600">
                  已节省 ¥{{ packageSavings.toFixed(2) }}
                </span>
              </div>
              <div v-if="member" class="mt-2 text-xs text-orange-500 flex items-center gap-1">
                <Info class="w-3 h-3" />
                <span>套餐不享受会员折扣</span>
              </div>
            </div>

            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 mb-2">套餐包含服务</h4>
              <div class="space-y-2">
                <div
                  v-for="pkgService in package_.services"
                  :key="pkgService.package_service_id"
                  class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center gap-2">
                    <img
                      :src="pkgService.image"
                      :alt="pkgService.name"
                      class="w-10 h-10 rounded object-cover"
                    />
                    <div>
                      <div class="text-sm font-medium text-gray-800">{{ pkgService.name }}</div>
                      <div class="text-xs text-gray-500">x{{ pkgService.quantity }}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm text-gray-800">¥{{ pkgService.price.toFixed(2) }}</div>
                    <div class="text-xs text-gray-500">/{{ pkgService.unit }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="mb-3">
              <div class="flex items-baseline gap-2">
                <span v-if="member && discountAmount > 0" class="text-sm text-gray-400 line-through">
                  ¥{{ originalPrice.toFixed(2) }}
                </span>
                <span class="text-2xl font-bold text-orange-500">
                  ¥{{ discountedPrice.toFixed(2) }}
                </span>
                <span class="text-sm text-gray-500">/{{ service.unit }}</span>
              </div>
              <div v-if="member && discountAmount > 0" class="flex items-center gap-2 mt-1">
                <span class="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                  {{ (member.discount * 10).toFixed(1) }}折
                </span>
                <span class="text-xs text-green-600">
                  已优惠 ¥{{ discountAmount.toFixed(2) }}
                </span>
              </div>
            </div>
          </template>

          <p class="text-sm text-gray-600">{{ isPackageBooking ? package_.description : service.description }}</p>
        </div>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">填写预约信息</h3>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            联系人姓名 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.contact_name"
            type="text"
            placeholder="请输入联系人姓名"
            class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            :class="{ 'border-red-500': errors.contact_name }"
          />
          <p v-if="errors.contact_name" class="mt-1 text-sm text-red-500">{{ errors.contact_name }}</p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            联系电话 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.contact_phone"
            type="tel"
            placeholder="请输入联系电话"
            class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            :class="{ 'border-red-500': errors.contact_phone }"
          />
          <p v-if="errors.contact_phone" class="mt-1 text-sm text-red-500">{{ errors.contact_phone }}</p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            服务地址 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.address"
            type="text"
            placeholder="请输入详细服务地址"
            class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            :class="{ 'border-red-500': errors.address }"
          />
          <p v-if="errors.address" class="mt-1 text-sm text-red-500">{{ errors.address }}</p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            预约时间 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.appointment_time"
            type="datetime-local"
            class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            :class="{ 'border-red-500': errors.appointment_time }"
          />
          <p v-if="errors.appointment_time" class="mt-1 text-sm text-red-500">{{ errors.appointment_time }}</p>
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">
            备注
          </label>
          <textarea
            v-model="form.remark"
            rows="3"
            placeholder="请输入备注信息（选填）"
            class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
          ></textarea>
        </div>

        <div v-if="member && member.points > 0" class="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Coins class="w-5 h-5 text-amber-500" />
              <span class="font-medium text-gray-800">积分抵扣</span>
              <span class="text-sm text-gray-500">(可用 {{ member.points }} 积分)</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="usePoints" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div v-if="usePoints" class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  @click="adjustPoints(-100)"
                  class="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Minus class="w-4 h-4 text-gray-600" />
                </button>
                <input
                  v-model.number="pointsToUse"
                  type="number"
                  min="0"
                  :max="maxPointsToUse"
                  step="100"
                  class="w-24 px-2 py-1.5 text-center border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
                <button
                  @click="adjustPoints(100)"
                  class="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Plus class="w-4 h-4 text-gray-600" />
                </button>
                <button
                  @click="useMaxPoints"
                  class="ml-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  最大
                </button>
              </div>
              <div class="text-right">
                <div v-if="deductionResult" class="text-lg font-bold text-amber-600">
                  -¥{{ deductionResult.deduction_amount.toFixed(2) }}
                </div>
                <div v-else-if="calculatingDeduction" class="text-sm text-gray-500">
                  计算中...
                </div>
              </div>
            </div>
            <div class="flex items-start gap-2 text-xs text-gray-500">
              <Info class="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>100积分抵扣1元，每次最多抵扣订单金额的50%。当前可用积分可抵扣最多¥{{ (maxPointsToUse / 100).toFixed(2) }}</p>
            </div>
          </div>
        </div>

        <div class="mb-6 p-4 bg-gray-50 rounded-xl">
          <h4 class="font-medium text-gray-800 mb-3">费用明细</h4>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">{{ isPackageBooking ? '套餐原价' : '服务原价' }}</span>
              <span class="text-gray-800">¥{{ originalPrice.toFixed(2) }}</span>
            </div>
            <div v-if="isPackageBooking && packageSavings > 0" class="flex justify-between">
              <span class="text-gray-500">套餐优惠</span>
              <span class="text-green-600">-¥{{ packageSavings.toFixed(2) }}</span>
            </div>
            <div v-if="!isPackageBooking && member && discountAmount > 0" class="flex justify-between">
              <span class="text-gray-500">会员折扣</span>
              <span class="text-green-600">-¥{{ discountAmount.toFixed(2) }}</span>
            </div>
            <div v-if="usePoints && deductionResult && deductionResult.deduction_amount > 0" class="flex justify-between">
              <span class="text-gray-500">积分抵扣 ({{ deductionResult.points_used }}积分)</span>
              <span class="text-amber-600">-¥{{ deductionResult.deduction_amount.toFixed(2) }}</span>
            </div>
            <div class="border-t pt-2 mt-2">
              <div class="flex justify-between items-center">
                <span class="font-medium text-gray-800">应付金额</span>
                <span class="text-2xl font-bold text-orange-500">¥{{ finalPrice.toFixed(2) }}</span>
              </div>
              <div v-if="totalSavings > 0" class="flex justify-end mt-1">
                <span class="text-xs text-green-600">已为您节省 ¥{{ totalSavings.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          <span v-if="submitting" class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            提交中...
          </span>
          <span v-else>确认预约 · ¥{{ finalPrice.toFixed(2) }}</span>
        </button>
      </form>
    </div>
  </div>
</template>
