<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { register, loading } = useAuth()

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  name: '',
  phone: '',
  role: 'customer' as 'customer' | 'worker',
})

const errors = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  name: '',
  phone: '',
})

const apiError = ref('')

function validateForm() {
  let isValid = true
  errors.username = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.name = ''
  errors.phone = ''
  apiError.value = ''

  if (!form.username.trim()) {
    errors.username = '请输入用户名'
    isValid = false
  } else if (form.username.length < 3) {
    errors.username = '用户名至少3个字符'
    isValid = false
  }

  if (!form.password) {
    errors.password = '请输入密码'
    isValid = false
  } else if (form.password.length < 6) {
    errors.password = '密码至少6个字符'
    isValid = false
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = '请确认密码'
    isValid = false
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次密码输入不一致'
    isValid = false
  }

  if (!form.name.trim()) {
    errors.name = '请输入姓名'
    isValid = false
  }

  if (!form.phone.trim()) {
    errors.phone = '请输入手机号'
    isValid = false
  } else if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    errors.phone = '请输入正确的手机号'
    isValid = false
  }

  return isValid
}

async function handleSubmit() {
  if (loading.value) return

  if (!validateForm()) return

  const result = await register({
    username: form.username,
    password: form.password,
    name: form.name,
    phone: form.phone,
    role: form.role,
  })

  if (result.success) {
    router.push('/')
  } else {
    apiError.value = result.error || '注册失败，请重试'
  }
}

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4 py-12">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">家政服务平台</h1>
        <p class="text-gray-500">创建新账户，开始使用服务</p>
      </div>

      <div class="bg-white rounded-2xl shadow-xl p-8">
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <div v-if="apiError" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {{ apiError }}
          </div>

          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              placeholder="请输入用户名（至少3个字符）"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              :class="{ 'border-red-500': errors.username }"
            />
            <p v-if="errors.username" class="mt-1 text-sm text-red-500">
              {{ errors.username }}
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                id="password"
                v-model="form.password"
                type="password"
                placeholder="至少6个字符"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                :class="{ 'border-red-500': errors.password }"
              />
              <p v-if="errors.password" class="mt-1 text-sm text-red-500">
                {{ errors.password }}
              </p>
            </div>

            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
                确认密码
              </label>
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                type="password"
                placeholder="再次输入密码"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                :class="{ 'border-red-500': errors.confirmPassword }"
              />
              <p v-if="errors.confirmPassword" class="mt-1 text-sm text-red-500">
                {{ errors.confirmPassword }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
                姓名
              </label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="请输入真实姓名"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                :class="{ 'border-red-500': errors.name }"
              />
              <p v-if="errors.name" class="mt-1 text-sm text-red-500">
                {{ errors.name }}
              </p>
            </div>

            <div>
              <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
                手机号
              </label>
              <input
                id="phone"
                v-model="form.phone"
                type="tel"
                placeholder="请输入手机号"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                :class="{ 'border-red-500': errors.phone }"
              />
              <p v-if="errors.phone" class="mt-1 text-sm text-red-500">
                {{ errors.phone }}
              </p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-3">
              选择角色
            </label>
            <div class="flex gap-4">
              <label
                class="flex-1 flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all"
                :class="form.role === 'customer' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'"
              >
                <input
                  v-model="form.role"
                  type="radio"
                  value="customer"
                  class="sr-only"
                />
                <div class="text-center">
                  <div class="text-2xl mb-1">👤</div>
                  <div class="text-sm font-medium" :class="form.role === 'customer' ? 'text-emerald-700' : 'text-gray-700'">
                    客户
                  </div>
                  <div class="text-xs text-gray-500 mt-1">预约家政服务</div>
                </div>
              </label>

              <label
                class="flex-1 flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all"
                :class="form.role === 'worker' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'"
              >
                <input
                  v-model="form.role"
                  type="radio"
                  value="worker"
                  class="sr-only"
                />
                <div class="text-center">
                  <div class="text-2xl mb-1">🧹</div>
                  <div class="text-sm font-medium" :class="form.role === 'worker' ? 'text-emerald-700' : 'text-gray-700'">
                    家政人员
                  </div>
                  <div class="text-xs text-gray-500 mt-1">提供家政服务</div>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? '注册中...' : '注 册' }}
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-gray-600">
            已有账户？
            <button
              @click="goToLogin"
              class="text-emerald-600 hover:text-emerald-700 font-medium ml-1"
            >
              立即登录
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
