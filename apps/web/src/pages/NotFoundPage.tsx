import { Link } from '@tanstack/react-router'

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="text-center">
                <div className="mb-8">
                    <h1 className="text-9xl font-bold text-gray-900 mb-4">404</h1>
                    <div className="w-24 h-1 bg-blue-600 mx-auto mb-8"></div>
                </div>

                <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                    Page Not Found
                </h2>

                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    The page you're looking for doesn't exist or has been moved.
                </p>

                <div className="flex gap-4 justify-center">
                    <Link
                        to="/"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
                    >
                        Go Home
                    </Link>

                    <Link
                        to="/auth/login"
                        className="bg-white hover:bg-gray-50 text-gray-900 font-medium py-3 px-6 rounded-lg border-2 border-gray-300 transition-colors duration-200"
                    >
                        Sign In
                    </Link>
                </div>

                <div className="mt-12">
                    <svg
                        className="w-64 h-64 mx-auto text-gray-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={0.5}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>
            </div>
        </div>
    )
}
