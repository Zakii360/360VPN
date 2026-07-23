"use strict";

/*
 * 360VPN
 * Frontend application — Step 1
 *
 * This file currently handles:
 * - Dashboard navigation
 * - Session timer
 * - Location selection
 * - Protection toggles
 * - Custom blocked domains
 * - Trusted domain handling
 * - Profile initial customization
 * - Toast notifications
Based off of the proxy.pac handler in 360's old VPN but I changed some stuff.
 * IMPORTANT:
 * 360-search.com is permanently trusted.
 */

const VPN_APP = {
    version: "1.0.0",

    trustedDomains: [
        "360-search.com"
    ],

    connection: {
        connected: false,
        location: "automatic",
        protocol: "WireGuard",
        startedAt: null
    },

    profile: {
        initial: "A"
    },

    protection: {
        malware: true,
        phishing: true,
        adult: true,
        gambling: true,
        drugs: true,
        social: false,
        autoconnect: false,
        killswitch: true,
        fastest: true
    },

    blockedDomains: [],

    // Backend-managed devices (see api.js). When a device is selected,
    // protection toggles and blocked domains sync to that device's real
    // NextDNS filtering profile instead of just local storage.
    devices: [],
    activeDeviceId: null
};


/* =========================================
   DOM HELPERS
========================================= */

const $ = (selector, parent = document) => {
    return parent.querySelector(selector);
};

const $$ = (selector, parent = document) => {
    return [...parent.querySelectorAll(selector)];
};


/* =========================================
   STORAGE
========================================= */

const STORAGE_KEYS = {
    profile: "360vpn_profile",
    protection: "360vpn_protection",
    blockedDomains: "360vpn_blocked_domains",
    location: "360vpn_location"
};


function loadStoredState() {

    try {

        const storedProfile =
            localStorage.getItem(STORAGE_KEYS.profile);

        if (storedProfile) {

            const parsedProfile =
                JSON.parse(storedProfile);

            if (
                parsedProfile &&
                typeof parsedProfile.initial === "string"
            ) {
                VPN_APP.profile.initial =
                    normalizeInitial(parsedProfile.initial);
            }
        }


        const storedProtection =
            localStorage.getItem(STORAGE_KEYS.protection);

        if (storedProtection) {

            const parsedProtection =
                JSON.parse(storedProtection);

            if (
                parsedProtection &&
                typeof parsedProtection === "object"
            ) {
                VPN_APP.protection = {
                    ...VPN_APP.protection,
                    ...parsedProtection
                };
            }
        }


        const storedDomains =
            localStorage.getItem(STORAGE_KEYS.blockedDomains);

        if (storedDomains) {

            const parsedDomains =
                JSON.parse(storedDomains);

            if (Array.isArray(parsedDomains)) {

                VPN_APP.blockedDomains =
                    parsedDomains
                        .filter(Boolean)
                        .map(normalizeDomain)
                        .filter(Boolean)
                        .filter(isNotTrustedDomain);
            }
        }


        const storedLocation =
            localStorage.getItem(STORAGE_KEYS.location);

        if (storedLocation) {

            VPN_APP.connection.location =
                storedLocation;
        }

    } catch (error) {

        console.warn(
            "360VPN: Could not load stored settings.",
            error
        );
    }
}


function saveProfile() {

    localStorage.setItem(
        STORAGE_KEYS.profile,
        JSON.stringify(VPN_APP.profile)
    );
}


function saveProtection() {

    localStorage.setItem(
        STORAGE_KEYS.protection,
        JSON.stringify(VPN_APP.protection)
    );
}


function saveBlockedDomains() {

    localStorage.setItem(
        STORAGE_KEYS.blockedDomains,
        JSON.stringify(VPN_APP.blockedDomains)
    );
}


function saveLocation() {

    localStorage.setItem(
        STORAGE_KEYS.location,
        VPN_APP.connection.location
    );
}


/* =========================================
   PROFILE / AVATAR
========================================= */

function normalizeInitial(value) {

    const initial =
        String(value || "")
            .trim()
            .charAt(0)
            .toUpperCase();

    return /^[A-Z0-9]$/.test(initial)
        ? initial
        : "A";
}


