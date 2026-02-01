import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { get, post } from "./axios";
import { ApiErrorResponse } from "@mirrordb/types";

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
      const apiError = error.response.data as ApiErrorResponse;
      throw new Error(apiError.message || "Failed to verify MFA code");
    }
    throw new Error("Failed to verify MFA code");
  }
};

export const useConfirmMfaSetup = () => {
  return useMutation({
    mutationFn: (data: ConfirmMfaRequest) => confirmMfaSetupRequest(data),
  });
};

// MFA Challenge Verification
interface MfaChallengeDetails {
  challengeId: string;
  expiresAt: string;
}

interface VerifyMfaChallengeRequest {
  challengeId: string;
  code: string;
}

interface VerifyMfaChallengeResponse {
  success: boolean;
  message?: string;
}

export const getMfaChallenge = async (
  challengeId: string,
): Promise<MfaChallengeDetails> => {
  const response = await get<MfaChallengeDetails>(
    `/api/mfa/browser/${challengeId}/details`,
  );
  return response.data;
};

const verifyMfaChallengeRequest = async (
  data: VerifyMfaChallengeRequest,
): Promise<VerifyMfaChallengeResponse> => {
  try {
    const response = await post<VerifyMfaChallengeResponse>(
      `/api/mfa/browser/${data.challengeId}/verify`,
      { code: data.code },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      throw new Error(apiError.message || "Failed to verify MFA challenge code");
    }
    throw new Error("Failed to verify MFA challenge code");
  }
};

export const useVerifyMfaChallenge = () => {
  return useMutation({
    mutationFn: (data: VerifyMfaChallengeRequest) => verifyMfaChallengeRequest(data),
  });
};
