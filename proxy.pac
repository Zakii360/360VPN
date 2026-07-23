// from 360-search.com's vpn, changed some logic and made 360 a permanent allowlist application
function FindProxyForURL(url, host) {
    host = host.toLowerCase();

    // 360-search.com is always allowed directly.
    if (
        host === "360-search.com" ||
        dnsDomainIs(host, ".360-search.com")
    ) {
        return "DIRECT";
    }

    // Local and private network addresses stay local.
    if (
        isPlainHostName(host) ||
        isInNet(host, "10.0.0.0", "255.0.0.0") ||
        isInNet(host, "172.16.0.0", "255.240.0.0") ||
        isInNet(host, "192.168.0.0", "255.255.0.0") ||
        isInNet(host, "127.0.0.0", "255.0.0.0")
    ) {
        return "DIRECT";
    }

    // Step 2:
    // Replace this with the Cloudflare Worker proxy endpoint.
    return "DIRECT";
}