function updateProfileAvatar() {

    const avatar =
        $(".profile-avatar");

    if (!avatar) {
        return;
    }

    avatar.textContent =
        VPN_APP.profile.initial;
}


function changeProfileInitial() {

    const current =
        VPN_APP.profile.initial;

    const input =
        window.prompt(
            "Choose your profile initial:",
            current
        );

    if (input === null) {
        return;
    }

    const initial =
        normalizeInitial(input);

    VPN_APP.profile.initial =
        initial;

    saveProfile();

    updateProfileAvatar();

    showToast(
        `Profile initial changed to ${initial}.`
    );
}


/* =========================================
   NAVIGATION
========================================= */

const VIEW_TITLES = {
    overview: "Overview",
    protection: "Protection",
    locations: "Locations",
    devices: "Devices",
    settings: "Settings"
};


function navigateTo(viewName) {

    if (!VIEW_TITLES[viewName]) {
        viewName = "overview";
    }

    const views =
        $$("[data-view-panel]");

    const navigationItems =
        $$(".nav-item");

    views.forEach(view => {

        const isActive =
            view.dataset.viewPanel === viewName;

        view.classList.toggle(
            "active",
            isActive
        );
    });


    navigationItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.view === viewName
        );
    });


    const pageTitle =
        $("#pageTitle");

    if (pageTitle) {

        pageTitle.textContent =
            VIEW_TITLES[viewName];
    }


    const sidebar =
        $("#sidebar");

    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function initializeNavigation() {

    $$(".nav-item").forEach(item => {

        item.addEventListener(
            "click",
            () => {

                navigateTo(
                    item.dataset.view
                );
            }
        );
    });


    $$("[data-navigate]").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                navigateTo(
                    button.dataset.navigate
                );
            }
        );
    });
}


/* =========================================
   MOBILE MENU
========================================= */

function initializeMobileMenu() {

    const menuButton =
        $("#mobileMenuButton");

    const sidebar =
        $("#sidebar");

    if (
        !menuButton ||
        !sidebar
    ) {
        return;
    }


    menuButton.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );
        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !sidebar.classList.contains(
                    "open"
                )
            ) {
                return;
            }

            const clickedInsideSidebar =
                sidebar.contains(
                    event.target
                );

            const clickedMenuButton =
                menuButton.contains(
                    event.target
                );

            if (
                !clickedInsideSidebar &&
                !clickedMenuButton
            ) {

                sidebar.classList.remove(
                    "open"
                );
            }
        }
    );
}


/* =========================================
   VPN CONNECTION
========================================= */

function toggleConnection() {

    if (
        VPN_APP.connection.connected
    ) {

        disconnectVPN();

    } else {

        connectVPN();
    }
}


function connectVPN() {

    /*
     * STEP 2:
     *
     * This is where the real VPN connection
     * API will be called.
     *
     * Example future flow:
     *
     * const response = await fetch(
     *     "/api/vpn/connect"
     * );
     *
     * The frontend should only mark the
     * connection active after the backend
     * confirms it.
     */

    const button =
        $("#connectButton");

    if (button) {

        button.disabled =
            true;

        const text =
            $("#connectButtonText");

        if (text) {
            text.textContent =
                "Connecting...";
        }
    }


    setTimeout(
        () => {

            VPN_APP.connection.connected =
                true;

            VPN_APP.connection.startedAt =
                Date.now();

            updateConnectionUI();

            showToast(
                "VPN connection established."
            );

        },
        800
    );
}


function disconnectVPN() {

    /*
     * STEP 2:
     *
     * Replace this demo logic with the
     * actual VPN disconnect API.
     */

    VPN_APP.connection.connected =
        false;

    VPN_APP.connection.startedAt =
        null;

    updateConnectionUI();

    showToast(
        "VPN connection disconnected."
    );
}


/* =========================================
   CONNECTION UI
========================================= */

