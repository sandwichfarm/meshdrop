/* eslint-disable no-undef */

const SignalingRoomPriority = {
    priority: {
        "ip": 0,
        "fips": 1,
        "pollen": 2,
        "secret": 3,
        "public-id": 4,
        "nostr": 5
    },

    primary(roomIds = {}) {
        return Object.keys(roomIds)[0] || "";
    },

    shouldPrefer(currentRoomType, nextRoomType, connected = false) {
        if (connected) return false;
        if (!currentRoomType || !nextRoomType) return false;

        const currentPriority = this.priority[currentRoomType] ?? 99;
        const nextPriority = this.priority[nextRoomType] ?? 99;
        return nextPriority < currentPriority;
    },

    withPreferred(roomIds = {}, roomType, roomId) {
        const reordered = {[roomType]: roomId};
        Object.keys(roomIds).forEach(existingType => {
            if (existingType !== roomType) reordered[existingType] = roomIds[existingType];
        });
        return reordered;
    }
};

globalThis.SignalingRoomPriority = SignalingRoomPriority;

const ServerConnectionIdentityProtocol = {
    key(identity = null) {
        if (!identity?.pubkey) return "";

        return [
            identity.pubkey,
            identity.event?.id || "",
            identity.event?.sig || ""
        ].join(":");
    },

    serverIdentity(identity = null) {
        if (!identity?.event) return null;

        return {
            pubkey: identity.pubkey || identity.event.pubkey,
            event: identity.event
        };
    },

    storedKey(storage = globalThis.localStorage) {
        if (!storage?.getItem) return "";

        try {
            return this.key(JSON.parse(storage.getItem("meshdrop_nostr_identity")) || null);
        } catch {
            return "";
        }
    },

    storedServerIdentity(storage = globalThis.localStorage) {
        if (!storage?.getItem) return null;

        try {
            return this.serverIdentity(JSON.parse(storage.getItem("meshdrop_nostr_identity")) || null);
        } catch {
            return null;
        }
    }
};

globalThis.ServerConnectionIdentityProtocol = ServerConnectionIdentityProtocol;

const TransferPrivacyProtocol = {
    defaultMode: "private",
    modes: [
        {
            id: "private",
            label: "Private",
            description: "Encrypt file bytes in this browser before they leave."
        },
        {
            id: "unencrypted",
            label: "Unencrypted",
            description: "Send raw file bytes over the selected route."
        }
    ],

    normalize(mode) {
        return this.modes.some(entry => entry.id === mode) ? mode : this.defaultMode;
    },

    fromTransfer(transfer = null) {
        return this.normalize(transfer?.privacyMode || transfer?.privacy?.mode || this.defaultMode);
    },

    isPrivate(transfer = null) {
        return this.fromTransfer(transfer) === "private";
    }
};

globalThis.TransferPrivacyProtocol = TransferPrivacyProtocol;

class ServerConnection {

    constructor() {
        Events.on('pagehide', _ => this._disconnect());
        Events.on(window.visibilityChangeEvent, _ => this._onVisibilityChange());

        if (navigator.connection) {
            navigator.connection.addEventListener('change', _ => this._reconnect());
        }

        Events.on('room-secrets', e => this.send({ type: 'room-secrets', roomSecrets: e.detail }));
        Events.on('join-ip-room', _ => this.send({ type: 'join-ip-room'}));
        Events.on('leave-ip-room', _ => this.send({ type: 'leave-ip-room'}));
        Events.on('join-fips-room', _ => this.send({ type: 'join-fips-room'}));
        Events.on('leave-fips-room', _ => this.send({ type: 'leave-fips-room'}));
        Events.on('join-pollen-room', _ => this.send({ type: 'join-pollen-room'}));
        Events.on('leave-pollen-room', _ => this.send({ type: 'leave-pollen-room'}));
        Events.on('room-secrets-deleted', e => this.send({ type: 'room-secrets-deleted', roomSecrets: e.detail}));
        Events.on('regenerate-room-secret', e => this.send({ type: 'regenerate-room-secret', roomSecret: e.detail}));
        Events.on('pair-device-initiate', _ => this._onPairDeviceInitiate());
        Events.on('pair-device-join', e => this._onPairDeviceJoin(e.detail));
        Events.on('pair-device-cancel', _ => this.send({ type: 'pair-device-cancel' }));
        Events.on('nostr-identity-changed', e => this._onNostrIdentityChanged(e.detail));

        Events.on('create-public-room', _ => this._onCreatePublicRoom());
        Events.on('join-public-room', e => this._onJoinPublicRoom(e.detail.roomId, e.detail.createIfInvalid));
        Events.on('leave-public-room', _ => this._onLeavePublicRoom());

        Events.on('offline', _ => clearTimeout(this._reconnectTimer));
        Events.on('online', _ => this._connect());

        this._getConfig().then(() => this._connect());
    }

    _onNostrIdentityChanged(identity) {
        const nextIdentityKey = ServerConnectionIdentityProtocol.key(identity);
        if (nextIdentityKey === this._serverIdentityKey) return;

        this._serverIdentityKey = nextIdentityKey;
        this._reconnect();
    }

    _getConfig() {
        console.log("Loading config...")
        return new Promise(resolve => {
            let xhr = new XMLHttpRequest();
            xhr.addEventListener("load", () => {
                if (xhr.status === 200) {
                    let config;
                    try {
                        config = JSON.parse(xhr.responseText);
                    } catch {
                        resolveStaticConfig(resolve);
                        return;
                    }

                    console.log("Config loaded:", config)
                    this._config = config;
                    Events.fire('config', config);
                    resolve()
                } else if (xhr.status === 0 || xhr.status === 404) {
                    resolveStaticConfig(resolve);
                } else if (xhr.status < 200 || xhr.status >= 300) {
                    retry();
                }
            })

            xhr.addEventListener("error", _ => {
                resolveStaticConfig(resolve);
            });

            function openAndSend() {
                xhr.open('GET', 'config');
                xhr.send();
            }

            function retry() {
                setTimeout(openAndSend, 1000);
            }

            const resolveStaticConfig = resolve => {
                if (!globalThis.RuntimeCapabilities?.staticConfig) {
                    retry();
                    return;
                }

                const finish = targetManifest => {
                    const config = globalThis.RuntimeCapabilities.staticConfig(targetManifest);
                    console.log("Static config loaded:", config);
                    this._config = config;
                    Events.fire('config', config);
                    resolve();
                };

                if (globalThis.__meshdropTargetManifest) {
                    finish(globalThis.__meshdropTargetManifest);
                    return;
                }

                const manifestUrls = location.protocol === "file:"
                    ? ["../meshdrop-target.json", "/meshdrop-target.json"]
                    : ["/meshdrop-target.json"];
                const loadManifest = index => {
                    if (index >= manifestUrls.length) {
                        finish(null);
                        return;
                    }

                    const manifestXhr = new XMLHttpRequest();
                    manifestXhr.addEventListener("load", () => {
                        const loaded = manifestXhr.status === 200
                            || (location.protocol === "file:" && manifestXhr.status === 0 && manifestXhr.responseText);
                        if (!loaded) {
                            loadManifest(index + 1);
                            return;
                        }

                        try {
                            finish(JSON.parse(manifestXhr.responseText));
                        } catch {
                            loadManifest(index + 1);
                        }
                    });
                    manifestXhr.addEventListener("error", () => loadManifest(index + 1));
                    manifestXhr.open('GET', manifestUrls[index]);
                    manifestXhr.send();
                };

                loadManifest(0);
            };

            openAndSend(xhr);
        })
    }

    _setWsConfig(wsConfig) {
        this._wsConfig = wsConfig;
        Events.fire('ws-config', wsConfig);
    }

    _connect() {
        clearTimeout(this._reconnectTimer);
        if (!this._config) return;
        if (this._isConnected() || this._isConnecting() || this._isOffline()) return;
        if (globalThis.RuntimeCapabilities?.hasBackend?.(this._config) === false) {
            this._setWsConfig(this._config.wsConfig || {
                rtcConfig: globalThis.RuntimeCapabilities.staticRtcConfig,
                wsFallback: false
            });
            return;
        }
        this._serverIdentityKey = ServerConnectionIdentityProtocol.storedKey();
        if (this._isReconnect) {
            Events.fire('notify-user', {
                message: Localization.getTranslation("notifications.connecting"),
                persistent: true
            });
        }
        const ws = new WebSocket(this._endpoint());
        ws.binaryType = 'arraybuffer';
        ws.onopen = _ => this._onOpen();
        ws.onmessage = e => this._onMessage(e.data);
        ws.onclose = _ => this._onDisconnect();
        ws.onerror = e => this._onError(e);
        this._socket = ws;
    }

    _onOpen() {
        console.log('WS: server connected');
        Events.fire('ws-connected');
        if (this._isReconnect) Events.fire('notify-user', Localization.getTranslation("notifications.connected"));
    }

    _onPairDeviceInitiate() {
        if (!this._isConnected()) {
            Events.fire('notify-user', Localization.getTranslation("notifications.online-requirement-pairing"));
            return;
        }
        this.send({ type: 'pair-device-initiate' });
    }

