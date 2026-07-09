const meshdropGetById = globalThis.$;
const meshdropQuery = globalThis.$$;
const meshdropBrowserTabsConnector = globalThis.BrowserTabsConnector;
const meshdropEvents = globalThis.Events;
const meshdropLocalization = globalThis.Localization;
const meshdropNostrDiscoveryProtocol = globalThis.NostrDiscoveryProtocol;
const meshdropPersistentStorage = globalThis.PersistentStorage;
const meshdropProtocolServerPreferences = globalThis.ProtocolServerPreferences;
const meshdropRelaySettingsPreferences = () => globalThis.RelaySettingsPreferences || globalThis.meshdropRelaySettingsPreferences;
const meshdropChangeFavicon = globalThis.changeFavicon;
const meshdropDecodeBase64Files = globalThis.decodeBase64Files;
const meshdropDecodeBase64Text = globalThis.decodeBase64Text;
const meshdropGetThumbnailAsDataUrl = globalThis.getThumbnailAsDataUrl;
const meshdropIsUrlValid = globalThis.isUrlValid;
const meshdropUiHasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const meshdropNetworkRouteMeta = (meta, privacyTone = "direct") => ({
    group: "Network routes",
    privacyTone,
    ...meta
});
const meshdropRouteDetails = (discovery, dataPath, extraLabel, extraValue) => [
    ["Discovery", discovery],
    ["Data path", dataPath],
    [extraLabel, extraValue]
];
const meshdropPrivateStorageDetails = (path, unencrypted) => [
    ["Path", path],
    ["Private mode", "encrypts before upload"],
    ["Unencrypted", unencrypted]
];
const meshdropMeshSignaledRouteMeta = (id, label, className, substrate, transferPrimitive) => meshdropNetworkRouteMeta({
    id,
    label,
    shortLabel: label,
    className,
    description: `WebRTC route discovered through Nostr WOT and signaled through ${substrate}`,
    privacy: `${substrate} signaling, instance ICE bridge when configured`,
    details: [
        ["Discovery", "Nostr WOT route request"],
        ["Signaling", `${substrate} substrate`],
        ["ICE bridge", "instance-scoped when descriptor exists"],
        ["Transfer primitive", transferPrimitive]
    ]
});
const meshdropStorageOption = (option) => ({
    id: option.id,
    type: "storage",
    label: option.label,
    description: option.description,
    group: "Storage routes",
    privacy: option.privacy,
    privacyTone: option.privacyTone,
    details: option.details,
    attempt: PeerRouteStatusProtocol.attempt({
        route: option.route,
        routeLabel: option.label,
        state: "candidate",
        encrypted: option.encrypted,
        objectStore: true
    })
});
const meshdropSendFilesOrText = (files, text, peerId) => {
    if (files.length > 0) {
        meshdropEvents.fire('select-files-transport', {files, to: peerId});
    }
    else if (text.length > 0) {
        meshdropEvents.fire('send-text', {text, to: peerId});
    }
};

const PeerAvailabilityProtocol = {
    roomTypeOrder: ["ip", "nostr", "fips", "pollen", "secret", "public-id"],
    terminalRouteStates: new Set([
        "disabled",
        "failed",
        "timeout",
        "error",
        "connection-failed",
        "ice-failed"
    ]),
    roomTypeMeta: {
        "ip": meshdropNetworkRouteMeta({
            id: "local",
            label: "Instance",
            shortLabel: "Instance",
            className: "badge-room-ip",
            description: "Instance-assisted WebRTC path through same-instance discovery",
            privacy: "Instance-assisted path",
            details: meshdropRouteDetails("same MeshDrop instance", "clearnet WebRTC ICE", "Exclude with", "Instance toggle")
        }, "strong"),
        "secret": meshdropNetworkRouteMeta({
            id: "paired",
            label: "Paired",
            shortLabel: "Pair",
            className: "badge-room-secret",
            description: "Paired-device peer-to-peer data channel",
            privacy: "Direct paired path",
            details: meshdropRouteDetails("paired device", "WebRTC ICE direct", "Best case", "local network candidate")
        }, "strong"),
        "nostr": meshdropNetworkRouteMeta({
            id: "webrtc",
            label: "Clearnet via Nostr",
            shortLabel: "Clearnet",
            className: "badge-room-nostr",
            description: "Direct clearnet WebRTC route discovered and signaled by Nostr",
            privacy: "Direct clearnet path",
            details: meshdropRouteDetails("Nostr WOT", "clearnet WebRTC ICE", "Nostr events", "discovery/signaling only")
        }),
        "fips": meshdropMeshSignaledRouteMeta("fips", "FIPS", "badge-room-fips", "FIPS", "FIPS stream is separate"),
        "pollen": meshdropMeshSignaledRouteMeta("pollen-mesh", "Pollen", "badge-room-pollen", "Pollen", "Pollen storage is separate"),
        "public-id": meshdropNetworkRouteMeta({
            id: "room",
            label: "Room",
            shortLabel: "Room",
            className: "badge-room-public-id",
            description: "Peer-to-peer transfer found through room signaling",
            privacy: "Direct after room signaling",
            details: meshdropRouteDetails("public room", "WebRTC ICE direct", "Room server", "signaling only")
        })
    },

    roomTypes(peer) {
        const roomIds = peer?._roomIds || {};
        const roomTypes = this.roomTypeOrder.filter(roomType => meshdropUiHasOwn(roomIds, roomType));
        const statusRoomType = this.statusRoomType(peer?.routeStatus);
        if (statusRoomType && !roomTypes.includes(statusRoomType)) roomTypes.push(statusRoomType);
        return this.roomTypeOrder.filter(roomType => roomTypes.includes(roomType));
    },

    statusRoomType(status = null) {
        const roomType = status?.route || status?.roomType || "";
        if (!roomType || this.terminalRouteStates.has(status?.state)) return "";
        return roomType;
    },

    routeStatuses(peer) {
        const statuses = [];
        if (Array.isArray(peer?.routeStatuses)) statuses.push(...peer.routeStatuses);
        if (peer?.routeStatus) statuses.push(peer.routeStatus);
        return statuses.filter(status => status?.route || status?.roomType);
    },

    setConfig(config = null) {
        this._config = config || null;
    },

    roomTypeSupported(roomType, config = this._config) {
        if (!config?.capabilities?.transports || !globalThis.RuntimeCapabilities?.transportSupported) return true;

        if (roomType === "nostr") {
            return globalThis.RuntimeCapabilities.transportSupported(config, "nostr", true)
                && globalThis.RuntimeCapabilities.transportSupported(config, "webrtc", true);
        }
        const transport = this.transportForRoomType(roomType);
        if (!transport) return true;

        return globalThis.RuntimeCapabilities.transportSupported(config, transport, true);
    },

    storageRouteSupported(transport, config = this._config) {
        if (!config?.capabilities?.transports || !globalThis.RuntimeCapabilities?.transportSupported) return true;

        return globalThis.RuntimeCapabilities.transportSupported(config, transport, true);
    },

    transportForRoomType(roomType) {
        return {
            ip: "localDiscovery",
            nostr: "nostr",
            fips: "fips",
            pollen: "pollen"
        }[roomType] || "";
    },

    unavailableReasonForRoomType(roomType, config = this._config) {
        const transport = this.transportForRoomType(roomType);
        const capabilityReason = transport
            ? config?.capabilities?.transports?.[transport]?.unavailableReason
            : "";
        if (capabilityReason) return capabilityReason;
        if (roomType === "fips" || roomType === "pollen") return "requires-instance-native-route";
        if (roomType === "ip") return "requires-instance";
        return "route-policy";
    },

    statusForRoomType(peer, roomType) {
        return this.routeStatuses(peer)
            .filter(status => (status.route || status.roomType) === roomType)
            .at(-1) || null;
    },

    availability(peer, options = {}) {
        return this.roomTypes(peer).flatMap(roomType => {
            const supported = this.roomTypeSupported(roomType);
            if (!supported && options.includeUnavailable !== true) return [];

            return [{
                roomType,
                unavailable: !supported,
                unavailableReason: supported ? "" : this.unavailableReasonForRoomType(roomType),
                backendOnly: !supported && ["fips", "pollen"].includes(roomType),
                ...this.roomTypeMeta[roomType]
            }];
        });
    },

    directOptions(peer) {
        return this.availability(peer)
            .map(option => ({
                id: option.id,
                type: "direct",
                roomType: option.roomType,
                peerId: this.peerIdForRoomType(peer, option.roomType),
                label: option.label,
                description: option.description,
                group: option.group,
                privacy: option.privacy,
                privacyTone: option.privacyTone,
                details: option.details,
                attempt: PeerRouteStatusProtocol.attempt(
                    this.statusForRoomType(peer, option.roomType)
                    || {route: option.roomType, state: "candidate"}
                )
            }));
    },

    peerIdForRoomType(peer, roomType) {
        return peer?._peerIdsByRoomType?.[roomType] || peer?.id;
    },

    identityKeys(peer, roomType = null) {
        const pubkeys = [
            peer?.nostrIdentity?.pubkey,
            roomType === "nostr" ? peer?.id : "",
            peer?.routeMetadata?.peerPubkey,
            peer?.routeDescriptor?.peerPubkey
        ];
        Object.values(peer?._routeMetadataByRoomType || {}).forEach(routeMetadata => {
            pubkeys.push(routeMetadata?.peerPubkey);
        });

        return [...new Set(pubkeys
            .map(pubkey => String(pubkey || "").toLowerCase())
            .filter(Boolean)
            .map(pubkey => `nostr:${pubkey}`))];
    },

    routeLabel(roomType) {
        return this.roomTypeMeta[roomType]?.shortLabel || roomType || "route";
    },

    privateTransferAvailable() {
        return globalThis.BlossomTransferProtocol?.hasWebCrypto?.() !== false;
    },

    privacyModeAvailable(mode) {
        return mode !== "private" || this.privateTransferAvailable();
    },

    defaultPrivacyMode() {
        const configuredDefault = globalThis.TransferPrivacyProtocol?.defaultMode || "private";
        return this.privacyModeAvailable(configuredDefault) ? configuredDefault : "unencrypted";
    },

    storageOptions() {
        const routes = [
            {
                active: globalThis.meshdropHashtreeTransfer?.isActive?.(),
                transport: "hashtree",
                option: {
                    id: "hashtree",
                    label: "Hashtree storage",
                    description: "Server-assisted content-addressed storage route",
                    privacy: "Integrity, not secrecy",
                    privacyTone: "caution",
                    details: meshdropPrivateStorageDetails("Blossom storage", "servers see chunks"),
                    route: "hashtree",
                    encrypted: false
                }
            },
            {
                active: globalThis.meshdropBlossomTransfer?.isActive?.(),
                transport: "blossom",
                option: {
                    id: "blossom",
                    label: "Blossom storage",
                    description: "Server-assisted encrypted object storage route",
                    privacy: "Stored ciphertext",
                    privacyTone: "encrypted",
                    details: [
                        ["Path", "selected Blossom servers"],
                        ["Encryption", "AES-256-GCM"],
                        ["Servers store", "ciphertext only"]
                    ],
                    route: "blossom",
                    encrypted: true
                }
            },
            {
                active: globalThis.meshdropPollenTransfer?.isActive?.(),
                transport: "pollen",
                option: {
                    id: "pollen",
                    label: "Pollen Storage",
                    description: "Seed files into Pollen storage for handoff",
                    privacy: "Storage handoff",
                    privacyTone: "caution",
                    details: meshdropPrivateStorageDetails("browser to MeshDrop server to Pollen blob", "server sees files"),
                    route: "pollen-storage",
                    encrypted: false
                }
            }
        ];

        return routes
            .filter(route => route.active && this.storageRouteSupported(route.transport))
            .map(route => meshdropStorageOption(route.option));
    },

    optionsFor(peer) {
        const direct = this.directOptions(peer);
        const storage = this.storageOptions();
        const localIndex = direct.findIndex(option => option.id === "local");
        const orderedDirect = localIndex > 0
            ? [direct[localIndex], ...direct.slice(0, localIndex), ...direct.slice(localIndex + 1)]
            : direct;

        return [...orderedDirect, ...storage];
    },

    groupOptions(options) {
        const groups = [];
        (options || []).forEach(option => {
            const label = option.group || "Other routes";
            let group = groups.find(entry => entry.label === label);
            if (!group) {
                group = {label, options: []};
                groups.push(group);
            }
            group.options.push(option);
        });
        return groups;
    },

    countByRoomType(peers, roomType) {
        return Object.values(peers || {})
            .filter(peer => meshdropUiHasOwn(peer?._roomIds, roomType))
            .length;
    },

    networkPostureCounts(peers) {
        return ["ip", "nostr", "fips", "pollen"]
            .map(roomType => ({
                roomType,
                ...this.roomTypeMeta[roomType],
                count: this.countByRoomType(peers, roomType)
            }));
    },

    badgeClassName(peer) {
        const availability = this.availability(peer);
        const preferred = availability.find(option => option.roomType === "secret")
            || availability.find(option => option.roomType === "ip")
            || availability[0];

        return preferred?.className || "badge-room-public-id";
    }
};

globalThis.PeerAvailabilityProtocol = PeerAvailabilityProtocol;

const PeerRouteStatusProtocol = {
    stateLabels: {
        candidate: "Available",
        selected: "Trying",
        requested: "Trying",
        accepted: "Accepted",
        connecting: "Connecting",
        waiting: "Waiting",
        offer: "Connecting",
        answer: "Connecting",
        "remote-offer": "Connecting",
        "remote-answer": "Connecting",
        "ice-checking": "Connecting",
        "connection-connecting": "Connecting",
        transferring: "Transferring",
        connected: "Connected",
        "ice-connected": "Connected",
        "ice-completed": "Connected",
        "connection-connected": "Connected",
        complete: "Complete",
        disabled: "Unavailable",
        unavailable: "Unavailable",
        rejected: "Rejected",
        expired: "Expired",
        timeout: "Timed out",
        failed: "Failed",
        error: "Failed",
        "connection-failed": "Failed",
        "ice-failed": "Failed",
        "blocked-fallback": "Fallback blocked",
        "connection-disconnected": "Disconnected",
        "ice-disconnected": "Disconnected"
    },

    reasonLabels: {
        "requires-native-app": "Requires native app",
        "requires-instance": "Requires instance",
        "requires-instance-native-route": "Requires instance or native app",
        "requires-nostr": "Needs Nostr sign-in",
        "nostr-sign-in": "Needs Nostr sign-in",
        "peer-not-trusted": "Peer not trusted",
        "overlay-unavailable": "Overlay network unavailable",
        "route-expired": "Peer route expired",
        "peer-route-expired": "Peer route expired",
        "fallback-disabled": "Fallback disabled by privacy policy",
        "route-policy": "Fallback disabled by privacy policy",
        "overlay-bridge-unavailable": "Instance ICE bridge unavailable",
        "overlay-relay-unavailable": "Instance ICE bridge unavailable",
        "clearnet-disabled": "Clearnet disabled",
        "instance-ice-bridge": "Instance ICE bridge",
        "private-route": "Private route requested",
        "priority": "Best available route",
        "local-description": "Local offer prepared",
        "remote-description": "Peer answered",
        "ice-failed": "ICE route failed",
        "connection-failed": "Connection failed",
        "data-channel-closed": "Data channel closed",
        "route-timeout": "Peer route timed out"
    },

    pendingStates: new Set([
        "selected",
        "requested",
        "connecting",
        "waiting",
        "offer",
        "answer",
        "remote-offer",
        "remote-answer",
        "ice-checking",
        "connection-connecting",
        "transferring"
    ]),

    completeStates: new Set([
        "complete",
        "connected",
        "ice-connected",
        "ice-completed",
        "connection-connected"
    ]),

    blockedStates: new Set([
        "disabled",
        "unavailable",
        "blocked-fallback"
    ]),

    failedStates: new Set([
        "rejected",
        "expired",
        "timeout",
        "failed",
        "error",
        "connection-failed",
        "ice-failed",
        "connection-disconnected",
        "ice-disconnected"
    ]),

    text(status = {}) {
        const route = PeerAvailabilityProtocol.routeLabel(status.route || status.roomType);

        switch (status.state) {
            case "candidate":
                return status.selected ? `Trying ${route}...` : `${route} available`;
            case "selected":
            case "requested":
                return `Trying ${route}...`;
            case "connecting":
                return `Connecting on ${route}...`;
            case "waiting":
                return `Waiting on ${route}...`;
            case "offer":
                return `Sending ${route} offer...`;
            case "answer":
                return `Answering on ${route}...`;
            case "remote-offer":
                return `Received ${route} offer...`;
            case "remote-answer":
                return `Received ${route} answer...`;
            case "ice-checking":
            case "connection-connecting":
                return `Checking ${route} ICE...`;
            case "ice-connected":
            case "ice-completed":
            case "connection-connected":
            case "connected":
                return `Connected on ${route}`;
            case "ice-failed":
            case "connection-failed":
            case "failed":
                return `${route} failed`;
            case "timeout":
                return `${route} timed out`;
            case "error":
                return `${route} error`;
            case "connection-disconnected":
            case "ice-disconnected":
                return `${route} disconnected`;
            case "disabled":
                return `${route} disabled`;
            default:
                return route ? `Connecting on ${route}...` : meshdropLocalization.getTranslation("notifications.connecting");
        }
    },

    stateLabel(status = {}) {
        return this.stateLabels[status.state] || "Connecting";
    },

    reasonLabel(reason = "") {
        if (!reason) return "";
        if (this.reasonLabels[reason]) return this.reasonLabels[reason];
        return String(reason)
            .split("-")
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    },

    routeLabel(status = {}) {
        return status.routeLabel || PeerAvailabilityProtocol.routeLabel(status.route || status.roomType);
    },

    message(status = {}) {
        const route = this.routeLabel(status);
        if (status.state === "disabled" || status.state === "unavailable") return `${route} unavailable`;
        if (status.state === "complete") return `Complete on ${route}`;
        return this.text(status);
    },

    privacyLabels(status = {}) {
        const labels = status.encrypted === false ? [] : ["End-to-end encrypted"];
        const route = status.route || status.roomType || "";
        if (status.instanceRelayed) {
            labels.push("Relayed by your instance", "Relayed by peer instance");
        } else if (status.backendOnly) {
            labels.push("Backend-only route");
        } else if (route === "nostr" || status.webRtcUsed) {
            labels.push("Direct data path");
        } else if (route === "ip") {
            labels.push("Instance-assisted discovery");
        } else if (status.objectStore) {
            labels.push("Object-store route");
        }
        if (status.publicDiscovery === true) labels.push("Public discovery enabled");
        if (status.publicDiscovery === false) labels.push("Public discovery disabled");
        return labels;
    },

    visualTone(status = {}) {
        const state = status.state || "candidate";
        if (this.pendingStates.has(state)) return "pending";
        if (this.completeStates.has(state)) return "complete";
        if (this.blockedStates.has(state)) return "blocked";
        if (this.failedStates.has(state)) return "failed";
        return "available";
    },

    attempt(status = {}) {
        const route = status.route || status.roomType || "unknown";
        return {
            route,
            routeLabel: this.routeLabel(status),
            state: status.state || "candidate",
            stateLabel: this.stateLabel(status),
            message: this.message(status),
            reason: this.reasonLabel(status.reason),
            privacyLabels: this.privacyLabels(status)
        };
    },

    visualAttempt(attempt = {}) {
        const route = attempt.route || "unknown";
        const state = attempt.state || "candidate";
        const routeLabel = attempt.routeLabel || PeerAvailabilityProtocol.routeLabel(route);
        const detail = [
            attempt.message,
            attempt.reason,
            ...(attempt.privacyLabels || [])
        ].filter(Boolean).join(" · ");
        const fallbackLabel = `${routeLabel} ${this.stateLabel({state})}`;
        const ariaLabel = detail || fallbackLabel;

        return {
            ...attempt,
            route,
            routeLabel,
            state,
            visibleLabel: "",
            tone: this.visualTone({state}),
            title: detail || fallbackLabel,
            ariaLabel
        };
    },

    createVisualAttemptChip(attempt = {}, className = "route-attempt") {
        const visual = this.visualAttempt(attempt);
        const item = document.createElement('span');
        item.className = className;
        item.dataset.route = visual.route;
        item.dataset.state = visual.state;
        item.dataset.tone = visual.tone;
        item.title = visual.title;
        item.setAttribute('role', 'img');
        item.setAttribute('aria-label', visual.ariaLabel);

        const symbol = document.createElement('span');
        symbol.className = 'route-attempt-symbol';
        symbol.setAttribute('aria-hidden', 'true');

        item.append(symbol);
        return item;
    },

    createAvailabilityPill(option = {}, visual = {}) {
        const pill = document.createElement('span');
        pill.className = ["availability-pill", option.className].filter(Boolean).join(" ");
        pill.dataset.transport = option.id || "";
        pill.dataset.route = visual.route || option.roomType || option.id || "";
        pill.dataset.state = visual.state || "candidate";
        pill.dataset.tone = visual.tone || "available";
        pill.title = visual.title || option.label || option.shortLabel || "";
        pill.setAttribute("role", "img");
        pill.setAttribute("aria-label", visual.ariaLabel || pill.title);

        const symbol = document.createElement('span');
        symbol.className = 'availability-pill-symbol';
        symbol.setAttribute('aria-hidden', 'true');

        pill.append(symbol);
        return pill;
    },

    attemptsForPeer(peer = {}) {
        const attempts = PeerAvailabilityProtocol.availability(peer, {includeUnavailable: true})
            .map(option => this.attempt(
                PeerAvailabilityProtocol.statusForRoomType(peer, option.roomType)
                || {
                    route: option.roomType,
                    state: option.unavailable ? "disabled" : "candidate",
                    reason: option.unavailableReason,
                    backendOnly: option.backendOnly
                }
            ));
        const seen = new Set(attempts.map(attempt => attempt.route));
        PeerAvailabilityProtocol.routeStatuses(peer).forEach(status => {
            const route = status.route || status.roomType;
            if (!route || seen.has(route)) return;
            attempts.push(this.attempt(status));
            seen.add(route);
        });
        return attempts;
    },

    formatBytes(bytes) {
        const value = Number(bytes || 0);
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        return `${(value / 1024 / 1024).toFixed(1)} MB`;
    },

    proofSummary(proof = {}) {
        if (!proof.routeType || proof.fallbackUsed || proof.hashMatched !== true) return null;
        if (Number(proof.bytesSent) !== Number(proof.bytesReceived)) return null;
        const route = proof.routeType;
        return {
            route,
            routeLabel: PeerAvailabilityProtocol.routeLabel(route),
            state: "complete",
            stateLabel: "Complete",
            message: `Complete on ${PeerAvailabilityProtocol.routeLabel(route)}`,
            dataPlane: proof.dataPlanePrimitive || "",
            bytes: `${this.formatBytes(proof.bytesSent)} sent / ${this.formatBytes(proof.bytesReceived)} received`,
            privacyLabels: this.privacyLabels({
                route,
                state: "complete",
                webRtcUsed: proof.webRtcUsed,
                instanceRelayed: proof.instanceRelayed
            })
        };
    },

    statusKey(status = {}) {
        return `route-${status.route || status.roomType || "unknown"}-${status.state || "unknown"}`;
    }
};

