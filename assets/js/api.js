const PUBLISHED_API_BASE_URL = "https://racoon-synopsis-daintily.ngrok-free.dev";

function resolveApiBaseUrl() {
    const hostname = window.location.hostname;
    const origin = window.location.origin;

    if (!origin || !hostname) {
        return "http://127.0.0.1:8000";
    }

    if (hostname === "localhost") {
        return "http://localhost:8000";
    }

    if (hostname === "127.0.0.1") {
        return "http://127.0.0.1:8000";
    }

    if (hostname === "0.0.0.0") {
        return "http://127.0.0.1:8000";
    }

    if (hostname === "onlinejudge0.github.io") {
        return PUBLISHED_API_BASE_URL;
    }

    if (hostname.endsWith(".ngrok-free.app") || hostname.endsWith(".ngrok.io")) {
        return "http://127.0.0.1:8000";
    }

    const apiHostname = hostname.replace(/^\[|\]$/g, "");
    const formattedHostname = apiHostname.includes(":") ? `[${apiHostname}]` : apiHostname;
    return `${window.location.protocol}//${formattedHostname}:8000`;
}

export function isAdminRole(role) {
    return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdminRole(role) {
    return role === "SUPER_ADMIN";
}

export async function requireAccountAccess({
    allowedRoles = ["USER", "ADMIN", "SUPER_ADMIN"],
    redirectTo = "login.html",
} = {}) {
    const response = await apiFetch("/auth/me");
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            window.location.replace(redirectTo);
            return null;
        }
        throw new Error(`Không thể xác minh quyền truy cập (${response.status}).`);
    }

    const account = await response.json();
    if (!allowedRoles.includes(account.role)) {
        window.location.replace(redirectTo);
        return null;
    }

    return account;
}

const configuredApiBaseUrl = resolveApiBaseUrl();
const FORWARDED_API_STORAGE_KEY = "online-judge-api-base-url";
const SESSION_STORAGE_KEY = "online-judge-session-id";
const localHostname = window.location.hostname;
const usesSessionHeader = localHostname === "onlinejudge0.github.io";
const savedApiBaseUrl = sessionStorage.getItem(FORWARDED_API_STORAGE_KEY);
const savedApiUrlIsValid =
    (localHostname === "localhost" || localHostname === "127.0.0.1") &&
    new RegExp(`^http://${localHostname.replaceAll(".", "\\.")}:800[1-9]$|^http://${localHostname.replaceAll(".", "\\.")}:8010$`).test(
        savedApiBaseUrl ?? "",
    );
let apiBaseUrl = savedApiUrlIsValid ? savedApiBaseUrl : configuredApiBaseUrl;
let forwardedApiDiscovery;

async function discoverForwardedApi() {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        throw new Error("Automatic API port discovery is only available on localhost.");
    }

    const candidates = Array.from(
        { length: 10 },
        (_, index) => `http://${hostname}:${8001 + index}`,
    );
    try {
        return await Promise.any(
            candidates.map(async (candidate) => {
                try {
                    const response = await fetch(`${candidate}/`, {
                        credentials: "omit",
                        headers: { Accept: "application/json" },
                        signal: AbortSignal.timeout(1500),
                    });
                    if (!response.ok) {
                        throw new Error("Not the Online Judge API");
                    }

                    const payload = await response.json();
                    if (payload.message === "Hello Online Judge!") {
                        return candidate;
                    }
                    throw new Error("Not the Online Judge API");
                } catch (error) {
                    throw new Error(`Could not verify ${candidate}`, { cause: error });
                }
            }),
        );
    } catch {
        throw new Error("Could not find the forwarded Online Judge API on localhost ports 8001-8010.");
    }
}

function fetchFromApi(path, options) {
    const headers = new Headers(options.headers);
    if (usesSessionHeader) {
        const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionId) {
            headers.set("X-Session-ID", sessionId);
        }
    }

    return fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers,
        credentials: options.credentials ?? (usesSessionHeader ? "omit" : "include")
    });
}

export async function apiFetch(path, options = {}) {
    try {
        const response = await fetchFromApi(path, options);
        if (usesSessionHeader && path === "/auth/login" && response.ok) {
            const payload = await response.clone().json();
            if (typeof payload.session_id !== "string" || !payload.session_id) {
                throw new Error("Login response did not include a valid session ID.");
            }
            sessionStorage.setItem(SESSION_STORAGE_KEY, payload.session_id);
        } else if (usesSessionHeader && path === "/auth/logout" && response.ok) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } else if (usesSessionHeader && response.status === 401) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
        return response;
    } catch (error) {
        if (localHostname !== "localhost" && localHostname !== "127.0.0.1") {
            throw error;
        }

        forwardedApiDiscovery ??= discoverForwardedApi();
        try {
            apiBaseUrl = await forwardedApiDiscovery;
            sessionStorage.setItem(FORWARDED_API_STORAGE_KEY, apiBaseUrl);
        } catch (discoveryError) {
            throw new Error(
                `Cannot connect to the Online Judge API at ${configuredApiBaseUrl}. ${discoveryError.message}`,
                { cause: error },
            );
        }

        return fetchFromApi(path, options);
    }
}

export async function readResponse(response) {
    if (response.headers.get("content-type")?.includes("application/json")) {
        return response.json();
    }

    return {};
}
