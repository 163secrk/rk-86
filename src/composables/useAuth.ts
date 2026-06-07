import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { User } from '@/lib/api'
import { authApi } from '@/lib/api'

const user = ref<User | null>(null)
const loading = ref(false)

export function useAuth() {
  const router = useRouter()

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isCustomer = computed(() => user.value?.role === 'customer')
  const isWorker = computed(() => user.value?.role === 'worker')

  async function loadUser() {
    const userId = localStorage.getItem('userId')
    if (!userId) return

    try {
      loading.value = true
      const res = await authApi.profile()
      if (res.success && res.data) {
        user.value = res.data
      } else {
        localStorage.removeItem('userId')
      }
    } catch (e) {
      localStorage.removeItem('userId')
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    loading.value = true
    try {
      const res = await authApi.login({ username, password })
      if (res.success && res.data) {
        user.value = res.data
        localStorage.setItem('userId', String(res.data.id))
        return { success: true }
      }
      return { success: false, error: res.error }
    } finally {
      loading.value = false
    }
  }

  async function register(data: { username: string; password: string; name: string; phone?: string; role?: string }) {
    loading.value = true
    try {
      const res = await authApi.register(data)
      if (res.success && res.data) {
        user.value = res.data
        localStorage.setItem('userId', String(res.data.id))
        return { success: true }
      }
      return { success: false, error: res.error }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch (e) {
      // ignore
    }
    user.value = null
    localStorage.removeItem('userId')
    router.push('/login')
  }

  function requireAuth() {
    if (!user.value && !localStorage.getItem('userId')) {
      router.push('/login')
      return false
    }
    return true
  }

  function requireRole(...roles: string[]) {
    if (!requireAuth()) return false
    if (!user.value) return false
    if (!roles.includes(user.value.role)) {
      router.push('/')
      return false
    }
    return true
  }

  return {
    user,
    loading,
    isLoggedIn,
    isAdmin,
    isCustomer,
    isWorker,
    loadUser,
    login,
    register,
    logout,
    requireAuth,
    requireRole,
  }
}
