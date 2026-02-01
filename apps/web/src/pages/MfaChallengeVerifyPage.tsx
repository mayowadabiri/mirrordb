import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useVerifyMfaChallenge } from '../api/mfa'

interface VerifyCodeForm {
    code: string
}

export default function MfaChallengeVerifyPage() {
    const { challengeId } = useParams({ from: '/mfa/challenge/$challengeId/verify' })
    const navigate = useNavigate()
    const { mutateAsync, isPending, isError, error, reset } = useVerifyMfaChallenge()

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<VerifyCodeForm>({
        mode: 'onChange',
        defaultValues: {
            code: '',
        },
    })

    const codeValue = watch('code', '')

    const onSubmit = async (data: VerifyCodeForm) => {
        reset()
        try {
            await mutateAsync({
                challengeId,
                code: data.code,
            })
            // On success, redirect to success page
            navigate({ to: '/auth/success' })
        } catch (err) {
            console.error(err)
        }
    }

    const errorMessage = error instanceof Error ? error.message : null

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                        Verify MFA Challenge
                    </h1>
                    <p className="text-sm text-gray-600">
                        Enter the 6-digit code from your authenticator app
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                            Authentication Code
                        </label>
                        <input
                            type="text"
                            id="code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            {...register('code', {
                                required: 'Code is required',
                                pattern: {
                                    value: /^[0-9]{6}$/,
                                    message: 'Code must be exactly 6 digits',
                                },
                            })}
                            className={`w-full text-center text-3xl font-mono font-bold tracking-widest px-4 py-4 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${errors.code
                                ? 'border-red-300 bg-red-50'
                                : codeValue.length === 6
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-gray-300 bg-white'
                                }`}
                            placeholder="000000"
                        />
                        {errors.code && (
                            <p className="mt-2 text-sm text-red-600">
                                {errors.code.message}
                            </p>
                        )}
                        <p className="mt-2 text-xs text-gray-500 text-center">
                            {codeValue.length}/6 digits
                        </p>
                    </div>

                    {isError && errorMessage && (
                        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                            <div className="flex gap-3">
                                <svg className="shrink-0 w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-red-600">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <svg className="shrink-0 w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-blue-900 mb-1">
                                    Having trouble?
                                </p>
                                <p className="text-xs text-blue-800">
                                    Make sure you're using the code from your authenticator app. The code refreshes every 30 seconds.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => navigate({ to: '/' })}
                            disabled={isPending}
                            className="flex-1 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg border-2 border-gray-300 transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || codeValue.length !== 6}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                            {isPending ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Verifying...
                                </>
                            ) : (
                                'Verify Code'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
