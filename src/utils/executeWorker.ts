// src/workers/executeWorker.ts

export interface ExecuteWorkerPayload {
    database: string;
    spName: string;
    method?: 'GET' | 'POST';
    params?: Record<string, any>; // SP parameters (e.g., { CustomerID: 101, Status: 'Active' })
    pagination?: {
        top?: number;
        skip?: number;
    };
    accessToken?: string;
}

function getStoredDeviceKey(): string | undefined {
    return localStorage.getItem("user_email") || undefined;
}

const ctx: Worker = self as unknown as Worker;
const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

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
            credentials: "include",
            body: JSON.stringify({
                device_key: getStoredDeviceKey()
            })
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

ctx.onmessage = async (event: MessageEvent<ExecuteWorkerPayload>) => {
    const {
        database,
        spName,
        method = 'GET',
        params = {},
        pagination,
        accessToken: token
    } = event.data;

    if (token) {
        accessToken = token;
        accessTokenExpiresAt = Date.now() + 15 * 60 * 1000;
    }

    try {
        // Construct base endpoint route matching Flask backend
        const endpointUrl = new URL(`${API_URL}/api/${database}/sp/${spName}`);

        // Set pagination params ($top,$skip) if provided
        if (pagination?.top !== undefined) {
            endpointUrl.searchParams.set('$top', String(pagination.top));
        }
        if (pagination?.skip !== undefined) {
            endpointUrl.searchParams.set('$skip', String(pagination.skip));
        }

        const fetchOptions: RequestInit = { method };

        if (method.toUpperCase() === 'GET') {
            // Append procedure parameters directly into URL query params
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    endpointUrl.searchParams.set(key, String(value));
                }
            });
        } else {
            // For POST requests, send params in the JSON body
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify(params);
        }

        const response = await authenticatedFetch(endpointUrl.toString(), fetchOptions);

        if (!response.ok) {
            const errorJson = await response.json().catch(() => null);
            const errorMessage = errorJson?.error || errorJson?.details || `HTTP ${response.status}`;
            throw new Error(`Stored Procedure execution failed: ${errorMessage}`);
        }

        const json = await response.json();

        ctx.postMessage({
            success: true,
            data: json.value ?? [],
            nextLink: json['@odata.nextLink'] ?? null,
            context: json['@odata.context'] ?? null
        });

    } catch (error: any) {
        ctx.postMessage({
            success: false,
            error: error?.message || 'Stored procedure worker execution failed'
        });
    }
};

export default {};