    _onPairDeviceJoin(pairKey) {
        if (!this._isConnected()) {
            setTimeout(() => this._onPairDeviceJoin(pairKey), 1000);
            return;
        }
        this.send({ type: 'pair-device-join', pairKey: pairKey });
    }

    _onCreatePublicRoom() {
        if (!this._isConnected()) {
            Events.fire('notify-user', Localization.getTranslation("notifications.online-requirement-public-room"));
            return;
        }
        this.send({ type: 'create-public-room' });
    }

    _onJoinPublicRoom(roomId, createIfInvalid) {
        if (!this._isConnected()) {
            setTimeout(() => this._onJoinPublicRoom(roomId), 1000);
            return;
        }
        this.send({ type: 'join-public-room', publicRoomId: roomId, createIfInvalid: createIfInvalid });
    }

    _onLeavePublicRoom() {
        if (!this._isConnected()) {
            setTimeout(() => this._onLeavePublicRoom(), 1000);
            return;
        }
        this.send({ type: 'leave-public-room' });
    }

    _onMessage(msg) {
        msg = JSON.parse(msg);
        if (msg.type !== 'ping') console.log('WS receive:', msg);
        switch (msg.type) {
            case 'ws-config':
                this._setWsConfig(msg.wsConfig);
                break;
            case 'peers':
                this._onPeers(msg);
                break;
            case 'peer-joined':
                Events.fire('peer-joined', msg);
                break;
            case 'peer-left':
                Events.fire('peer-left', msg);
                break;
            case 'signal':
                Events.fire('signal', msg);
                break;
            case 'ping':
                this.send({ type: 'pong' });
                break;
            case 'display-name':
                this._onDisplayName(msg);
                break;
            case 'pair-device-initiated':
                Events.fire('pair-device-initiated', msg);
                break;
            case 'pair-device-joined':
                Events.fire('pair-device-joined', msg);
                break;
            case 'pair-device-join-key-invalid':
                Events.fire('pair-device-join-key-invalid');
                break;
            case 'pair-device-canceled':
                Events.fire('pair-device-canceled', msg.pairKey);
                break;
            case 'join-key-rate-limit':
                Events.fire('notify-user', Localization.getTranslation("notifications.rate-limit-join-key"));
                break;
            case 'secret-room-deleted':
                Events.fire('secret-room-deleted', msg.roomSecret);
                break;
            case 'room-secret-regenerated':
                Events.fire('room-secret-regenerated', msg);
                break;
            case 'public-room-id-invalid':
                Events.fire('public-room-id-invalid', msg.publicRoomId);
                break;
            case 'public-room-created':
                Events.fire('public-room-created', msg.roomId);
                break;
            case 'public-room-left':
                Events.fire('public-room-left');
                break;
            case 'fips-status':
                Events.fire('fips-status', msg.status);
                break;
            case 'pollen-status':
                Events.fire('pollen-status', msg.status);
                break;
            case 'request':
            case 'blossom-request':
            case 'hashtree-request':
            case 'pollen-request':
            case 'header':
            case 'partition':
            case 'partition-received':
            case 'progress':
            case 'files-transfer-response':
            case 'file-transfer-complete':
            case 'message-transfer-complete':
            case 'text':
            case 'display-name-changed':
            case 'ws-chunk':
                // ws-fallback
                if (this._wsConfig.wsFallback) {
                    Events.fire('ws-relay', JSON.stringify(msg));
                }
                else {
                    console.log("WS receive: message type is for websocket fallback only but websocket fallback is not activated on this instance.")
                }
                break;
            default:
                console.error('WS receive: unknown message type', msg);
        }
    }

    send(msg) {
        if (!this._isConnected()) return;
        if (msg.type !== 'pong') console.log("WS send:", msg)
        this._socket.send(JSON.stringify(msg));
    }

    _onPeers(msg) {
        Events.fire('peers', msg);
    }

    _onDisplayName(msg) {
        // Add peerId and peerIdHash to sessionStorage to authenticate as the same device on page reload
        sessionStorage.setItem('peer_id', msg.peerId);
        sessionStorage.setItem('peer_id_hash', msg.peerIdHash);

        // Add peerId to localStorage to mark it for other PairDrop tabs on the same browser
        BrowserTabsConnector
            .addPeerIdToLocalStorage()
            .then(peerId => {
                if (!peerId) return;
                console.log("successfully added peerId to localStorage");

                // Only now join rooms
                if (globalThis.meshdropLocalDiscovery?.join) {
                    globalThis.meshdropLocalDiscovery.join();
                }
                else if (globalThis.meshdropLocalDiscovery?.isEnabled?.() !== false) {
                    Events.fire('join-ip-room');
                }
                PersistentStorage.getAllRoomSecrets()
                    .then(roomSecrets => {
                        Events.fire('room-secrets', roomSecrets);
                    });
            });

        Events.fire('display-name', msg);
    }

    _endpoint() {
        const protocol = location.protocol.startsWith('https') ? 'wss' : 'ws';
        // Check whether the instance specifies another signaling server otherwise use the current instance for signaling
        let wsServerDomain = this._config.signalingServer
            ? this._config.signalingServer
            : location.host + location.pathname;

        let wsUrl = new URL(protocol + '://' + wsServerDomain + 'server');

        wsUrl.searchParams.append('webrtc_supported', window.isRtcSupported ? 'true' : 'false');

        const peerId = sessionStorage.getItem('peer_id');
        const peerIdHash = sessionStorage.getItem('peer_id_hash');
        if (peerId && peerIdHash) {
            wsUrl.searchParams.append('peer_id', peerId);
            wsUrl.searchParams.append('peer_id_hash', peerIdHash);
        }

        const nostrIdentity = ServerConnectionIdentityProtocol.storedServerIdentity();
        if (nostrIdentity) {
            wsUrl.searchParams.append('nostr_identity', JSON.stringify(nostrIdentity));
        }

        return wsUrl.toString();
    }

    _disconnect() {
        this.send({ type: 'disconnect' });

        const peerId = sessionStorage.getItem('peer_id');
        BrowserTabsConnector
            .removePeerIdFromLocalStorage(peerId)
            .then(_ => {
                console.log("successfully removed peerId from localStorage");
            });

        if (!this._socket) return;

        this._socket.onclose = null;
        this._socket.close();
        this._socket = null;
        Events.fire('ws-disconnected');
        this._isReconnect = true;
    }

    _onDisconnect() {
        console.log('WS: server disconnected');
        setTimeout(() => {
            this._isReconnect = true;
            Events.fire('ws-disconnected');
            this._reconnectTimer = setTimeout(() => this._connect(), 1000);
        }, 100); //delay for 100ms to prevent flickering on page reload
    }

    _onVisibilityChange() {
        if (window.hiddenProperty) return;
        this._connect();
    }

    _isConnected() {
        return this._socket && this._socket.readyState === this._socket.OPEN;
    }

    _isConnecting() {
        return this._socket && this._socket.readyState === this._socket.CONNECTING;
    }

    _isOffline() {
        return !navigator.onLine;
    }

    _onError(e) {
        console.error(e);
    }

    _reconnect() {
        if (!this._config) return;
        this._disconnect();
        this._connect();
    }
}

class Peer {

    constructor(serverConnection, isCaller, peerId, roomType, roomId) {
        this._server = serverConnection;
        this._isCaller = isCaller;
        this._peerId = peerId;

        this._roomIds = {};
        this._updateRoomIds(roomType, roomId);

        this._filesQueue = [];
        this._busy = false;

        // evaluate auto accept
        this._evaluateAutoAccept();
    }

    sendJSON(message) {
        this._send(JSON.stringify(message));
    }

    // Is overwritten in expanding classes
    _send(_message) {}

    sendDisplayName(displayName) {
        this.sendJSON({type: 'display-name-changed', displayName: displayName});
    }

    _isSameBrowser() {
        return BrowserTabsConnector.peerIsSameBrowser(this._peerId);
    }

    _isPaired() {
        return !!this._roomIds['secret'];
    }

    _getPairSecret() {
        return this._roomIds['secret'];
    }

    _regenerationOfPairSecretNeeded() {
        return this._getPairSecret() && this._getPairSecret().length !== 256
    }

    _getRoomTypes() {
        return Object.keys(this._roomIds);
    }

    _updateRoomIds(roomType, roomId) {
        const roomTypeIsSecret = roomType === "secret";
        const roomIdIsNotPairSecret = this._getPairSecret() !== roomId;

        // if peer is another browser tab, peer is not identifiable with roomSecret as browser tabs share all roomSecrets
        // -> do not delete duplicates and do not regenerate room secrets
        if (!this._isSameBrowser()
            && roomTypeIsSecret
            && this._isPaired()
            && roomIdIsNotPairSecret) {
            // multiple roomSecrets with same peer -> delete old roomSecret
            PersistentStorage
                .deleteRoomSecret(this._getPairSecret())
                .then(deletedRoomSecret => {
                    if (deletedRoomSecret) console.log("Successfully deleted duplicate room secret with same peer: ", deletedRoomSecret);
                });
        }

        this._roomIds[roomType] = roomId;

        if (!this._isSameBrowser()
            &&  roomTypeIsSecret
            &&  this._isPaired()
            &&  this._regenerationOfPairSecretNeeded()
            &&  this._isCaller) {
            // increase security by initiating the increase of the roomSecret length
            // from 64 chars (<v1.7.0) to 256 chars (v1.7.0+)
            console.log('RoomSecret is regenerated to increase security')
            Events.fire('regenerate-room-secret', this._getPairSecret());
        }
    }

