import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { get, post } from "./axios";

interface MfaSetupDetails {
  otpauthUrl: string;
  secret: string;
}

interface ConfirmMfaRequest {
  setupId: string;
  code: string;
}

interface ConfirmMfaResponse {
  success: boolean;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

export const getMfaSetup = async (
  setupId: string,
): Promise<MfaSetupDetails> => {
  const response = await get<MfaSetupDetails>(
    `/api/mfa/browser/${setupId}/verify`,
  );
  return response.data;
};

const confirmMfaSetupRequest = async (
  data: ConfirmMfaRequest,
): Promise<ConfirmMfaResponse> => {
  try {
    const response = await post<ConfirmMfaResponse>(
      `/api/mfa/browser/${data.setupId}/confirm`,
      { code: data.code },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiError;
      throw new Error(apiError.error.message);
    }
    throw new Error("Failed to verify MFA code");
  }
};

export const useConfirmMfaSetup = () => {
  return useMutation({
    mutationFn: (data: ConfirmMfaRequest) => confirmMfaSetupRequest(data),
  });
};
