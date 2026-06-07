<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { packageApi, type Package } from '@/lib/api'
import { useAuth } from '@/composables/useAuth'
import Empty from '@/components/Empty.vue'
import { Clock, Tag, ChevronRight, Save } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { isLoggedIn } = useAuth()

const pkg = ref<Package | null>(null)
const loading = ref(true)

const packageId = computed(() => Number(route.params.packageId))

async function loadPackage() {
  try {
    loading.value = true
    const res = await packageApi.get(packageId.value)
    if (res.success && res.data) {
      pkg.value = res.data
    }
  } catch (e) {
    console.error('Failed to load package:', e)
  } finally {
    loading.value = false
  }
}

function handleBooking() {
  if (!isLoggedIn.value) {
    router.push('/login')
    return
  }
  router.push(`/booking/package/${packageId.value}`)
}

onMounted(() => {
  loadPackage()
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="loading" class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
        <div class="aspect-[16/9] bg-gray-200"></div>
        <div class="p-6 space-y-4">
          <div class="h-8 bg-gray-200 rounded w-3/4"></div>
          <div class="h-4 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    </div>

    <Empty v-else-if="!pkg" />

    <div v-else class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <img
          :src="pkg.image"
          :alt="pkg.name"
          class="w-full aspect-[16/9] object-cover"
        />
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <h1 class="text-2xl font-bold text-gray-800">{{ pkg.name }}</h1>
            <span
              :class="[
                'px-3 py-1 rounded-full text-sm font-medium',
                pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              ]"
            >
              {{ pkg.status === 'active' ? '热卖中' : '已下架' }}
            </span>
          </div>

          <div class="mb-6">
            <div class="flex items-baseline gap-3 mb-2">
              <span class="text-gray-400 line-through text-lg">
                ¥{{ pkg.original_price_calculated.toFixed(2) }}
              </span>
              <span class="text-3xl font-bold text-orange-500">
                ¥{{ pkg.price.toFixed(2) }}
              </span>
              <span class="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                <Save class="w-4 h-4" />
                省 ¥{{ pkg.savings.toFixed(2) }}
              </span>
            </div>
            <p class="text-gray-600">{{ pkg.description }}</p>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="flex items-center gap-2 text-gray-600">
              <Tag class="w-5 h-5 text-blue-500" />
              <span>共 {{ pkg.services.length }} 项服务</span>
            </div>
            <div class="flex items-center gap-2 text-gray-600">
              <Clock class="w-5 h-5 text-blue-500" />
              <span>约 {{ pkg.services.reduce((sum, s) => sum + s.duration * s.quantity, 0) }} 分钟</span>
            </div>
          </div>

          <button
            @click="handleBooking"
            :disabled="pkg.status !== 'active'"
            class="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {{ pkg.status === 'active' ? '立即预约' : '已下架' }}
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">套餐包含服务</h2>

        <div class="bg-orange-50 rounded-xl p-4 mb-4">
          <div class="flex justify-between items-center mb-3">
            <span class="text-gray-600">单项总价</span>
            <span class="text-gray-800">¥{{ pkg.original_price_calculated.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">套餐优惠</span>
            <span class="text-green-600">-¥{{ pkg.savings.toFixed(2) }}</span>
          </div>
          <div class="border-t border-orange-200 mt-3 pt-3 flex justify-between items-center">
            <span class="font-medium text-gray-800">套餐价</span>
            <span class="text-xl font-bold text-orange-500">¥{{ pkg.price.toFixed(2) }}</span>
          </div>
        </div>

        <div class="space-y-3">
          <div
            v-for="service in pkg.services"
            :key="service.package_service_id"
            class="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
          >
            <div class="flex items-center gap-4">
              <img
                :src="service.image"
                :alt="service.name"
                class="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <h3 class="font-medium text-gray-800">{{ service.name }}</h3>
                <p class="text-sm text-gray-500">{{ service.description }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-sm text-gray-400 line-through">¥{{ service.price }}</span>
                  <span class="text-sm text-orange-500">× {{ service.quantity }}</span>
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-gray-800 font-medium">¥{{ (service.price * service.quantity).toFixed(2) }}</div>
              <div class="text-xs text-gray-500">
                <Clock class="w-3 h-3 inline mr-1" />
                {{ service.duration }}分钟
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">购买须知</h2>
        <ul class="space-y-2 text-gray-600 text-sm">
          <li class="flex items-start gap-2">
          <ChevronRight class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>套餐内所有服务需在预约时一次性完成，不可拆分使用</span>
          </li>
          <li class="flex items-start gap-2">
          <ChevronRight class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>套餐价格为优惠价格，不与其他优惠叠加</span>
          </li>
          <li class="flex items-start gap-2">
          <ChevronRight class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>如需更换服务人员请提前24小时联系客服</span>
          </li>
          <li class="flex items-start gap-2">
          <ChevronRight class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>服务完成后如有质量问题，24小时内可申请返工</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
