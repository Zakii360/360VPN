"use strict";

/*
 * Talks to the Pages Functions in /functions/api — deployed automatically
 * alongside this site on Cloudflare Pages, so API_BASE is just "" (same
 * origin) once deployed. DASH_TOKEN must match the DASH_TOKEN env var set
 * on the Pages project.
 */
const API_CONFIG = {
    API_BASE: window.localStorage.getItem("360vpn_api_base") ?? "",
    DASH_TOKEN: window.localStorage.getItem("360vpn_dash_token") || ""
};

function isBackendConfigured() {
    return Boolean(API_CONFIG.DASH_TOKEN);
}

async function apiRequest(path, options = {}) {
    if (!isBackendConfigured()) {
        throw new Error("Dashboard isn't connected yet — set it up in Settings.");
    }

    const response = await fetch(`${API_CONFIG.API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_CONFIG.DASH_TOKEN}`,
            ...(options.headers || {})
        }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || `Request failed (${response.status})`);
    }
    return body;
}

const Api = {
    isBackendConfigured,

    configure(apiBase, dashToken) {
        API_CONFIG.API_BASE = apiBase;
        API_CONFIG.DASH_TOKEN = dashToken;
        window.localStorage.setItem("360vpn_api_base", apiBase);
        window.localStorage.setItem("360vpn_dash_token", dashToken);
    },

    // -- Protection category toggles (Cloudflare Gateway DNS policies) --
    getProtection() {
        return apiRequest("/api/policies");
    },
    setProtection(key, on) {
        return apiRequest("/api/policies", {
            method: "POST",
            body: JSON.stringify({ key, on })
        });
    },

    // -- Domain lists (always-allowed admin domain + custom blocklist) --
    getLists() {
        return apiRequest("/api/lists");
    },
    addDomain(type, domain) {
        return apiRequest("/api/lists", {
            method: "POST",
            body: JSON.stringify({ type, domain })
        });
    },
    removeDomain(type, domain) {
        return apiRequest("/api/lists", {
            method: "DELETE",
            body: JSON.stringify({ type, domain })
        });
    },

    // -- Enrolled WARP devices --
    listDevices() {
        return apiRequest("/api/devices");
    },
    revokeDevice(id) {
        return apiRequest("/api/devices", {
            method: "DELETE",
            body: JSON.stringify({ id })
        });
    }
};

window.Api = Api;
