import axios from "axios";

const baseUrl = "https://console.neon.tech/api/v2";

function getNeonConfig() {
    const apiKey = process.env.NEON_API_KEY;
    const projectId = process.env.NEON_PROJECT_ID;
    const branchId = process.env.NEON_BRANCH_ID;

    if (!apiKey || !projectId || !branchId) {
        throw new Error(
            "NEON_API_KEY, NEON_PROJECT_ID, and NEON_BRANCH_ID environment variables are required"
        );
    }

    return { apiKey, projectId, branchId };
}

function createNeonClient() {
    const { apiKey } = getNeonConfig();
    return axios.create({
        baseURL: baseUrl,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
    });
}

const neon = {
    async createDatabase(payload: object) {
        const { projectId, branchId } = getNeonConfig();
        const client = createNeonClient();
        return await client.post(
            `/projects/${projectId}/branches/${branchId}/databases`,
            payload
        );
    },

    async createRole(roleName: string) {
        const { projectId, branchId } = getNeonConfig();
        const client = createNeonClient();
        return await client.post(
            `/projects/${projectId}/branches/${branchId}/roles`,
            {
                role: {
                    name: roleName,
                }
            }
        );
    },

    async getConnectionUri(payload: object) {
        const { projectId } = getNeonConfig();
        const client = createNeonClient();
        const response = await client.get(
            `/projects/${projectId}/connection_uri`,
            {
                params: { ...payload },
            }
        );
        return response.data;
    },

    async deleteDatabase(databaseName: string) {
        const { projectId, branchId } = getNeonConfig();
        const client = createNeonClient();
        return await client.delete(
            `/projects/${projectId}/branches/${branchId}/databases/${databaseName}`
        );
    },

    async getExistingRole(roleName: string) {
        const { projectId, branchId } = getNeonConfig();
        const client = createNeonClient();
        const response = await client.get(
            `/projects/${projectId}/branches/${branchId}/roles/${roleName}`
        );
        return response.data;
    }

};

export default neon;
