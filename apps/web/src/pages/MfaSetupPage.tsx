import { QRCodeSVG } from 'qrcode.react'
import { useParams } from '@tanstack/react-router'
import { Route } from '../routes/mfa/$setupId.start'

export default function MfaSetupPage() {
    const data = Route.useLoaderData()
    const { setupId } = useParams({ from: '/mfa/$setupId/start' })


    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Set Up Two-Factor Authentication
                    </h1>
                    <p className="text-gray-600">
                        Scan the QR code below with your authenticator app
                    </p>
                </div>

                <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 mb-6">
                    <div className="flex flex-col items-center justify-center mb-6">
                        <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                            <QRCodeSVG
                                value={data?.otpauthUrl}
                                size={256}
                                level="H"
                                includeMargin={true}
                            />
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <p className="text-sm text-gray-600 mb-2">
                            Can't scan the QR code?
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-xs text-gray-600 mb-1">Manual Entry Code</p>
                            <p className="font-mono text-sm text-gray-900 break-all">
                                {data?.secret}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Instructions
                    </h2>
                    <ol className="space-y-3 text-gray-700">
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                1
                            </span>
                            <span>
                                Download an authenticator app such as{' '}
                                <strong>Google Authenticator</strong>,{' '}
                                <strong>Authy</strong>, or{' '}
                                <strong>Microsoft Authenticator</strong> on your mobile device
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                2
                            </span>
                            <span>
                                Open the authenticator app and scan the QR code above, or manually enter the code provided
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                3
                            </span>
                            <span>
                                Your authenticator app will generate a 6-digit code that refreshes every 30 seconds
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                4
                            </span>
                            <span>
                                After setup, you'll be prompted to enter a code from your authenticator app to verify the setup
                            </span>
                        </li>
                    </ol>
                </div>

                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-6">
                    <div className="flex gap-3">
                        <svg className="flex-shrink-0 w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="text-sm font-semibold text-yellow-900 mb-1">
                                Important: Save Your Secret Key
                            </p>
                            <p className="text-sm text-yellow-800">
                                Keep the manual entry code in a safe place. You'll need it to recover access if you lose your device.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex-1 cursor-pointer bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg border-2 border-gray-300 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            window.location.href = `/mfa/${setupId}/verify`
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                    >
                        Continue to Verification
                    </button>
                </div>
            </div>
        </div>
    )
}
