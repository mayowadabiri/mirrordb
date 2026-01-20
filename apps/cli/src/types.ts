// cli/src/config/types.ts
export interface MirrorConfig {
  schemaVersion: 1;
  user: {
    id: string;
    email: string;
  };
  session: {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  };
  device: {
    id: string;
  };
}

export interface DeviceAuthResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: Date;
  createdAt: Date;
  authorizedAt: Date | null;
  userId: string | null;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}
