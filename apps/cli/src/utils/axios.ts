/* eslint-disable @typescript-eslint/only-throw-error */
import axios, { AxiosError } from "axios";
import { readConfig } from "./config.js";

export function getAccessToken(): string {
  const config = readConfig();
  const token = config?.session?.accessToken;


  return token!;
}

export const axiosInstance = axios.create({
  baseURL: process.env.API_URL || "http://127.0.0.1:3000/api",
  timeout: 5000,
});

axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});


axiosInstance.interceptors.response.use(
  res => res,
  err => {
    return Promise.reject(err);
  }
);


export const errorHandler = (err: AxiosError<Error>) => {
  if (axios.isAxiosError(err)) {
    throw err.response?.data
  }
  throw new Error(
    'Error processing request, please check your internet connection',
  );
};

export default axiosInstance;
