// Uses VITE_API_BASE_URL if set; defaults to relative path "" for local serving
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Helper function to construct full API URLs cleanly
 * Example: getApiUrl("/api/DISPATCH_APP_DMS/table/DMS_CEM")
 */
export const getApiUrl = (endpoint: string): string => {
    // Ensure endpoint starts with a slash
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
};