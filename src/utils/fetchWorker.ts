// src/workers/fetchWorker.ts

export interface FetchWorkerPayload {
    endpoint: string;
    options: {
        filter?: string;
        select?: string | string[];
        orderBy?: string | string[];
        skip?: number;
    };
    targetTop: number;
    keyField?: string;
    accessToken?: string;
}

const ctx: Worker = self as unknown as Worker;
const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            accessToken = null;
            accessTokenExpiresAt = 0;
            return null;
        }

        const data = await response.json();

        accessToken = data.access_token;
        accessTokenExpiresAt = Date.now() + (data.expires_in * 1000);

        return accessToken;
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

async function ensureValidToken(): Promise<string | null> {
    const now = Date.now();

    if (accessToken && now < accessTokenExpiresAt - 5 * 60 * 1000) {
        return accessToken;
    }

    return await refreshAccessToken();
}

async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    let token = await ensureValidToken();

    if (!token) {
        throw new Error("Authentication required");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);

    let response = await fetch(url, {
        ...options,
        headers,
        credentials: "include"
    });

    if (response.status === 401) {
        token = await refreshAccessToken();

        if (!token) {
            throw new Error("Authentication expired");
        }

        headers.set("Authorization", `Bearer ${token}`);

        response = await fetch(url, {
            ...options,
            headers,
            credentials: "include"
        });
    }

    return response;
}

ctx.onmessage = async (event: MessageEvent<FetchWorkerPayload>) => {
    const { endpoint, options = {}, targetTop = 2000, keyField, accessToken: token } = event.data;

    if (token) {
        accessToken = token;
        // Assume default token validity window (e.g. 15 minutes) if not explicitly passed
        accessTokenExpiresAt = Date.now() + 15 * 60 * 1000;
    }

    const MAX_BATCH_SIZE = 2000;
    const result: any[] = [];
    let currentSkip = options.skip || 0;

    try {
        while (result.length < targetTop) {
            const remainingToFetch = targetTop - result.length;
            const batchSize = Math.min(MAX_BATCH_SIZE, remainingToFetch);

            const queryParams = new URLSearchParams();
            queryParams.set('$top', String(batchSize));
            queryParams.set('$skip', String(currentSkip));

            if (options.filter) queryParams.set('$filter', options.filter);
            if (options.select) {
                const selectStr = Array.isArray(options.select) ? options.select.join(',') : options.select;
                queryParams.set('$select', selectStr);
            }
            if (options.orderBy) {
                const orderbyStr = Array.isArray(options.orderBy) ? options.orderBy.join(',') : options.orderBy;
                queryParams.set('$orderby', orderbyStr);
            }

            const response = await authenticatedFetch(`${endpoint}?${queryParams.toString()}`);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OData request failed (${response.status}): ${errorText}`);
            }

            const json: { value?: any[] } = await response.json();
            const batchData = json.value ?? [];

            if (batchData.length === 0) break;

            result.push(...batchData);
            currentSkip += batchData.length;

            if (batchData.length < batchSize) break;
        }

        if (keyField && result.length > 0) {
            const uniqueMap = new Map<any, any>();
            for (const item of result) {
                const val = item[keyField];
                if (val !== undefined && val !== null && !uniqueMap.has(val)) {
                    uniqueMap.set(val, item);
                }
            }
            result.splice(0, result.length, ...uniqueMap.values());
        }

        ctx.postMessage({
            success: true,
            data: result.slice(0, targetTop)
        });

    } catch (error: any) {
        ctx.postMessage({
            success: false,
            error: error?.message || 'Worker fetch failed'
        });
    }
};

export default {};