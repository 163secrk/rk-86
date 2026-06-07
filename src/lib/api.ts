export interface User {
  id: number
  username: string
  name: string
  phone: string
  role: 'admin' | 'customer' | 'worker'
}

export interface Service {
  id: number
  name: string
  description: string
  price: number
  unit: string
  duration: number
  category: string
  image: string
  status: string
  created_at: string
}

export interface PackageService {
  package_service_id: number
  package_id: number
  service_id: number
  quantity: number
  name: string
  description: string
  price: number
  unit: string
  duration: number
  image: string
}

export interface Package {
  id: number
  name: string
  description: string
  price: number
  original_price: number
  package_price: number
  package_original_price: number
  original_price_calculated: number
  savings: number
  image: string
  status: string
  created_at: string
  updated_at: string
  services: PackageService[]
}

export interface OrderSubtask {
  id: number
  parent_order_id: number
  service_id: number
  worker_id: number | null
  status: 'pending' | 'assigned' | 'processing' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  service_name?: string
  service_description?: string
  service_price?: number
  worker_name?: string
}

export interface Worker {
  id: number
  user_id: number
  name: string
  phone: string
  skills: string[]
  experience: number
  rating: number
  order_count: number
  status: string
  avatar?: string
  created_at: string
}

export interface Order {
  id: number
  order_no: string
  customer_id: number
  service_id: number
  package_id: number | null
  is_package_order: number
  subtotal_price: number
  worker_id: number | null
  contact_name: string
  contact_phone: string
  address: string
  appointment_time: string
  price: number
  status: 'pending' | 'assigned' | 'processing' | 'completed' | 'cancelled'
  remark: string
  created_at: string
  updated_at: string
  service_name?: string
  package_name?: string
  customer_name?: string
  worker_name?: string
  follow_up_id?: number
  follow_up_status?: 'pending' | 'completed' | 'expired'
  follow_up_expire_at?: string
  attitude_rating?: number
  quality_rating?: number
  punctuality_rating?: number
  feedback?: string
  follow_up_completed_at?: string
  subtasks?: OrderSubtask[]
}

export interface FollowUp {
  id: number
  order_id: number
  customer_id: number
  worker_id: number
  attitude_rating?: number
  quality_rating?: number
  punctuality_rating?: number
  feedback?: string
  status: 'pending' | 'completed' | 'expired'
  expire_at: string
  created_at: string
  completed_at?: string
  is_expired?: boolean
  order_no?: string
  price?: number
  appointment_time?: string
  order_status?: string
  service_name?: string
  customer_name?: string
  worker_name?: string
}

export interface WorkerFollowUpStats {
  avg_attitude: number
  avg_quality: number
  avg_punctuality: number
  overall_rating: number
  total_count: number
  completed_count: number
  pending_count: number
  expired_count: number
}

export interface Review {
  id: number
  order_id: number
  customer_id: number
  worker_id: number
  rating: number
  content: string
  created_at: string
  customer_name?: string
  worker_name?: string
  service_name?: string
}

export interface MemberLevel {
  level: string
  minSpent: number
  maxSpent: number
  discount: number
  pointsRate: number
}

export interface Member {
  id: number
  user_id: number
  level: string
  points: number
  total_spent: number
  total_orders: number
  discount: number
  created_at: string
  updated_at: string
  currentLevelConfig?: MemberLevel
  nextLevel?: MemberLevel | null
  progress?: number
}

export interface PointsRecord {
  id: number
  member_id: number
  user_id: number
  type: 'earn' | 'spend'
  points: number
  balance: number
  order_id?: number
  description?: string
  created_at: string
  order_no?: string
  service_name?: string
}

export interface PointsDeductionResult {
  points_available: number
  points_requested: number
  points_used: number
  deduction_amount: number
  max_deduction: number
  member_level: string
  member_discount: number
}

const baseURL = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string }> {
  const userId = localStorage.getItem('userId')
  const headers = {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
    ...options.headers,
  }

  const response = await fetch(baseURL + path, {
    ...options,
    headers,
  })

  return response.json()
}

