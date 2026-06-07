import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import BookingPage from '@/pages/BookingPage.vue'
import CustomerOrdersPage from '@/pages/CustomerOrdersPage.vue'
import WorkerOrdersPage from '@/pages/WorkerOrdersPage.vue'
import AdminDashboard from '@/pages/AdminDashboard.vue'
import ReviewPage from '@/pages/ReviewPage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
  },
  {
    path: '/booking/:serviceId',
    name: 'booking',
    component: BookingPage,
  },
  {
    path: '/orders',
    name: 'orders',
    component: CustomerOrdersPage,
  },
  {
    path: '/worker/orders',
    name: 'worker-orders',
    component: WorkerOrdersPage,
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminDashboard,
  },
  {
    path: '/review/:orderId',
    name: 'review',
    component: ReviewPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
