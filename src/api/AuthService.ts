const API_URL = import.meta.env.VITE_API_BASE_URL || "";

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshPromise: Promise<{ accessToken: string; expiresIn: number } | null> | null = null;

function getStoredDeviceKey(): string | undefined {
    return localStorage.getItem("user_email") || undefined;
}

export const AuthService = {

    async initialize() {
        return await this.refresh();
    },

    async login(appKey: string, appSecret: string, deviceKey?: string) {
        return {}
        const response = await fetch(`${API_URL}/api/auth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                app_key: appKey,
                app_secret: appSecret,
                device_key: deviceKey
            })
        });

        if (!response.ok) {
            throw new Error(`Authentication failed (${response.status})`);
        }

        const data = await response.json();

        setAccessToken(data.access_token, data.expires_in);

        return data;
    },

    async refresh() {
        if (refreshPromise) {
            return refreshPromise;
        }

        refreshPromise = performRefresh();

        try {
            return await refreshPromise;
        } finally {
            refreshPromise = null;
        }
    },

    async ensureValidToken(): Promise<string | null> {
        const now = Date.now();

        if (!accessToken || now >= accessTokenExpiresAt - 5 * 60 * 1000) {
            const result = await this.refresh();
            return result?.accessToken ?? null;
        }

        return accessToken;
    },

    getAccessToken() {
        return accessToken;
    },

    clear() {
        accessToken = null;
        accessTokenExpiresAt = 0;
    },

    async logout() {
        console.log('attempted log out')
        // try {
        //     await fetch(`${API_URL}/api/auth/logout`, {
        //         method: "POST",
        //         credentials: "include"
        //     });
        // } finally {
        //     this.clear();
        // }

        this.clear();
    }
};

async function performRefresh(): Promise<{ accessToken: string; expiresIn: number } | null> {
    console.log('refreshing with key: ', getStoredDeviceKey());
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
            device_key: getStoredDeviceKey()
        })
    });

    console.log("Refresh status:", response.status);

    const responseText = await response.text();

    if (!response.ok) {
        accessToken = null;
        accessTokenExpiresAt = 0;
        return null;
    }

    const data = JSON.parse(responseText);

    setAccessToken(data.access_token, data.expires_in);

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in
    };
}

function setAccessToken(token: string, expiresIn: number) {
    accessToken = token;
    accessTokenExpiresAt = Date.now() + expiresIn * 1000;
}