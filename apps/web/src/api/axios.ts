import axios, { AxiosResponse } from "axios";

import { ApiSuccessResponse } from "@mirrordb/types";

const baseURL = import.meta.env.VITE_API_URL as string;

const axiosInstance = axios.create({
  baseURL: baseURL,
  timeout: 5000,
});

const handleResponse = <T>(response: AxiosResponse<ApiSuccessResponse<T>>): ApiSuccessResponse<T> => {
  return {
    data: response.data.data,
    success: response.data.success,
  };
};

export const get = async <T>(
  url: string,
  config?: object
): Promise<ApiSuccessResponse<T>> => {
  const res = await axiosInstance.get(url, config);
  return handleResponse<T>(res);
};

export const post = async <T>(url: string, data?: object, config?: object) => {
  const res = await axiosInstance.post(url, data, config);
  return handleResponse<T>(res);
};
