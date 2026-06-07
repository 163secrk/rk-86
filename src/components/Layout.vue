<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <header class="bg-white shadow-sm sticky top-0 z-50 flex-shrink-0">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center space-x-3 cursor-pointer" @click="goHome">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <span class="text-white font-bold text-xl">家</span>
            </div>
            <span class="text-xl font-bold text-gray-800">家政服务平台</span>
          </div>
          <nav class="hidden md:flex items-center space-x-6">
            <router-link to="/" class="text-gray-600 hover:text-blue-600 transition-colors">首页</router-link>
            <template v-if="isLoggedIn">
              <template v-if="isCustomer">
                <router-link to="/orders" class="text-gray-600 hover:text-blue-600 transition-colors">我的订单</router-link>
              </template>
              <template v-else-if="isWorker">
                <router-link to="/worker/orders" class="text-gray-600 hover:text-blue-600 transition-colors">我的工单</router-link>
              </template>
              <template v-else-if="isAdmin">
                <router-link to="/admin" class="text-gray-600 hover:text-blue-600 transition-colors">管理后台</router-link>
              </template>
            </template>
          </nav>
          <div class="flex items-center space-x-4">
            <template v-if="isLoggedIn && user">
              <div class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span class="text-blue-600 font-medium text-sm">{{ user.name.charAt(0) }}</span>
                </div>
                <div class="hidden sm:block">
                  <p class="text-sm font-medium text-gray-700">{{ user.name }}</p>
                  <p class="text-xs text-gray-500">{{ roleLabel }}</p>
                </div>
              </div>
              <button
                @click="handleLogout"
                class="px-4 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                退出
              </button>
            </template>
            <template v-else>
              <router-link
                to="/login"
                class="px-4 py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                登录
              </router-link>
              <router-link
                to="/register"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                注册
              </router-link>
            </template>
          </div>
        </div>
      </div>
      <div class="md:hidden border-t bg-gray-50 px-4 py-2">
        <div class="flex justify-around">
          <router-link to="/" class="flex flex-col items-center py-1 text-gray-600 hover:text-blue-600">
            <span class="text-sm">首页</span>
          </router-link>
          <template v-if="isLoggedIn">
            <template v-if="isCustomer">
              <router-link to="/orders" class="flex flex-col items-center py-1 text-gray-600 hover:text-blue-600">
                <span class="text-sm">订单</span>
              </router-link>
            </template>
            <template v-else-if="isWorker">
              <router-link to="/worker/orders" class="flex flex-col items-center py-1 text-gray-600 hover:text-blue-600">
                <span class="text-sm">工单</span>
              </router-link>
            </template>
            <template v-else-if="isAdmin">
              <router-link to="/admin" class="flex flex-col items-center py-1 text-gray-600 hover:text-blue-600">
                <span class="text-sm">管理</span>
              </router-link>
            </template>
          </template>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
      <router-view />
    </main>
    <footer class="bg-gray-800 text-gray-300 py-8 mt-auto flex-shrink-0">
      <div class="max-w-7xl mx-auto px-4 text-center">
        <p class="text-sm">© 2024 家政服务平台 - 专业、便捷、放心</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { user, isLoggedIn, isCustomer, isWorker, isAdmin, logout } = useAuth()

const roleLabel = computed(() => {
  const roleMap: Record<string, string> = {
    admin: '管理员',
    customer: '客户',
    worker: '家政人员',
  }
  return roleMap[user.value?.role || ''] || ''
})

function goHome() {
  router.push('/')
}

async function handleLogout() {
  await logout()
}
</script>
