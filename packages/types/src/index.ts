
export interface ApiErrorResponse {
    success: false;
    statusCode: string;
    message: string;
    details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export enum DatabaseEngine {
    POSTGRES = "POSTGRES",
    MYSQL = "MYSQL",
    MONGODB = "MONGODB",
    SQLITE = "SQLITE",
}

export enum DatabaseEnvironment {
    PRODUCTION = "PRODUCTION",
    STAGING = "STAGING",
    DEVELOPMENT = "DEVELOPMENT",
}

export enum DatabaseStatus {
    REGISTERED = "REGISTERED",
    CONNECTED = "CONNECTED",
    VERIFIED = "VERIFIED",
    CLONED = "CLONED",
    DISABLED = "DISABLED",
}

export interface Database {
    id: string;
    ownerUserId: string;
    name: string;
    engine: DatabaseEngine;
    environment: DatabaseEnvironment;
    status: DatabaseStatus;
    description?: string | null;
    tags: string[];
    connectedAt?: Date | null;
    verifiedAt?: Date | null;
    disabledAt?: Date | null;
    isArchived?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface AddDbPayload {
    name: string;
    engine: DatabaseEngine;
    environment: DatabaseEnvironment;
    description?: string;
}

export interface AddDatabaseResponse extends AddDbPayload {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export enum DbCredentialsMethod {
    HOST = "HOST",
    URI = "URI",
}

export interface HostDbCredentials {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    method: DbCredentialsMethod.HOST;
}

export interface UriDbCredentials {
    uri: string;
    method: DbCredentialsMethod.URI;
}

export type DbCredentialsPayload = HostDbCredentials | UriDbCredentials;


export enum AuthProvider {
    GITHUB = "GITHUB",
    GOOGLE = "GOOGLE",
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

export interface RequestUser {
    id: string;
    email?: string;
    username?: string;
    avatarUrl?: string;

    isActive: boolean;

    providers: AuthProvider[];
    deviceId?: string;

    createdAt: Date;
}

export interface MirrorConfig {
    schemaVersion: 1;
    user: {
        id: string;
        email: string;
        mfaEnabled: boolean;
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
    database?: {
        id: string;
    };
}
