import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { DeviceAuthResponse } from "../types.js";
import { post } from "./axios.js";

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

const validateDeviceCode = async (
  code: string
): Promise<DeviceAuthResponse> => {
  try {
    const response = await post<DeviceAuthResponse>("/api/auth/device/verify", {
      code,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiError;
      throw new Error(apiError.error.message);
    }
    throw new Error("Failed to validate device code");
  }
};

export const useValidateDeviceCode = () => {
  return useMutation({
    mutationFn: (code: string) => validateDeviceCode(code),
  });
};
