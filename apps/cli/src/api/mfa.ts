import { ApiSuccessResponse } from "@mirrordb/types";
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

interface MfaChallengeResponse {
  challengeId: string;
  expiresAt: string;
  verification_url: string;
}

export const startMfaSetup = async () => {
  const response =
    await axiosInstance.post<ApiSuccessResponse<MfaSetupResponse>>(
      "/mfa/cli/start",
    );
  return response.data.data;

};

export const getMfaSetupStatus = async (setupId: string) => {
  const response = await axiosInstance.get<
    ApiSuccessResponse<MfaSetupStatus>
  >(`/mfa/cli/setup/${setupId}/status`);
  return response.data.data;

};


export const challengeMfa = async () => {
  const response = await axiosInstance.post<ApiSuccessResponse<MfaChallengeResponse>>(
    "/mfa/cli/challenge",
  );
  return response.data.data;
};

export const getMfaChallengeStatus = async (challengeId: string) => {
  const response = await axiosInstance.get<
    ApiSuccessResponse<{ status: string }>
  >(`/mfa/cli/challenge/${challengeId}/status`);
  return response.data.data;

};

export const getMfaSession = async () => {
  const response = await axiosInstance.get<ApiSuccessResponse<{ ok: boolean }>>(
    `/mfa/cli/session`
  );
  return response.data.data;
}