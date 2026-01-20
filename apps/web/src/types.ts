export interface DeviceAuthResponse {
  token: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}