globalThis.PeerRouteStatusProtocol = PeerRouteStatusProtocol;

const MeshDropSafeDom = {
    setQrSvg($container, svgMarkup) {
        const parsed = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
        const $svg = parsed.documentElement;
        if (!$svg || $svg.tagName.toLowerCase() !== "svg") {
            throw new Error("QRCode renderer returned invalid SVG");
        }
        $container.replaceChildren(document.importNode($svg, true));
    },

    renderReceivedText($target, text) {
        $target.textContent = "";
        const $fragment = document.createDocumentFragment();
        let cursor = 0;

        for (const match of this._receivedTextLinkMatches(text)) {
            const whitespace = match.whitespace || "";
            const linkText = match.linkText;
            const href = this._normalizeReceivedTextLink(linkText);
            if (!meshdropIsUrlValid(href)) continue;

            $fragment.appendChild(document.createTextNode(text.slice(cursor, match.index + whitespace.length)));
            const $link = document.createElement("a");
            $link.href = href;
            $link.target = "_blank";
            $link.rel = "noreferrer";
            $link.textContent = linkText;
            $fragment.appendChild($link);
            cursor = match.index + match.full.length;
        }

        $fragment.appendChild(document.createTextNode(text.slice(cursor)));
        $target.replaceChildren($fragment);
    },

    _receivedTextLinkMatches(text) {
        const chrs = `a-zA-Z0-9áàäčçđéèêŋńñóòôöšŧüžæøåëìíîïðùúýþćěłřśţźǎǐǒǔǥǧǩǯəʒâûœÿãõāēīōūăąĉċďĕėęĝğġģĥħĩĭįıĵķĸĺļľņňŏőŕŗŝşťũŭůűųŵŷżאבגדהוזחטיךכלםמןנסעףפץצקרשתװױײ`;
        const rgxWhitespace = `(?<whitespace>^|\\n|\\s)`;
        const rgxScheme = `(?<scheme>https?:\\/\\/)`;
        const rgxSchemeMail = `(mailto:)`;
        const rgxUserinfo = `(?:(?:[${chrs}.%]*(?::[${chrs}.%]*)?)@)`;
        const rgxHost = `(?:(?:[${chrs}](?:[${chrs}-]{0,61}[${chrs}])?\\.)+[${chrs}][${chrs}-]{0,61}[${chrs}])`;
        const rgxPort = `(:\\d*)`;
        const rgxPath = `(?:(?:\\/[${chrs}\\-\\._~!$&'\\(\\)\\*\\+,;=:@%]*)*)`;
        const rgxQueryAndFragment = `(\\?[${chrs}\\-_~:\\/#\\[\\]@!$&'\\(\\)*+,;=%.]*)`;
        const rgxUrl = `${rgxScheme}?${rgxHost}${rgxPort}?${rgxPath}${rgxQueryAndFragment}?`;
        const rgxMail = `${rgxSchemeMail}${rgxUserinfo}${rgxHost}`;
        const rgxLink = new RegExp(`${rgxWhitespace}(?<link>${rgxUrl}|${rgxMail})`, "g");

        return [...text.matchAll(rgxLink)].map(match => ({
            full: match[0],
            index: match.index,
            whitespace: match.groups.whitespace,
            scheme: match.groups.scheme,
            linkText: match.groups.link
        }));
    },

    _normalizeReceivedTextLink(linkText) {
        return linkText.startsWith("www") ? `http://${linkText}` : linkText;
    }
};

globalThis.MeshDropSafeDom = MeshDropSafeDom;

class PeersUI {

    constructor() {
        this.$xPeers = meshdropQuery('x-peers');
        this.$xNoPeers = meshdropQuery('x-no-peers');
        this.$xInstructions = meshdropQuery('x-instructions');
        this.$wsFallbackWarning = meshdropGetById('websocket-fallback');

        this.$sharePanel = meshdropQuery('.shr-panel');
        this.$shareModeImageThumb = meshdropQuery('.shr-panel .image-thumb');
        this.$shareModeTextThumb = meshdropQuery('.shr-panel .text-thumb');
        this.$shareModeFileThumb = meshdropQuery('.shr-panel .file-thumb');
        this.$shareModeDescriptor = meshdropQuery('.shr-panel .share-descriptor');
        this.$shareModeDescriptorItem = meshdropQuery('.shr-panel .descriptor-item');
        this.$shareModeDescriptorOther = meshdropQuery('.shr-panel .descriptor-other');
        this.$shareModeCancelBtn = meshdropQuery('.shr-panel .cancel-btn');
        this.$shareModeEditBtn = meshdropQuery('.shr-panel .edit-btn');

        this.peers = {};
        this._peerAliases = {};
        this._routeStatuses = {};

        this.shareMode = {
            active: false,
            descriptor: "",
            files: [],
            text: ""
        }

        meshdropEvents.on('peer-joined', e => this._onPeerJoined(e.detail));
        meshdropEvents.on('peer-added', _ => this._evaluateOverflowingPeers());
        meshdropEvents.on('peer-connected', e => this._onPeerConnected(e.detail.peerId, e.detail.connectionHash));
        meshdropEvents.on('peer-disconnected', e => this._onPeerDisconnected(e.detail));
        meshdropEvents.on('peer-route-status', e => this._onPeerRouteStatus(e.detail));
        meshdropEvents.on('peers', e => this._onPeers(e.detail));
        meshdropEvents.on('set-progress', e => this._onSetProgress(e.detail));

        meshdropEvents.on('drop', e => this._onDrop(e));
        meshdropEvents.on('keydown', e => this._onKeyDown(e));
        meshdropEvents.on('dragover', e => this._onDragOver(e));
        meshdropEvents.on('dragleave', _ => this._onDragEnd());
        meshdropEvents.on('dragend', _ => this._onDragEnd());
        meshdropEvents.on('resize', _ => this._evaluateOverflowingPeers());
        meshdropEvents.on('header-changed', _ => this._evaluateOverflowingPeers());

        meshdropEvents.on('paste', e => this._onPaste(e));
        meshdropEvents.on('activate-share-mode', e => this._activateShareMode(e.detail.files, e.detail.text));
        meshdropEvents.on('translation-loaded', _ => this._reloadShareMode());
        meshdropEvents.on('room-type-removed', e => this._onRoomTypeRemoved(e.detail.peerId, e.detail.roomType));


        this.$shareModeCancelBtn.addEventListener('click', _ => this._deactivateShareMode());

        meshdropEvents.on('peer-display-name-changed', e => this._onPeerDisplayNameChanged(e));
        meshdropEvents.on('peer-profile-changed', e => this._onPeerProfileChanged(e));
        meshdropEvents.on('nostr-identity-changed', e => this._onNostrIdentityChanged(e.detail));

        meshdropEvents.on('config', e => this._onConfig(e.detail || {}));
        meshdropEvents.on('ws-config', e => this._evaluateRtcSupport(e.detail))
    }

    _onConfig(config) {
        PeerAvailabilityProtocol.setConfig(config);
        Object.keys(this.peers).forEach(peerId => this._redrawPeerRoomTypes(peerId));
    }

    _evaluateRtcSupport(wsConfig) {
        if (wsConfig.wsFallback) {
            this.$wsFallbackWarning.hidden = false;
        }
        else {
            this.$wsFallbackWarning.hidden = true;
            if (!window.isRtcSupported) {
                alert(meshdropLocalization.getTranslation("instructions.webrtc-requirement"));
            }
        }
    }

    _changePeerDisplayName(peerId, displayName) {
        peerId = this._visiblePeerId(peerId);
        if (!this.peers[peerId]) return;

        this.peers[peerId].name.displayName = displayName;
        const peerIdNode = meshdropGetById(peerId);
        if (peerIdNode && displayName) peerIdNode.querySelector('.name').textContent = displayName;
        this._redrawPeerRoomTypes(peerId);
    }

    _onPeerDisplayNameChanged(e) {
        if (!e.detail.displayName) return;
        this._changePeerDisplayName(e.detail.peerId, e.detail.displayName);
    }

    _onPeerProfileChanged(e) {
        const peerId = this._visiblePeerId(e.detail.peerId);
        const peer = this.peers[peerId];
        if (!peer) return;

        if (e.detail.displayName) peer.name.displayName = e.detail.displayName;
        peer.nostrIdentity = {
            ...peer.nostrIdentity,
            picture: e.detail.picture || peer.nostrIdentity?.picture || ""
        };

        const peerNode = meshdropGetById(peerId);
        if (!peerNode) return;

        if (e.detail.displayName) peerNode.querySelector('.name').textContent = e.detail.displayName;
        peerNode.ui._setAvatar(peer.nostrIdentity.picture);
        this._redrawPeerRoomTypes(peerId);
    }

    async _onKeyDown(e) {
        if (!this.shareMode.active || Dialog.anyDialogShown()) return;

        if (e.key === "Escape") {
            await this._deactivateShareMode();
        }

        // close About PairDrop page on Escape
        if (e.key === "Escape") {
            window.location.hash = '#';
        }
    }

    _onPeerJoined(msg) {
        this._joinPeer(msg.peer, msg.roomType, msg.roomId);
    }

    _joinPeer(peer, roomType, roomId) {
        peer = this._withRouteMetadata(peer, roomType, roomId);
        const routeAllowed = this._routeAllowed(roomType);
        const pendingRouteStatus = routeAllowed ? null : this._pendingPrivateRouteStatus(peer, roomType);
        if (!routeAllowed && !pendingRouteStatus) return;
        if (globalThis.NostrFollowPolicy?.allowsPeer(peer, roomType) === false) return;
        if (this._anonymousOverlayPeerBlocked(peer, roomType)) return;

        const existingPeerId = this._existingPeerId(peer, roomType);
        const existingPeer = this.peers[existingPeerId];
        if (existingPeer) {
            if (routeAllowed) {
                this._mergePeer(existingPeerId, peer, roomType, roomId);
            } else {
                this._applyRouteStatus(existingPeerId, pendingRouteStatus);
            }
            return;
        }

        peer._isSameBrowser = () => meshdropBrowserTabsConnector.peerIsSameBrowser(peer.id);
        peer._roomIds = {};
        peer._peerIdsByRoomType = {};

        if (routeAllowed) {
            peer._roomIds[roomType] = roomId;
            peer._peerIdsByRoomType[roomType] = peer.id;
        }
        peer.routeStatus = this._routeStatuses[peer.id]
            || this._routeStatuses[this._visiblePeerId(peer.id)]
            || pendingRouteStatus
            || null;
        this.peers[peer.id] = peer;
        this._rememberPeerAliases(peer.id, peer);
        new PeerUI(peer, null, {
            active: this.shareMode.active,
            descriptor: this.shareMode.descriptor,
        });
        this._renderProtocolPeerCounts();
    }

    _routeAllowed(roomType) {
        if (PeerAvailabilityProtocol.roomTypeSupported(roomType) === false) return false;
        if (globalThis.ClearnetRoutePolicy?.allows) return globalThis.ClearnetRoutePolicy.allows(roomType);
        if (globalThis.LocalDiscoveryProtocol?.allowsRoomType) return globalThis.LocalDiscoveryProtocol.allowsRoomType(roomType);
        if (roomType === "ip" && globalThis.meshdropLocalDiscovery?.isEnabled?.() === false) return false;
        return true;
    }

    _pendingPrivateRouteStatus(peer = {}, fallbackRoomType = "") {
        const candidates = [
            ...(peer.routeCapabilities || []),
            fallbackRoomType
        ];
        const routeType = candidates.find(candidate => ["fips", "pollen"].includes(candidate));
        if (!routeType) return null;
        const supported = PeerAvailabilityProtocol.roomTypeSupported(routeType);
        const peerId = peer.id;
        return {
            peerId,
            route: routeType,
            roomType: routeType,
            routePeerId: peer.nostrIdentity?.pubkey || peerId,
            state: supported ? "requested" : "disabled",
            reason: supported ? "clearnet-disabled" : PeerAvailabilityProtocol.unavailableReasonForRoomType(routeType),
            routes: []
        };
    }

    _applyRouteStatus(peerId, status = null) {
        if (!status) return;
        const normalized = {
            ...status,
            peerId
        };
        this._routeStatuses[status.peerId] = normalized;
        this._routeStatuses[peerId] = normalized;

        const peer = this.peers[peerId];
        if (peer) {
            peer.routeStatus = normalized;
            peer.routeStatuses = this._mergeRouteStatuses(peer.routeStatuses, normalized);
        }

        const peerNode = meshdropGetById(peerId);
        peerNode?.ui?.setRouteStatus(normalized);
        peerNode?.ui?.refreshAvailability?.();
    }

    _existingPeerId(peer, roomType) {
        const peerId = this._visiblePeerId(peer.id);
        if (peerId && this.peers[peerId]) return peerId;

        const identityKeys = this._peerIdentityKeys(peer, roomType);
        if (!identityKeys.length) return peer.id;

        return Object.keys(this.peers).find(existingPeerId => {
            const existingPeer = this.peers[existingPeerId];
            const existingKeys = this._peerIdentityKeys(existingPeer, null);
            return identityKeys.some(identityKey => existingKeys.includes(identityKey));
        }) || peer.id;
    }

    _peerIdentityKeys(peer, roomType) {
        return PeerAvailabilityProtocol.identityKeys(peer, roomType);
    }

    _withRouteMetadata(peer, roomType, roomId) {
        const routeMetadata = this._routeMetadataForRoom(peer, roomType, roomId);
        if (!routeMetadata) return peer;
        return {
            ...peer,
            routeMetadata,
            _routeMetadataByRoomType: {
                ...peer?._routeMetadataByRoomType,
                [roomType]: routeMetadata
            }
        };
    }

