/*
 * Shared helpers for all /functions/api/* routes.
 *
 * These run as Cloudflare Pages Functions — free, serverless, no server
 * to install or maintain. Cloudflare runs them on-demand next to your
 * static site.
 *
 * Two secrets need to be set in the Pages project (Settings -> Environment
 * variables -> Production, marked "Encrypt"), NOT committed to the repo:
 *
 *   CF_API_TOKEN   - a Cloudflare API token with "Zero Trust: Edit" permission
 *                    (create at dash.cloudflare.com/profile/api-tokens)
 *   CF_ACCOUNT_ID  - your Cloudflare account ID (shown on the right side of
 *                    any Cloudflare dashboard page)
 *   DASH_TOKEN     - a password you make up, so random visitors to your
 *                    dashboard's API can't rewrite your filtering rules
 */

const CF_API = "https://api.cloudflare.com/client/v4";

export function requireAuth(request, env) {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!env.DASH_TOKEN || token !== env.DASH_TOKEN) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }
    return null;
}

export async function cfRequest(env, path, options = {}) {
    const response = await fetch(`${CF_API}/accounts/${env.CF_ACCOUNT_ID}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.CF_API_TOKEN}`,
            ...(options.headers || {})
        }
    });

    const body = await response.json();
    if (!response.ok || body.success === false) {
        throw new Error(
            `Cloudflare API error: ${JSON.stringify(body.errors || body)}`
        );
    }
    return body.result;
}

export function json(data, init = {}) {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) }
    });
}
