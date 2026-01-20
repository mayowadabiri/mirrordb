import { createFileRoute, redirect } from '@tanstack/react-router'
import MfaVerifyPage from '../../pages/MfaVerifyPage'

export const Route = createFileRoute('/mfa/$setupId/verify')({
    component: MfaVerifyPage,
    loader: async ({ params }) => {
        if (!params.setupId) {
            throw redirect({
                to: '/',
            })
        }
        return { setupId: params.setupId }
    },
})