function updateConnectionUI() {

    const connected =
        VPN_APP.connection.connected;


    const status =
        $("#connectionStatus");

    const description =
        $("#connectionDescription");

    const buttonText =
        $("#connectButtonText");

    const headerStatus =
        $("#headerConnectionStatus");

    const ipAddress =
        $("#ipAddress");

    const latency =
        $("#latencyValue");

    const connectionIcon =
        $("#connectionIcon");

    const protectionStatus =
        $("#protectionStatus");


    if (connected) {

        if (status) {
            status.textContent =
                "Connected";
        }

        if (description) {
            description.textContent =
                "Your connection is protected by 360VPN.";
        }

        if (buttonText) {
            buttonText.textContent =
                "Disconnect";
        }

        if (headerStatus) {
            headerStatus.textContent =
                "Connected";
        }

        if (ipAddress) {
            ipAddress.textContent =
                "Protected";
        }

        if (latency) {
            latency.textContent =
                "—";
        }

        if (connectionIcon) {
            connectionIcon.textContent =
                "✓";
        }

        if (protectionStatus) {
            protectionStatus.textContent =
                "Active";
        }

    } else {

        if (status) {
            status.textContent =
                "Not connected";
        }

        if (description) {
            description.textContent =
                "Your internet connection is currently using your normal network.";
        }

        if (buttonText) {
            buttonText.textContent =
                "Connect";
        }

        if (headerStatus) {
            headerStatus.textContent =
                "Disconnected";
        }

        if (ipAddress) {
            ipAddress.textContent =
                "Not connected";
        }

        if (latency) {
            latency.textContent =
                "—";
        }

        if (connectionIcon) {
            connectionIcon.textContent =
                "◌";
        }

        if (protectionStatus) {
            protectionStatus.textContent =
                "Active";
        }
    }


    updateLocationUI();
}


function initializeConnection() {

    const button =
        $("#connectButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        toggleConnection
    );

    updateConnectionUI();
}


/* =========================================
   SESSION TIMER
========================================= */

function formatDuration(milliseconds) {

    const totalSeconds =
        Math.max(
            0,
            Math.floor(
                milliseconds / 1000
            )
        );

    const hours =
        Math.floor(
            totalSeconds / 3600
        );

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const seconds =
        totalSeconds % 60;


    return [
        hours,
        minutes,
        seconds
    ]
        .map(
            value =>
                String(value).padStart(
                    2,
                    "0"
                )
        )
        .join(":");
}


function updateSessionTimer() {

    const sessionTime =
        $("#sessionTime");

    if (!sessionTime) {
        return;
    }


    if (
        !VPN_APP.connection.connected ||
        !VPN_APP.connection.startedAt
    ) {

        sessionTime.textContent =
            "00:00:00";

        return;
    }


    sessionTime.textContent =
        formatDuration(
            Date.now() -
            VPN_APP.connection.startedAt
        );
}


function initializeSessionTimer() {

    updateSessionTimer();

    setInterval(
        updateSessionTimer,
        1000
    );
}


/* =========================================
   LOCATION MANAGEMENT
========================================= */

const LOCATION_DATA = {

    automatic: {
        name: "Automatic",
        city: "Best available server",
        code: "AUTO"
    },

    "united-states": {
        name: "United States",
        city: "United States",
        code: "US"
    },

    canada: {
        name: "Canada",
        city: "Canada",
        code: "CA"
    },

    "united-kingdom": {
        name: "United Kingdom",
        city: "United Kingdom",
        code: "UK"
    },

    germany: {
        name: "Germany",
        city: "Germany",
        code: "DE"
    },

    japan: {
        name: "Japan",
        city: "Japan",
        code: "JP"
    }
};


function selectLocation(location) {

    if (!LOCATION_DATA[location]) {
        return;
    }


    VPN_APP.connection.location =
        location;

    saveLocation();


    $$(".server-card").forEach(card => {

        card.classList.toggle(
            "selected",
            card.dataset.location === location
        );
    });


    updateLocationUI();

    showToast(
        `${LOCATION_DATA[location].name} selected.`
    );
}


function updateLocationUI() {

    const location =
        LOCATION_DATA[
            VPN_APP.connection.location
        ] ||
        LOCATION_DATA.automatic;


    const locationName =
        $("#locationName");

    const locationCity =
        $("#locationCity");

    const currentLocation =
        $("#currentLocation");

    if (locationName) {

        locationName.textContent =
            location.name;
    }

    if (locationCity) {

        locationCity.textContent =
            location.city;
    }

    if (currentLocation) {

        currentLocation.textContent =
            location.name;
    }


    $$(".server-card").forEach(card => {

        card.classList.toggle(
            "selected",
            card.dataset.location ===
            VPN_APP.connection.location
        );
    });
}


