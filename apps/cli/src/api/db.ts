import { AddDatabaseResponse, AddDbPayload, ApiSuccessResponse, Database, DbCredentialsPayload } from "@mirrordb/types";
import axiosInstance from "../utils/axios.js";


export const createDb = async (body: AddDbPayload) => {
    const response =
        await axiosInstance.post<ApiSuccessResponse<AddDatabaseResponse>>(
            "/db/add",
            body
        );
    return response.data.data;

};


export const listDatabases = async () => {
    const response =
        await axiosInstance.get<ApiSuccessResponse<Database[]>>(
            "/db/list"
        );
    return response.data.data;
}

export const getDatabase = async (id: string) => {
    const response =
        await axiosInstance.get<ApiSuccessResponse<Database>>(
            `/db/${id}`
        );
    return response.data.data;
}


export const connectDatabase = async (id: string, body: DbCredentialsPayload) => {
    const response =
        await axiosInstance.post<ApiSuccessResponse<{ databaseId: string, name: string }>>(
            `/db/${id}/connect`,
            body
        );
    return response.data.data;
}