export const authApi = {
  register: (data: { username: string; password: string; name: string; phone?: string; role?: string }) =>
    request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { username: string; password: string }) =>
    request<User>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  profile: () => request<User>('/auth/profile'),
}

export const serviceApi = {
  list: () => request<Service[]>('/services'),
  get: (id: number) => request<Service>(`/services/${id}`),
  create: (data: Partial<Service>) =>
    request<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Service>) =>
    request<Service>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/services/${id}`, { method: 'DELETE' }),
}

export const packageApi = {
  list: () => request<Package[]>('/packages'),
  get: (id: number) => request<Package>(`/packages/${id}`),
  create: (data: Partial<Package> & { services: { service_id: number; quantity: number }[] }) =>
    request<Package>('/packages', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Package> & { services?: { service_id: number; quantity: number }[] }) =>
    request<Package>(`/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/packages/${id}`, { method: 'DELETE' }),
}

export const workerApi = {
  list: () => request<Worker[]>('/workers'),
  get: (id: number) => request<Worker>(`/workers/${id}`),
  create: (data: Partial<Worker> & { user_id: number }) =>
    request<Worker>('/workers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Worker>) =>
    request<Worker>(`/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/workers/${id}`, { method: 'DELETE' }),
}

export const orderApi = {
  list: (params?: { status?: string }) =>
    request<Order[]>(params ? `/orders?status=${params.status}` : '/orders'),
  get: (id: number) => request<Order>(`/orders/${id}`),
  create: (data: {
    service_id?: number
    package_id?: number
    contact_name: string
    contact_phone: string
    address: string
    appointment_time: string
    price: number
    remark?: string
    use_points?: number
  }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Order>) =>
    request<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assign: (id: number, worker_id: number) =>
    request<Order>(`/orders/${id}/assign`, { method: 'PUT', body: JSON.stringify({ worker_id }) }),
  assignSubtask: (orderId: number, subtaskId: number, worker_id: number) =>
    request<Order>(`/orders/${orderId}/subtasks/${subtaskId}/assign`, { method: 'PUT', body: JSON.stringify({ worker_id }) }),
  updateStatus: (id: number, status: Order['status']) =>
    request<Order>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  updateSubtaskStatus: (orderId: number, subtaskId: number, status: OrderSubtask['status']) =>
    request<Order>(`/orders/${orderId}/subtasks/${subtaskId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
}

export const reviewApi = {
  list: (params?: { worker_id?: number; order_id?: number }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return request<Review[]>(`/reviews${q}`)
  },
  get: (id: number) => request<Review>(`/reviews/${id}`),
  create: (data: { order_id: number; worker_id: number; rating: number; content?: string }) =>
    request<Review>('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getByWorker: (workerId: number) =>
    request<{ reviews: Review[]; avg_rating: number; review_count: number }>(`/reviews/worker/${workerId}`),
}

export const memberApi = {
  profile: () => request<Member>('/members/profile'),
  points: (params?: { page?: number; pageSize?: number }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return request<{ records: PointsRecord[]; total: number; page: number; pageSize: number }>(`/members/points${q}`)
  },
  orders: (params?: { page?: number; pageSize?: number }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return request<{ orders: Order[]; total: number; total_spent: number; page: number; pageSize: number }>(`/members/orders${q}`)
  },
  calculateDeduction: (data: { points: number; order_amount: number }) =>
    request<PointsDeductionResult>('/members/calculate-deduction', { method: 'POST', body: JSON.stringify(data) }),
  levels: () => request<MemberLevel[]>('/members/levels'),
}

export const followUpApi = {
  list: (params?: { worker_id?: number; order_id?: number; status?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return request<FollowUp[]>(`/follow-ups${q}`)
  },
  get: (id: number) => request<FollowUp>(`/follow-ups/${id}`),
  getByOrder: (orderId: number) => request<FollowUp>(`/follow-ups/order/${orderId}`),
  submit: (id: number, data: {
    attitude_rating: number
    quality_rating: number
    punctuality_rating: number
    feedback?: string
  }) =>
    request<FollowUp>(`/follow-ups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getWorkerStats: (workerId: number) =>
    request<WorkerFollowUpStats>(`/follow-ups/worker/${workerId}/stats`),
}