function initializeLocations() {

    $$(".server-card").forEach(card => {

        card.addEventListener(
            "click",
            () => {

                selectLocation(
                    card.dataset.location
                );
            }
        );
    });


    updateLocationUI();
}


/* =========================================
   PROTECTION SETTINGS
========================================= */

function initializeProtectionSettings() {

    $$(".toggle-input").forEach(input => {

        const setting =
            input.dataset.setting;

        if (!setting) {
            return;
        }


        if (
            Object.prototype.hasOwnProperty.call(
                VPN_APP.protection,
                setting
            )
        ) {

            input.checked =
                Boolean(
                    VPN_APP.protection[setting]
                );
        }


        input.addEventListener(
            "change",
            () => {

                VPN_APP.protection[setting] =
                    input.checked;

                saveProtection();

                showToast(
                    `${formatSettingName(setting)} ${
                        input.checked
                            ? "enabled"
                            : "disabled"
                    }.`
                );

                syncActiveDeviceProtection(setting);
            }
        );
    });
}


function initializeDashboardSettings() {

    const tokenInput =
        $("#dashTokenInput");

    const saveButton =
        $("#saveDashTokenButton");

    const status =
        $("#dashConnectionStatus");

    if (!tokenInput || !saveButton) {
        return;
    }

    function refreshStatus() {
        status.textContent =
            window.Api && Api.isBackendConfigured()
                ? "Connected."
                : "Not connected — protection toggles and blocked domains are local-only until you connect.";
    }

    if (window.Api && Api.isBackendConfigured()) {
        tokenInput.value = "••••••••";
    }

    refreshStatus();

    saveButton.addEventListener(
        "click",
        () => {

            const value =
                tokenInput.value.trim();

            if (!value || value === "••••••••") {
                return;
            }

            Api.configure("", value);

            refreshStatus();

            showToast("Dashboard connected. Syncing...");

            loadProtectionFromBackend();
            loadEnrolledDevices();
        }
    );
}


/* =========================================
   CLOUDFLARE GATEWAY SYNC
   (see api.js — no-ops until Settings has a dashboard token configured)
========================================= */

async function syncActiveDeviceProtection(setting) {

    if (
        !window.Api ||
        !Api.isBackendConfigured() ||
        !setting
    ) {
        return;
    }

    try {

        await Api.setProtection(
            setting,
            VPN_APP.protection[setting]
        );

    } catch (error) {

        showToast(
            `Couldn't sync to Cloudflare: ${error.message}`
        );
    }
}


async function loadProtectionFromBackend() {

    if (
        !window.Api ||
        !Api.isBackendConfigured()
    ) {
        return;
    }

    try {

        const remote =
            await Api.getProtection();

        Object.assign(
            VPN_APP.protection,
            remote
        );

        $$(".toggle-input").forEach(input => {
            const setting = input.dataset.setting;
            if (setting && Object.prototype.hasOwnProperty.call(remote, setting)) {
                input.checked = Boolean(remote[setting]);
            }
        });

    } catch (error) {

        showToast(
            `Couldn't reach Cloudflare: ${error.message}`
        );
    }
}


async function loadEnrolledDevices() {

    if (
        !window.Api ||
        !Api.isBackendConfigured()
    ) {
        return;
    }

    try {

        VPN_APP.devices =
            await Api.listDevices();

        renderEnrolledDevices();

    } catch (error) {

        showToast(
            `Couldn't reach Cloudflare: ${error.message}`
        );
    }
}


function renderEnrolledDevices() {

    const list =
        $("#warpDeviceList");

    if (!list) {
        return;
    }

    if (!VPN_APP.devices.length) {
        list.innerHTML =
            "<p class=\"muted\">No devices enrolled yet — install WARP and sign in on a device to see it here.</p>";
        return;
    }

    list.innerHTML =
        VPN_APP.devices
            .map(device =>
                `<div class="device-row">
                    <span>${device.name}</span>
                    <span class="muted">${device.user || ""}</span>
                </div>`
            )
            .join("");
}