    _routeMetadataForRoom(peer = {}, roomType, roomId) {
        const embedded = peer?._routeMetadataByRoomType?.[roomType]
            || peer?.routeMetadata
            || peer?.routeDescriptor;
        if (embedded?.routeType === roomType || embedded?.peerPubkey || embedded?.iceBridge || embedded?.relayIce) {
            return embedded;
        }

        const controller = roomType === "fips"
            ? globalThis.fipsController
            : roomType === "pollen"
                ? globalThis.pollenController
                : null;
        return controller?.routeMetadataForRoom?.(roomId) || null;
    }

    _anonymousOverlayPeerBlocked(peer, roomType) {
        if (roomType !== "fips" && roomType !== "pollen") return false;
        return this._peerIdentityKeys(peer, roomType).length === 0;
    }

    _mergePeer(existingPeerId, peer, roomType, roomId) {
        const existingPeer = this.peers[existingPeerId];
        existingPeer._roomIds[roomType] = roomId;
        existingPeer._peerIdsByRoomType = {
            ...existingPeer._peerIdsByRoomType,
            [roomType]: peer.id
        };
        existingPeer.nostrIdentity = {
            ...existingPeer.nostrIdentity,
            ...peer.nostrIdentity
        };
        existingPeer.routeMetadata = peer.routeMetadata || existingPeer.routeMetadata;
        existingPeer._routeMetadataByRoomType = {
            ...existingPeer._routeMetadataByRoomType,
            ...peer._routeMetadataByRoomType
        };
        existingPeer.routeStatus = this._routeStatuses[peer.id] || this._routeStatuses[existingPeerId] || existingPeer.routeStatus || null;

        if (this._isMoreSpecificPeerName(peer.name, existingPeer.name)) {
            existingPeer.name = peer.name;
            const peerNode = meshdropGetById(existingPeerId);
            if (peerNode) {
                peerNode.querySelector('.name').textContent = existingPeer.name.displayName;
                peerNode.querySelector('.device-name').textContent = existingPeer.name.deviceName;
            }
        }

        this._rememberPeerAliases(existingPeerId, existingPeer);
        this._rememberPeerAliases(existingPeerId, peer);
        const peerNode = meshdropGetById(existingPeerId);
        if (peerNode) {
            peerNode.ui._setAvatar(existingPeer.nostrIdentity?.picture);
            if (existingPeer.routeStatus) peerNode.ui.setRouteStatus(existingPeer.routeStatus);
        }
        this._redrawPeerRoomTypes(existingPeerId);
    }

    _isMoreSpecificPeerName(nextName = {}, currentName = {}) {
        if (currentName.deviceName === "Nostr peer" && nextName.deviceName !== "Nostr peer") return true;
        if (currentName.deviceName === "Nostr relay peer" && nextName.deviceName !== "Nostr relay peer") return true;
        if (!currentName.deviceName && nextName.deviceName) return true;
        return false;
    }

    _rememberPeerAliases(visiblePeerId, peer) {
        this._peerAliases[peer.id] = visiblePeerId;
        const pubkey = peer.nostrIdentity?.pubkey;
        if (pubkey) this._peerAliases[String(pubkey).toLowerCase()] = visiblePeerId;
        this._peerIdentityKeys(peer, null).forEach(identityKey => {
            const pubkeyKey = identityKey.startsWith("nostr:") ? identityKey.slice("nostr:".length) : "";
            if (pubkeyKey) this._peerAliases[pubkeyKey] = visiblePeerId;
        });
        Object.values(peer._peerIdsByRoomType || {}).forEach(peerId => this._peerAliases[peerId] = visiblePeerId);
    }

    _visiblePeerId(peerId) {
        return this._peerAliases[peerId] || this._peerAliases[String(peerId).toLowerCase()] || peerId;
    }

    _onNostrIdentityChanged(identity) {
        for (const peerId of Object.keys(this.peers)) {
            if (globalThis.NostrFollowPolicy?.allowsPeer(this.peers[peerId], null, identity) !== false) continue;

            this._onPeerDisconnected(peerId);
        }
    }

    _onPeerConnected(peerId, connectionHash) {
        peerId = this._visiblePeerId(peerId);
        if (!this.peers[peerId]) return;

        const peerNode = meshdropGetById(peerId);
        if (peerNode) {
            peerNode.ui?.markConnected(connectionHash);
            return;
        }

        const peer = this.peers[peerId];

        new PeerUI(peer, connectionHash, {
            active: this.shareMode.active,
            descriptor: this.shareMode.descriptor,
        });
    }

    _redrawPeerRoomTypes(peerId) {
        peerId = this._visiblePeerId(peerId);
        const peer = this.peers[peerId];
        const peerNode = meshdropGetById(peerId);

        if (!peer || !peerNode) return;

        peerNode.classList.remove('type-ip', 'type-secret', 'type-public-id', 'type-nostr', 'type-pollen', 'type-same-browser');
        peerNode.classList.remove('type-fips');

        if (peer._isSameBrowser()) {
            peerNode.classList.add(`type-same-browser`);
        }

        Object.keys(peer._roomIds).forEach(roomType => peerNode.classList.add(`type-${roomType}`));
        peerNode.ui?.refreshAvailability();
        this._renderProtocolPeerCounts();
    }

    _evaluateOverflowingPeers() {
        if (this.$xPeers.clientHeight < this.$xPeers.scrollHeight) {
            this.$xPeers.classList.add('overflowing');
        }
        else {
            this.$xPeers.classList.remove('overflowing');
        }
    }

    _onPeers(msg) {
        msg.peers.forEach(peer => this._joinPeer(peer, msg.roomType, msg.roomId));
        this._renderProtocolPeerCounts();
    }

    _onPeerDisconnected(peerId) {
        peerId = this._visiblePeerId(peerId);
        // Remove peer from UI
        delete this.peers[peerId];
        Object.keys(this._peerAliases).forEach(alias => {
            if (this._peerAliases[alias] === peerId) delete this._peerAliases[alias];
        });
        delete this._routeStatuses[peerId];
        this._renderProtocolPeerCounts();

        const $peer = meshdropGetById(peerId);
        if (!$peer) return;
        $peer.remove();
        this._evaluateOverflowingPeers();
        this._renderProtocolPeerCounts();

        // If no peer is shown -> start background animation again
        if (meshdropQuery('x-peers:empty')) {
            meshdropEvents.fire('background-animation', {animate: true});
        }

    }

    _onRoomTypeRemoved(peerId, roomType) {
        peerId = this._visiblePeerId(peerId);
        const peer = this.peers[peerId];

        if (!peer) return;

        delete peer._roomIds[roomType];

        this._redrawPeerRoomTypes(peerId)
    }

    _onSetProgress(progress) {
        const $peer = meshdropGetById(this._visiblePeerId(progress.peerId));
        if (!$peer) return;
        $peer.ui.setProgress(progress.progress, progress.status, progress.transport)
    }

    _onPeerRouteStatus(status = {}) {
        if (!status.peerId) return;

        const peerId = this._visiblePeerId(status.peerId);
        const normalized = {
            ...status,
            peerId
        };
        this._routeStatuses[status.peerId] = normalized;
        this._routeStatuses[peerId] = normalized;

        const peer = this.peers[peerId];
        if (peer) {
            peer.routeStatus = normalized;
            peer.routeStatuses = this._mergeRouteStatuses(peer.routeStatuses, normalized);
        }

        const peerNode = meshdropGetById(peerId);
        peerNode?.ui?.setRouteStatus(normalized);
    }

    _mergeRouteStatuses(statuses = [], status = {}) {
        const route = status.route || status.roomType;
        if (!route) return statuses || [];
        return [
            ...(statuses || []).filter(entry => (entry.route || entry.roomType) !== route),
            status
        ];
    }

    _renderProtocolPeerCounts() {
        globalThis.meshdropPeerAvailabilityCounts = Object.fromEntries(
            PeerAvailabilityProtocol.networkPostureCounts(this.peers)
                .map(entry => [entry.roomType, entry.count])
        );
        globalThis.meshdropNostrMesh?._render?.();
        globalThis.meshdropLocalDiscovery?._render?.();
        globalThis.meshdropFipsDiscovery?._render?.();
        globalThis.meshdropPollenTransfer?._render?.();
    }

    _onDrop(e) {
        if (this.shareMode.active || Dialog.anyDialogShown()) return;

        e.preventDefault();

        this._onDragEnd();

        if (meshdropQuery('x-peer') && meshdropQuery('x-peer').contains(e.target)) return; // dropped on peer

        let files = e.dataTransfer.files;
        let text = e.dataTransfer.getData("text");

        // convert FileList to Array
        files = [...files];

        if (files.length > 0) {
            meshdropEvents.fire('activate-share-mode', {
                files: files
            });
        }
        else if(text.length > 0) {
            meshdropEvents.fire('activate-share-mode', {
                text: text
            });
        }
    }

    _onDragOver(e) {
        if (this.shareMode.active || Dialog.anyDialogShown()) return;

        e.preventDefault();

        this.$xInstructions.setAttribute('drop-bg', true);
        this.$xNoPeers.setAttribute('drop-bg', true);
    }

    _onDragEnd() {
        this.$xInstructions.removeAttribute('drop-bg');
        this.$xNoPeers.removeAttribute('drop-bg');
    }

    _onPaste(e) {
        // prevent send on paste when dialog is open
        if (this.shareMode.active || Dialog.anyDialogShown()) return;

        e.preventDefault()
        let files = e.clipboardData.files;
        let text = e.clipboardData.getData("Text");

        // convert FileList to Array
        files = [...files];

        if (files.length > 0) {
            meshdropEvents.fire('activate-share-mode', {files: files});
        } else if (text.length > 0) {
            if (ShareTextDialog.isApproveShareTextSet()) {
                meshdropEvents.fire('share-text-dialog', text);
            } else {
                meshdropEvents.fire('activate-share-mode', {text: text});
            }
        }
    }

    async _activateShareMode(files = [], text = "") {
        if (this.shareMode.active || (files.length === 0 && text.length === 0)) return;

        this._activateCallback = e => this._sendShareData(e);
        this._editShareTextCallback = _ => {
            this._deactivateShareMode();
            meshdropEvents.fire('share-text-dialog', text);
        };

        meshdropEvents.on('share-mode-pointerdown', this._activateCallback);

        const sharedText = meshdropLocalization.getTranslation("instructions.activate-share-mode-shared-text");
        const andOtherFilesPlural = meshdropLocalization.getTranslation("instructions.activate-share-mode-and-other-files-plural", null, {count: files.length-1});
        const andOtherFiles = meshdropLocalization.getTranslation("instructions.activate-share-mode-and-other-file");

        let descriptorComplete, descriptorItem, descriptorOther, descriptorInstructions;

        if (files.length > 2) {
            // files shared
            descriptorItem = files[0].name;
            descriptorOther = andOtherFilesPlural;
            descriptorComplete = `${descriptorItem} ${descriptorOther}`;
        }
        else if (files.length === 2) {
            descriptorItem = files[0].name;
            descriptorOther = andOtherFiles;
            descriptorComplete = `${descriptorItem} ${descriptorOther}`;
        } else if (files.length === 1) {
            descriptorItem = files[0].name;
            descriptorComplete = descriptorItem;
        }
        else {
            // text shared
            descriptorItem = text.replace(/\s/g," ");
            descriptorComplete = sharedText;
        }

        if (files.length > 0) {
            if (descriptorOther) {
                this.$shareModeDescriptorOther.innerText = descriptorOther;
                this.$shareModeDescriptorOther.removeAttribute('hidden');
            }
            if (files.length > 1) {
                descriptorInstructions = meshdropLocalization.getTranslation("instructions.activate-share-mode-shared-files-plural", null, {count: files.length});
            }
            else {
                descriptorInstructions = meshdropLocalization.getTranslation("instructions.activate-share-mode-shared-file");
            }

            if (files[0].type.split('/')[0] === 'image') {
                try {
                    let imageUrl = await meshdropGetThumbnailAsDataUrl(files[0], 80, null, 0.9);

                    this.$shareModeImageThumb.style.backgroundImage = `url(${imageUrl})`;

                    this.$shareModeImageThumb.removeAttribute('hidden');
                } catch (e) {
                    console.error(e);
                    this.$shareModeFileThumb.removeAttribute('hidden');
                }
            } else {
                this.$shareModeFileThumb.removeAttribute('hidden');
            }
        }
        else {
            this.$shareModeTextThumb.removeAttribute('hidden');

            this.$shareModeEditBtn.addEventListener('click', this._editShareTextCallback);
            this.$shareModeEditBtn.removeAttribute('hidden');

            descriptorInstructions = meshdropLocalization.getTranslation("instructions.activate-share-mode-shared-text");
        }

        const desktop = meshdropLocalization.getTranslation("instructions.x-instructions-share-mode_desktop", null, {descriptor: descriptorInstructions});
        const mobile = meshdropLocalization.getTranslation("instructions.x-instructions-share-mode_mobile", null, {descriptor: descriptorInstructions});

        this.$xInstructions.setAttribute('desktop', desktop);
        this.$xInstructions.setAttribute('mobile', mobile);

        this.$sharePanel.removeAttribute('hidden');

        this.$shareModeDescriptor.removeAttribute('hidden');
        this.$shareModeDescriptorItem.innerText = descriptorItem;

        this.shareMode.active = true;
        this.shareMode.descriptor = descriptorComplete;
        this.shareMode.files = files;
        this.shareMode.text = text;

        console.log('Share mode activated.');

        meshdropEvents.fire('share-mode-changed', {
            active: true,
            descriptor: descriptorComplete
        });
    }

    async _reloadShareMode() {
        // If shareMode is active only
        if (!this.shareMode.active) return;

        let files = this.shareMode.files;
        let text = this.shareMode.text;

        await this._deactivateShareMode();
        await this._activateShareMode(files, text);
    }

    async _deactivateShareMode() {
        if (!this.shareMode.active) return;

        this.shareMode.active = false;
        this.shareMode.descriptor = "";
        this.shareMode.files = [];
        this.shareMode.text = "";

        meshdropEvents.off('share-mode-pointerdown', this._activateCallback);

        const desktop = meshdropLocalization.getTranslation("instructions.x-instructions_desktop");
        const mobile = meshdropLocalization.getTranslation("instructions.x-instructions_mobile");

        this.$xInstructions.setAttribute('desktop', desktop);
        this.$xInstructions.setAttribute('mobile', mobile);

        this.$sharePanel.setAttribute('hidden', true);

        this.$shareModeImageThumb.setAttribute('hidden', true);
        this.$shareModeFileThumb.setAttribute('hidden', true);
        this.$shareModeTextThumb.setAttribute('hidden', true);

        this.$shareModeDescriptorItem.innerHTML = "";
        this.$shareModeDescriptorItem.classList.remove('cursive');
        this.$shareModeDescriptorOther.innerHTML = "";
        this.$shareModeDescriptorOther.setAttribute('hidden', true);
        this.$shareModeEditBtn.removeEventListener('click', this._editShareTextCallback);
        this.$shareModeEditBtn.setAttribute('hidden', true);

        console.log('Share mode deactivated.')
        meshdropEvents.fire('share-mode-changed', { active: false });
    }

    _sendShareData(e) {
        // send the shared file/text content
        meshdropSendFilesOrText(this.shareMode.files, this.shareMode.text, e.detail.peerId);
    }
}

class PeerUI {

    constructor(peer, connectionHash, shareMode) {
        this.$xInstructions = meshdropQuery('x-instructions');
        this.$xPeers = meshdropQuery('x-peers');

        this._peer = peer;
        this._connected = connectionHash !== null && connectionHash !== undefined;
        this._connectionHash = this._formatConnectionHash(connectionHash);
        this._routeStatus = peer.routeStatus || null;

        // This is needed if the ShareMode is started BEFORE the PeerUI is drawn.
        this._shareMode = shareMode;

        this._initDom();

        this.$xPeers.appendChild(this.$el);
        meshdropEvents.fire('peer-added');

        // ShareMode
        meshdropEvents.on('share-mode-changed', e => this._onShareModeChanged(e.detail.active, e.detail.descriptor));
    }

    html() {
        let title = !this._connected
            ? this._connectingStatusText()
            : this._shareMode.active
            ? meshdropLocalization.getTranslation("peer-ui.click-to-send-share-mode", null, {descriptor: this._shareMode.descriptor})
            : meshdropLocalization.getTranslation("peer-ui.click-to-send");

        this.$el.innerHTML = `
            <label class="column center pointer" title="${title}">
                <input type="file" multiple/>
                <x-icon>
                    <div class="icon-wrapper" shadow="1">
                        <svg class="icon"><use xlink:href="#"/></svg>
                        <img class="avatar" alt="" hidden>
                    </div>
                    <div class="highlight-wrapper center">
                        <div class="highlight highlight-room-ip" shadow="1"></div>
                        <div class="highlight highlight-room-secret" shadow="1"></div>
                        <div class="highlight highlight-room-nostr" shadow="1"></div>
                        <div class="highlight highlight-room-fips" shadow="1"></div>
                        <div class="highlight highlight-room-pollen" shadow="1"></div>
                        <div class="highlight highlight-room-public-id" shadow="1"></div>
                    </div>
                </x-icon>
                <div class="progress">
                  <div class="circle"></div>
                  <div class="circle right"></div>
                </div>
                <div class="device-descriptor">
                    <div class="name font-subheading"></div>
                    <div class="device-name font-body2"></div>
                    <div class="availability-row"></div>
                    <div class="status font-body2"></div>
                    <div class="route-attempts font-body2" hidden></div>
                </div>
            </label>`;

        this.$el.querySelector('svg use').setAttribute('xlink:href', this._icon());
        this.$el.querySelector('.name').textContent = this._displayName();
        this.$el.querySelector('.device-name').textContent = this._deviceName();
        this._setAvatar(this._peer.nostrIdentity?.picture);
        this.refreshAvailability();

        this.$label = this.$el.querySelector('label');
        this.$input = this.$el.querySelector('input');
    }

    _formatConnectionHash(connectionHash) {
        if (!connectionHash) return "";

        return `${connectionHash.substring(0, 4)} ${connectionHash.substring(4, 8)} ${connectionHash.substring(8, 12)} ${connectionHash.substring(12, 16)}`;
    }

    _setAvatar(picture) {
        const avatar = this.$el.querySelector('.avatar');
        const icon = this.$el.querySelector('svg.icon');
        if (!avatar || !icon) return;

        if (!picture) {
            avatar.hidden = true;
            avatar.removeAttribute('src');
            icon.hidden = false;
            return;
        }

        avatar.src = picture;
        avatar.hidden = false;
        icon.hidden = true;
    }

