/*
 * GET /api/devices
 *
 * Lists devices enrolled in your Zero Trust org (i.e. devices that have
 * installed the WARP client and logged in with your team). Devices
 * enroll themselves when someone installs WARP and signs in — this
 * dashboard can't "add" a device, only show what's already enrolled and
 * let you remove/revoke one.
 *
 * Verify this endpoint shape against the current Cloudflare API docs
 * (Zero Trust -> Devices) after deploying — Cloudflare's device-list API
 * has had a couple of shapes over time, so treat this as a starting point
 * to confirm against a live response rather than as certain.
 */

import { requireAuth, cfRequest, json } from "../_lib.js";

export async function onRequestGet({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    try {
        const devices = await cfRequest(env, "/devices");
        return json(
            devices.map(d => ({
                id: d.id,
                name: d.device_name || d.name || "Unnamed device",
                user: d.user?.email || null,
                lastSeen: d.last_seen || d.updated_at || null
            }))
        );
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}

export async function onRequestDelete({ request, env }) {
    const authError = requireAuth(request, env);
    if (authError) return authError;

    const { id } = await request.json();
    if (!id) return json({ error: "id is required" }, { status: 400 });

    try {
        await cfRequest(env, `/devices/${id}`, { method: "DELETE" });
        return json({ status: "revoked" });
    } catch (err) {
        return json({ error: err.message }, { status: 502 });
    }
}
