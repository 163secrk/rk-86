<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { serviceApi, orderApi, type Service } from '@/lib/api'
import { useAuth } from '@/composables/useAuth'
import Empty from '@/components/Empty.vue'

const route = useRoute()
const router = useRouter()
const { requireAuth, user } = useAuth()

const service = ref<Service | null>(null)
const loading = ref(true)
const submitting = ref(false)

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

async function loadService() {
  try {
    loading.value = true
    const res = await serviceApi.get(serviceId.value)
    if (res.success && res.data) {
      service.value = res.data
      if (user.value) {
        form.contact_name = user.value.name
        form.contact_phone = user.value.phone || ''
      }
    }
  } catch (e) {
    console.error('Failed to load service:', e)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!validateForm() || !service.value) return

  try {
    submitting.value = true
    const res = await orderApi.create({
      service_id: service.value.id,
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      address: form.address,
      appointment_time: form.appointment_time,
      remark: form.remark,
    })

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
  loadService()
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold text-gray-800 mb-6">预约服务</h1>

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

    <Empty v-else-if="!service" />

    <div v-else class="grid md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <img
          :src="service.image"
          :alt="service.name"
          class="w-full aspect-[4/3] object-cover"
        />
        <div class="p-4">
          <h2 class="text-xl font-semibold text-gray-800 mb-2">{{ service.name }}</h2>
          <div class="mb-3">
            <span class="text-2xl font-bold text-orange-500">¥{{ service.price }}</span>
            <span class="text-sm text-gray-500 ml-1">/{{ service.unit }}</span>
          </div>
          <p class="text-sm text-gray-600">{{ service.description }}</p>
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
          <span v-else>确认预约</span>
        </button>
      </form>
    </div>
  </div>
</template>
