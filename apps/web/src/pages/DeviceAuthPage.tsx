import { useForm } from 'react-hook-form'
import { useNavigate } from '@tanstack/react-router'
import { Route } from '../routes/start.device'
import { useValidateDeviceCode } from '../api/auth'

interface DeviceCodeForm {
    code: string
}

export default function DeviceAuthPage() {
    const { code } = Route.useSearch()
    const navigate = useNavigate()
    const { mutateAsync, isPending, isError, error, reset } = useValidateDeviceCode()

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<DeviceCodeForm>({
        mode: 'onChange',
        defaultValues: {
            code: code || '',
        },
    })

    const codeValue = watch('code', '')

    const onSubmit = async (data: DeviceCodeForm) => {
        reset()
        try {
            const response = await mutateAsync(data.code)
            navigate({
                to: '/auth/login',
                search: {
                    token: response.token,
                },
            })
        } catch (err) {
            // Error is handled by the mutation
        }
    }

    const errorMessage = error instanceof Error ? error.message : null

    // When code is present, show auto-filled confirmation UI1
    if (code) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="mb-6">
                            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                            Confirm your code
                        </h1>
                        <p className="text-sm text-gray-600">
                            Is this the code displayed on your device?
                        </p>
                    </div>

                    <div className="mb-6">
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
                            <p className="text-xs text-gray-600 mb-2 text-center">Device Code</p>
                            <p className="text-3xl font-mono font-bold text-gray-900 text-center tracking-widest">
                                {code}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <input type="hidden" {...register('code')} value={code} />

                        {isError && errorMessage && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">
                                    {errorMessage}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => window.location.href = '/start/device'}
                                disabled={isPending}
                                className="flex-1 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg border-2 border-gray-300 transition-colors duration-200"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                                {isPending && (
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {isPending ? 'Authorizing...' : 'Allow'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-blue-900 mb-1">
                                    Verify the code
                                </p>
                                <p className="text-xs text-blue-800">
                                    Make sure this matches the code shown in your CLI terminal before continuing.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Normal manual entry UI
    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <svg className="w-12 h-12 mx-auto text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                        Device Activation
                    </h1>
                    <p className="text-sm text-gray-600">
                        Enter the code displayed on your device to authorize access
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {isError && errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">
                                {errorMessage}
                            </p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                            User Code
                        </label>
                        <input
                            type="text"
                            id="code"
                            disabled={isPending}
                            {...register('code', {
                                required: 'User code is required',
                                minLength: {
                                    value: 5,
                                    message: 'Code must be at least 5 characters',
                                },
                                pattern: {
                                    value: /^[A-Z0-9-]+$/,
                                    message: 'Code must contain only letters, numbers, and dashes',
                                },
                                onChange: (e) => {
                                    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
                                },
                            })}
                            placeholder="Enter your code"
                            className={`w-full px-4 py-3 text-center text-lg font-mono tracking-wider border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 ${errors.code ? 'border-red-500' : 'border-gray-300'
                                }`}
                        />
                        {errors.code && (
                            <p className="mt-2 text-xs text-red-600">{errors.code.message}</p>
                        )}
                        {!errors.code && (
                            <p className="mt-2 text-xs text-gray-500">
                                Enter the code exactly as shown on your device
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isPending || codeValue.length < 5}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        {isPending && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isPending ? 'Authorizing...' : 'Continue'}
                    </button>
                </form>

                <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-blue-900 mb-1">
                                Need help?
                            </p>
                            <p className="text-xs text-blue-800">
                                Make sure you're entering the code from your CLI terminal. The code is case-sensitive and expires in 10 minutes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
