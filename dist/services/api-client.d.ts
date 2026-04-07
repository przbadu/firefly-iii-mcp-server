/**
 * Shared API client for Firefly III REST API.
 *
 * Authentication uses a Personal Access Token (PAT) passed via
 * the FIREFLY_III_PAT environment variable.
 */
import { type AxiosInstance } from "axios";
export declare function getApiBaseUrl(): string;
export declare function getApiClient(): AxiosInstance;
/**
 * Generic API request helper with proper error handling.
 */
export declare function apiRequest<T>(endpoint: string, method?: "GET" | "POST" | "PUT" | "DELETE", data?: unknown, params?: Record<string, unknown>): Promise<T>;
/**
 * Translates Axios errors into actionable, human-readable messages.
 */
export declare function handleApiError(error: unknown): string;
//# sourceMappingURL=api-client.d.ts.map