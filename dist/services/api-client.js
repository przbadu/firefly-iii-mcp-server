/**
 * Shared API client for Firefly III REST API.
 *
 * Authentication uses a Personal Access Token (PAT) passed via
 * the FIREFLY_III_PAT environment variable.
 */
import axios, { AxiosError } from "axios";
import { REQUEST_TIMEOUT } from "../constants.js";
let client = null;
export function getApiBaseUrl() {
    const url = process.env.FIREFLY_III_URL;
    if (!url) {
        throw new Error("FIREFLY_III_URL environment variable is required. " +
            "Set it to your Firefly III instance URL (e.g. https://expense.przbadu.dev)");
    }
    // Strip trailing slash
    return url.replace(/\/+$/, "");
}
export function getApiClient() {
    if (client)
        return client;
    const baseURL = getApiBaseUrl();
    const pat = process.env.FIREFLY_III_PAT;
    if (!pat) {
        throw new Error("FIREFLY_III_PAT environment variable is required. " +
            "Generate a Personal Access Token in Firefly III → Options → Profile → OAuth.");
    }
    client = axios.create({
        baseURL: `${baseURL}/api/v1`,
        timeout: REQUEST_TIMEOUT,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/vnd.api+json",
            Authorization: `Bearer ${pat}`,
        },
    });
    return client;
}
/**
 * Generic API request helper with proper error handling.
 */
export async function apiRequest(endpoint, method = "GET", data, params) {
    const api = getApiClient();
    const response = await api.request({
        url: endpoint,
        method,
        data,
        params,
    });
    return response.data;
}
/**
 * Translates Axios errors into actionable, human-readable messages.
 */
export function handleApiError(error) {
    if (error instanceof AxiosError) {
        if (error.response) {
            const status = error.response.status;
            const detail = typeof error.response.data === "object" && error.response.data !== null
                ? JSON.stringify(error.response.data, null, 2)
                : String(error.response.data ?? "");
            switch (status) {
                case 401:
                    return "Error: Unauthorized. Check that your FIREFLY_III_PAT is valid and not expired.";
                case 403:
                    return "Error: Forbidden. Your token does not have permission for this action.";
                case 404:
                    return "Error: Resource not found. Check the ID you provided.";
                case 422:
                    return `Error: Validation failed. Firefly III rejected the request:\n${detail}`;
                case 429:
                    return "Error: Rate limit exceeded. Wait a moment and try again.";
                case 500:
                    return "Error: Firefly III server error. Check the server logs.";
                default:
                    return `Error: API returned status ${status}.\n${detail}`;
            }
        }
        else if (error.code === "ECONNABORTED") {
            return "Error: Request timed out. Is your Firefly III instance reachable?";
        }
        else if (error.code === "ECONNREFUSED") {
            return "Error: Connection refused. Check FIREFLY_III_URL and that the server is running.";
        }
    }
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
//# sourceMappingURL=api-client.js.map