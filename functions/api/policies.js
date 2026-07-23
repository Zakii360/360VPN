/*
 * /api/policies
 *
 * Creates/toggles Cloudflare Gateway DNS policies:
 *   - one "always allow" policy for the admin domain list (must win over
 *     every block rule — see NOTE on precedence below)
 *   - one "block custom domains" policy for your manual blocklist
 *   - one policy per protection toggle (malware, phishing, adult,
 *     gambling, drugs, social), each blocking a set of Cloudflare's
 *     built-in DNS content categories
 *
 * GET  /api/policies             -> { malware: true, adult: false, ... }
 * POST /api/policies {key, on}   -> enable/disable one toggle's policy
 *
 * NOTE on ordering: Cloudflare evaluates Gateway policies by "precedence"
 * (lower number = evaluated first, first match wins). This code gives the
 * allow-admin-domain rule the lowest precedence value so it's checked
 * before any block rule. After first deploy, open Zero Trust -> Gateway ->
 * Policies and confirm "360VPN - Always Allow Admin" is at/near the top —
 * drag it there if not. Cloudflare's UI is the source of truth if this
 * ever drifts from what's coded here.
 *
 * NOTE on category names: Cloudflare's exact category names can change.
 * This matches by keyword against the LIVE list from /api/categories
 * rather than hardcoded IDs, but double-check the matches make sense for
 * your account (GET /api/categories to see the real list).
 */

import { requireAuth, cfRequest, json } from "../_lib.js";

const RULE_PREFIX = "360VPN - ";

const CATEGORY_KEYWORDS = {
    malware: ["malware", "security risk", "spyware", "botnet"],
    phishing: ["phishing"],
    adult: ["adult", "pornography", "nudity"],
    gambling: ["gambling"],
    drugs: ["drug"],
    social: ["social network"]
};

async function getCategoryIdsFor(env, key) {
    const categories = await cfRequest(env, "/gateway/categories");
    const keywords = CATEGORY_KEYWORDS[key] || [];
    return categories
        .filter(c => keywords.some(kw => c.name.toLowerCase().includes(kw)))
        .map(c => c.id);
}

async function findRule(env, name) {
    const rules = await cfRequest(env, "/gateway/rules");
    return rules.find(r => r.name === name) || null;
}

async function ensureBaseRules(env) {
    const lists = await cfRequest(env, "/gateway/lists");
    const allowList = lists.find(l => l.name === "360VPN - Always Allowed");
    const blockList = lists.find(l => l.name === "360VPN - Custom Blocked");

    if (allowList && !(await findRule(env, `${RULE_PREFIX}Always Allow Admin`))) {
        await cfRequest(env, "/gateway/rules", {
            method: "POST",
            body: JSON.stringify({
                name: `${RULE_PREFIX}Always Allow Admin`,
                enabled: true,
                action: "allow",
                filters: ["dns"],
                traffic: `any(dns.domains[*] in $${allowList.id})`,
                precedence: 1
            })
        });
    }

    if (blockList && !(await findRule(env, `${RULE_PREFIX}Custom Blocklist`))) {
        await cfRequest(env, "/gateway/rules", {
            method: "POST",
            body: JSON.stringify({
                name: `${RULE_PREFIX}Custom Blocklist`,
                enabled: true,
                action: "block",
                filters: ["dns"],
                traffic: `any(dns.domains[*] in $${blockList.id})`,
                precedence: 1000
            })
        });
    }
}

export async function onRequestGet({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    try {
        await ensureBaseRules(env);
        const rules = await cfRequest(env, "/gateway/rules");

        const state = {};
        for (const key of Object.keys(CATEGORY_KEYWORDS)) {
            const rule = rules.find(r => r.name === `${RULE_PREFIX}${key}`);
            state[key] = rule ? rule.enabled : false;
        }
        return json(state);
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}

export async function onRequestPost({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    const { key, on } = await request.json();
    if (!Object.keys(CATEGORY_KEYWORDS).includes(key)) {
        return json({ error: `Unknown protection key: ${key}` }, { status: 400 });
    }

    try {
        const ruleName = `${RULE_PREFIX}${key}`;
        const existing = await findRule(env, ruleName);

        if (existing) {
            await cfRequest(env, `/gateway/rules/${existing.id}`, {
                method: "PATCH",
                body: JSON.stringify({ enabled: Boolean(on) })
            });
            return json({ key, on: Boolean(on) });
        }

        const categoryIds = await getCategoryIdsFor(env, key);
        if (!categoryIds.length) {
            return json(
                { error: `No matching Cloudflare categories found for "${key}" — check /api/categories.` },
                { status: 500 }
            );
        }

        await cfRequest(env, "/gateway/rules", {
            method: "POST",
            body: JSON.stringify({
                name: ruleName,
                enabled: Boolean(on),
                action: "block",
                filters: ["dns"],
                traffic: `any(dns.content_category[*] in {${categoryIds.join(" ")}})`,
                precedence: 500
            })
        });

        return json({ key, on: Boolean(on) });
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}
