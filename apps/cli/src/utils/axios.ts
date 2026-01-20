import axios from "axios";
import { readConfig } from "./config.js";

export function getAccessToken(): string {
  const config = readConfig();

  const token = config?.session?.accessToken;
  if (!token) {
    throw new Error("Not authenticated. Run: mirrordb auth login");
  }

  return token;
}

export const axiosInstance = axios.create({
  baseURL: process.env.API_URL || "http://localhost:3000",
  timeout: 5000,
});

// attach token per request
axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});


axiosInstance.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      throw new Error("Session expired. Run: mirrordb auth login");
    }
    return Promise.reject(err);
  }
);

export default axiosInstance;