function formatSettingName(setting) {

    const names = {

        malware: "Malware protection",

        phishing: "Phishing protection",

        adult: "Adult content filtering",

        gambling: "Gambling filtering",

        drugs: "Drug content filtering",

        social: "Social media filtering",

        autoconnect: "Auto-connect",

        killswitch: "Kill switch",

        fastest: "Fastest server selection"
    };


    return (
        names[setting] ||
        setting
    );
}


/* =========================================
   DOMAIN HELPERS
========================================= */

function normalizeDomain(domain) {

    return String(domain || "")
        .trim()
        .toLowerCase()
        .replace(
            /^https?:\/\//,
            ""
        )
        .replace(
            /^www\./,
            ""
        )
        .split("/")[0]
        .split("?")[0]
        .split("#")[0];
}


function isValidDomain(domain) {

    if (!domain) {
        return false;
    }

    if (
        domain.includes(" ") ||
        domain.includes("://")
    ) {
        return false;
    }


    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
        domain
    );
}


function isTrustedDomain(domain) {

    const normalized =
        normalizeDomain(domain);


    return VPN_APP.trustedDomains.some(
        trusted => {

            return (
                normalized === trusted ||
                normalized.endsWith(
                    `.${trusted}`
                )
            );
        }
    );
}


function isNotTrustedDomain(domain) {

    return !isTrustedDomain(
        domain
    );
}


/* =========================================
   BLOCKED DOMAIN UI
========================================= */

function renderBlockedDomains() {

    const emptyState =
        $("#blockedDomainsEmpty");

    const list =
        $("#blockedDomainsList");


    if (
        !emptyState ||
        !list
    ) {
        return;
    }


    list.innerHTML = "";


    if (
        VPN_APP.blockedDomains.length === 0
    ) {

        emptyState.hidden =
            false;

        list.classList.remove(
            "has-items"
        );

        return;
    }


    emptyState.hidden =
        true;

    list.classList.add(
        "has-items"
    );


    VPN_APP.blockedDomains.forEach(
        domain => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "domain-table-row";


            const name =
                document.createElement(
                    "strong"
                );

            name.textContent =
                domain;


            const removeButton =
                document.createElement(
                    "button"
                );

            removeButton.type =
                "button";

            removeButton.className =
                "remove-domain-button";

            removeButton.textContent =
                "Remove";


            removeButton.addEventListener(
                "click",
                () => {

                    removeBlockedDomain(
                        domain
                    );
                }
            );


            row.append(
                name,
                removeButton
            );

            list.appendChild(
                row
            );
        }
    );
}


function addBlockedDomain(domain) {

    const normalized =
        normalizeDomain(domain);


    if (!isValidDomain(normalized)) {

        showDomainError(
            "Enter a valid domain such as example.com."
        );

        return false;
    }


    if (isTrustedDomain(normalized)) {

        showDomainError(
            "This domain is permanently trusted by 360VPN and cannot be blocked."
        );

        return false;
    }


    if (
        VPN_APP.blockedDomains.includes(
            normalized
        )
    ) {

        showDomainError(
            "This domain is already blocked."
        );

        return false;
    }


    VPN_APP.blockedDomains.push(
        normalized
    );

    saveBlockedDomains();

    renderBlockedDomains();

    closeDomainModal();

    showToast(
        `${normalized} added to blocked domains.`
    );

    if (window.Api && Api.isBackendConfigured()) {
        Api.addDomain("block", normalized).catch(error =>
            showToast(`Couldn't sync to Cloudflare: ${error.message}`)
        );
    }

    return true;
}


function removeBlockedDomain(domain) {

    VPN_APP.blockedDomains =
        VPN_APP.blockedDomains.filter(
            item =>
                item !== domain
        );

    saveBlockedDomains();

    renderBlockedDomains();

    showToast(
        `${domain} removed from blocked domains.`
    );

    if (window.Api && Api.isBackendConfigured()) {
        Api.removeDomain("block", domain).catch(error =>
            showToast(`Couldn't sync to Cloudflare: ${error.message}`)
        );
    }
}


/* =========================================
   DOMAIN MODAL
========================================= */

