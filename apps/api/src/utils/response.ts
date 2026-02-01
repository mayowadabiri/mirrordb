import type { ApiSuccessResponse } from "@mirrordb/types";

/**
 * Helper function to create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiSuccessResponse<T> & { message?: string } {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}
