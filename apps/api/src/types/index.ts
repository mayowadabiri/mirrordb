/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;



export enum AuthProvider {
  GITHUB = "GITHUB",
  GOOGLE = "GOOGLE",
}




export interface RequestUser {
  /** Core identity */
  id: string;
  email?: string;
  username?: string;
  avatarUrl?: string;

  /** Status */
  isActive: boolean;

  /** Auth context */
  providers: AuthProvider[];
  deviceId?: string;

  /** Timestamps (optional but useful) */
  createdAt: Date;
}
