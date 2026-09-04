import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ToastContainer } from 'react-toastify'
import { store } from './store/store'
import App from './App'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'

// PWA Service Worker Registration
import { registerSW } from 'virtual:pwa-register'

// Keep the PWA installable in production and on localhost. Local registration
// can be disabled with VITE_PWA_DEV_ENABLED=false when debugging cache issues.
const pwaEnabled = import.meta.env.PROD || import.meta.env.VITE_PWA_DEV_ENABLED !== 'false'

if (pwaEnabled && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('🔄 New content available, reloading...')
      window.location.reload()
    },
    onOfflineReady() {
      console.log('✅ App ready to work offline')
    },
    onRegistered(registration) {
      console.log('✅ Service Worker registered:', registration)
    },
    onRegisterError(error) {
      console.error('❌ Service Worker registration failed:', error)
    }
  })
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
)
