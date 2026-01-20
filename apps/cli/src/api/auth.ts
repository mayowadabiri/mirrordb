import { ApiSuccessResponse, DeviceAuthResponse } from "../types.js";
import axiosInstance from "../utils/axios.js";

export const createDeviceCode = async (): Promise<DeviceAuthResponse> => {
  try {
    const response =
      await axiosInstance.post<ApiSuccessResponse<DeviceAuthResponse>>(
        "/api/auth/device/start"
      );
    return response.data.data;
  } catch (error) {
    throw new Error("Failed to create device code");
  }
};


export const pollDeviceStatus = async (deviceCode: string) => {
  try {

    const response = await axiosInstance.get(`/api/auth/device/${deviceCode}/status`);
    return response.data.data
  } catch (error) {
    throw new Error("Failed to poll device status");
  }
};
