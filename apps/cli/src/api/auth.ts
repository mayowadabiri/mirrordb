import { ApiSuccessResponse, DeviceAuthResponse } from "@mirrordb/types";
import axiosInstance from "../utils/axios.js";

export const createDeviceCode = async (): Promise<DeviceAuthResponse> => {
  const response =
    await axiosInstance.post<ApiSuccessResponse<DeviceAuthResponse>>(
      "/auth/device/start"
    );
  return response.data.data;

};


export const pollDeviceStatus = async (deviceCode: string) => {

  const response = await axiosInstance.get(`/auth/device/${deviceCode}/status`);
  return response.data.data

};

export const verifySession = async () => {
  const response = await axiosInstance.get("/session/verify");
  return response.data.data;
};