    addTypesToClassList() {
        if (this._peer._isSameBrowser()) {
            this.$el.classList.add(`type-same-browser`);
        }

        Object.keys(this._peer._roomIds).forEach(roomType => this.$el.classList.add(`type-${roomType}`));

        if (!this._peer.rtcSupported || !window.isRtcSupported) this.$el.classList.add('ws-peer');
    }

    _initDom() {
        this.$el = document.createElement('x-peer');
        this.$el.id = this._peer.id;
        this.$el.ui = this;
        this.$el.classList.add('center');

        this.addTypesToClassList();

        this.html();

        this._createCallbacks();

        this._evaluateShareMode();
        this._bindListeners();
    }

    markConnected(connectionHash) {
        this._connected = true;
        this._connectionHash = this._formatConnectionHash(connectionHash);
        this._routeStatus = null;
        if (this.currentStatus === 'connecting' || this.currentStatus?.startsWith('route-')) {
            this.$el.removeAttribute('status');
            this.$el.removeAttribute('data-route');
            this.$el.removeAttribute('data-route-state');
            this.$el.querySelector('.status').innerHTML = '';
            this.currentStatus = null;
        }
        this._evaluateShareMode();
        this._bindListeners();
    }

    _onShareModeChanged(active = false, descriptor = "") {
        // This is needed if the ShareMode is started AFTER the PeerUI is drawn.
        this._shareMode.active = active;
        this._shareMode.descriptor = descriptor;

        this._evaluateShareMode();
        this._bindListeners();
    }

    _evaluateShareMode() {
        let title;
        if (!this._connected) {
            title = this._connectingStatusText();
            this.$input.setAttribute('disabled', true);
            this.$el.setAttribute('status', 'connecting');
            if (this._routeStatus?.route || this._routeStatus?.roomType) {
                this.$el.dataset.route = this._routeStatus.route || this._routeStatus.roomType;
            } else {
                this.$el.removeAttribute('data-route');
            }
            if (this._routeStatus?.state) {
                this.$el.dataset.routeState = this._routeStatus.state;
            } else {
                this.$el.removeAttribute('data-route-state');
            }
            const hasRouteVisual = this._renderRouteAttempts();
            const statusNode = this.$el.querySelector('.status');
            statusNode.innerText = hasRouteVisual ? "" : title;
            if (hasRouteVisual) {
                statusNode.setAttribute('aria-hidden', 'true');
            } else {
                statusNode.removeAttribute('aria-hidden');
            }
            this.currentStatus = this._routeStatus
                ? PeerRouteStatusProtocol.statusKey(this._routeStatus)
                : 'connecting';
        }
        else if (!this._shareMode.active) {
            title = meshdropLocalization.getTranslation("peer-ui.click-to-send");
            this.$input.removeAttribute('disabled');
            this.$el.removeAttribute('data-route');
            this.$el.removeAttribute('data-route-state');
            this._clearRouteAttempts();
        }
        else {
            title =  meshdropLocalization.getTranslation("peer-ui.click-to-send-share-mode", null, {descriptor: this._shareMode.descriptor});
            this.$input.setAttribute('disabled', true);
            this.$el.removeAttribute('data-route');
            this.$el.removeAttribute('data-route-state');
            this._clearRouteAttempts();
        }
        this.$label.setAttribute('title', title);
    }

    _connectingStatusText() {
        if (!this._routeStatus) return meshdropLocalization.getTranslation("notifications.connecting");
        return PeerRouteStatusProtocol.text(this._routeStatus);
    }

    _clearRouteAttempts() {
        const row = this.$el.querySelector('.route-attempts');
        if (!row) return false;
        row.replaceChildren();
        row.setAttribute('hidden', true);
        row.removeAttribute('role');
        row.removeAttribute('aria-label');
        this.$el.querySelector('.status')?.removeAttribute('aria-hidden');
        delete this.$el.dataset.routeVisual;
        return false;
    }

    _renderRouteAttempts() {
        const row = this.$el.querySelector('.route-attempts');
        if (!row) return false;
        const attempts = PeerRouteStatusProtocol.attemptsForPeer(this._peer).slice(0, 3);
        if (!attempts.length) {
            return this._clearRouteAttempts();
        }

        const nodes = attempts.map(attempt => {
            return PeerRouteStatusProtocol.createVisualAttemptChip(attempt);
        });

        row.replaceChildren(...nodes);
        row.hidden = false;
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', attempts
            .map(attempt => PeerRouteStatusProtocol.visualAttempt(attempt).ariaLabel)
            .filter(Boolean)
            .join(' | '));
        this.$el.dataset.routeVisual = 'true';
        return true;
    }

    _createCallbacks() {
        this._callbackInput = e => this._onFilesSelected(e);
        this._callbackClickSleep = _ => NoSleepUI.enable();
        this._callbackTouchStartSleep = _ => NoSleepUI.enable();
        this._callbackDrop = e => this._onDrop(e);
        this._callbackDragEnd = e => this._onDragEnd(e);
        this._callbackDragLeave = e => this._onDragEnd(e);
        this._callbackDragOver = e => this._onDragOver(e);
        this._callbackContextMenu = e => this._onRightClick(e);
        this._callbackTouchStart = e => this._onTouchStart(e);
        this._callbackTouchEnd = e => this._onTouchEnd(e);
        this._callbackPointerDown = e => this._onPointerDown(e);
    }

    _bindListeners() {
        if(!this._shareMode.active) {
            // Remove meshdropEvents Share mode
            this.$el.removeEventListener('pointerdown', this._callbackPointerDown);

            // Add meshdropEvents Normal Mode
            this.$el.querySelector('input').addEventListener('change', this._callbackInput);
            this.$el.addEventListener('click', this._callbackClickSleep);
            this.$el.addEventListener('touchstart', this._callbackTouchStartSleep);
            this.$el.addEventListener('drop', this._callbackDrop);
            this.$el.addEventListener('dragend', this._callbackDragEnd);
            this.$el.addEventListener('dragleave', this._callbackDragLeave);
            this.$el.addEventListener('dragover', this._callbackDragOver);
            this.$el.addEventListener('contextmenu', this._callbackContextMenu);
            this.$el.addEventListener('touchstart', this._callbackTouchStart);
            this.$el.addEventListener('touchend', this._callbackTouchEnd);
        }
        else {
            // Remove meshdropEvents Normal Mode
            this.$el.removeEventListener('click', this._callbackClickSleep);
            this.$el.removeEventListener('touchstart', this._callbackTouchStartSleep);
            this.$el.removeEventListener('drop', this._callbackDrop);
            this.$el.removeEventListener('dragend', this._callbackDragEnd);
            this.$el.removeEventListener('dragleave', this._callbackDragLeave);
            this.$el.removeEventListener('dragover', this._callbackDragOver);
            this.$el.removeEventListener('contextmenu', this._callbackContextMenu);
            this.$el.removeEventListener('touchstart', this._callbackTouchStart);
            this.$el.removeEventListener('touchend', this._callbackTouchEnd);

            // Add meshdropEvents Share mode
            this.$el.addEventListener('pointerdown', this._callbackPointerDown);
        }
    }

    _onPointerDown(e) {
        if (!this._connected) return;

        // Prevents triggering of event twice on touch devices
        e.stopPropagation();
        e.preventDefault();
        meshdropEvents.fire('share-mode-pointerdown', {
            peerId: this._peer.id
        });
    }

    _displayName() {
        return this._peer.name.displayName;
    }

    _deviceName() {
        return this._peer.name.deviceName;
    }

    _badgeClassName() {
        return PeerAvailabilityProtocol.badgeClassName(this._peer);
    }

    refreshAvailability() {
        const row = this.$el.querySelector('.availability-row');
        if (!row) return;

        const pills = PeerAvailabilityProtocol.availability(this._peer)
            .map(option => {
                const visual = PeerRouteStatusProtocol.visualAttempt(PeerRouteStatusProtocol.attempt(
                    PeerAvailabilityProtocol.statusForRoomType(this._peer, option.roomType)
                    || {
                        route: option.roomType,
                        state: option.unavailable ? "disabled" : "candidate",
                        reason: option.unavailableReason,
                        backendOnly: option.backendOnly
                    }
                ));
                return PeerRouteStatusProtocol.createAvailabilityPill(option, visual);
            });

        row.replaceChildren(...pills);
    }

    setRouteStatus(status = null) {
        this._routeStatus = status;
        this._peer.routeStatus = status;
        this._peer.routeStatuses = status
            ? PeerAvailabilityProtocol.routeStatuses(this._peer)
                .filter(entry => (entry.route || entry.roomType) !== (status.route || status.roomType))
                .concat(status)
            : [];
        if (this._connected) return;
        this._evaluateShareMode();
        this.refreshAvailability();
    }

    _icon() {
        const device = this._peer.name.device || this._peer.name;
        if (device.type === 'mobile') {
            return '#phone-iphone';
        }
        if (device.type === 'tablet') {
            return '#tablet-mac';
        }
        return '#desktop-mac';
    }

    _onFilesSelected(e) {
        if (!this._connected) return;

        const $input = e.target;
        const files = $input.files;

        if (files.length === 0) return;

        meshdropEvents.fire('select-files-transport', {
            files: files,
            to: this._peer.id
        });
        $input.files = null; // reset input
    }

    setProgress(progress, status, transport = null) {
        const $progress = this.$el.querySelector('.progress');
        if (0.5 < progress && progress < 1) {
            $progress.classList.add('over50');
        }
        else {
            $progress.classList.remove('over50');
        }
        if (progress < 1) {
            if (status !== this.currentStatus) {
                let statusName = {
                    "prepare": meshdropLocalization.getTranslation("peer-ui.preparing"),
                    "transfer": meshdropLocalization.getTranslation("peer-ui.transferring"),
                    "process": meshdropLocalization.getTranslation("peer-ui.processing"),
                    "wait": meshdropLocalization.getTranslation("peer-ui.waiting")
                }[status];
                if (transport?.label) statusName = `${statusName} · ${transport.label}`;

                this.$el.setAttribute('status', status);
                this.$el.querySelector('.status').innerText = statusName;
                this.currentStatus = status;
            }
        }
        else {
            this.$el.removeAttribute('status');
            this.$el.querySelector('.status').innerHTML = '';
            progress = 0;
            this.currentStatus = null;
        }
        const degrees = `rotate(${360 * progress}deg)`;
        $progress.style.setProperty('--progress', degrees);
    }

    _onDrop(e) {
        if (!this._connected) return;
        if (this._shareMode.active || Dialog.anyDialogShown()) return;

        e.preventDefault();

        this._onDragEnd();

        const peerId = this._peer.id;
        const files = e.dataTransfer.files;
        const text = e.dataTransfer.getData("text");

        meshdropSendFilesOrText(files, text, peerId);
    }

    _onDragOver() {
        this.$el.setAttribute('drop', true);
        this.$xInstructions.setAttribute('drop-peer', true);
    }

    _onDragEnd() {
        this.$el.removeAttribute('drop');
        this.$xInstructions.removeAttribute('drop-peer');
    }

    _onRightClick(e) {
        if (!this._connected) return;

        e.preventDefault();
        meshdropEvents.fire('text-recipient', {
            peerId: this._peer.id,
            deviceName: e.target.closest('x-peer').querySelector('.name').innerText
        });
    }

    _onTouchStart(e) {
        this._touchStart = Date.now();
        this._touchTimer = setTimeout(() => this._onTouchEnd(e), 610);
    }

    _onTouchEnd(e) {
        if (!this._connected) return;

        if (Date.now() - this._touchStart < 500) {
            clearTimeout(this._touchTimer);
        }
        else if (this._touchTimer) { // this was a long tap
            e.preventDefault();
            meshdropEvents.fire('text-recipient', {
                peerId: this._peer.id,
                deviceName: e.target.closest('x-peer').querySelector('.name').innerText
            });
        }
        this._touchTimer = null;
    }
}

class Dialog {
    constructor(id) {
        this.$el = meshdropGetById(id);
        this.$autoFocus = this.$el.querySelector('[autofocus]');
        this.$xBackground = this.$el.querySelector('x-background');
        this.$closeBtns = this.$el.querySelectorAll('[close]');

        this.$closeBtns.forEach(el => {
            el.addEventListener('click', _ => this.hide())
        });

        meshdropEvents.on('peer-disconnected', e => this._onPeerDisconnected(e.detail));
    }

    static anyDialogShown() {
        return document.querySelectorAll('x-dialog[show]').length > 0;
    }

    show() {
        if (this.$xBackground) {
            this.$xBackground.scrollTop = 0;
        }

        this.$el.setAttribute('show', true);

        if (!window.isMobile && this.$autoFocus) {
            this.$autoFocus.focus();
        }
    }

    isShown() {
        return !!this.$el.attributes["show"];
    }

    hide() {
        this.$el.removeAttribute('show');
        if (!window.isMobile) {
            document.activeElement.blur();
            window.blur();
        }
        document.title = 'MeshDrop | Transfer Files Cross-Platform. No Setup, No Signup.';
        meshdropChangeFavicon("images/favicon-96x96.png");
        this.correspondingPeerId = undefined;
    }

    _onPeerDisconnected(peerId) {
        if (this.isShown() && this.correspondingPeerId === peerId) {
            this.hide();
            meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.selected-peer-left"));
        }
    }

    _evaluateOverflowing(element) {
        if (element.clientHeight < element.scrollHeight) {
            element.classList.add('overflowing');
        }
        else {
            element.classList.remove('overflowing');
        }
    }
}

class LanguageSelectDialog extends Dialog {

    constructor() {
        super('language-select-dialog');

        this.$languageSelectBtn = meshdropGetById('language-selector');
        this.$languageSelectBtn.addEventListener('click', _ => this.show());

        this.$languageButtons = this.$el.querySelectorAll(".language-buttons .btn");
        this.$languageButtons.forEach($btn => {
            $btn.addEventListener("click", e => this.selectLanguage(e));
        })
        meshdropEvents.on('keydown', e => this._onKeyDown(e));
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            this.hide();
        }
    }

    show() {
        let locale = meshdropLocalization.getLocale();
        this.currentLanguageBtn = meshdropLocalization.isSystemLocale()
            ? this.$languageButtons[0]
            : this.$el.querySelector(`.btn[value="${locale}"]`);

        this.currentLanguageBtn.classList.add("current");

        super.show();
    }

    hide() {
        this.currentLanguageBtn.classList.remove("current");

        super.hide();
    }

    selectLanguage(e) {
        e.preventDefault()
        let languageCode = e.target.value;

        if (languageCode) {
            localStorage.setItem('language_code', languageCode);
        }
        else {
            localStorage.removeItem('language_code');
        }

        meshdropLocalization.setTranslation(languageCode)
            .then(_ => this.hide());
    }
}

class ProtocolSettingsDialog extends Dialog {

    constructor() {
        super('protocol-settings-dialog');

        this.$button = meshdropGetById('protocol-settings');
        this.$tabs = [...this.$el.querySelectorAll('[data-settings-tab]')];
        this.$panels = [...this.$el.querySelectorAll('[data-settings-panel]')];
        this.$status = this.$el.querySelector('.protocol-settings-status');
        this.$serverList = this.$el.querySelector('.protocol-server-list');
        this.$fipsStatus = this.$el.querySelector('.fips-settings-status');
        this.$fipsPeerList = this.$el.querySelector('.fips-peer-list');
        this.$fipsAddPeer = this.$el.querySelector('.fips-add-peer');
        this.$fipsSavePeers = this.$el.querySelector('.fips-save-peers');
        this.$relayStatus = this.$el.querySelector('.relay-settings-status');
        this.$relayBootstrap = this.$el.querySelector('.relay-bootstrap');
        this.$relayWebRtc = this.$el.querySelector('.relay-webrtc');
        this.$relayInbox = this.$el.querySelector('.relay-inbox');
        this.$relayOutbox = this.$el.querySelector('.relay-outbox');
        this.$relaySave = this.$el.querySelector('.relay-save-settings');
        this._activeTab = 'blossom';

        if (this.$button) this.$button.addEventListener('click', _ => this.show());

        meshdropEvents.on('nostr-identity-changed', _ => this.render());
        meshdropEvents.on('nostr-server-list-changed', _ => this.render());
        meshdropEvents.on('protocol-server-preferences-changed', _ => this.render());
        meshdropEvents.on('relay-settings-changed', _ => this._renderRelays());
        this.$tabs.forEach(tab => tab.addEventListener('click', _ => this._selectTab(tab.dataset.settingsTab)));
        this.$serverList.addEventListener('change', e => this._onToggle(e));
        this.$fipsAddPeer.addEventListener('click', _ => this._addFipsPeerRow());
        this.$fipsSavePeers.addEventListener('click', _ => this._saveFipsPeers());
        this.$relaySave.addEventListener('click', _ => this._saveRelays());
        this.render();
    }

    show() {
        this.render();
        this._loadFipsPeers();
        super.show();
    }

    render() {
        this._renderButton();
        this._renderTabs();
        this._renderServers();
        this._renderRelays();
    }

    _renderButton() {
        if (!this.$button) return;

        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        this.$button.removeAttribute('hidden');
        if (!identity) {
            this.$button.classList.remove('loading', 'unavailable');
            this.$button.removeAttribute('data-state');
            this.$button.removeAttribute('data-badge');
            return;
        }

        const status = identity.blossomServerListStatus || 'loading';
        this.$button.classList.toggle('loading', status === 'loading');
        this.$button.classList.toggle('unavailable', status === 'missing' || status === 'error');
        this.$button.setAttribute('data-state', status);

        if (status === 'missing' || status === 'error') {
            this.$button.setAttribute('data-badge', '!');
        }
        else {
            this.$button.removeAttribute('data-badge');
        }
    }

    _renderTabs() {
        this.$tabs.forEach(tab => {
            const selected = tab.dataset.settingsTab === this._activeTab;
            tab.classList.toggle('selected', selected);
            tab.setAttribute('aria-selected', String(selected));
        });
        this.$panels.forEach(panel => {
            panel.toggleAttribute('hidden', panel.dataset.settingsPanel !== this._activeTab);
        });
    }

    _selectTab(tabName) {
        this._activeTab = tabName || 'blossom';
        this._renderTabs();
        if (this._activeTab === 'fips') this._loadFipsPeers();
    }