function openDomainModal() {

    const modal =
        $("#domainModal");

    const input =
        $("#domainInput");

    const error =
        $("#domainModalError");


    if (!modal) {
        return;
    }


    modal.hidden =
        false;

    document.body.style.overflow =
        "hidden";


    if (input) {

        input.value =
            "";

        setTimeout(
            () => input.focus(),
            50
        );
    }


    if (error) {

        error.hidden =
            true;

        error.textContent =
            "";
    }
}


function closeDomainModal() {

    const modal =
        $("#domainModal");


    if (!modal) {
        return;
    }


    modal.hidden =
        true;

    document.body.style.overflow =
        "";
}


function showDomainError(message) {

    const error =
        $("#domainModalError");


    if (!error) {
        return;
    }


    error.textContent =
        message;

    error.hidden =
        false;
}


function initializeDomainModal() {

    const addBlocked =
        $("#addBlockedDomainButton");

    const addTrusted =
        $("#addTrustedDomainButton");

    const closeButton =
        $("#closeDomainModal");

    const cancelButton =
        $("#cancelDomainModal");

    const saveButton =
        $("#saveDomainButton");

    const input =
        $("#domainInput");


    if (addBlocked) {

        addBlocked.addEventListener(
            "click",
            openDomainModal
        );
    }


    /*
     * Trusted domains are intentionally
     * handled separately from blocked domains.
     *
     * Step 2 will connect this to the
     * backend-managed allowlist.
     */
    if (addTrusted) {

        addTrusted.addEventListener(
            "click",
            () => {

                showToast(
                    "Custom trusted domains will be available with backend integration."
                );
            }
        );
    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeDomainModal
        );
    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeDomainModal
        );
    }


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            () => {

                if (input) {

                    addBlockedDomain(
                        input.value
                    );
                }
            }
        );
    }


    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    addBlockedDomain(
                        input.value
                    );
                }


                if (
                    event.key === "Escape"
                ) {

                    closeDomainModal();
                }
            }
        );
    }


    const modal =
        $("#domainModal");

    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeDomainModal();
                }
            }
        );
    }
}


/* =========================================
   PROFILE MENU
========================================= */

function initializeProfile() {

    const profileButton =
        $("#profileButton");


    if (!profileButton) {
        return;
    }


    profileButton.addEventListener(
        "click",
        changeProfileInitial
    );


    updateProfileAvatar();
}


/* =========================================
   TOAST NOTIFICATIONS
========================================= */

let toastTimeout = null;


function showToast(message) {

    const toast =
        $("#toast");

    const toastMessage =
        $("#toastMessage");


    if (
        !toast ||
        !toastMessage
    ) {
        return;
    }


    toastMessage.textContent =
        message;

    toast.hidden =
        false;


    if (toastTimeout) {

        clearTimeout(
            toastTimeout
        );
    }


    toastTimeout =
        setTimeout(
            () => {

                toast.hidden =
                    true;

            },
            2800
        );
}


/* =========================================
   NOTIFICATIONS BUTTON
========================================= */

function initializeNotifications() {

    const button =
        $("#notificationsButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            showToast(
                "No new notifications."
            );
        }
    );
}


/* =========================================
   ADD DEVICE
========================================= */

function initializeDevices() {

    const button =
        $("#addDeviceButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            showToast(
                "Device enrollment will be available with backend integration."
            );
        }
    );
}


/* =========================================
   KEYBOARD SHORTCUTS
========================================= */

function initializeKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeDomainModal();

                const sidebar =
                    $("#sidebar");

                if (sidebar) {

                    sidebar.classList.remove(
                        "open"
                    );
                }
            }
        }
    );
}


/* =========================================
   APPLICATION INITIALIZATION
========================================= */

function initializeApp() {

    loadStoredState();

    initializeNavigation();

    initializeMobileMenu();

    initializeConnection();

    initializeSessionTimer();

    initializeLocations();

    initializeProtectionSettings();

    initializeDomainModal();

    initializeProfile();

    initializeNotifications();

    initializeDevices();

    initializeKeyboardShortcuts();

    renderBlockedDomains();

    updateConnectionUI();

    initializeDashboardSettings();

    loadProtectionFromBackend();

    loadEnrolledDevices();

    console.info(
        `360VPN frontend initialized — v${VPN_APP.version}`
    );
}


if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}
