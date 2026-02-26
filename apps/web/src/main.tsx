import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'

const router = createRouter({ routeTree })
const queryClient = new QueryClient()

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

createRoot(document.getElementById('root')!).render(
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
            <StrictMode>
                <RouterProvider router={router} />
            </StrictMode>
        </QueryClientProvider>
    </GoogleOAuthProvider>,
)
