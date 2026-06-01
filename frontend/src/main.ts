import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import './styles.css'
import './styles/components.css'

initTheme()

const app = createApp(App)
app.use(router)
app.mount('#app')
