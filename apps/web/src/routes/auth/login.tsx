import { createFileRoute, redirect } from '@tanstack/react-router'
import LoginPage from '../../pages/LoginPage'

interface LoginSearchParams {
    token?: string
}

export const Route = createFileRoute('/auth/login')({
    validateSearch: (search: Record<string, unknown>): LoginSearchParams => {
        return {
            token: search.token as string | undefined,
        }
    },
    beforeLoad: ({ search }) => {
        if (!search.token) {
            throw redirect({
                to: '/start/device',
            })
        }
    },
    component: LoginPage,
})