    _removeRoomType(roomType) {
        delete this._roomIds[roomType];

        Events.fire('room-type-removed', {
            peerId: this._peerId,
            roomType: roomType
        });
    }

    _evaluateAutoAccept() {
        if (!this._isPaired()) {
            this._setAutoAccept(false);
            return;
        }

        PersistentStorage
            .getRoomSecretEntry(this._getPairSecret())
            .then(roomSecretEntry => {
                const autoAccept = roomSecretEntry
                    ? roomSecretEntry.entry.auto_accept
                    : false;
                this._setAutoAccept(autoAccept);
            })
            .catch(_ => {
                this._setAutoAccept(false);
            });
    }

    _setAutoAccept(autoAccept) {
        this._autoAccept = !this._isSameBrowser()
            ? autoAccept
            : false;
    }

    async requestFileTransfer(files, transfer = null) {
        if (!this._allowsNostrPeer()) return;

        const selectedTransfer = transfer || this._defaultTransferSelection();

        if (selectedTransfer?.id === "hashtree") {
            return this.requestHashtreeFileTransfer(files, selectedTransfer);
        }

        if (selectedTransfer?.id === "blossom") {
            return this.requestBlossomFileTransfer(files, selectedTransfer);
        }

        if (selectedTransfer?.id === "pollen") {
            return this.requestPollenFileTransfer(files, selectedTransfer);
        }

        try {
            const request = await this._createFileTransferRequest(files, selectedTransfer);
            const payload = await this._prepareTransferPayload(files, request.header, selectedTransfer);
            this._filesRequested = payload.files.map((file, index) => ({
                file,
                header: payload.payloadHeaders?.[index] || null,
                index
            }));
            this._selectedTransfer = selectedTransfer;

            this.sendJSON({
                type: 'request',
                ...request,
                ...payload.requestFields
            });
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'wait', transport: selectedTransfer})
        } catch (error) {
            console.error(error);
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            Events.fire('notify-user', error.message);
        }
    }

    _defaultTransferSelection() {
        if (globalThis.meshdropHashtreeTransfer?.isActive()) {
            return {id: "hashtree", type: "storage", label: "Hashtree"};
        }

        if (globalThis.meshdropBlossomTransfer?.isActive()) {
            return {id: "blossom", type: "storage", label: "Blossom"};
        }

        if (globalThis.meshdropPollenTransfer?.isActive()) {
            return {id: "pollen", type: "storage", label: "Pollen"};
        }

        return {id: "direct", type: "direct", label: "Direct"};
    }

    async requestBlossomFileTransfer(files, transfer = {id: "blossom", type: "storage", label: "Blossom"}) {
        try {
            const request = await this._createFileTransferRequest(files, transfer);
            const contentKey = await BlossomTransferProtocol.generateContentKey();
            const keyDelivery = await this._createBlossomKeyDelivery(contentKey);
            const {blossomDescriptors, blossomEncryption} = await globalThis.meshdropBlossomTransfer.uploadEncryptedFiles(
                files,
                request.header,
                contentKey,
                progress => {
                Events.fire('set-progress', {peerId: this._peerId, progress: 0.8 + 0.2 * progress, status: 'prepare', transport: transfer});
                }
            );

            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'prepare', transport: transfer});
            this.sendJSON({
                type: 'blossom-request',
                ...request,
                blossomDescriptors,
                blossomEncryption: {
                    ...blossomEncryption,
                    keyDelivery
                }
            });
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'wait', transport: transfer})
        }
        catch (error) {
            console.error(error);
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            Events.fire(
                'notify-user',
                `${Localization.getTranslation("notifications.blossom-transfer-upload-failed")}: ${error.message}`
            );
        }
    }

    _isBlossomKeyDeliveryChannelTrusted() {
        return false;
    }

    _isNostrPubkey(value) {
        return /^[0-9a-f]{64}$/i.test(value || "");
    }

    async _createBlossomKeyDelivery(contentKey) {
        const key = BlossomTransferProtocol.bytesToBase64Url(await BlossomTransferProtocol.exportContentKey(contentKey));
        const keyEnvelope = {
            version: BlossomTransferProtocol.keyEnvelopeVersion,
            algorithm: BlossomTransferProtocol.contentAlgorithm,
            key
        };

        if (this._isBlossomKeyDeliveryChannelTrusted()) {
            return {
                type: "rtc-data-channel",
                version: keyEnvelope.version,
                algorithm: keyEnvelope.algorithm,
                key
            };
        }

        const identityController = globalThis.meshdropNostrIdentity;
        const senderIdentity = identityController?.getIdentity?.();
        if (senderIdentity?.pubkey && this._isNostrPubkey(this._peerId) && identityController.canNip44?.()) {
            return {
                type: "nip44",
                version: keyEnvelope.version,
                algorithm: keyEnvelope.algorithm,
                senderPubkey: senderIdentity.pubkey,
                recipientPubkey: this._peerId,
                ciphertext: await identityController.encryptNip44To(this._peerId, JSON.stringify(keyEnvelope))
            };
        }

        throw new Error("Encrypted Blossom key delivery requires WebRTC data channel or NIP-44 signer support");
    }

    async _prepareTransferPayload(files, headers, transfer = null) {
        const privacyMode = TransferPrivacyProtocol.fromTransfer(transfer);
        if (privacyMode !== "private") {
            return {
                files,
                payloadHeaders: null,
                requestFields: {
                    payloadPrivacy: {mode: "unencrypted"}
                }
            };
        }

        if (!globalThis.BlossomTransferProtocol) {
            throw new Error("Private transfer encryption is unavailable");
        }

        const contentKey = await BlossomTransferProtocol.generateContentKey();
        const keyDelivery = await this._createBlossomKeyDelivery(contentKey);
        const transferId = BlossomTransferProtocol.createTransferId();
        const encryptedFiles = [];
        const payloadHeaders = [];
        const fileEnvelopes = [];

        for (let i = 0; i < files.length; i++) {
            const encrypted = await BlossomTransferProtocol.encryptFile(files[i], contentKey, {
                transferId,
                index: i,
                header: headers[i]
            });
            const encryptedFile = new File([encrypted.blob], headers[i].name, {
                type: "application/octet-stream"
            });
            encryptedFiles.push(encryptedFile);
            payloadHeaders.push({
                name: headers[i].name,
                mime: "application/octet-stream",
                size: encryptedFile.size,
                index: i
            });
            fileEnvelopes.push(encrypted.envelope);
        }

        return {
            files: encryptedFiles,
            payloadHeaders,
            requestFields: {
                payloadPrivacy: {mode: "private"},
                payloadHeaders,
                payloadEncryption: {
                    version: BlossomTransferProtocol.encryptionVersion,
                    algorithm: BlossomTransferProtocol.contentAlgorithm,
                    transferId,
                    files: fileEnvelopes,
                    keyDelivery
                }
            }
        };
    }

    async _unwrapBlossomTransferKey(envelope) {
        const keyDelivery = envelope?.keyDelivery;
        if (!keyDelivery) throw new Error("Blossom key delivery envelope is missing");

        if (keyDelivery.type === "rtc-data-channel") {
            if (!this._isBlossomKeyDeliveryChannelTrusted()) {
                throw new Error("Refusing raw Blossom key delivery on an untrusted channel");
            }
            return BlossomTransferProtocol.importContentKeyForDecrypt(BlossomTransferProtocol.base64UrlToBytes(keyDelivery.key));
        }

        if (keyDelivery.type === "nip44") {
            const identityController = globalThis.meshdropNostrIdentity;
            const identity = identityController?.getIdentity?.();
            if (!identity?.pubkey || identity.pubkey !== keyDelivery.recipientPubkey) {
                throw new Error("Blossom NIP-44 key delivery recipient mismatch");
            }
            if (!identityController.canNip44?.()) {
                throw new Error("Blossom NIP-44 key delivery requires signer support");
            }

            const plaintext = await identityController.decryptNip44From(keyDelivery.senderPubkey, keyDelivery.ciphertext);
            const keyEnvelope = JSON.parse(plaintext);
            if (keyEnvelope.version !== BlossomTransferProtocol.keyEnvelopeVersion) {
                throw new Error("Unsupported Blossom key envelope version");
            }
            if (keyEnvelope.algorithm !== BlossomTransferProtocol.contentAlgorithm) {
                throw new Error("Unsupported Blossom key algorithm");
            }
            return BlossomTransferProtocol.importContentKeyForDecrypt(BlossomTransferProtocol.base64UrlToBytes(keyEnvelope.key));
        }

        throw new Error("Unsupported Blossom key delivery type");
    }

    async requestHashtreeFileTransfer(files, transfer = {id: "hashtree", type: "storage", label: "Hashtree"}) {
        try {
            const request = await this._createFileTransferRequest(files, transfer);
            const payload = await this._prepareTransferPayload(files, request.header, transfer);
            const hashtreeManifest = await globalThis.meshdropHashtreeTransfer.uploadFiles(payload.files, progress => {
                Events.fire('set-progress', {peerId: this._peerId, progress: 0.8 + 0.2 * progress, status: 'prepare', transport: transfer});
            });

            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'prepare', transport: transfer});
            this.sendJSON({
                type: 'hashtree-request',
                ...request,
                ...payload.requestFields,
                hashtreeManifest
            });
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'wait', transport: transfer})
        }
        catch (error) {
            console.error(error);
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            Events.fire('notify-user', Localization.getTranslation("notifications.hashtree-transfer-upload-failed"));
        }
    }

    async requestPollenFileTransfer(files, transfer = {id: "pollen", type: "storage", label: "Pollen"}) {
        try {
            const request = await this._createFileTransferRequest(files, transfer);
            const payload = await this._prepareTransferPayload(files, request.header, transfer);
            const pollenDescriptors = await globalThis.meshdropPollenTransfer.uploadFiles(payload.files, progress => {
                Events.fire('set-progress', {peerId: this._peerId, progress: 0.8 + 0.2 * progress, status: 'prepare', transport: transfer});
            });

            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'prepare', transport: transfer});
            this.sendJSON({
                type: 'pollen-request',
                ...request,
                ...payload.requestFields,
                pollenDescriptors
            });
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'wait', transport: transfer})
        }
        catch (error) {
            console.error(error);
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            Events.fire(
                'notify-user',
                `${Localization.getTranslation("notifications.pollen-transfer-upload-failed")}: ${error.message}`
            );
        }
    }

    async _createFileTransferRequest(files, transfer = null) {
        let header = [];
        let totalSize = 0;
        let imagesOnly = true
        for (let i=0; i<files.length; i++) {
            Events.fire('set-progress', {peerId: this._peerId, progress: 0.8*i/files.length, status: 'prepare', transport: transfer})
            header.push({
                name: files[i].name,
                mime: files[i].type,
                size: files[i].size
            });
            totalSize += files[i].size;
            if (files[i].type.split('/')[0] !== 'image') imagesOnly = false;
        }

        Events.fire('set-progress', {peerId: this._peerId, progress: 0.8, status: 'prepare', transport: transfer})

        let dataUrl = '';
        if (files[0].type.split('/')[0] === 'image') {
            try {
                dataUrl = await getThumbnailAsDataUrl(files[0], 400, null, 0.9);
            } catch (e) {
                console.error(e);
            }
        }

        Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'prepare', transport: transfer})

        return {
            header: header,
            totalSize: totalSize,
            imagesOnly: imagesOnly,
            thumbnailDataUrl: dataUrl,
            transport: transfer
        };
    }

    async sendFiles() {
        if (!this._allowsNostrPeer()) return;

        for (let i=0; i<this._filesRequested.length; i++) {
            this._filesQueue.push(this._filesRequested[i]);
        }
        this._filesRequested = null
        if (this._busy) return;
        this._dequeueFile();
    }

    _dequeueFile() {
        this._busy = true;
        const file = this._filesQueue.shift();
        this._sendFile(file);
    }

    async _sendFile(file) {
        const entry = file?.file ? file : {file, header: null, index: 0};
        const fileToSend = entry.file;
        const header = entry.header || {
            size: fileToSend.size,
            name: fileToSend.name,
            mime: fileToSend.type,
            index: entry.index
        };
        this.sendJSON({
            type: 'header',
            size: header.size,
            name: header.name,
            mime: header.mime,
            index: header.index ?? entry.index
        });
        this._chunker = new FileChunker(fileToSend,
            chunk => this._send(chunk),
            offset => this._onPartitionEnd(offset));
        this._chunker.nextPartition();
    }

    _onPartitionEnd(offset) {
        this.sendJSON({ type: 'partition', offset: offset });
    }

    _onReceivedPartitionEnd(offset) {
        this.sendJSON({ type: 'partition-received', offset: offset });
    }

    _sendNextPartition() {
        if (!this._chunker || this._chunker.isFileEnd()) return;
        this._chunker.nextPartition();
    }

    _sendProgress(progress) {
        this.sendJSON({ type: 'progress', progress: progress });
    }

    _onMessage(message) {
        if (!this._allowsNostrPeerMessage(message)) return;

        if (typeof message !== 'string') {
            this._onChunkReceived(message);
            return;
        }
        const messageJSON = JSON.parse(message);
        switch (messageJSON.type) {
            case 'request':
                this._onFilesTransferRequest(messageJSON);
                break;
            case 'blossom-request':
                this._onBlossomFilesTransferRequest(messageJSON);
                break;
            case 'hashtree-request':
                this._onHashtreeFilesTransferRequest(messageJSON);
                break;
            case 'pollen-request':
                this._onPollenFilesTransferRequest(messageJSON);
                break;
            case 'header':
                this._onFileHeader(messageJSON);
                break;
            case 'partition':
                this._onReceivedPartitionEnd(messageJSON);
                break;
            case 'partition-received':
                this._sendNextPartition();
                break;
            case 'progress':
                this._onDownloadProgress(messageJSON.progress);
                break;
            case 'files-transfer-response':
                this._onFileTransferRequestResponded(messageJSON);
                break;
            case 'file-transfer-complete':
                this._onFileTransferCompleted();
                break;
            case 'message-transfer-complete':
                this._onMessageTransferCompleted();
                break;
            case 'text':
                this._onTextReceived(messageJSON);
                break;
            case 'display-name-changed':
                this._onDisplayNameChanged(messageJSON);
                break;
        }
    }

    _onFilesTransferRequest(request) {
        if (!this._allowsFileTransferRequest()) {
            this.sendJSON({type: 'files-transfer-response', accepted: false, reason: 'not-followed'});
            return;
        }
        if (this._requestPending) {
            // Only accept one request at a time per peer
            this.sendJSON({type: 'files-transfer-response', accepted: false});
            return;
        }
        if (window.iOS && request.totalSize >= 200*1024*1024) {
            // iOS Safari can only put 400MB at once to memory.
            // Request to send them in chunks of 200MB instead:
            this.sendJSON({type: 'files-transfer-response', accepted: false, reason: 'ios-memory-limit'});
            return;
        }

        this._requestPending = request;

        if (this._autoAccept) {
            // auto accept if set via Edit Paired Devices Dialog
            this._respondToFileTransferRequest(true);
            return;
        }

        // default behavior: show user transfer request
        Events.fire('files-transfer-request', {
            request: request,
            peerId: this._peerId
        });
    }

    _allowsFileTransferRequest() {
        return this._allowsNostrPeer();
    }

    _allowsNostrPeer() {
        if (!this._roomIds.nostr) return true;

        const identity = globalThis.meshdropNostrIdentity?.getIdentity?.();
        return globalThis.NostrFollowPolicy?.allowsPubkey(this._peerId, identity) !== false;
    }

    _allowsNostrPeerMessage(message) {
        if (this._allowsNostrPeer()) return true;

        if (typeof message !== "string") return false;

        try {
            const parsed = JSON.parse(message);
            if (["request", "blossom-request", "hashtree-request", "pollen-request"].includes(parsed.type)) {
                this.sendJSON({type: 'files-transfer-response', accepted: false, reason: 'not-followed'});
            }
        } catch {
            return false;
        }

        return false;
    }

    _onBlossomFilesTransferRequest(request) {
        if (!request.blossomEncryption?.version) {
            this.sendJSON({type: 'files-transfer-response', accepted: false, reason: 'blossom-encryption-required'});
            Events.fire('notify-user', Localization.getTranslation("notifications.blossom-transfer-encryption-required"));
            return;
        }

        request.blossom = true;
        this._onFilesTransferRequest(request);
    }

    _onHashtreeFilesTransferRequest(request) {
        request.hashtree = true;
        this._onFilesTransferRequest(request);
    }

    _onPollenFilesTransferRequest(request) {
        request.pollen = true;
        this._onFilesTransferRequest(request);
    }

    _respondToFileTransferRequest(accepted) {
        const pendingRequest = this._requestPending;

        this.sendJSON({
            type: 'files-transfer-response',
            accepted: accepted,
            blossom: !!pendingRequest?.blossom,
            hashtree: !!pendingRequest?.hashtree,
            pollen: !!pendingRequest?.pollen
        });
        if (accepted) {
            this._requestAccepted = pendingRequest;
            this._totalBytesReceived = 0;
            this._receivedFileIndex = 0;
            this._busy = true;
            this._filesReceived = [];
        }
        this._requestPending = null;

        if (accepted && pendingRequest?.blossom) {
            this._downloadBlossomFiles(pendingRequest);
        }

        if (accepted && pendingRequest?.hashtree) {
            this._downloadHashtreeFiles(pendingRequest);
        }

        if (accepted && pendingRequest?.pollen) {
            this._downloadPollenFiles(pendingRequest);
        }
    }

    _onFileHeader(header) {
        if (this._requestAccepted && this._requestAccepted.header.length) {
            const headerIndex = Number.isSafeInteger(Number(header.index))
                ? Number(header.index)
                : this._receivedFileIndex || 0;
            this._activeReceiveHeaderIndex = headerIndex;
            const expectedHeader = this._requestAccepted.payloadHeaders?.[headerIndex] || header;
            const expectedTotalSize = this._requestAccepted.payloadHeaders
                ? this._requestAccepted.payloadHeaders.reduce((total, payloadHeader) => total + payloadHeader.size, 0)
                : this._requestAccepted.totalSize;
            this._lastProgress = 0;
            this._digester = new FileDigester({size: expectedHeader.size, name: expectedHeader.name, mime: expectedHeader.mime},
                expectedTotalSize,
                this._totalBytesReceived,
                fileBlob => this._onFileReceived(fileBlob)
            );
        }
    }

    _abortTransfer() {
        Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
        Events.fire('notify-user', Localization.getTranslation("notifications.files-incorrect"));
        this._filesReceived = [];
        this._requestAccepted = null;
        this._digester = null;
        throw new Error("Received files differ from requested files. Abort!");
    }

    _onChunkReceived(chunk) {
        if(!this._digester || !(chunk.byteLength || chunk.size)) return;

        this._digester.unchunk(chunk);
        const progress = this._digester.progress;

        if (progress > 1) {
            this._abortTransfer();
        }

        this._onDownloadProgress(progress);

        // occasionally notify sender about our progress
        if (progress - this._lastProgress < 0.005 && progress !== 1) return;
        this._lastProgress = progress;
        this._sendProgress(progress);
    }

    _onDownloadProgress(progress) {
        Events.fire('set-progress', {peerId: this._peerId, progress: progress, status: 'transfer'});
    }

    async _onFileReceived(fileBlob) {
        const request = this._requestAccepted;
        const fileIndex = this._activeReceiveHeaderIndex ?? 0;
        request._originalHeaderSnapshot ||= [...request.header];
        const acceptedHeader = request.header.shift();
        const receivedFile = request.payloadEncryption
            ? await this._decryptPayloadFile(fileBlob, request, fileIndex, acceptedHeader)
            : fileBlob;
        this._totalBytesReceived += fileBlob.size;
        this._receivedFileIndex = fileIndex + 1;
        this._activeReceiveHeaderIndex = null;

        this.sendJSON({type: 'file-transfer-complete'});

        const sameSize = receivedFile.size === acceptedHeader.size;
        const sameName = receivedFile.name === acceptedHeader.name
        if (!sameSize || !sameName) {
            this._abortTransfer();
        }

        // include for compatibility with 'Snapdrop & PairDrop for Android' app
        Events.fire('file-received', receivedFile);

        this._filesReceived.push(receivedFile);
        if (!request.header.length) {
            this._busy = false;
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'process'});
            Events.fire('files-received', {
                peerId: this._peerId,
                files: this._filesReceived,
                imagesOnly: request.imagesOnly,
                totalSize: request.totalSize
            });
            this._filesReceived = [];
            this._requestAccepted = null;
        }
    }

    async _decryptPayloadFile(fileBlob, request, index, header) {
        const payloadEncryption = BlossomTransferProtocol.validateEncryptionEnvelope(
            request.payloadEncryption,
            request._originalHeaderSnapshot || request.header
        );
        const contentKey = request._payloadContentKey
            || await this._unwrapBlossomTransferKey(payloadEncryption);
        request._payloadContentKey = contentKey;

        return BlossomTransferProtocol.decryptFile(fileBlob, contentKey, {
            transferId: payloadEncryption.transferId,
            index,
            header,
            fileEnvelope: payloadEncryption.files.find(fileEnvelope => fileEnvelope.index === index)
        });
    }

    async _decryptPayloadFiles(files, request) {
        if (!request.payloadEncryption) return files;

        request._originalHeaderSnapshot ||= [...request.header];
        const decrypted = [];
        for (let i = 0; i < files.length; i++) {
            decrypted.push(await this._decryptPayloadFile(files[i], request, i, request.header[i]));
        }
        return decrypted;
    }

    async _downloadBlossomFiles(request) {
        try {
            const blossomEncryption = BlossomTransferProtocol.validateEncryptionEnvelope(
                request.blossomEncryption,
                request.header
            );
            const contentKey = await this._unwrapBlossomTransferKey(blossomEncryption);

            for (let i = 0; i < request.blossomDescriptors.length; i++) {
                const file = await globalThis.meshdropBlossomTransfer.downloadDescriptor(
                    request.blossomDescriptors[i],
                    request.header[i],
                    {
                        envelope: blossomEncryption,
                        contentKey,
                        index: i
                    }
                );

                this._totalBytesReceived += file.size;
                this._onDownloadProgress(this._totalBytesReceived / request.totalSize);
                Events.fire('file-received', file);
                this._filesReceived.push(file);
            }

            this._busy = false;
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'process'});
            Events.fire('files-received', {
                peerId: this._peerId,
                files: this._filesReceived,
                imagesOnly: request.imagesOnly,
                totalSize: request.totalSize
            });
            this._filesReceived = [];
            this._requestAccepted = null;
            this.sendJSON({type: 'file-transfer-complete'});
        }
        catch (error) {
            console.error(error);
            Events.fire(
                'notify-user',
                `${Localization.getTranslation("notifications.blossom-transfer-download-failed")}: ${error.message}`
            );
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            this._busy = false;
            this._filesReceived = [];
            this._requestAccepted = null;
        }
    }

    async _downloadHashtreeFiles(request) {
        try {
            const downloadedFiles = await globalThis.meshdropHashtreeTransfer.downloadFiles(
                request.hashtreeManifest,
                request.payloadHeaders || request.header,
                progress => this._onDownloadProgress(progress)
            );
            const files = await this._decryptPayloadFiles(downloadedFiles, request);

            this._filesReceived = files;
            files.forEach(file => Events.fire('file-received', file));

            this._busy = false;
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'process'});
            Events.fire('files-received', {
                peerId: this._peerId,
                files: this._filesReceived,
                imagesOnly: request.imagesOnly,
                totalSize: request.totalSize
            });
            this._filesReceived = [];
            this._requestAccepted = null;
            this.sendJSON({type: 'file-transfer-complete'});
        }
        catch (error) {
            console.error(error);
            Events.fire('notify-user', Localization.getTranslation("notifications.hashtree-transfer-download-failed"));
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            this._busy = false;
            this._filesReceived = [];
            this._requestAccepted = null;
        }
    }

    async _downloadPollenFiles(request) {
        try {
            const downloadedFiles = [];
            const expectedTotalSize = request.payloadHeaders
                ? request.payloadHeaders.reduce((total, payloadHeader) => total + payloadHeader.size, 0)
                : request.totalSize;
            for (let i = 0; i < request.pollenDescriptors.length; i++) {
                const file = await globalThis.meshdropPollenTransfer.downloadDescriptor(
                    request.pollenDescriptors[i],
                    request.payloadHeaders?.[i] || request.header[i]
                );

                this._totalBytesReceived += file.size;
                this._onDownloadProgress(this._totalBytesReceived / expectedTotalSize);
                downloadedFiles.push(file);
            }
            const files = await this._decryptPayloadFiles(downloadedFiles, request);

            this._filesReceived = files;
            files.forEach(file => Events.fire('file-received', file));
            this._busy = false;
            Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'process'});
            Events.fire('files-received', {
                peerId: this._peerId,
                files: this._filesReceived,
                imagesOnly: request.imagesOnly,
                totalSize: request.totalSize
            });
            this._filesReceived = [];
            this._requestAccepted = null;
            this.sendJSON({type: 'file-transfer-complete'});
        }
        catch (error) {
            console.error(error);
            Events.fire(
                'notify-user',
                `${Localization.getTranslation("notifications.pollen-transfer-download-failed")}: ${error.message}`
            );
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            this._busy = false;
            this._filesReceived = [];
            this._requestAccepted = null;
        }
    }

    _onFileTransferCompleted() {
        this._chunker = null;
        if (!this._filesQueue.length) {
            this._busy = false;
            this._selectedTransfer = null;
            Events.fire('notify-user', Localization.getTranslation("notifications.file-transfer-completed"));
            Events.fire('files-sent'); // used by 'Snapdrop & PairDrop for Android' app
        }
        else {
            this._dequeueFile();
        }
    }

    _onFileTransferRequestResponded(message) {
        if (!message.accepted) {
            Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
            this._filesRequested = null;
            this._selectedTransfer = null;
            if (message.reason === 'ios-memory-limit') {
                Events.fire('notify-user', Localization.getTranslation("notifications.ios-memory-limit"));
            }
            else if (message.reason === 'blossom-encryption-required') {
                Events.fire('notify-user', Localization.getTranslation("notifications.blossom-transfer-encryption-required"));
            }
            return;
        }
        Events.fire('file-transfer-accepted');
        Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'transfer', transport: this._selectedTransfer});
        if (message.blossom || message.hashtree || message.pollen) {
            return;
        }
        this.sendFiles();
    }

    _onMessageTransferCompleted() {
        Events.fire('notify-user', Localization.getTranslation("notifications.message-transfer-completed"));
    }

    sendText(text) {
        if (!this._allowsNostrPeer()) return;

        const unescaped = btoa(unescape(encodeURIComponent(text)));
        this.sendJSON({ type: 'text', text: unescaped });
    }

    _onTextReceived(message) {
        if (!message.text) return;
        const escaped = decodeURIComponent(escape(atob(message.text)));
        Events.fire('text-received', { text: escaped, peerId: this._peerId });
        this.sendJSON({ type: 'message-transfer-complete' });
    }

    _onDisplayNameChanged(message) {
        const displayNameHasChanged = this._displayName !== message.displayName

        if (message.displayName && displayNameHasChanged) {
            this._displayName = message.displayName;
        }

        Events.fire('peer-display-name-changed', {peerId: this._peerId, displayName: message.displayName});

        if (!displayNameHasChanged) return;
        Events.fire('notify-peer-display-name-changed', this._peerId);
    }
}

