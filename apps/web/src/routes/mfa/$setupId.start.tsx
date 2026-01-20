import { createFileRoute, redirect } from '@tanstack/react-router'
import MfaSetupPage from '../../pages/MfaSetupPage'
import { getMfaSetup } from '../../api/mfa'

export const Route = createFileRoute('/mfa/$setupId/start')({
    component: MfaSetupPage,
    loader: async ({ params }) => {
        try {
            const data = await getMfaSetup(params.setupId)
            return data
        } catch (error) {
            // If setupId doesn't exist or is invalid, redirect to home
            throw redirect({
                to: '/',
            })
        }
    },
})