    _renderServers() {
        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        if (!identity) {
            this.$status.textContent = 'Sign in with Nostr to load your Blossom server list.';
            this.$serverList.textContent = '';
            return;
        }

        const status = identity.blossomServerListStatus || 'loading';
        const servers = meshdropProtocolServerPreferences.normalizeServers(identity.blossomServers);

        if (status === 'loading') {
            this.$status.textContent = 'Loading your Blossom server list from Nostr relays.';
            this.$serverList.textContent = '';
            return;
        }

        if (status === 'missing') {
            this.$status.textContent = 'No Blossom server list was found for this npub.';
            this.$serverList.textContent = '';
            return;
        }

        if (status === 'error') {
            this.$status.textContent = 'Blossom server list lookup failed.';
            this.$serverList.textContent = '';
            return;
        }

        this.$status.textContent = 'Choose which discovered servers MeshDrop may use.';
        this.$serverList.replaceChildren(...servers.map(server => this._serverRow(server)));
    }

    _serverRow(server) {
        const row = document.createElement('div');
        row.className = 'protocol-server-row column';

        const name = document.createElement('div');
        name.className = 'protocol-server-name';
        name.textContent = server;

        const toggles = document.createElement('div');
        toggles.className = 'protocol-server-toggles column';
        toggles.append(
            this._toggle(server, 'hashtree', 'Hashtree'),
            this._toggle(server, 'blossom', 'Blossom')
        );

        row.append(name, toggles);
        return row;
    }

    _toggle(server, protocol, label) {
        const wrapper = document.createElement('label');
        wrapper.className = 'protocol-server-toggle row';

        const text = document.createElement('span');
        text.textContent = label;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.server = server;
        input.dataset.protocol = protocol;
        input.checked = meshdropProtocolServerPreferences.protocolEnabled(server, protocol);

        wrapper.append(text, input);
        return wrapper;
    }

    _onToggle(event) {
        const input = event.target;
        if (!input?.dataset?.server || !input.dataset.protocol) return;

        meshdropProtocolServerPreferences.setProtocolEnabled(
            input.dataset.server,
            input.dataset.protocol,
            input.checked
        );
    }

    async _loadFipsPeers() {
        if (!this.$fipsStatus || !this.$fipsPeerList) return;

        this.$fipsStatus.textContent = 'Loading FIPS peers.';
        try {
            const response = await fetch('/fips/status');
            const status = await response.json();
            if (!status.available) {
                this.$fipsStatus.textContent = status.error
                    ? `FIPS control plane unavailable: ${status.error}`
                    : 'FIPS control plane unavailable.';
                this.$fipsPeerList.textContent = '';
                return;
            }

            const peers = (status.peers || []).map(peer => ({
                npub: peer.npub || '',
                alias: peer.displayName || '',
                transport: peer.transportType || 'udp',
                address: peer.transportAddr || ''
            }));
            this.$fipsStatus.textContent = 'Edit peers connected through the local FIPS control plane.';
            this.$fipsPeerList.replaceChildren(...peers.map(peer => this._fipsPeerRow(peer)));
            if (!peers.length) this._addFipsPeerRow();
        } catch (error) {
            this.$fipsStatus.textContent = `FIPS lookup failed: ${error.message}`;
            this.$fipsPeerList.textContent = '';
        }
    }

    _addFipsPeerRow(peer = {}) {
        this.$fipsPeerList.append(this._fipsPeerRow(peer));
    }

    _fipsPeerRow(peer) {
        const row = document.createElement('div');
        row.className = 'fips-peer-row column';

        row.append(
            this._settingsInput('npub or host', 'npub', peer.npub || ''),
            this._settingsInput('Display name', 'alias', peer.alias || ''),
            this._settingsSelect('Transport', 'transport', peer.transport || 'udp', ['udp', 'tcp', 'tor', 'ethernet']),
            this._settingsInput('Address', 'address', peer.address || '')
        );

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-rounded btn-grey';
        remove.textContent = 'Remove';
        remove.addEventListener('click', _ => row.remove());
        row.append(remove);

        return row;
    }

    _settingsInput(label, field, value) {
        const wrapper = document.createElement('label');
        wrapper.className = 'settings-field column';

        const text = document.createElement('span');
        text.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.field = field;
        input.value = value;

        wrapper.append(text, input);
        return wrapper;
    }

    _settingsSelect(label, field, value, options) {
        const wrapper = document.createElement('label');
        wrapper.className = 'settings-field column';

        const text = document.createElement('span');
        text.textContent = label;

        const select = document.createElement('select');
        select.dataset.field = field;
        options.forEach(option => {
            const item = document.createElement('option');
            item.value = option;
            item.textContent = option;
            item.selected = option === value;
            select.append(item);
        });

        wrapper.append(text, select);
        return wrapper;
    }

    async _saveFipsPeers() {
        const peers = [...this.$fipsPeerList.querySelectorAll('.fips-peer-row')]
            .map(row => ({
                npub: row.querySelector('[data-field="npub"]')?.value || '',
                alias: row.querySelector('[data-field="alias"]')?.value || '',
                transport: row.querySelector('[data-field="transport"]')?.value || 'udp',
                address: row.querySelector('[data-field="address"]')?.value || ''
            }))
            .filter(peer => peer.npub.trim() && peer.address.trim());

        this.$fipsStatus.textContent = 'Saving FIPS peers.';
        try {
            const response = await fetch('/settings/fips/peers', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({peers})
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

            this.$fipsStatus.textContent = result.restart?.available
                ? 'Saved FIPS peers and restarted the FIPS server.'
                : `Saved FIPS peers. FIPS restart unavailable: ${result.restart?.error || 'unsupported control command'}`;
            await globalThis.meshdropFipsDiscovery?.fetchStatus?.();
        } catch (error) {
            this.$fipsStatus.textContent = `FIPS save failed: ${error.message}`;
        }
    }

    _renderRelays() {
        const preferences = meshdropRelaySettingsPreferences();
        if (!preferences) {
            this.$relayStatus.textContent = 'Relay settings are unavailable.';
            return;
        }

        const identity = globalThis.meshdropNostrIdentity?.getIdentity?.();
        const settings = preferences.displaySettings
            ? preferences.displaySettings(identity)
            : preferences.normalize(preferences.read());
        this.$relayBootstrap.value = settings.bootstrapRelays.join('\n');
        this.$relayWebRtc.value = settings.webRtcRelays.join('\n');
        this.$relayInbox.value = settings.inboxRelays.join('\n');
        this.$relayOutbox.value = settings.outboxRelays.join('\n');
        this.$relayStatus.textContent = identity?.relays
            ? 'Configure relays used for identity bootstrap, WebRTC announcements, and your NIP-65 relay list.'
            : 'Configure relays used for identity bootstrap, WebRTC announcements, and your NIP-65 relay list. Sign in with Nostr to load your current list.';
    }

    async _saveRelays() {
        const preferences = meshdropRelaySettingsPreferences();
        if (!preferences) {
            this.$relayStatus.textContent = 'Relay settings are unavailable.';
            return;
        }

        const settings = preferences.write({
            bootstrapRelays: this._textareaLines(this.$relayBootstrap),
            webRtcRelays: this._textareaLines(this.$relayWebRtc),
            inboxRelays: this._textareaLines(this.$relayInbox),
            outboxRelays: this._textareaLines(this.$relayOutbox)
        });

        const identityController = globalThis.meshdropNostrIdentity;
        const identity = identityController?.getIdentity?.();
        if (!identity) {
            this.$relayStatus.textContent = 'Saved relay settings locally. Sign in with Nostr to publish your NIP-65 relay list.';
            return;
        }

        try {
            const event = await identityController.signEvent({
                kind: meshdropNostrDiscoveryProtocol.relayListKind,
                created_at: Math.floor(Date.now() / 1000),
                tags: preferences.relayListTags(settings.inboxRelays, settings.outboxRelays),
                content: ''
            });
            const relays = [
                ...settings.outboxRelays,
                ...settings.bootstrapRelays,
                ...(identity.relays?.write || [])
            ];
            const result = await globalThis.meshdropNostrRelays.publishEvent(relays, event);
            this.$relayStatus.textContent = `Saved relay settings and published NIP-65 to ${result.accepted}/${result.attempted} relays.`;
            identityController.hydrateIdentity();
        } catch (error) {
            this.$relayStatus.textContent = `Saved relay settings locally. NIP-65 publish failed: ${error.message}`;
        }
    }

    _textareaLines(textarea) {
        return textarea.value.split(/\s+/).map(line => line.trim()).filter(Boolean);
    }
}

class TransferChoiceDialog extends Dialog {

    constructor() {
        super('transfer-choice-dialog');

        this.$recipient = this.$el.querySelector('.transfer-choice-recipient');
        this.$privacy = this.$el.querySelector('.transfer-privacy-selector');
        this.$list = this.$el.querySelector('.transfer-choice-list');
        this.$privacy.addEventListener('click', e => this._onPrivacyClick(e));
        this.$list.addEventListener('click', e => this._onOptionClick(e));

        meshdropEvents.on('select-files-transport', e => this._onFilesSelected(e.detail));
    }

    _onFilesSelected(detail) {
        const peerNode = meshdropGetById(detail.to);
        const peer = peerNode?.ui?._peer;
        if (!peer) {
            meshdropEvents.fire('files-selected', detail);
            return;
        }

        this._detail = {
            files: [...detail.files],
            to: detail.to,
            privacyMode: PeerAvailabilityProtocol.defaultPrivacyMode(),
            options: PeerAvailabilityProtocol.optionsFor(peer)
        };

        if (!this._detail.options.length) {
            meshdropEvents.fire('files-selected', {
                ...detail,
                transport: {id: 'direct', type: 'direct', label: 'Direct', privacyMode: this._detail.privacyMode}
            });
            return;
        }

        this._render(peerNode);
        this.show();
    }

    _render(peerNode) {
        this.$recipient.textContent = peerNode.ui._displayName();
        this.$recipient.className = `transfer-choice-recipient badge ${peerNode.ui._badgeClassName()}`;
        this._renderPrivacySelector();
        const nodes = [];
        let optionIndex = 0;

        PeerAvailabilityProtocol.groupOptions(this._detail.options).forEach(group => {
            const heading = document.createElement('div');
            heading.className = 'transport-choice-group';
            heading.textContent = group.label;
            nodes.push(heading);

            group.options.forEach(option => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'transport-choice-option';
                button.dataset.transportId = option.id;
                button.dataset.privacyTone = option.privacyTone || "neutral";
                if (optionIndex === 0) button.dataset.default = 'true';
                optionIndex += 1;

                const head = document.createElement('span');
                head.className = 'transport-choice-head';

                const label = document.createElement('span');
                label.className = 'transport-choice-label';
                label.textContent = option.label;

                const privacy = document.createElement('span');
                privacy.className = 'transport-choice-privacy';
                privacy.textContent = option.privacy || "Route";

                const description = document.createElement('span');
                description.className = 'transport-choice-description';
                description.textContent = option.description;

                const attempt = document.createElement('span');
                attempt.className = 'transport-choice-attempt';
                if (option.attempt) {
                    const chip = PeerRouteStatusProtocol.createVisualAttemptChip(
                        option.attempt,
                        'transport-choice-route route-attempt'
                    );
                    const visual = PeerRouteStatusProtocol.visualAttempt(option.attempt);
                    attempt.dataset.state = visual.state;
                    attempt.dataset.tone = visual.tone;
                    attempt.title = visual.title;
                    attempt.setAttribute('aria-label', visual.ariaLabel);
                    attempt.append(chip);
                } else {
                    attempt.setAttribute('hidden', true);
                }

                const details = document.createElement('span');
                details.className = 'transport-choice-details';
                (option.details || []).forEach(([term, value]) => {
                    const item = document.createElement('span');
                    item.className = 'transport-choice-detail';

                    const termNode = document.createElement('span');
                    termNode.className = 'transport-choice-detail-term';
                    termNode.textContent = term;

                    const valueNode = document.createElement('span');
                    valueNode.className = 'transport-choice-detail-value';
                    valueNode.textContent = value;

                    item.append(termNode, valueNode);
                    details.append(item);
                });

                head.append(label, privacy);
                button.append(head, description, attempt, details);
                nodes.push(button);
            });
        });

        this.$list.replaceChildren(...nodes);
    }

    _renderPrivacySelector() {
        const modes = globalThis.TransferPrivacyProtocol?.modes || [
            {id: "private", label: "Private", description: "Encrypt before send"},
            {id: "unencrypted", label: "Unencrypted", description: "Send raw bytes"}
        ];

        this.$privacy.replaceChildren(...modes.map(mode => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'transfer-privacy-option';
            button.dataset.privacyMode = mode.id;
            button.dataset.selected = String(mode.id === this._detail.privacyMode);
            button.disabled = !PeerAvailabilityProtocol.privacyModeAvailable(mode.id);
            button.setAttribute('aria-checked', String(mode.id === this._detail.privacyMode));
            button.setAttribute('aria-disabled', String(button.disabled));
            button.setAttribute('role', 'radio');

            const label = document.createElement('span');
            label.className = 'transfer-privacy-label';
            label.textContent = mode.label;

            const description = document.createElement('span');
            description.className = 'transfer-privacy-description';
            description.textContent = mode.description;

            button.append(label, description);
            return button;
        }));
    }

    _onPrivacyClick(event) {
        const button = event.target.closest('.transfer-privacy-option');
        if (!button || !this._detail) return;
        if (button.disabled) return;

        this._detail.privacyMode = globalThis.TransferPrivacyProtocol?.normalize?.(button.dataset.privacyMode)
            || button.dataset.privacyMode;
        this._renderPrivacySelector();
    }

    _onOptionClick(event) {
        const button = event.target.closest('button[data-transport-id]');
        if (!button || !this._detail) return;

        const transport = this._detail.options.find(option => option.id === button.dataset.transportId);
        if (!transport) return;
        const privacyMode = this._detail.privacyMode || "private";
        if (privacyMode === "unencrypted") {
            const confirmed = globalThis.confirm?.("Send without client-side file encryption?");
            if (!confirmed) return;
        }

        meshdropEvents.fire('files-selected', {
            files: this._detail.files,
            to: transport.peerId || this._detail.to,
            transport: {
                ...transport,
                privacyMode
            }
        });
        this.hide();
    }

    hide() {
        this._detail = null;
        super.hide();
    }
}

class ReceiveDialog extends Dialog {
    constructor(id) {
        super(id);
        this.$fileDescription = this.$el.querySelector('.file-description');
        this.$displayName = this.$el.querySelector('.display-name');
        this.$fileStem = this.$el.querySelector('.file-stem');
        this.$fileExtension = this.$el.querySelector('.file-extension');
        this.$fileOther = this.$el.querySelector('.file-other');
        this.$fileSize = this.$el.querySelector('.file-size');
        this.$previewBox = this.$el.querySelector('.file-preview');
        this.$receiveTitle = this.$el.querySelector('h2:first-of-type');
    }

    _formatFileSize(bytes) {
        // 1 GB = 1024 MB = 1024^2 KB = 1024^3 B
        // 1024^2 = 104876; 1024^3 = 1073741824
        if (bytes >= 1073741824) {
            return Math.round(10 * bytes / 1073741824) / 10 + ' GB';
        }
        else if (bytes >= 1048576) {
            return Math.round(bytes / 1048576) + ' MB';
        }
        else if (bytes > 1024) {
            return Math.round(bytes / 1024) + ' KB';
        }
        else {
            return bytes + ' Bytes';
        }
    }

    _parseFileData(displayName, connectionHash, files, imagesOnly, totalSize, badgeClassName) {
        let fileOther = "";

        if (files.length === 2) {
            fileOther = imagesOnly
                ? meshdropLocalization.getTranslation("dialogs.file-other-description-image")
                : meshdropLocalization.getTranslation("dialogs.file-other-description-file");
        }
        else if (files.length >= 2) {
            fileOther = imagesOnly
                ? meshdropLocalization.getTranslation("dialogs.file-other-description-image-plural", null, {count: files.length - 1})
                : meshdropLocalization.getTranslation("dialogs.file-other-description-file-plural", null, {count: files.length - 1});
        }

        this.$fileOther.innerText = fileOther;

        const fileName = files[0].name;
        const fileNameSplit = fileName.split('.');
        const fileExtension = fileNameSplit.length > 1
            ? '.' + fileNameSplit[fileNameSplit.length - 1]
            : '';
        this.$fileStem.innerText = fileName.substring(0, fileName.length - fileExtension.length);
        this.$fileExtension.innerText = fileExtension;
        this.$fileSize.innerText = this._formatFileSize(totalSize);
        this.$displayName.innerText = displayName;
        this.$displayName.title = connectionHash;
        this.$displayName.classList.remove("badge-room-ip", "badge-room-secret", "badge-room-public-id");
        this.$displayName.classList.add(badgeClassName)
    }
}

class ReceiveFileDialog extends ReceiveDialog {

    constructor() {
        super('receive-file-dialog');

        this.$downloadBtn = this.$el.querySelector('#download-btn');
        this.$shareBtn = this.$el.querySelector('#share-btn');

        meshdropEvents.on('files-received', e => this._onFilesReceived(e.detail.peerId, e.detail.files, e.detail.imagesOnly, e.detail.totalSize));
        this._filesQueue = [];
    }

    async _onFilesReceived(peerId, files, imagesOnly, totalSize) {
        const displayName = meshdropGetById(peerId).ui._displayName();
        const connectionHash = meshdropGetById(peerId).ui._connectionHash;
        const badgeClassName = meshdropGetById(peerId).ui._badgeClassName();

        this._filesQueue.push({
            peerId: peerId,
            displayName: displayName,
            connectionHash: connectionHash,
            files: files,
            imagesOnly: imagesOnly,
            totalSize: totalSize,
            badgeClassName: badgeClassName
        });

        window.blop.play();

        await this._nextFiles();
    }

    async _nextFiles() {
        if (this._busy || !this._filesQueue.length) return;
        this._busy = true;
        const {peerId, displayName, connectionHash, files, imagesOnly, totalSize, badgeClassName} = this._filesQueue.shift();
        await this._displayFiles(peerId, displayName, connectionHash, files, imagesOnly, totalSize, badgeClassName);
    }

    createPreviewElement(file) {
        return new Promise((resolve, reject) => {
            try {
                let mime = file.type.split('/')[0]
                let previewElement = {
                    image: 'img',
                    audio: 'audio',
                    video: 'video'
                }

                if (Object.keys(previewElement).indexOf(mime) === -1) {
                    resolve(false);
                }
                else {
                    let element = document.createElement(previewElement[mime]);
                    element.controls = true;
                    element.onload = _ => {
                        this.$previewBox.appendChild(element);
                        resolve(true);
                    };
                    element.onloadeddata = _ => {
                        this.$previewBox.appendChild(element);
                        resolve(true);
                    };
                    element.onerror = _ => {
                        reject(`${mime} preview could not be loaded from type ${file.type}`);
                    };
                    element.src = URL.createObjectURL(file);
                }
            } catch (_e) {
                reject(`preview could not be loaded from type ${file.type}`);
            }
        });
    }