class RTCPeer extends Peer {

    constructor(serverConnection, isCaller, peerId, roomType, roomId, rtcConfig) {
        super(serverConnection, isCaller, peerId, roomType, roomId);

        this.rtcSupported = true;
        this.rtcConfig = rtcConfig
        this._intentionalDisconnect = false;
        this._signalSessionId = "";
        this._pendingIceCandidates = [];
        this._remoteOfferSdp = "";
        this._localOfferRecoveryAttempts = 0;

        if (!this._isCaller) return; // we will listen for a caller
        this._connect();
    }

    _connect() {
        if (this._shouldRefreshOfferConnection()) this._dropConnection();
        if (!this._conn || this._conn.signalingState === "closed") this._openConnection();

        if (this._isCaller) {
            this._openChannel();
        }
        else {
            this._conn.ondatachannel = e => this._onChannelOpened(e);
        }
    }

    _shouldRefreshOfferConnection() {
        if (!this._isCaller || !this._conn || this._conn.signalingState === "closed") return false;
        if (this._isConnected() || this._isConnecting()) return false;
        return !!(this._conn.localDescription || this._conn.remoteDescription);
    }

    _openConnection() {
        this._conn = new RTCPeerConnection(this.rtcConfig);
        this._conn.onicecandidate = e => this._onIceCandidate(e);
        this._conn.onicecandidateerror = e => this._onError(e);
        this._conn.onconnectionstatechange = _ => this._onConnectionStateChange();
        this._conn.oniceconnectionstatechange = e => this._onIceConnectionStateChange(e);
        this._pendingIceCandidates = [];
        this._remoteOfferSdp = "";
        this._signalSessionId = this._isCaller ? this._createSignalSessionId() : "";
    }

