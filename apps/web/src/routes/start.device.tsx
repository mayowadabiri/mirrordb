import { createFileRoute } from '@tanstack/react-router'
import DeviceAuthPage from '../pages/DeviceAuthPage'

interface DeviceSearch {
    code?: string
}

export const Route = createFileRoute('/start/device')({
    component: DeviceAuthPage,
    validateSearch: (search: Record<string, unknown>): DeviceSearch => {
        return {
            code: search.code as string | undefined,
        }
    },
})