    async _displayFiles(peerId, displayName, connectionHash, files, imagesOnly, totalSize, badgeClassName) {
        this._parseFileData(displayName, connectionHash, files, imagesOnly, totalSize, badgeClassName);

        let descriptor, url, filenameDownload;
        if (files.length === 1) {
            descriptor = imagesOnly
                ? meshdropLocalization.getTranslation("dialogs.title-image")
                : meshdropLocalization.getTranslation("dialogs.title-file");
        }
        else {
            descriptor = imagesOnly
                ? meshdropLocalization.getTranslation("dialogs.title-image-plural")
                : meshdropLocalization.getTranslation("dialogs.title-file-plural");
        }
        this.$receiveTitle.innerText = meshdropLocalization.getTranslation("dialogs.receive-title", null, {descriptor: descriptor});

        const canShare = (window.iOS || window.android) && !!navigator.share && navigator.canShare({files});
        if (canShare) {
            this.$shareBtn.removeAttribute('hidden');
            this.$shareBtn.onclick = _ => {
                navigator.share({files: files})
                    .catch(err => {
                        console.error(err);
                    });
            }
        }

        let downloadZipped = false;
        if (files.length > 1) {
            downloadZipped = true;
            try {
                let bytesCompleted = 0;
                globalThis.zipper.createNewZipWriter();
                for (let i=0; i<files.length; i++) {
                    await globalThis.zipper.addFile(files[i], {
                        onprogress: (progress) => {
                            meshdropEvents.fire('set-progress', {
                                peerId: peerId,
                                progress: (bytesCompleted + progress) / totalSize,
                                status: 'process'
                            })
                        }
                    });
                    bytesCompleted += files[i].size;
                }
                url = await globalThis.zipper.getBlobURL();

                let now = new Date(Date.now());
                let year = now.getFullYear().toString();
                let month = (now.getMonth()+1).toString();
                month = month.length < 2 ? "0" + month : month;
                let date = now.getDate().toString();
                date = date.length < 2 ? "0" + date : date;
                let hours = now.getHours().toString();
                hours = hours.length < 2 ? "0" + hours : hours;
                let minutes = now.getMinutes().toString();
                minutes = minutes.length < 2 ? "0" + minutes : minutes;
                filenameDownload = `MeshDrop_files_${year+month+date}_${hours+minutes}.zip`;
            } catch (e) {
                console.error(e);
                downloadZipped = false;
            }
        }

        this.$downloadBtn.removeAttribute('disabled');
        this.$downloadBtn.innerText = meshdropLocalization.getTranslation("dialogs.download");
        this.$downloadBtn.onclick = _ => {
            if (downloadZipped) {
                let tmpZipBtn = document.createElement("a");
                tmpZipBtn.download = filenameDownload;
                tmpZipBtn.href = url;
                tmpZipBtn.click();
            }
            else {
                this._downloadFilesIndividually(files);
            }

            if (!canShare) {
                this.$downloadBtn.innerText = meshdropLocalization.getTranslation("dialogs.download-again");
            }
            meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.download-successful", null, {descriptor: descriptor}));

            // Prevent clicking the button multiple times
            this.$downloadBtn.style.pointerEvents = "none";
            setTimeout(() => this.$downloadBtn.style.pointerEvents = "unset", 2000);
        };

        document.title = files.length === 1
            ? `${ meshdropLocalization.getTranslation("document-titles.file-received") } - MeshDrop`
            : `${ meshdropLocalization.getTranslation("document-titles.file-received-plural", null, {count: files.length}) } - MeshDrop`;
        meshdropChangeFavicon("images/favicon-96x96-notification.png");

        meshdropEvents.fire('set-progress', {peerId: peerId, progress: 1, status: 'process'})
        this.show();

        setTimeout(() => {
            // wait for the dialog to be shown
            if (canShare) {
                this.$shareBtn.click();
            }
            else {
                this.$downloadBtn.click();
            }
        }, 500);

        this.createPreviewElement(files[0])
            .then(canPreview => {
                if (canPreview) {
                    console.log('the file is able to preview');
                }
                else {
                    console.log('the file is not able to preview');
                }
            })
            .catch(r => console.error(r));
    }

    _downloadFilesIndividually(files) {
        let tmpBtn = document.createElement("a");
        for (let i=0; i<files.length; i++) {
            tmpBtn.download = files[i].name;
            tmpBtn.href = URL.createObjectURL(files[i]);
            tmpBtn.click();
        }
    }

    hide() {
        super.hide();
        setTimeout(async () => {
            this.$shareBtn.setAttribute('hidden', true);
            this.$downloadBtn.setAttribute('disabled', true);
            this.$previewBox.innerHTML = '';
            this._busy = false;
            await this._nextFiles();
        }, 300);
    }
}

class ReceiveRequestDialog extends ReceiveDialog {

    constructor() {
        super('receive-request-dialog');

        this.$acceptRequestBtn = this.$el.querySelector('#accept-request');
        this.$declineRequestBtn = this.$el.querySelector('#decline-request');
        this.$acceptRequestBtn.addEventListener('click', _ => this._respondToFileTransferRequest(true));
        this.$declineRequestBtn.addEventListener('click', _ => this._respondToFileTransferRequest(false));

        meshdropEvents.on('files-transfer-request', e => this._onRequestFileTransfer(e.detail.request, e.detail.peerId))
        meshdropEvents.on('keydown', e => this._onKeyDown(e));
        this._filesTransferRequestQueue = [];
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            this._respondToFileTransferRequest(false);
        }
    }

    _onRequestFileTransfer(request, peerId) {
        this._filesTransferRequestQueue.push({request: request, peerId: peerId});
        if (this.isShown()) return;
        this._dequeueRequests();
    }

    _dequeueRequests() {
        if (!this._filesTransferRequestQueue.length) return;
        let {request, peerId} = this._filesTransferRequestQueue.shift();
        this._showRequestDialog(request, peerId)
    }

    _showRequestDialog(request, peerId) {
        this.correspondingPeerId = peerId;

        const displayName = meshdropGetById(peerId).ui._displayName();
        const connectionHash = meshdropGetById(peerId).ui._connectionHash;

        const badgeClassName = meshdropGetById(peerId).ui._badgeClassName();

        this._parseFileData(displayName, connectionHash, request.header, request.imagesOnly, request.totalSize, badgeClassName);

        if (request.thumbnailDataUrl && request.thumbnailDataUrl.substring(0, 22) === "data:image/jpeg;base64") {
            let element = document.createElement('img');
            element.src = request.thumbnailDataUrl;
            this.$previewBox.appendChild(element)
        }

        const transferRequestTitle= request.imagesOnly
            ? meshdropLocalization.getTranslation('document-titles.image-transfer-requested')
            : meshdropLocalization.getTranslation('document-titles.file-transfer-requested');

        this.$receiveTitle.innerText = transferRequestTitle;

        document.title =  `${transferRequestTitle} - MeshDrop`;
        meshdropChangeFavicon("images/favicon-96x96-notification.png");

        this.$acceptRequestBtn.removeAttribute('disabled');
        this.show();
    }

    _respondToFileTransferRequest(accepted) {
        meshdropEvents.fire('respond-to-files-transfer-request', {
            to: this.correspondingPeerId,
            accepted: accepted
        })
        if (accepted) {
            meshdropEvents.fire('set-progress', {peerId: this.correspondingPeerId, progress: 0, status: 'wait'});
            NoSleepUI.enable();
        }
        this.hide();
    }

    hide() {
        // clear previewBox after dialog is closed
        setTimeout(() => {
            this.$previewBox.innerHTML = '';
            this.$acceptRequestBtn.setAttribute('disabled', true);
        }, 300);

        super.hide();

        // show next request
        setTimeout(() => this._dequeueRequests(), 300);
    }
}

class InputKeyContainer {
    constructor(inputKeyContainer, evaluationRegex, onAllCharsFilled, onNoAllCharsFilled, onLastCharFilled) {

        this.$inputKeyContainer = inputKeyContainer;
        this.$inputKeyChars = inputKeyContainer.querySelectorAll('input');

        this.$inputKeyChars.forEach(char => char.addEventListener('input', e => this._onCharsInput(e)));
        this.$inputKeyChars.forEach(char => char.addEventListener('keydown', e => this._onCharsKeyDown(e)));
        this.$inputKeyChars.forEach(char => char.addEventListener('keyup', e => this._onCharsKeyUp(e)));
        this.$inputKeyChars.forEach(char => char.addEventListener('focus', e => e.target.select()));
        this.$inputKeyChars.forEach(char => char.addEventListener('click', e => e.target.select()));

        this.evalRgx = evaluationRegex

        this._onAllCharsFilled = onAllCharsFilled;
        this._onNotAllCharsFilled = onNoAllCharsFilled;
        this._onLastCharFilled = onLastCharFilled;
    }

    _enableChars() {
        this.$inputKeyChars.forEach(char => char.removeAttribute('disabled'));
    }

    _disableChars() {
        this.$inputKeyChars.forEach(char => char.setAttribute('disabled', true));
    }

    _clearChars() {
        this.$inputKeyChars.forEach(char => char.value = '');
    }

    _cleanUp() {
        this._clearChars();
        this._disableChars();
    }

    _onCharsInput(e) {
        if (!e.target.value.match(this.evalRgx)) {
            e.target.value = '';
            return;
        }
        this._evaluateKeyChars();

        let nextSibling = e.target.nextElementSibling;
        if (nextSibling) {
            e.preventDefault();
            nextSibling.focus();
        }
    }

    _onCharsKeyDown(e) {
        let previousSibling = e.target.previousElementSibling;
        let nextSibling = e.target.nextElementSibling;
        if (e.key === "Backspace" && previousSibling && !e.target.value) {
            previousSibling.value = '';
            previousSibling.focus();
        }
        else if (e.key === "ArrowRight" && nextSibling) {
            e.preventDefault();
            nextSibling.focus();
        }
        else if (e.key === "ArrowLeft" && previousSibling) {
            e.preventDefault();
            previousSibling.focus();
        }
    }

    _onCharsKeyUp(e) {
        // deactivate submit btn when e.g. using backspace to clear element
        if (!e.target.value) {
            this._evaluateKeyChars();
        }
    }

    _getInputKey() {
        let key = "";
        this.$inputKeyChars.forEach(char => {
            key += char.value;
        })
        return key;
    }

    _onPaste(pastedKey) {
        let rgx = new RegExp("(?!" + this.evalRgx.source + ").", "g");
        pastedKey = pastedKey.replace(rgx,'').substring(0, this.$inputKeyChars.length)
        for (let i = 0; i < pastedKey.length; i++) {
            document.activeElement.value = pastedKey.charAt(i);
            let nextSibling = document.activeElement.nextElementSibling;
            if (!nextSibling) break;
            nextSibling.focus();
        }
        this._evaluateKeyChars();
    }

    _evaluateKeyChars() {
        if (this.$inputKeyContainer.querySelectorAll('input:placeholder-shown').length > 0) {
            this._onNotAllCharsFilled();
        }
        else {
            this._onAllCharsFilled();

            const lastCharFocused = document.activeElement === this.$inputKeyChars[this.$inputKeyChars.length - 1];
            if (lastCharFocused) {
                this._onLastCharFilled();
            }
        }
    }

    focusLastChar() {
        let lastChar = this.$inputKeyChars[this.$inputKeyChars.length-1];
        lastChar.focus();
    }
}

class PairDeviceDialog extends Dialog {
    constructor() {
        super('pair-device-dialog');
        this.$pairDeviceHeaderBtn = meshdropGetById('pair-device');
        this.$editPairedDevicesHeaderBtn = meshdropGetById('edit-paired-devices');
        this.$footerInstructionsPairedDevices = meshdropQuery('.discovery-wrapper .badge-room-secret');

        this.$key = this.$el.querySelector('.key');
        this.$qrCode = this.$el.querySelector('.key-qr-code');
        this.$form = this.$el.querySelector('form');
        this.$closeBtn = this.$el.querySelector('[close]')
        this.$pairSubmitBtn = this.$el.querySelector('button[type="submit"]');

        this.inputKeyContainer = new InputKeyContainer(
            this.$el.querySelector('.input-key-container'),
            /\d/,
            () => this.$pairSubmitBtn.removeAttribute('disabled'),
            () => this.$pairSubmitBtn.setAttribute('disabled', true),
            () => this._submit()
        );

        this.$pairDeviceHeaderBtn.addEventListener('click', _ => this._pairDeviceInitiate());
        this.$form.addEventListener('submit', e => this._onSubmit(e));
        this.$closeBtn.addEventListener('click', _ => this._close());

        meshdropEvents.on('keydown', e => this._onKeyDown(e));
        meshdropEvents.on('ws-disconnected', _ => this.hide());
        meshdropEvents.on('pair-device-initiated', e => this._onPairDeviceInitiated(e.detail));
        meshdropEvents.on('pair-device-joined', e => this._onPairDeviceJoined(e.detail.peerId, e.detail.roomSecret));
        meshdropEvents.on('peers', e => this._onPeers(e.detail));
        meshdropEvents.on('peer-joined', e => this._onPeerJoined(e.detail));
        meshdropEvents.on('pair-device-join-key-invalid', _ => this._onPublicRoomJoinKeyInvalid());
        meshdropEvents.on('pair-device-canceled', e => this._onPairDeviceCanceled(e.detail));
        meshdropEvents.on('evaluate-number-room-secrets', _ => this._evaluateNumberRoomSecrets())
        meshdropEvents.on('secret-room-deleted', e => this._onSecretRoomDeleted(e.detail));
        this.$el.addEventListener('paste', e => this._onPaste(e));
        this.$qrCode.addEventListener('click', _ => this._copyPairUrl());

        this.pairPeer = {};
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            // Timeout to prevent share mode from getting cancelled simultaneously
            setTimeout(() => this._close(), 50);
        }
    }

    _onPaste(e) {
        e.preventDefault();
        let pastedKey = e.clipboardData
            .getData("Text")
            .replace(/\D/g,'')
            .substring(0, 6);
        this.inputKeyContainer._onPaste(pastedKey);
    }

    _pairDeviceInitiate() {
        meshdropEvents.fire('pair-device-initiate');
    }

    _onPairDeviceInitiated(msg) {
        this.pairKey = msg.pairKey;
        this.roomSecret = msg.roomSecret;
        this._setKeyAndQRCode();
        this.inputKeyContainer._enableChars();
        this.show();
    }

    _setKeyAndQRCode() {
        this.$key.innerText = `${this.pairKey.substring(0,3)} ${this.pairKey.substring(3,6)}`

        // Display the QR code for the url
        const qr = new globalThis.QRCode({
            content: this._getPairUrl(),
            width: 130,
            height: 130,
            padding: 1,
            background: 'white',
            color: 'rgb(18, 18, 18)',
            ecl: "L",
            join: true
        });
        MeshDropSafeDom.setQrSvg(this.$qrCode, qr.svg());
    }

    _getPairUrl() {
        let url = new URL(location.href);
        url.searchParams.append('pair_key', this.pairKey)
        return url.href;
    }

    _copyPairUrl() {
        navigator.clipboard.writeText(this._getPairUrl())
            .then(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pair-url-copied-to-clipboard"));
            })
            .catch(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.copied-to-clipboard-error"));
            })
    }

    _onSubmit(e) {
        e.preventDefault();
        this._submit();
    }

    _submit() {
        let inputKey = this.inputKeyContainer._getInputKey();
        this._pairDeviceJoin(inputKey);
    }

    _pairDeviceJoin(pairKey) {
        if (/^\d{6}$/g.test(pairKey)) {
            meshdropEvents.fire('pair-device-join', pairKey);
            this.inputKeyContainer.focusLastChar();
        }
    }

    _onPairDeviceJoined(peerId, roomSecret) {
        // abort if peer is another tab on the same browser and remove room-type from gui
        if (meshdropBrowserTabsConnector.peerIsSameBrowser(peerId)) {
            this._cleanUp();
            this.hide();

            meshdropEvents.fire('room-secrets-deleted', [roomSecret]);

            meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pairing-tabs-error"));
            return;
        }

        // save pairPeer and wait for it to connect to ensure both devices have gotten the roomSecret
        this.pairPeer = {
            "peerId": peerId,
            "roomSecret": roomSecret
        };
    }

    _onPeers(message) {
        message.peers.forEach(messagePeer => {
            this._evaluateJoinedPeer(messagePeer.id, message.roomType, message.roomId);
        });
    }

    _onPeerJoined(message) {
        this._evaluateJoinedPeer(message.peer.id, message.roomType, message.roomId);
    }

    _evaluateJoinedPeer(peerId, roomType, roomId) {
        const noPairPeerSaved = !Object.keys(this.pairPeer);

        if (!peerId || !roomType || !roomId || noPairPeerSaved) return;

        const samePeerId = peerId === this.pairPeer.peerId;
        const sameRoomSecret = roomId === this.pairPeer.roomSecret;
        const typeIsSecret = roomType === "secret";

        if (!samePeerId || !sameRoomSecret || !typeIsSecret) return;

        this._onPairPeerJoined(peerId, roomId);
        this.pairPeer = {};
    }

    _onPairPeerJoined(peerId, roomSecret) {
        // if devices are paired that are already connected we must save the names at this point
        const $peer = meshdropGetById(peerId);
        let displayName, deviceName;
        if ($peer) {
            displayName = $peer.ui._peer.name.displayName;
            deviceName = $peer.ui._peer.name.deviceName;
        }

        meshdropPersistentStorage
            .addRoomSecret(roomSecret, displayName, deviceName)
            .then(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pairing-success"));
                this._evaluateNumberRoomSecrets();
            })
            .finally(() => {
                this._cleanUp();
                this.hide();
            })
            .catch(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pairing-not-persistent"));
                meshdropPersistentStorage.logBrowserNotCapable();
            });
    }

    _onPublicRoomJoinKeyInvalid() {
        meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pairing-key-invalid"));
    }

    _close() {
        this._pairDeviceCancel();
    }

    _pairDeviceCancel() {
        this.hide();
        this._cleanUp();
        meshdropEvents.fire('pair-device-cancel');
    }

    _onPairDeviceCanceled(pairKey) {
        meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pairing-key-invalidated", null, {key: pairKey}));
    }

    _cleanUp() {
        this.roomSecret = null;
        this.pairKey = null;
        this.inputKeyContainer._cleanUp();
        this.pairPeer = {};
    }

    _onSecretRoomDeleted(roomSecret) {
        meshdropPersistentStorage
            .deleteRoomSecret(roomSecret)
            .then(_ => {
                this._evaluateNumberRoomSecrets();
            });
    }

    _evaluateNumberRoomSecrets() {
        meshdropPersistentStorage
            .getAllRoomSecrets()
            .then(roomSecrets => {
                if (roomSecrets.length > 0) {
                    this.$editPairedDevicesHeaderBtn.removeAttribute('hidden');
                    this.$footerInstructionsPairedDevices.removeAttribute('hidden');
                }
                else {
                    this.$editPairedDevicesHeaderBtn.setAttribute('hidden', true);
                    this.$footerInstructionsPairedDevices.setAttribute('hidden', true);
                }
                meshdropEvents.fire('evaluate-footer-badges');
            });
    }
}