    _openChannel() {
        if (!this._conn) return;

        const channel = this._conn.createDataChannel('data-channel', {
            ordered: true,
            reliable: true // Obsolete. See https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/reliable
        });
        channel.onopen = e => this._onChannelOpened(e);
        channel.onerror = e => this._onError(e);

        this._conn
            .createOffer()
            .then(d => this._onDescription(d))
            .catch(e => this._onError(e));
    }

    _onDescription(description) {
        // description.sdp = description.sdp.replace('b=AS:30', 'b=AS:1638400');
        if (description.type === 'answer' && this._conn.signalingState !== 'have-remote-offer') return;

        this._conn
            .setLocalDescription(description)
            .then(_ => this._sendSignal({ sdp: description }))
            .catch(e => {
                if (this._shouldIgnoreLocalDescriptionError(description, e)) return;
                if (this._shouldRecoverLocalOfferError(description, e)) {
                    this._localOfferRecoveryAttempts += 1;
                    this._dropConnection();
                    this._connect();
                    return;
                }
                this._onError(e);
            });
    }

    _onIceCandidate(event) {
        if (!event.candidate) return;
        this._sendSignal({ ice: event.candidate });
    }

    _shouldIgnoreLocalDescriptionError(description, error) {
        if (description.type !== 'answer') return false;
        if (error?.name !== 'InvalidStateError') return false;
        const message = `${error?.message || ''}`;
        return this._conn?.signalingState !== 'have-remote-offer' || message.includes('wrong state: stable');
    }

