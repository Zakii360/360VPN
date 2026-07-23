/*
 * GET /api/categories
 *
 * Returns Cloudflare Gateway's current list of DNS content categories
 * (id + name), fetched live rather than hardcoded — Cloudflare occasionally
 * adds/renames categories, so this keeps the mapping in policies.js honest.
 * Cross-check this against https://developers.cloudflare.com/cloudflare-one/policies/gateway/domain-categories/
 * if something looks off.
 */

import { requireAuth, cfRequest, json } from "../_lib.js";

export async function onRequestGet({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    try {
        const categories = await cfRequest(env, "/gateway/categories");
        return json(categories);
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}
