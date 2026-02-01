import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { ApiErrorResponse } from "@mirrordb/types";
import { post } from "./axios.js";

// Response from the device verify endpoint (specific to web auth flow)
interface DeviceVerifyResponse {
  token: string;
}

const validateDeviceCode = async (
  code: string
): Promise<DeviceVerifyResponse> => {
  try {
    const response = await post<DeviceVerifyResponse>("/api/auth/device/verify", {
      code,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      throw new Error(apiError.message || "Failed to validate device code");
    }
    throw new Error("Failed to validate device code");
  }
};

export const useValidateDeviceCode = () => {
  return useMutation({
    mutationFn: (code: string) => validateDeviceCode(code),
  });
};