    _shouldRecoverLocalOfferError(description, error) {
        if (description.type !== 'offer') return false;
        if (this._localOfferRecoveryAttempts > 0) return false;
        const message = `${error?.message || ''}`;
        return error?.name === 'InvalidAccessError' && message.includes('m-lines');
    }

    onServerMessage(message) {
        if (!this._conn) this._connect();

        if (message.sdp) {
            this._onRemoteDescription(message);
        }
        else if (message.ice) {
            this._onRemoteIceCandidate(message);
        }
    }

    _onRemoteDescription(message) {
        if (this._shouldIgnoreSignal(message)) return;

        const description = message.sdp;
        if (description.type === 'answer' && this._conn.signalingState !== 'have-local-offer') return;
        if (description.type === 'offer' && this._shouldIgnoreOffer(description)) return;

        if (description.type === 'offer') {
            this._signalSessionId = message.sessionId || this._createSignalSessionId();
            this._remoteOfferSdp = description.sdp || "";
        }

        this._conn
            .setRemoteDescription(description)
            .then(_ => this._flushPendingIceCandidates())
            .then(_ => {
                if (description.type === 'offer') {
                    return this._conn
                        .createAnswer()
                        .then(d => this._onDescription(d));
                }
            })
            .catch(e => this._onError(e));
    }

    _shouldIgnoreOffer(description) {
        if (this._isCaller) return true;
        if (this._remoteOfferSdp && this._remoteOfferSdp === (description.sdp || "")) return true;
        if (this._isConnected()) return true;
        return this._conn.signalingState !== 'stable';
    }

    _onRemoteIceCandidate(message) {
        if (this._shouldIgnoreSignal(message)) return;

        const candidate = new RTCIceCandidate(message.ice);
        if (!this._conn.remoteDescription) {
            this._pendingIceCandidates.push({
                candidate,
                sessionId: message.sessionId || ""
            });
            return;
        }

        this._addIceCandidate(candidate);
    }

    _flushPendingIceCandidates() {
        if (!this._pendingIceCandidates.length || !this._conn.remoteDescription) return;

        const candidates = this._pendingIceCandidates;
        this._pendingIceCandidates = [];
        candidates.forEach(entry => {
            if (this._shouldIgnoreSignalSession(entry.sessionId)) return;
            this._addIceCandidate(entry.candidate);
        });
    }

    _addIceCandidate(candidate) {
        if (!this._candidateMatchesRemoteDescription(candidate)) return;

        this._conn
            .addIceCandidate(candidate)
            .catch(e => this._onError(e));
    }

    _candidateMatchesRemoteDescription(candidate) {
        if (!candidate.usernameFragment || !this._conn.remoteDescription?.sdp) return true;

        return this._remoteIceUfrags().includes(candidate.usernameFragment);
    }

    _remoteIceUfrags() {
        return (this._conn.remoteDescription?.sdp || "")
            .split("\r\n")
            .filter(line => line.startsWith("a=ice-ufrag:"))
            .map(line => line.substring("a=ice-ufrag:".length));
    }

    _shouldIgnoreSignal(message) {
        return this._shouldIgnoreSignalSession(message.sessionId || "");
    }

    _shouldIgnoreSignalSession(sessionId) {
        if (sessionId) return !!this._signalSessionId && sessionId !== this._signalSessionId;
        return false;
    }

    _createSignalSessionId() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    _onChannelOpened(event) {
        console.log('RTC: channel opened with', this._peerId);
        const channel = event.channel || event.target;
        channel.binaryType = 'arraybuffer';
        channel.onmessage = e => this._onMessage(e.data);
        channel.onclose = _ => this._onChannelClosed();
        this._channel = channel;
        Events.on('beforeunload', e => this._onBeforeUnload(e));
        Events.on('pagehide', _ => this._onPageHide());
        Events.fire('peer-connected', {peerId: this._peerId, connectionHash: this.getConnectionHash()});
    }

    _onMessage(message) {
        if (typeof message === 'string') {
            console.log('RTC:', JSON.parse(message));
        }
        super._onMessage(message);
    }

    getConnectionHash() {
        const localConnectionFingerprint = this._connectionFingerprint(this._conn?.localDescription?.sdp || "");
        const remoteConnectionFingerprint = this._connectionFingerprint(this._conn?.remoteDescription?.sdp || "");
        if (!localConnectionFingerprint || !remoteConnectionFingerprint) return "";

        const combinedFingerprints = this._isCaller
            ? localConnectionFingerprint + remoteConnectionFingerprint
            : remoteConnectionFingerprint + localConnectionFingerprint;
        let hash = cyrb53(combinedFingerprints).toString();
        while (hash.length < 16) {
            hash = "0" + hash;
        }
        return hash;
    }

    _connectionFingerprint(sdp) {
        const fingerprint = sdp
            .split("\r\n")
            .find(line => line.startsWith("a=fingerprint:"));
        return fingerprint?.substring(14) || "";
    }

    _onBeforeUnload(e) {
        if (this._busy) {
            e.preventDefault();
            return Localization.getTranslation("notifications.unfinished-transfers-warning");
        }
    }

    _onPageHide() {
        this._disconnect();
    }

    _disconnect() {
        this._intentionalDisconnect = true;
        if (this._conn && this._channel) {
            this._channel.onclose = null;
            this._channel.close();
        }
        Events.fire('peer-disconnected', this._peerId);
    }

    _onChannelClosed() {
        console.log('RTC: channel closed', this._peerId);
        Events.fire('peer-disconnected', this._peerId);
        if (this._intentionalDisconnect) return;
        if (!this._isCaller) return;
        this._dropConnection();
        this._connect(); // reopen the channel
    }

    _dropConnection() {
        if (this._conn && this._conn.signalingState !== 'closed') this._conn.close();
        this._conn = null;
        this._channel = null;
        this._pendingIceCandidates = [];
        this._remoteOfferSdp = "";
        this._signalSessionId = "";
    }

