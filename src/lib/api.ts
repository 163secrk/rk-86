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
  customer_name?: string
  worker_name?: string
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
    service_id: number
    contact_name: string
    contact_phone: string
    address: string
    appointment_time: string
    remark?: string
  }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Order>) =>
    request<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assign: (id: number, worker_id: number) =>
    request<Order>(`/orders/${id}/assign`, { method: 'PUT', body: JSON.stringify({ worker_id }) }),
  updateStatus: (id: number, status: Order['status']) =>
    request<Order>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
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
