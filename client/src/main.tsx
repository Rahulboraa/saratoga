import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './lib/auth'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: { fontSize: '13px', borderRadius: '10px', border: '1px solid hsl(214.3 31.8% 91.4%)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', padding: '10px 14px', color: 'hsl(222.2 84% 4.9%)' },
              success: { iconTheme: { primary: 'hsl(152 60% 44%)', secondary: 'white' } },
              error: { iconTheme: { primary: 'hsl(0 79% 63%)', secondary: 'white' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