    _onConnectionStateChange() {
        console.log('RTC: state changed:', this._conn.connectionState);
        switch (this._conn.connectionState) {
            case 'disconnected':
                console.warn('RTC: connection temporarily disconnected', this._peerId);
                break;
            case 'failed':
                Events.fire('peer-disconnected', this._peerId);
                this._onError('rtc connection failed');
                break;
        }
    }

    _onIceConnectionStateChange() {
        switch (this._conn.iceConnectionState) {
            case 'failed':
                this._onError('ICE Gathering failed');
                break;
            default:
                console.log('ICE Gathering', this._conn.iceConnectionState);
        }
    }

    _onError(error) {
        console.error(error);
    }

    _send(message) {
        if (!this._channel) this.refresh();
        this._channel.send(message);
    }

    _isBlossomKeyDeliveryChannelTrusted() {
        // Browser RTCDataChannel sends SCTP over DTLS. MDN documents all WebRTC data as encrypted;
        // RFC 8831 documents SCTP-over-DTLS confidentiality, authentication, and integrity.
        return true;
    }

    _sendSignal(signal) {
        signal.type = 'signal';
        signal.to = this._peerId;
        if (this._signalSessionId) signal.sessionId = this._signalSessionId;
        signal.roomType = this._getRoomTypes()[0];
        signal.roomId = this._roomIds[this._getRoomTypes()[0]];
        this._server.send(signal);
    }

    refresh() {
        // check if channel is open. otherwise create one
        if (this._isConnected() || this._isConnecting()) return;

        // only reconnect if peer is caller
        if (!this._isCaller) return;

        this._connect();
    }

    _isConnected() {
        return this._channel && this._channel.readyState === 'open';
    }

    _isConnecting() {
        return this._channel && this._channel.readyState === 'connecting';
    }

    switchSignalingRoute(isCaller, roomType, roomId, transport) {
        this._intentionalDisconnect = true;
        if (this._channel) {
            this._channel.onclose = null;
            this._channel.close();
        }
        if (this._conn) this._conn.close();

        this._channel = null;
        this._conn = null;
        this._signalSessionId = "";
        this._pendingIceCandidates = [];
        this._remoteOfferSdp = "";
        this._intentionalDisconnect = false;
        this._isCaller = isCaller;
        this._server = transport;
        this._roomIds = SignalingRoomPriority.withPreferred(this._roomIds, roomType, roomId);

        if (this._isCaller) this._connect();
    }

    sendDisplayName(displayName) {
        if (!this._isConnected()) return;
        super.sendDisplayName(displayName);
    }
}

class WSPeer extends Peer {

    constructor(serverConnection, isCaller, peerId, roomType, roomId) {
        super(serverConnection, isCaller, peerId, roomType, roomId);

        this.rtcSupported = false;

        if (!this._isCaller) return; // we will listen for a caller
        this._sendSignal();
    }

    _send(chunk) {
        this.sendJSON({
            type: 'ws-chunk',
            chunk: arrayBufferToBase64(chunk)
        });
    }

    sendJSON(message) {
        message.to = this._peerId;
        message.roomType = this._getRoomTypes()[0];
        message.roomId = this._roomIds[this._getRoomTypes()[0]];
        this._server.send(message);
    }

    _sendSignal(connected = false) {
        this.sendJSON({type: 'signal', connected: connected});
    }

    onServerMessage(message) {
        this._peerId = message.sender.id;
        Events.fire('peer-connected', {peerId: message.sender.id, connectionHash: this.getConnectionHash()})
        if (message.connected) return;
        this._sendSignal(true);
    }

    getConnectionHash() {
        // Todo: implement SubtleCrypto asymmetric encryption and create connectionHash from public keys
        return "";
    }
}

class PeersManager {

    constructor(serverConnection) {
        this.peers = {};
        this._peerAliases = {};
        this._server = serverConnection;
        this._pendingPeerMessages = [];
        Events.on('signal', e => this._onMessage(e.detail));
        Events.on('peers', e => this._onPeers(e.detail));
        Events.on('files-selected', e => this._onFilesSelected(e.detail));
        Events.on('respond-to-files-transfer-request', e => this._onRespondToFileTransferRequest(e.detail))
        Events.on('send-text', e => this._onSendText(e.detail));
        Events.on('peer-left', e => this._onPeerLeft(e.detail));
        Events.on('peer-joined', e => this._onPeerJoined(e.detail));
        Events.on('peer-connected', e => this._onPeerConnected(e.detail.peerId));
        Events.on('peer-disconnected', e => this._onPeerDisconnected(e.detail));
        Events.on('leave-ip-room', _ => this._disconnectOrRemoveRoomTypeByRoomType('ip'));
        Events.on('leave-fips-room', _ => this._disconnectOrRemoveRoomTypeByRoomType('fips'));
        Events.on('leave-pollen-room', _ => this._disconnectOrRemoveRoomTypeByRoomType('pollen'));

        // this device closes connection
        Events.on('room-secrets-deleted', e => this._onRoomSecretsDeleted(e.detail));
        Events.on('leave-public-room', e => this._onLeavePublicRoom(e.detail));

        // peer closes connection
        Events.on('secret-room-deleted', e => this._onSecretRoomDeleted(e.detail));

        Events.on('room-secret-regenerated', e => this._onRoomSecretRegenerated(e.detail));
        Events.on('display-name', e => this._onDisplayName(e.detail.displayName));
        Events.on('self-display-name-changed', e => this._notifyPeersDisplayNameChanged(e.detail));
        Events.on('notify-peer-display-name-changed', e => this._notifyPeerDisplayNameChanged(e.detail));
        Events.on('auto-accept-updated', e => this._onAutoAcceptUpdated(e.detail.roomSecret, e.detail.autoAccept));
        Events.on('ws-disconnected', _ => this._onWsDisconnected());
        Events.on('ws-relay', e => this._onWsRelay(e.detail));
        Events.on('ws-config', e => this._onWsConfig(e.detail));
    }

    _onWsConfig(wsConfig) {
        this._wsConfig = wsConfig;
        const pendingPeerMessages = this._pendingPeerMessages;
        this._pendingPeerMessages = [];
        pendingPeerMessages.forEach(args => this._createOrRefreshPeer(...args));
    }

    _onMessage(message) {
        const peerId = this._resolvePeerId(message.sender.id);
        if (!this.peers[peerId]) return;
        this.peers[peerId].onServerMessage(message);
    }

    _refreshPeer(peerId, roomType, roomId) {
        if (!this._peerExists(peerId)) return false;

        const peer = this.peers[peerId];
        const currentPrimaryRoomType = SignalingRoomPriority.primary(peer._roomIds);
        const roomTypesDiffer = currentPrimaryRoomType !== roomType;
        const roomIdsDiffer = peer._roomIds[roomType] !== roomId;

        // if roomType or roomId for roomType differs peer is already connected
        // -> only update roomSecret and reevaluate auto accept
        if (roomTypesDiffer || roomIdsDiffer) {
            peer._updateRoomIds(roomType, roomId);
            peer._evaluateAutoAccept();

            return true;
        }

        peer.refresh();

        return true;
    }

    _createOrRefreshPeer(isCaller, peerId, roomType, roomId, rtcSupported, transport = this._server, peerInfo = null) {
        if (roomType === "ip" && globalThis.meshdropLocalDiscovery?.isEnabled?.() === false) return;

        if (!this._wsConfig) {
            this._pendingPeerMessages.push([isCaller, peerId, roomType, roomId, rtcSupported, transport, peerInfo]);
            return;
        }

        const policyPeer = peerInfo || {id: peerId};
        const identity = globalThis.meshdropNostrIdentity?.getIdentity?.();
        if (globalThis.NostrFollowPolicy?.allowsPeer(policyPeer, roomType, identity) === false) return;

        this._rememberPeerAliases(peerId, policyPeer);

        if (this._peerExists(peerId)) {
            const peer = this.peers[peerId];
            const currentRoomType = SignalingRoomPriority.primary(peer._roomIds);
            const connected = peer._isConnected?.() === true;
            const preferNewRoute = SignalingRoomPriority.shouldPrefer(currentRoomType, roomType, connected);
            this._refreshPeer(peerId, roomType, roomId);
            if (preferNewRoute && peer.switchSignalingRoute) {
                peer.switchSignalingRoute(isCaller, roomType, roomId, transport || this._server);
            }
            return;
        }

        if (window.isRtcSupported && rtcSupported) {
            this.peers[peerId] = new RTCPeer(transport, isCaller, peerId, roomType, roomId, this._wsConfig.rtcConfig);
        }
        else if (roomType !== 'nostr' && this._wsConfig.wsFallback) {
            this.peers[peerId] = new WSPeer(this._server, isCaller, peerId, roomType, roomId);
        }
        else {
            console.warn("Websocket fallback is not activated on this instance.\n" +
                "Activate WebRTC in this browser or ask the admin of this instance to activate the websocket fallback.")
        }
    }

    _onPeerJoined(message) {
        this._createOrRefreshPeer(
            !!message.isCaller,
            message.peer.id,
            message.roomType,
            message.roomId,
            message.peer.rtcSupported,
            message.transport,
            message.peer
        );
    }

