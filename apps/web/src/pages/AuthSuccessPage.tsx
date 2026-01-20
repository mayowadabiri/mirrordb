
export default function AuthSuccessPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
                <div className="mb-6 flex justify-center">
                    <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Success!</h1>
                <p className="text-gray-600 mb-8">You have successfully authenticated with MirrorDB.</p>

                <button
                    onClick={() => window.close()}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                >
                    Close Window
                </button>
            </div>
        </div>
    )
}
