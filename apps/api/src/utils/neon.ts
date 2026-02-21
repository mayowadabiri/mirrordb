import axios from "axios"
const baseUrl = "https://console.neon.tech/api/v2"



const neonClient = axios.create({
    baseURL: baseUrl,
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEON_API_KEY}`
    }
})

const neon = {

    async createDatabase(payload: object) {
        return await neonClient.post(`/projects/${process.env.NEON_PROJECT_ID}/branches/${process.env.NEON_BRANCH_ID}/databases`, payload)
    },

    async createRole(payload: object) {
        return await neonClient.post(`/projects/${process.env.NEON_PROJECT_ID}/branches/${process.env.NEON_BRANCH_ID}/roles`, payload)
    },

    async getConnectionUri(payload: object) {
        const response = await neonClient.get(`/projects/${process.env.NEON_PROJECT_ID}/connection_uri`, {
            params: {
                ...payload
            }
        })
        return response.data;
    },

    async deleteDatabase(databaseName: string) {
        return await neonClient.delete(`/projects/${process.env.NEON_PROJECT_ID}/branches/${process.env.NEON_BRANCH_ID}/databases/${databaseName}`)
    },

    async deleteRole(roleName: string) {
        return await neonClient.delete(`/projects/${process.env.NEON_PROJECT_ID}/branches/${process.env.NEON_BRANCH_ID}/roles/${roleName}`)
    }
}

export default neon;