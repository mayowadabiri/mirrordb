import axios, { AxiosError } from "axios";
import { ApiErrorResponse } from "@mirrordb/types";

/**
 * Type guard to check if error is an AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
    return axios.isAxiosError(error);
}

/**
 * Extract error data from any error type
 */
export function getErrorData(error: unknown): ApiErrorResponse | null {
    if (isAxiosError(error)) {
        return error.response?.data ?? null;
    }
    return null;
}

/**
 * Get error message from any error type
 */
export function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "An unknown error occurred";
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatus(error: unknown): number | null {
    if (isAxiosError(error)) {
        return error.response?.status ?? null;
    }
    return null;
}
