import { createFileRoute, redirect } from '@tanstack/react-router'
import MfaChallengeVerifyPage from '../../pages/MfaChallengeVerifyPage'
import { getMfaChallenge } from '../../api/mfa'

export const Route = createFileRoute('/mfa/challenge/$challengeId/verify')({
    component: MfaChallengeVerifyPage,
    loader: async ({ params }) => {
        try {
            const data = await getMfaChallenge(params.challengeId)
            return data
        } catch {
            redirect({
                to: '/',
            })
        }
    },
})
