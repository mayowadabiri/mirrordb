import { ApiSuccessResponse } from "../types.js";
import axiosInstance from "../utils/axios.js";

interface MfaSetupResponse {
  setupUrl: string;
  expiresIn: string;
  setupId: string;
}

interface MfaSetupStatus {
  used: boolean;
  expired: boolean;
}

export const startMfaSetup = async () => {
  try {
    const response =
      await axiosInstance.post<ApiSuccessResponse<MfaSetupResponse>>(
        "/api/mfa/cli/start",
      );
    return response.data.data;
  } catch (error) {
    throw new Error("Failed to create device code");
  }
};

export const getMfaSetupStatus = async (setupId: string) => {
  try {
    const response = await axiosInstance.get<
      ApiSuccessResponse<MfaSetupStatus>
    >(`/api/mfa/cli/${setupId}/status`);
    return response.data.data;
  } catch (error) {
    throw new Error("Failed to get MFA setup status");
  }
};