class EditPairedDevicesDialog extends Dialog {
    constructor() {
        super('edit-paired-devices-dialog');
        this.$pairedDevicesWrapper = this.$el.querySelector('.paired-devices-wrapper');
        this.$footerBadgePairedDevices = meshdropQuery('.discovery-wrapper .badge-room-secret');

        meshdropGetById('edit-paired-devices').addEventListener('click', _ => this._onEditPairedDevices());
        this.$footerBadgePairedDevices.addEventListener('click', _ => this._onEditPairedDevices());

        meshdropEvents.on('peer-display-name-changed', e => this._onPeerDisplayNameChanged(e));
        meshdropEvents.on('keydown', e => this._onKeyDown(e));
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            this.hide();
        }
    }

    async _initDOM() {
        const pairedDeviceRemovedString = meshdropLocalization.getTranslation("dialogs.paired-device-removed");
        const unpairString = meshdropLocalization.getTranslation("dialogs.unpair").toUpperCase();
        const autoAcceptString = meshdropLocalization.getTranslation("dialogs.auto-accept").toLowerCase();
        const roomSecretsEntries = await meshdropPersistentStorage.getAllRoomSecretEntries();

        roomSecretsEntries
            .forEach(roomSecretsEntry => {
                let $pairedDevice = document.createElement('div');
                $pairedDevice.classList.add("paired-device");
                $pairedDevice.setAttribute('placeholder', pairedDeviceRemovedString);

                $pairedDevice.innerHTML = `
                    <div class="display-name">
                        <span class="fw">
                            ${roomSecretsEntry.display_name}
                        </span>
                    </div>
                    <div class="device-name">
                        <span class="fw">
                            ${roomSecretsEntry.device_name}
                        </span>
                    </div>
                    <div class="button-wrapper row fw center wrap">
                        <div class="center grow">
                            <span class="center wrap">
                                ${autoAcceptString}
                            </span>
                            <label class="auto-accept switch pointer m-1">
                                <input type="checkbox" ${roomSecretsEntry.auto_accept ? "checked" : ""}>
                                <div class="slider round"></div>
                            </label>
                        </div>
                        <button class="btn grow" type="button">${unpairString}</button>
                    </div>`

                $pairedDevice
                    .querySelector('input[type="checkbox"]')
                    .addEventListener('click', e => {
                        meshdropPersistentStorage
                            .updateRoomSecretAutoAccept(roomSecretsEntry.secret, e.target.checked)
                            .then(roomSecretsEntry => {
                                meshdropEvents.fire('auto-accept-updated', {
                                    'roomSecret': roomSecretsEntry.entry.secret,
                                    'autoAccept': e.target.checked
                                });
                            });
                    });

                $pairedDevice
                    .querySelector('button')
                    .addEventListener('click', _e => {
                        meshdropPersistentStorage
                            .deleteRoomSecret(roomSecretsEntry.secret)
                            .then(roomSecret => {
                                meshdropEvents.fire('room-secrets-deleted', [roomSecret]);
                                meshdropEvents.fire('evaluate-number-room-secrets');
                                $pairedDevice.innerText = "";
                            });
                    })

                this.$pairedDevicesWrapper.appendChild($pairedDevice)
            })
    }

    hide() {
        super.hide();
        setTimeout(() => {
            this.$pairedDevicesWrapper.innerHTML = ""
        }, 300);
    }

    _onEditPairedDevices() {
        this._initDOM()
            .then(_ => {
                this._evaluateOverflowing(this.$pairedDevicesWrapper);
                this.show();
            });
    }

    _clearRoomSecrets() {
        meshdropPersistentStorage
            .getAllRoomSecrets()
            .then(roomSecrets => {
                meshdropPersistentStorage
                    .clearRoomSecrets()
                    .finally(() => {
                        meshdropEvents.fire('room-secrets-deleted', roomSecrets);
                        meshdropEvents.fire('evaluate-number-room-secrets');
                        meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.pairing-cleared"));
                        this.hide();
                    })
            });
    }

    _onPeerDisplayNameChanged(e) {
        const peerId = e.detail.peerId;
        const peerNode = meshdropGetById(peerId);

        if (!peerNode) return;

        const peer = peerNode.ui._peer;

        if (!peer || !peer._roomIds["secret"]) return;

        meshdropPersistentStorage
            .updateRoomSecretNames(peer._roomIds["secret"], peer.name.displayName, peer.name.deviceName)
            .then(roomSecretEntry => {
                console.log(`Successfully updated DisplayName and DeviceName for roomSecretEntry ${roomSecretEntry.key}`);
            })
    }
}

class PublicRoomDialog extends Dialog {
    constructor() {
        super('public-room-dialog');

        this.$key = this.$el.querySelector('.key');
        this.$qrCode = this.$el.querySelector('.key-qr-code');
        this.$form = this.$el.querySelector('form');
        this.$closeBtn = this.$el.querySelector('[close]');
        this.$leaveBtn = this.$el.querySelector('.leave-room');
        this.$joinSubmitBtn = this.$el.querySelector('button[type="submit"]');
        this.$headerBtnJoinPublicRoom = meshdropGetById('join-public-room');
        this.$footerBadgePublicRoomDevices = meshdropQuery('.discovery-wrapper .badge-room-public-id');


        this.$form.addEventListener('submit', e => this._onSubmit(e));
        this.$closeBtn.addEventListener('click', _ => this.hide());
        this.$leaveBtn.addEventListener('click', _ => this._leavePublicRoom())

        this.$headerBtnJoinPublicRoom.addEventListener('click', _ => this._onHeaderBtnClick());
        this.$footerBadgePublicRoomDevices.addEventListener('click', _ => this._onHeaderBtnClick());

        this.inputKeyContainer = new InputKeyContainer(
            this.$el.querySelector('.input-key-container'),
            /[a-z|A-Z]/,
            () => this.$joinSubmitBtn.removeAttribute('disabled'),
            () => this.$joinSubmitBtn.setAttribute('disabled', true),
            () => this._submit()
        );

        meshdropEvents.on('keydown', e => this._onKeyDown(e));
        meshdropEvents.on('public-room-created', e => this._onPublicRoomCreated(e.detail));
        meshdropEvents.on('peers', e => this._onPeers(e.detail));
        meshdropEvents.on('peer-joined', e => this._onPeerJoined(e.detail));
        meshdropEvents.on('public-room-id-invalid', e => this._onPublicRoomIdInvalid(e.detail));
        meshdropEvents.on('public-room-left', _ => this._onPublicRoomLeft());
        this.$el.addEventListener('paste', e => this._onPaste(e));
        this.$qrCode.addEventListener('click', _ => this._copyShareRoomUrl());

        meshdropEvents.on('ws-connected', _ => this._onWsConnected());
        meshdropEvents.on('translation-loaded', _ => this.setFooterBadge());
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            this.hide();
        }
    }

    _onPaste(e) {
        e.preventDefault();
        let pastedKey = e.clipboardData.getData("Text");
        this.inputKeyContainer._onPaste(pastedKey);
    }

    _onHeaderBtnClick() {
        if (this.roomId) {
            this.show();
        }
        else {
            this._createPublicRoom();
        }
    }

    _createPublicRoom() {
        meshdropEvents.fire('create-public-room');
    }

    _onPublicRoomCreated(roomId) {
        this.roomId = roomId;

        this._setKeyAndQrCode();

        this.show();

        sessionStorage.setItem('public_room_id', roomId);
    }

    _setKeyAndQrCode() {
        if (!this.roomId) return;

        this.$key.innerText = this.roomId.toUpperCase();

        // Display the QR code for the url
        const qr = new globalThis.QRCode({
            content: this._getShareRoomUrl(),
            width: 130,
            height: 130,
            padding: 1,
            background: 'white',
            color: 'rgb(18, 18, 18)',
            ecl: "L",
            join: true
        });
        MeshDropSafeDom.setQrSvg(this.$qrCode, qr.svg());

        this.setFooterBadge();
    }

    setFooterBadge() {
        if (!this.roomId) return;

        this.$footerBadgePublicRoomDevices.dataset.roomId = this.roomId.toUpperCase();
        this.$footerBadgePublicRoomDevices.innerText = meshdropLocalization.getTranslation("footer.public-room-devices", null, {
            roomId: this.roomId.toUpperCase()
        });
        this.$footerBadgePublicRoomDevices.removeAttribute('hidden');

        meshdropEvents.fire('evaluate-footer-badges');
    }

    _getShareRoomUrl() {
        let url = new URL(location.href);
        url.searchParams.append('room_id', this.roomId)
        return url.href;
    }

    _copyShareRoomUrl() {
        navigator.clipboard.writeText(this._getShareRoomUrl())
            .then(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.room-url-copied-to-clipboard"));
            })
            .catch(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.copied-to-clipboard-error"));
            })
    }

    _onWsConnected() {
        let roomId = sessionStorage.getItem('public_room_id');

        if (!roomId) return;

        this.roomId = roomId;
        this._setKeyAndQrCode();

        this._joinPublicRoom(roomId, true);
    }

    _onSubmit(e) {
        e.preventDefault();
        this._submit();
    }

    _submit() {
        let inputKey = this.inputKeyContainer._getInputKey();
        this._joinPublicRoom(inputKey);
    }

    _joinPublicRoom(roomId, createIfInvalid = false) {
        roomId = roomId.toLowerCase();
        if (/^[a-z]{5}$/g.test(roomId)) {
            this.roomIdJoin = roomId;

            this.inputKeyContainer.focusLastChar();

            meshdropEvents.fire('join-public-room', {
                roomId: roomId,
                createIfInvalid: createIfInvalid
            });
        }
    }

    _onPeers(message) {
        message.peers.forEach(messagePeer => {
            this._evaluateJoinedPeer(messagePeer.id, message.roomId);
        });
    }

    _onPeerJoined(message) {
        this._evaluateJoinedPeer(message.peer.id, message.roomId);
    }

    _evaluateJoinedPeer(peerId, roomId) {
        const isInitiatedRoomId = roomId === this.roomId;
        const isJoinedRoomId = roomId === this.roomIdJoin;

        if (!peerId || !roomId || !(isInitiatedRoomId || isJoinedRoomId)) return;

        this.hide();

        sessionStorage.setItem('public_room_id', roomId);

        if (isJoinedRoomId) {
            this.roomId = roomId;
            this.roomIdJoin = false;
            this._setKeyAndQrCode();
        }
    }

    _onPublicRoomIdInvalid(roomId) {
        meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.public-room-id-invalid"));
        if (roomId === sessionStorage.getItem('public_room_id')) {
            sessionStorage.removeItem('public_room_id');
        }
    }

    _leavePublicRoom() {
        meshdropEvents.fire('leave-public-room', this.roomId);
    }

    _onPublicRoomLeft() {
        let publicRoomId = this.roomId.toUpperCase();
        this.hide();
        this._cleanUp();
        meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.public-room-left", null, {publicRoomId: publicRoomId}));
    }

    show() {
        this.inputKeyContainer._enableChars();
        super.show();
    }

    hide() {
        this.inputKeyContainer._cleanUp();
        super.hide();
    }

    _cleanUp() {
        this.roomId = null;
        this.inputKeyContainer._cleanUp();
        sessionStorage.removeItem('public_room_id');
        delete this.$footerBadgePublicRoomDevices.dataset.roomId;
        this.$footerBadgePublicRoomDevices.setAttribute('hidden', true);
        meshdropEvents.fire('evaluate-footer-badges');
    }
}

