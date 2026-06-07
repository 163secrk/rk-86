import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { useAuth } from './composables/useAuth'

const app = createApp(App)
app.use(router)

const { loadUser } = useAuth()
loadUser()

app.mount('#app')
