import { AddDatabaseResponse, AddDbPayload, ApiSuccessResponse, Database, DbCredentialsPayload } from "@mirrordb/types";
import axiosInstance from "../utils/axios.js";
import http from "http";


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


export const forkDatabase = async (id: string) => {
    const response =
        await axiosInstance.post<ApiSuccessResponse<{ cloneId: string }>>(
            `/db/${id}/fork`
        );
    return response.data.data;
}

export const streamFork = async (
    cloneId: string,
    onEvent: (event: string, payload: any) => void
) => {
    const response = await axiosInstance.get(
        `/db/${cloneId}/stream`,
        {
            responseType: "stream",
            timeout: 0,
            httpAgent: new http.Agent({ keepAlive: false }),
        }
    );

    const stream = response.data;

    return new Promise<void>((resolve, reject) => {
        let buffer = "";
        let currentEvent = "message";

        stream.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                if (line.startsWith("event:")) {
                    currentEvent = line.replace("event:", "").trim();
                    continue;
                }

                if (line.startsWith("data:")) {
                    const raw = line.replace("data:", "").trim();

                    let payload: any = raw;
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        // keep string
                        onEvent(currentEvent, raw);
                        continue;
                    }

                    onEvent(currentEvent, payload);

                    // End stream when __END__ event is received
                    if (currentEvent === "__END__") {
                        stream.destroy();
                        resolve();
                        return;
                    }
                    continue;
                }

                // blank line = end of SSE message
                if (line.trim() === "") {
                    currentEvent = "message";
                }
            }
        });

        stream.on("end", () => {
            resolve();
        });

        stream.on("error", (err: any) => {
            if (err.code === "ECONNRESET" || err.message === "aborted") {
                resolve();
                return;
            }
            console.error("Unexpected stream error:", err);
            reject(err);
        });
    });
};


export const tunnelCloneDb = async (
    cloneId: string,
    signal: AbortSignal,
    onEvent: (event: string, payload: any) => void
) => {
    const response = await axiosInstance.get(
        `/db/${cloneId}/tunnel`,
        {
            responseType: "stream",
            timeout: 0,
            httpAgent: new http.Agent({ keepAlive: false }),
        }
    );

    const stream = response.data;

    // When abort signal fires, destroy the stream to trigger API-side cleanup
    signal.addEventListener("abort", () => {
        stream.destroy();
    }, { once: true });

    return new Promise<void>((resolve, reject) => {
        let buffer = "";
        let currentEvent = "message";

        stream.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                if (line.startsWith("event:")) {
                    currentEvent = line.replace("event:", "").trim();
                    continue;
                }

                if (line.startsWith("data:")) {
                    const raw = line.replace("data:", "").trim();

                    let payload: any = raw;
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        // keep string
                        onEvent(currentEvent, raw);
                        continue;
                    }

                    onEvent(currentEvent, payload);

                    // End stream when __END__ event is received
                    if (currentEvent === "__END__") {
                        stream.destroy();
                        resolve();
                        return;
                    }
                    continue;
                }

                // blank line = end of SSE message
                if (line.trim() === "") {
                    currentEvent = "message";
                }
            }
        });

        stream.on("end", () => {
            resolve();
        });

        stream.on("close", () => {
            resolve();
        });

        stream.on("error", (err: any) => {
            if (err.code === "ECONNRESET" || err.message === "aborted" || signal.aborted) {
                resolve();
                return;
            }
            console.error("Unexpected stream error:", err);
            reject(err);
        });
    });
};