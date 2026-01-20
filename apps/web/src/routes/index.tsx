import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: () => (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to MirrorDB</h1>
                <p className="text-gray-600">Your database mirroring solution</p>
            </div>
        </div>
    ),
})