class SendTextDialog extends Dialog {
    constructor() {
        super('send-text-dialog');

        this.$text = this.$el.querySelector('.textarea');
        this.$peerDisplayName = this.$el.querySelector('.display-name');
        this.$form = this.$el.querySelector('form');
        this.$submit = this.$el.querySelector('button[type="submit"]');
        this.$form.addEventListener('submit', e => this._onSubmit(e));
        this.$text.addEventListener('input', _ => this._onInput());
        this.$text.addEventListener('paste', e => this._onPaste(e));
        this.$text.addEventListener('drop', e => this._onDrop(e));

        meshdropEvents.on('text-recipient', e => this._onRecipient(e.detail.peerId, e.detail.deviceName));
        meshdropEvents.on('keydown', e => this._onKeyDown(e));
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            this.hide();
        }
        else if (e.code === "Enter" && (e.ctrlKey || e.metaKey)) {
            if (this._textEmpty()) return;

            this._send();
        }
    }

    async _onDrop(e) {
        e.preventDefault()

        const text = e.dataTransfer.getData("text");
        const selection = window.getSelection();

        if (selection.rangeCount) {
            selection.deleteFromDocument();
            selection.getRangeAt(0).insertNode(document.createTextNode(text));
        }

        this._onInput();
    }

    async _onPaste(e) {
        e.preventDefault()

        const text = (e.clipboardData || window.clipboardData).getData('text');
        const selection = window.getSelection();

        if (selection.rangeCount) {
            selection.deleteFromDocument();
            const textNode = document.createTextNode(text);
            const range = document.createRange();
            range.setStart(textNode, textNode.length);
            range.collapse(true);
            selection.getRangeAt(0).insertNode(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this._onInput();
    }

    _textEmpty() {
        return !this.$text.innerText || this.$text.innerText === "\n";
    }

    _onInput() {
        if (this._textEmpty()) {
            this.$submit.setAttribute('disabled', true);
            // remove remaining whitespace on Firefox on text deletion
            this.$text.innerText = "";
        }
        else {
            this.$submit.removeAttribute('disabled');
        }
        this._evaluateOverflowing(this.$text);
    }

    _onRecipient(peerId, deviceName) {
        this.correspondingPeerId = peerId;
        this.$peerDisplayName.innerText = deviceName;
        this.$peerDisplayName.classList.remove("badge-room-ip", "badge-room-secret", "badge-room-public-id");
        this.$peerDisplayName.classList.add(meshdropGetById(peerId).ui._badgeClassName());

        this.show();

        const range = document.createRange();
        const sel = window.getSelection();

        range.selectNodeContents(this.$text);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    _onSubmit(e) {
        e.preventDefault();
        this._send();
    }

    _send() {
        meshdropEvents.fire('send-text', {
            to: this.correspondingPeerId,
            text: this.$text.innerText
        });
        this.hide();
        setTimeout(() => this.$text.innerText = "", 300);
    }
}

class ReceiveTextDialog extends Dialog {
    constructor() {
        super('receive-text-dialog');
        meshdropEvents.on('text-received', e => this._onText(e.detail.text, e.detail.peerId));
        this.$text = this.$el.querySelector('#text');
        this.$copy = this.$el.querySelector('#copy');
        this.$close = this.$el.querySelector('#close');

        this.$copy.addEventListener('click', _ => this._onCopy());
        this.$close.addEventListener('click', _ => this.hide());

        meshdropEvents.on('keydown', e => this._onKeyDown(e));

        this.$displayName = this.$el.querySelector('.display-name');
        this._receiveTextQueue = [];
        this._hideTimeout = null;
    }

    selectionEmpty() {
        return !window.getSelection().toString()
    }

    async _onKeyDown(e) {
        if (!this.isShown()) return

        if (e.code === "KeyC" && (e.ctrlKey || e.metaKey) && this.selectionEmpty()) {
            await this._onCopy()
        }
        else if (e.code === "Escape") {
            this.hide();
        }
    }

    _onText(text, peerId) {
        window.blop.play();
        this._receiveTextQueue.push({text: text, peerId: peerId});
        this._setDocumentTitleMessages();
        meshdropChangeFavicon("images/favicon-96x96-notification.png");

        if (this.isShown() || this._hideTimeout) return;

        this._dequeueRequests();
    }

    _dequeueRequests() {
        this._setDocumentTitleMessages();
        meshdropChangeFavicon("images/favicon-96x96-notification.png");

        let {text, peerId} = this._receiveTextQueue.shift();
        this._showReceiveTextDialog(text, peerId);
    }

    _showReceiveTextDialog(text, peerId) {
        this.$displayName.innerText = meshdropGetById(peerId).ui._displayName();
        this.$displayName.classList.remove("badge-room-ip", "badge-room-secret", "badge-room-public-id");
        this.$displayName.classList.add(meshdropGetById(peerId).ui._badgeClassName());

        this.$text.innerText = text;

        // Beautify text if text is not too long
        if (this.$text.innerText.length <= 300000) {
            MeshDropSafeDom.renderReceivedText(this.$text, text);
        }

        this._evaluateOverflowing(this.$text);
        this.show();
    }

    _setDocumentTitleMessages() {
        document.title = this._receiveTextQueue.length <= 1
            ? `${ meshdropLocalization.getTranslation("document-titles.message-received") } - MeshDrop`
            : `${ meshdropLocalization.getTranslation("document-titles.message-received-plural", null, {count: this._receiveTextQueue.length + 1}) } - MeshDrop`;
    }

    async _onCopy() {
        const sanitizedText = this.$text.innerText.replace(/\u00A0/gm, ' ');
        navigator.clipboard
            .writeText(sanitizedText)
            .then(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.copied-to-clipboard"));
                this.hide();
            })
            .catch(_ => {
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.copied-to-clipboard-error"));
            });
    }

    hide() {
        super.hide();

        // If queue is empty -> clear text field | else -> open next message
        this._hideTimeout = setTimeout(() => {
            if (!this._receiveTextQueue.length) {
                this.$text.innerHTML = "";
            }
            else {
                this._dequeueRequests();
            }
            this._hideTimeout = null;
        }, 500);
    }
}

class ShareTextDialog extends Dialog {
    constructor() {
        super('share-text-dialog');

        this.$text = this.$el.querySelector('.textarea');
        this.$approveMsgBtn = this.$el.querySelector('button[type="submit"]');
        this.$checkbox = this.$el.querySelector('input[type="checkbox"]')

        this.$approveMsgBtn.addEventListener('click', _ => this._approveShareText());

        // Only show this per default if user sets checkmark
        this.$checkbox.checked = localStorage.getItem('approve-share-text')
            ? ShareTextDialog.isApproveShareTextSet()
            : false;

        this._setCheckboxValueToLocalStorage();

        this.$checkbox.addEventListener('change', _ => this._setCheckboxValueToLocalStorage());
        meshdropEvents.on('share-text-dialog', e => this._onShareText(e.detail));
        meshdropEvents.on('keydown', e => this._onKeyDown(e));
        this.$text.addEventListener('input', _ => this._evaluateEmptyText());
    }

    static isApproveShareTextSet() {
        return localStorage.getItem('approve-share-text') === "true";
    }

    _setCheckboxValueToLocalStorage() {
        localStorage.setItem('approve-share-text', this.$checkbox.checked ? "true" : "false");
    }

    _onKeyDown(e) {
        if (!this.isShown()) return;

        if (e.code === "Escape") {
            this._approveShareText();
        }
        else if (e.code === "Enter" && (e.ctrlKey || e.metaKey)) {
            if (this._textEmpty()) return;

            this._approveShareText();
        }
    }

    _textEmpty() {
        return !this.$text.innerText || this.$text.innerText === "\n";
    }

    _evaluateEmptyText() {
        if (this._textEmpty()) {
            this.$approveMsgBtn.setAttribute('disabled', true);
            // remove remaining whitespace on Firefox on text deletion
            this.$text.innerText = "";
        }
        else {
            this.$approveMsgBtn.removeAttribute('disabled');
        }
        this._evaluateOverflowing(this.$text);
    }

    _onShareText(text) {
        this.$text.innerText = text;
        this._evaluateEmptyText();
        this.show();
    }

    _approveShareText() {
        meshdropEvents.fire('activate-share-mode', {text: this.$text.innerText});
        this.hide();
    }

    hide() {
        super.hide();
        setTimeout(() => this.$text.innerText = "", 500);
    }
}

class Base64Dialog extends Dialog {

    constructor() {
        super('base64-paste-dialog');

        this.$title = this.$el.querySelector('.dialog-title');
        this.$pasteBtn = this.$el.querySelector('#base64-paste-btn');
        this.$fallbackTextarea = this.$el.querySelector('.textarea');
    }

    async evaluateBase64Text(base64Text, hash) {
        this.$title.innerText = meshdropLocalization.getTranslation('dialogs.base64-title-text');

        if (base64Text === 'paste') {
            // ?base64text=paste
            // base64 encoded string is ready to be pasted from clipboard
            this.preparePasting('text');
            this.show();
        }
        else if (base64Text === 'hash') {
            // ?base64text=hash#BASE64ENCODED
            // base64 encoded text is url hash which cannot be seen by the server and is faster (recommended)
            this.show();
            await this.processBase64Text(hash);
        }
        else {
            // ?base64text=BASE64ENCODED
            // base64 encoded text is part of the url param. Seen by server and slow (not recommended)
            this.show();
            await this.processBase64Text(base64Text);
        }
    }

    async evaluateBase64Zip(base64Zip, hash) {
        this.$title.innerText = meshdropLocalization.getTranslation('dialogs.base64-title-files');

        if (base64Zip === 'paste') {
            // ?base64zip=paste || ?base64zip=true
            this.preparePasting('files');
            this.show();
        }
        else if (base64Zip === 'hash') {
            // ?base64zip=hash#BASE64ENCODED
            // base64 encoded zip file is url hash which cannot be seen by the server
            await this.processBase64Zip(hash);
        }
    }

    _setPasteBtnToProcessing() {
        this.$pasteBtn.style.pointerEvents = "none";
        this.$pasteBtn.innerText = meshdropLocalization.getTranslation("dialogs.base64-processing");
    }

    preparePasting(type) {
        const translateType = type === 'text'
            ? meshdropLocalization.getTranslation("dialogs.base64-text")
            : meshdropLocalization.getTranslation("dialogs.base64-files");

        if (navigator.clipboard.readText) {
            this.$pasteBtn.innerText = meshdropLocalization.getTranslation("dialogs.base64-tap-to-paste", null, {type: translateType});
            this._clickCallback = _ => this.processClipboard(type);
            this._clickListener = _ => this._clickCallback();
            this.$pasteBtn.addEventListener('click', this._clickListener);
        }
        else {
            console.log("`navigator.clipboard.readText()` is not available on your browser.\nOn Firefox you can set `dom.events.asyncClipboard.readText` to true under `about:config` for convenience.")
            this.$pasteBtn.setAttribute('hidden', true);
            this.$fallbackTextarea.setAttribute('placeholder', meshdropLocalization.getTranslation("dialogs.base64-paste-to-send", null, {type: translateType}));
            this.$fallbackTextarea.removeAttribute('hidden');
            this._inputCallback = _ => this.processInput(type);
            this._inputListener = _ => this._inputCallback();
            this.$fallbackTextarea.addEventListener('input', this._inputListener);
            this.$fallbackTextarea.focus();
        }
    }

    async processInput(type) {
        const base64 = this.$fallbackTextarea.textContent;
        this.$fallbackTextarea.textContent = '';
        await this.processPastedBase64(type, base64);
    }

    async processClipboard(type) {
        const base64 = await navigator.clipboard.readText();
        await this.processPastedBase64(type, base64);
    }

    async processPastedBase64(type, base64) {
        try {
            if (type === 'text') {
                await this.processBase64Text(base64);
            }
            else {
                await this.processBase64Zip(base64);
            }
        }
        catch(_e) {
            meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.clipboard-content-incorrect"));
            console.log("Clipboard content is incorrect.")
        }
        this.hide();
    }

    async processBase64Text(base64){
        this._setPasteBtnToProcessing();

        try {
            const decodedText = await meshdropDecodeBase64Text(base64);
            if (ShareTextDialog.isApproveShareTextSet()) {
                meshdropEvents.fire('share-text-dialog', decodedText);
            }
            else {
                meshdropEvents.fire('activate-share-mode', {text: decodedText});
            }
        }
        catch (_e) {
            meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.text-content-incorrect"));
            console.log("Text content incorrect.");
        }

        this.hide();
    }

    async processBase64Zip(base64) {
        this._setPasteBtnToProcessing();

        try {
            const decodedFiles = await meshdropDecodeBase64Files(base64);
            meshdropEvents.fire('activate-share-mode', {files: decodedFiles});
        }
        catch (_e) {
            meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.file-content-incorrect"));
            console.log("File content incorrect.");
        }

        this.hide();
    }

    hide() {
        if (this._clickListener) this.$pasteBtn.removeEventListener('click', this._clickListener);
        if (this._inputListener) this.$fallbackTextarea.removeEventListener('input', this._inputListener);
        this.$fallbackTextarea.setAttribute('disabled', true);
        this.$fallbackTextarea.blur();
        super.hide();
    }
}

class AboutUI {
    constructor() {
        this.$donationBtn = meshdropGetById('donation-btn');
        this.$twitterBtn = meshdropGetById('x-twitter-btn');
        this.$mastodonBtn = meshdropGetById('mastodon-btn');
        this.$blueskyBtn = meshdropGetById('bluesky-btn');
        this.$customBtn = meshdropGetById('custom-btn');
        this.$privacypolicyBtn = meshdropGetById('privacypolicy-btn');
        meshdropEvents.on('config', e => this._onConfig(e.detail.buttons));
    }

    async _onConfig(btnConfig) {
        await this._evaluateBtnConfig(this.$donationBtn, btnConfig.donation_button);
        await this._evaluateBtnConfig(this.$twitterBtn, btnConfig.twitter_button);
        await this._evaluateBtnConfig(this.$mastodonBtn, btnConfig.mastodon_button);
        await this._evaluateBtnConfig(this.$blueskyBtn, btnConfig.bluesky_button);
        await this._evaluateBtnConfig(this.$customBtn, btnConfig.custom_button);
        await this._evaluateBtnConfig(this.$privacypolicyBtn, btnConfig.privacypolicy_button);
    }

    async _evaluateBtnConfig($btn, config) {
        // if config is not set leave everything as default
        if (!Object.keys(config).length) return;

        if (config.active === "false") {
            $btn.setAttribute('hidden', true);
        } else {
            if (config.link) {
                $btn.setAttribute('href', config.link);
            }
            if (config.title) {
                $btn.setAttribute('title', config.title);
                // prevent overwriting of custom title when setting different language
                $btn.removeAttribute('data-i18n-key');
                $btn.removeAttribute('data-i18n-attrs');
            }
            if (config.icon) {
                $btn.setAttribute('title', config.title);
                // prevent overwriting of custom title when setting different language
                $btn.removeAttribute('data-i18n-key');
                $btn.removeAttribute('data-i18n-attrs');
            }
            $btn.removeAttribute('hidden');
        }
    }
}

class Toast extends Dialog {
    constructor() {
        super('toast');
        this.$closeBtn = this.$el.querySelector('.icon-button');
        this.$text = this.$el.querySelector('span');

        this.$closeBtn.addEventListener('click', _ => this.hide());
        meshdropEvents.on('notify-user', e => this._onNotify(e.detail));
        meshdropEvents.on('share-mode-changed', _ => this.hide());
    }

    _onNotify(message) {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        this.$text.innerText = typeof message === "object" ? message.message : message;
        this.show();

        if (typeof message === "object" && message.persistent) return;

        this.hideTimeout = setTimeout(() => this.hide(), 5000);
    }

    hide() {
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        super.hide();
    }
}

class Notifications {

    constructor() {
        // Check if the browser supports notifications
        if (!('Notification' in window)) return;

        this.$headerNotificationButton = meshdropGetById('notification');
        this.$downloadBtn = meshdropGetById('download-btn');

        this.$headerNotificationButton.addEventListener('click', _ => this._requestPermission());


        meshdropEvents.on('text-received', e => this._messageNotification(e.detail.text, e.detail.peerId));
        meshdropEvents.on('files-received', e => this._downloadNotification(e.detail.files));
        meshdropEvents.on('files-transfer-request', e => this._requestNotification(e.detail.request, e.detail.peerId));
    }

    async _requestPermission() {
        await Notification.
            requestPermission(permission => {
                if (permission !== 'granted') {
                    meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.notifications-permissions-error"));
                    return;
                }
                meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.notifications-enabled"));
                this.$headerNotificationButton.setAttribute('hidden', true);
            });
    }

    _notify(title, body) {
        const config = {
            body: body,
            icon: '/images/logo_transparent_128x128.png',
        }
        let notification;
        try {
            notification = new Notification(title, config);
        } catch (_e) {
            // Android doesn't support "new Notification" if service worker is installed
            if (!globalThis.serviceWorker || !globalThis.serviceWorker.showNotification) return;
            notification = globalThis.serviceWorker.showNotification(title, config);
        }

        // Notification is persistent on Android. We have to close it manually
        const visibilitychangeHandler = () => {
            if (document.visibilityState === 'visible') {
                notification.close();
                meshdropEvents.off('visibilitychange', visibilitychangeHandler);
            }
        };
        meshdropEvents.on('visibilitychange', visibilitychangeHandler);

        return notification;
    }

    _messageNotification(message, peerId) {
        if (document.visibilityState !== 'visible') {
            const peerDisplayName = meshdropGetById(peerId).ui._displayName();
            if (/^((https?:\/\/|www)[abcdefghijklmnopqrstuvwxyz0123456789\-._~:/?#[\]@!$&'()*+,;=]+)$/.test(message.toLowerCase())) {
                const notification = this._notify(meshdropLocalization.getTranslation("notifications.link-received", null, {name: peerDisplayName}), message);
                this._bind(notification, _ => window.open(message, '_blank', "noreferrer"));
            }
            else {
                const notification = this._notify(meshdropLocalization.getTranslation("notifications.message-received", null, {name: peerDisplayName}), message);
                this._bind(notification, _ => this._copyText(message, notification));
            }
        }
    }

    _downloadNotification(files) {
        if (document.visibilityState !== 'visible') {
            let imagesOnly = files.every(file => file.type.split('/')[0] === 'image');
            let title;

            if (files.length === 1) {
                title = `${files[0].name}`;
            }
            else {
                let fileOther;
                if (files.length === 2) {
                    fileOther = imagesOnly
                        ? meshdropLocalization.getTranslation("dialogs.file-other-description-image")
                        : meshdropLocalization.getTranslation("dialogs.file-other-description-file");
                }
                else {
                    fileOther = imagesOnly
                        ? meshdropLocalization.getTranslation("dialogs.file-other-description-image-plural", null, {count: files.length - 1})
                        : meshdropLocalization.getTranslation("dialogs.file-other-description-file-plural", null, {count: files.length - 1});
                }
                title = `${files[0].name} ${fileOther}`
            }
            const notification = this._notify(title, meshdropLocalization.getTranslation("notifications.click-to-download"));
            this._bind(notification, _ => this._download(notification));
        }
    }

    _requestNotification(request, peerId) {
        if (document.visibilityState !== 'visible') {
            let imagesOnly = request.header.every(header => header.mime.split('/')[0] === 'image');
            let displayName = meshdropGetById(peerId).querySelector('.name').textContent;

            let descriptor;
            if (request.header.length === 1) {
                descriptor = imagesOnly
                    ? meshdropLocalization.getTranslation("dialogs.title-image")
                    : meshdropLocalization.getTranslation("dialogs.title-file");
            }
            else {
                descriptor = imagesOnly
                    ? meshdropLocalization.getTranslation("dialogs.title-image-plural")
                    : meshdropLocalization.getTranslation("dialogs.title-file-plural");
            }

            let title = meshdropLocalization
                .getTranslation("notifications.request-title", null, {
                    name: displayName,
                    count: request.header.length,
                    descriptor: descriptor.toLowerCase()
                });

            this._notify(title, meshdropLocalization.getTranslation("notifications.click-to-show"));
        }
    }

    _download(notification) {
        this.$downloadBtn.click();
        notification.close();
    }

    async _copyText(message, notification) {
        if (await navigator.clipboard.writeText(message)) {
            notification.close();
            this._notify(meshdropLocalization.getTranslation("notifications.copied-text"));
        }
        else {
            this._notify(meshdropLocalization.getTranslation("notifications.copied-text-error"));
        }
    }

    _bind(notification, handler) {
        if (notification.then) {
            notification.then(_ => {
                globalThis.serviceWorker
                    .getNotifications()
                    .then(_ => {
                        globalThis.serviceWorker.addEventListener('notificationclick', handler);
                    })
            });
        }
        else {
            notification.onclick = handler;
        }
    }
}

class NetworkStatusUI {

    constructor() {
        meshdropEvents.on('offline', _ => this._showOfflineMessage());
        meshdropEvents.on('online', _ => this._showOnlineMessage());
        if (!navigator.onLine) this._showOfflineMessage();
    }

    _showOfflineMessage() {
        meshdropEvents.fire('notify-user', {
            message: meshdropLocalization.getTranslation("notifications.offline"),
            persistent: true
        });
    }

    _showOnlineMessage() {
        meshdropEvents.fire('notify-user', meshdropLocalization.getTranslation("notifications.online"));
    }
}

class WebShareTargetUI {

    async evaluateShareTarget(shareTargetType, title, text, url) {
        if (shareTargetType === "text") {
            let shareTargetText;
            if (url) {
                shareTargetText = url; // we share only the link - no text.
            }
            else if (title && text) {
                shareTargetText = title + '\r\n' + text;
            }
            else {
                shareTargetText = title + text;
            }

            if (ShareTextDialog.isApproveShareTextSet()) {
                meshdropEvents.fire('share-text-dialog', shareTargetText);
            }
            else {
                meshdropEvents.fire('activate-share-mode', {text: shareTargetText});
            }
        }
        else if (shareTargetType === "files") {
            let openRequest = window.indexedDB.open('pairdrop_store')
            openRequest.onsuccess = e => {
                const db = e.target.result;
                const tx = db.transaction('share_target_files', 'readwrite');
                const store = tx.objectStore('share_target_files');
                const request = store.getAll();
                request.onsuccess = _ => {
                    const fileObjects = request.result;

                    let filesReceived = [];
                    for (let i = 0; i < fileObjects.length; i++) {
                        filesReceived.push(new File([fileObjects[i].buffer], fileObjects[i].name));
                    }

                    const clearRequest = store.clear()
                    clearRequest.onsuccess = _ => db.close();

                    meshdropEvents.fire('activate-share-mode', {files: filesReceived})
                }
            }
        }
    }
}

// Keep for legacy reasons even though this is removed from new PWA installations
class WebFileHandlersUI {
    async evaluateLaunchQueue() {
        if (!("launchQueue" in window)) return;

        globalThis.launchQueue.setConsumer(async launchParams => {
            console.log("Launched with: ", launchParams);

            if (!launchParams.files.length) return;

            let files = [];

            for (let i = 0; i < launchParams.files.length; i++) {
                if (i !== 0 && await launchParams.files[i].isSameEntry(launchParams.files[i-1])) continue;

                const file = await launchParams.files[i].getFile();
                files.push(file);
            }

            meshdropEvents.fire('activate-share-mode', {files: files})
        });
    }
}

class NoSleepUI {
    constructor() {
        NoSleepUI._nosleep = new globalThis.NoSleep();
    }

    static enable() {
        if (!this._interval) {
            NoSleepUI._nosleep.enable();
            NoSleepUI._interval = setInterval(() => NoSleepUI.disable(), 10000);
        }
    }

    static disable() {
        if (meshdropQuery('x-peer[status]') === null) {
            clearInterval(NoSleepUI._interval);
            NoSleepUI._nosleep.disable();
        }
    }
}

Object.assign(globalThis, {
    AboutUI,
    Base64Dialog,
    EditPairedDevicesDialog,
    LanguageSelectDialog,
    NetworkStatusUI,
    NoSleepUI,
    Notifications,
    PairDeviceDialog,
    PeersUI,
    ProtocolSettingsDialog,
    PublicRoomDialog,
    ReceiveFileDialog,
    ReceiveRequestDialog,
    ReceiveTextDialog,
    SendTextDialog,
    ShareTextDialog,
    Toast,
    TransferChoiceDialog,
    WebFileHandlersUI,
    WebShareTargetUI
});