    _onPeers(message) {
        message.peers.forEach(peer => {
            this._createOrRefreshPeer(peer.isCaller ?? true, peer.id, message.roomType, message.roomId, peer.rtcSupported, message.transport, peer);
        })
    }

    _onWsRelay(message) {
        if (!this._wsConfig.wsFallback) return;

        const messageJSON = JSON.parse(message);
        if (messageJSON.type === 'ws-chunk') message = base64ToArrayBuffer(messageJSON.chunk);
        this.peers[this._resolvePeerId(messageJSON.sender.id)]?._onMessage(message);
    }

    _onRespondToFileTransferRequest(detail) {
        this.peers[this._resolvePeerId(detail.to)]?._respondToFileTransferRequest(detail.accepted);
    }

    async _onFilesSelected(message) {
        const peerId = this._resolvePeerId(message.to);
        if (!this.peers[peerId]) return;

        let files = mime.addMissingMimeTypesToFiles([...message.files]);
        await this.peers[peerId].requestFileTransfer(files, message.transport || null);
    }

    _onSendText(message) {
        const peerId = this._resolvePeerId(message.to);
        if (!this.peers[peerId]) return;

        this.peers[peerId].sendText(message.text);
    }

    _onPeerLeft(message) {
        if (this._peerExists(message.peerId) && this._webRtcSupported(message.peerId)) {
            console.log('WSPeer left:', message.peerId);
        }
        this._disconnectOrRemoveRoomTypeByPeerId(message.peerId, message.roomType);

        if (message.disconnect === true) {
            // If no peers are connected anymore, we can safely assume that no other tab on the same browser is connected:
            // Tidy up peerIds in localStorage
            if (Object.keys(this.peers).length === 0) {
                BrowserTabsConnector
                    .removeOtherPeerIdsFromLocalStorage()
                    .then(peerIds => {
                        if (!peerIds) return;
                        console.log("successfully removed other peerIds from localStorage");
                    });
            }
        }
    }

    _onPeerConnected(peerId) {
        this._notifyPeerDisplayNameChanged(peerId);
    }

    _peerExists(peerId) {
        return !!this.peers[peerId];
    }

    _webRtcSupported(peerId) {
        return this.peers[peerId].rtcSupported
    }

    _onWsDisconnected() {
        if (!this._wsConfig || !this._wsConfig.wsFallback) return;

        for (const peerId in this.peers) {
            if (!this._webRtcSupported(peerId)) {
                Events.fire('peer-disconnected', peerId);
            }
        }
    }

    _onPeerDisconnected(peerId) {
        const peer = this.peers[peerId];
        delete this.peers[peerId];
        this._forgetPeerAliases(peerId);
        if (!peer || !peer._conn) return;
        peer._intentionalDisconnect = true;
        if (peer._channel) peer._channel.onclose = null;
        peer._conn.close();
        peer._busy = false;
        peer._roomIds = {};
    }

    _onRoomSecretsDeleted(roomSecrets) {
        for (let i=0; i<roomSecrets.length; i++) {
            this._disconnectOrRemoveRoomTypeByRoomId('secret', roomSecrets[i]);
        }
    }

    _onLeavePublicRoom(publicRoomId) {
        this._disconnectOrRemoveRoomTypeByRoomId('public-id', publicRoomId);
    }

    _onSecretRoomDeleted(roomSecret) {
        this._disconnectOrRemoveRoomTypeByRoomId('secret', roomSecret);
    }

    _disconnectOrRemoveRoomTypeByRoomId(roomType, roomId) {
        const peerIds = this._getPeerIdsFromRoomId(roomId);

        if (!peerIds.length) return;

        for (let i=0; i<peerIds.length; i++) {
            this._disconnectOrRemoveRoomTypeByPeerId(peerIds[i], roomType);
        }
    }

    _disconnectOrRemoveRoomTypeByRoomType(roomType) {
        const peerIds = Object.keys(this.peers).filter(peerId => this.peers[peerId]._roomIds?.[roomType]);
        for (const peerId of peerIds) {
            this._disconnectOrRemoveRoomTypeByPeerId(peerId, roomType);
        }
    }

    _disconnectOrRemoveRoomTypeByPeerId(peerId, roomType) {
        const peer = this.peers[peerId];

        if (!peer) return;

        if (peer._getRoomTypes().length > 1) {
            peer._removeRoomType(roomType);
        }
        else {
            Events.fire('peer-disconnected', peerId);
        }
    }

    _onRoomSecretRegenerated(message) {
        PersistentStorage
            .updateRoomSecret(message.oldRoomSecret, message.newRoomSecret)
            .then(_ => {
                console.log("successfully regenerated room secret");
                Events.fire("room-secrets", [message.newRoomSecret]);
            })
    }

    _notifyPeersDisplayNameChanged(newDisplayName) {
        if (newDisplayName && typeof newDisplayName === "object") {
            newDisplayName = newDisplayName.displayName || "";
        }

        this._displayName = newDisplayName ? newDisplayName : this._originalDisplayName;
        for (const peerId in this.peers) {
            this._notifyPeerDisplayNameChanged(peerId);
        }
    }

    _notifyPeerDisplayNameChanged(peerId) {
        const peer = this.peers[this._resolvePeerId(peerId)];
        if (!peer) return;
        peer.sendDisplayName(this._displayName);
    }

    _onDisplayName(displayName) {
        this._originalDisplayName = displayName;
        // if the displayName has not been changed (yet) set the displayName to the original displayName
        if (!this._displayName) this._displayName = displayName;
    }

    _onAutoAcceptUpdated(roomSecret, autoAccept) {
        const peerId = this._getPeerIdsFromRoomId(roomSecret)[0];

        if (!peerId) return;

        this.peers[peerId]._setAutoAccept(autoAccept);
    }

    _getPeerIdsFromRoomId(roomId) {
        if (!roomId) return [];

        let peerIds = []
        for (const peerId in this.peers) {
            const peer = this.peers[peerId];

            // peer must have same roomId.
            if (Object.values(peer._roomIds).includes(roomId)) {
                peerIds.push(peer._peerId);
            }
        }
        return peerIds;
    }

    _rememberPeerAliases(peerId, peerInfo = {}) {
        if (!peerId) return;

        this._peerAliases[peerId] = peerId;
        if (peerInfo.id) this._peerAliases[peerInfo.id] = peerId;
        if (peerInfo.nostrIdentity?.pubkey) this._peerAliases[peerInfo.nostrIdentity.pubkey] = peerId;

        Object.values(peerInfo._peerIdsByRoomType || {}).forEach(alias => {
            if (alias) this._peerAliases[alias] = peerId;
        });
    }

    _forgetPeerAliases(peerId) {
        Object.keys(this._peerAliases).forEach(alias => {
            if (this._peerAliases[alias] === peerId) delete this._peerAliases[alias];
        });
    }

    _resolvePeerId(peerId) {
        return this._peerAliases[peerId] || peerId;
    }
}

class FileChunker {

    constructor(file, onChunk, onPartitionEnd) {
        this._chunkSize = 64000; // 64 KB
        this._maxPartitionSize = 1e6; // 1 MB
        this._offset = 0;
        this._partitionSize = 0;
        this._file = file;
        this._onChunk = onChunk;
        this._onPartitionEnd = onPartitionEnd;
        this._reader = new FileReader();
        this._reader.addEventListener('load', e => this._onChunkRead(e.target.result));
    }

    nextPartition() {
        this._partitionSize = 0;
        this._readChunk();
    }

    _readChunk() {
        const chunk = this._file.slice(this._offset, this._offset + this._chunkSize);
        this._reader.readAsArrayBuffer(chunk);
    }

    _onChunkRead(chunk) {
        this._offset += chunk.byteLength;
        this._partitionSize += chunk.byteLength;
        this._onChunk(chunk);
        if (this.isFileEnd()) return;
        if (this._isPartitionEnd()) {
            this._onPartitionEnd(this._offset);
            return;
        }
        this._readChunk();
    }

    repeatPartition() {
        this._offset -= this._partitionSize;
        this.nextPartition();
    }

    _isPartitionEnd() {
        return this._partitionSize >= this._maxPartitionSize;
    }

    isFileEnd() {
        return this._offset >= this._file.size;
    }
}

class FileDigester {

    constructor(meta, totalSize, totalBytesReceived, callback) {
        this._buffer = [];
        this._bytesReceived = 0;
        this._size = meta.size;
        this._name = meta.name;
        this._mime = meta.mime;
        this._totalSize = totalSize;
        this._totalBytesReceived = totalBytesReceived;
        this._callback = callback;
    }

    unchunk(chunk) {
        this._buffer.push(chunk);
        this._bytesReceived += chunk.byteLength || chunk.size;
        this.progress = (this._totalBytesReceived + this._bytesReceived) / this._totalSize;
        if (isNaN(this.progress)) this.progress = 1

        if (this._bytesReceived < this._size) return;
        // we are done
        const blob = new Blob(this._buffer)
        this._buffer = null;
        this._callback(new File([blob], this._name, {
            type: this._mime || "application/octet-stream",
            lastModified: new Date().getTime()
        }));
    }
}

Object.assign(globalThis, {
    PeersManager,
    ServerConnection
});
