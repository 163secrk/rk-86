<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { serviceApi, packageApi, type Service, type Package } from '@/lib/api'
import { useAuth } from '@/composables/useAuth'
import Empty from '@/components/Empty.vue'

const router = useRouter()
const { isLoggedIn } = useAuth()

const services = ref<Service[]>([])
const packages = ref<Package[]>([])
const loading = ref(true)

async function loadServices() {
  try {
    loading.value = true
    const [svcRes, pkgRes] = await Promise.all([
      serviceApi.list(),
      packageApi.list(),
    ])
    if (svcRes.success && svcRes.data) {
      services.value = svcRes.data.filter(s => s.status === 'active')
    }
    if (pkgRes.success && pkgRes.data) {
      packages.value = pkgRes.data.filter(p => p.status === 'active')
    }
  } catch (e) {
    console.error('Failed to load services:', e)
  } finally {
    loading.value = false
  }
}

function handleBooking(serviceId: number) {
  if (!isLoggedIn.value) {
    router.push('/login')
    return
  }
  router.push(`/booking/${serviceId}`)
}

function handlePackageDetail(packageId: number) {
  router.push(`/package/${packageId}`)
}

function handlePackageBooking(packageId: number) {
  if (!isLoggedIn.value) {
    router.push('/login')
    return
  }
  router.push(`/booking/package/${packageId}`)
}

onMounted(() => {
  loadServices()
})
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 mb-8 text-white">
      <div class="max-w-3xl">
        <h1 class="text-3xl md:text-4xl font-bold mb-4">专业家政服务，让生活更轻松</h1>
        <p class="text-lg text-blue-100 mb-6">
          我们提供专业的保洁、保姆、月嫂、维修等家政服务，所有服务人员均经过严格培训和背景调查，让您安心、放心。
        </p>
        <div class="flex flex-wrap gap-4">
          <div class="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
            <span class="text-xl">✓</span>
            <span>专业认证</span>
          </div>
          <div class="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
            <span class="text-xl">✓</span>
            <span>价格透明</span>
          </div>
          <div class="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
            <span class="text-xl">✓</span>
            <span>售后保障</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="packages.length > 0">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">热门套餐</h2>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="i in 3"
          :key="i"
          class="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"
        >
          <div class="aspect-[4/3] bg-gray-200"></div>
          <div class="p-4 space-y-3">
            <div class="h-5 bg-gray-200 rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
            <div class="h-10 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="pkg in packages"
          :key="pkg.id"
          class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div class="aspect-[4/3] overflow-hidden relative cursor-pointer" @click="handlePackageDetail(pkg.id)">
            <img
              :src="pkg.image"
              :alt="pkg.name"
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute top-3 left-3 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              省 ¥{{ pkg.savings }}
            </div>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-2 cursor-pointer hover:text-blue-600" @click="handlePackageDetail(pkg.id)">
              {{ pkg.name }}
            </h3>
            <div class="flex flex-wrap gap-1 mb-2">
              <span
                v-for="s in pkg.services.slice(0, 3)"
                :key="s.package_service_id"
                class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
              >
                {{ s.name }}
              </span>
              <span
                v-if="pkg.services.length > 3"
                class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
              >
                +{{ pkg.services.length - 3 }}项
              </span>
            </div>
            <p class="text-sm text-gray-500 mb-3 line-clamp-2">{{ pkg.description }}</p>
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-sm text-gray-400 line-through">¥{{ pkg.original_price_calculated }}</span>
                <span class="text-2xl font-bold text-orange-500 ml-2">¥{{ pkg.price }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click="handlePackageDetail(pkg.id)"
                class="flex-1 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm"
              >
                查看详情
              </button>
              <button
                @click="handlePackageBooking(pkg.id)"
                class="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
              >
                立即预约
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-12">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">热门服务</h2>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="i in 6"
          :key="i"
          class="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"
        >
          <div class="aspect-[4/3] bg-gray-200"></div>
          <div class="p-4 space-y-3">
            <div class="h-5 bg-gray-200 rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
            <div class="h-10 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>

      <Empty v-else-if="services.length === 0" />

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="service in services"
          :key="service.id"
          class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div class="aspect-[4/3] overflow-hidden">
            <img
              :src="service.image"
              :alt="service.name"
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ service.name }}</h3>
            <p class="text-sm text-gray-500 mb-3 line-clamp-2">{{ service.description }}</p>
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-2xl font-bold text-orange-500">¥{{ service.price }}</span>
                <span class="text-sm text-gray-500 ml-1">/{{ service.unit }}</span>
              </div>
            </div>
            <button
              @click="handleBooking(service.id)"
              class="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              立即预约
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
