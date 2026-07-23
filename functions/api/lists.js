/*
 * /api/lists
 *
 * Manages two Cloudflare Gateway domain lists:
 *   - "360VPN - Always Allowed"  (the admin/dashboard domain, e.g. 360-search.com)
 *   - "360VPN - Custom Blocked"  (domains you've manually blocked)
 *
 * These are real Cloudflare Gateway lists (dash.cloudflare.com -> Zero Trust
 * -> Gateway -> Lists) — you can see and edit them there too, this is just
 * a nicer UI on top.
 *
 * GET    /api/lists                  -> { allow: [...domains], block: [...domains] }
 * POST   /api/lists   {type, domain} -> adds a domain (type: "allow" | "block")
 * DELETE /api/lists   {type, domain} -> removes a domain
 */

import { requireAuth, cfRequest, json } from "../_lib.js";

const LIST_NAMES = {
    allow: "360VPN - Always Allowed",
    block: "360VPN - Custom Blocked"
};

async function findOrCreateList(env, type) {
    const existing = await cfRequest(env, "/gateway/lists");
    const found = existing.find(l => l.name === LIST_NAMES[type]);
    if (found) return found;

    return cfRequest(env, "/gateway/lists", {
        method: "POST",
        body: JSON.stringify({
            name: LIST_NAMES[type],
            type: "DOMAIN",
            items: []
        })
    });
}

export async function onRequestGet({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    try {
        const [allowList, blockList] = await Promise.all([
            findOrCreateList(env, "allow"),
            findOrCreateList(env, "block")
        ]);

        return json({
            allow: (allowList.items || []).map(i => i.value),
            block: (blockList.items || []).map(i => i.value),
            allowListId: allowList.id,
            blockListId: blockList.id
        });
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}

export async function onRequestPost({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    const { type, domain } = await request.json();
    if (!["allow", "block"].includes(type) || !domain) {
        return json({ error: "type ('allow'|'block') and domain are required" }, { status: 400 });
    }

    try {
        const list = await findOrCreateList(env, type);
        const items = [...(list.items || []).map(i => i.value)];
        if (!items.includes(domain)) items.push(domain);

        const updated = await cfRequest(env, `/gateway/lists/${list.id}`, {
            method: "PUT",
            body: JSON.stringify({ items: items.map(value => ({ value })) })
        });

        return json({ items: (updated.items || []).map(i => i.value) });
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}

export async function onRequestDelete({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    const { type, domain } = await request.json();
    if (!["allow", "block"].includes(type) || !domain) {
        return json({ error: "type ('allow'|'block') and domain are required" }, { status: 400 });
    }

    try {
        const list = await findOrCreateList(env, type);
        const items = (list.items || [])
            .map(i => i.value)
            .filter(v => v !== domain);

        const updated = await cfRequest(env, `/gateway/lists/${list.id}`, {
            method: "PUT",
            body: JSON.stringify({ items: items.map(value => ({ value })) })
        });

        return json({ items: (updated.items || []).map(i => i.value) });
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}
