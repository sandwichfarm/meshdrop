/* eslint-disable no-undef */

const MeshDropFipsStreamIntegration = {
    fipsOption() {
        return {
            id: "fips",
            type: "storage",
            label: "FIPS Stream",
            description: "Fetch encrypted bytes over the FIPS mesh address",
            group: "Storage routes",
            privacy: "Mesh stream ciphertext",
            privacyTone: "encrypted",
            details: [
                ["Path", "sender MeshDrop server over FIPS IPv6"],
                ["Private mode", "encrypts before upload"],
                ["Data plane", "FIPS HTTP stream"]
            ],
            attempt: PeerRouteStatusProtocol.attempt({
                route: "fips-stream",
                routeLabel: "FIPS Stream",
                state: "candidate",
                encrypted: true,
                objectStore: false
            })
        };
    },

    patchPeerAvailabilityProtocol(protocol = globalThis.PeerAvailabilityProtocol) {
        if (!protocol?.storageOptions || protocol.storageOptions.__meshdropFipsStreamPatched) return false;

        const originalStorageOptions = protocol.storageOptions;
        protocol.storageOptions = function storageOptionsWithFipsStream() {
            const options = originalStorageOptions.call(this);
            if (
                !options.some(option => option.id === "fips")
                && globalThis.meshdropFipsStreamTransfer?.isActive?.()
                && this.storageRouteSupported("fips")
            ) {
                options.push(MeshDropFipsStreamIntegration.fipsOption());
            }
            return options;
        };
        protocol.storageOptions.__meshdropFipsStreamPatched = true;
        return true;
    },

    patchPeerPrototype(proto) {
        if (!proto?.requestFileTransfer || proto.requestFileTransfer.__meshdropFipsStreamPatched) return false;

        const originalRequestFileTransfer = proto.requestFileTransfer;
        const originalOnMessage = proto._onMessage;
        const originalRespond = proto._respondToFileTransferRequest;
        const originalResponse = proto._onFileTransferRequestResponded;

        proto.requestFileTransfer = function requestFileTransferWithFipsStream(files, transfer = null) {
            const selectedTransfer = transfer || this._defaultTransferSelection?.();
            if (selectedTransfer?.id === "fips") {
                return this.requestFipsFileTransfer(files, selectedTransfer);
            }
            return originalRequestFileTransfer.call(this, files, transfer);
        };

        proto.requestFipsFileTransfer = async function requestFipsFileTransfer(
            files,
            transfer = {id: "fips", type: "storage", label: "FIPS Stream", privacyMode: "private"}
        ) {
            try {
                if (globalThis.meshdropFipsStreamTransfer?.isActive?.() !== true) {
                    throw new Error("FIPS stream transfer is unavailable");
                }

                const request = await this._createFileTransferRequest(files, transfer);
                const payload = await MeshDropFipsStreamIntegration.preparePrivatePayload.call(this, files, request.header, transfer);
                const fipsUpload = await globalThis.meshdropFipsStreamTransfer.uploadFiles(payload.files, progress => {
                    Events.fire('set-progress', {
                        peerId: this._peerId,
                        progress: 0.8 + 0.2 * progress,
                        status: 'prepare',
                        transport: transfer
                    });
                });
                const fipsStream = this._createFipsStreamMetadata(payload, fipsUpload);
                if (!fipsStream) throw new Error("FIPS stream descriptor could not be built");

                Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'prepare', transport: transfer});
                this.sendJSON({
                    type: 'fips-request',
                    ...request,
                    ...payload.requestFields,
                    fipsDescriptors: fipsUpload.descriptors,
                    fipsStream
                });
                Events.fire('set-progress', {peerId: this._peerId, progress: 0, status: 'wait', transport: transfer});
            } catch (error) {
                console.error(error);
                Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
                Events.fire(
                    'notify-user',
                    `${Localization.getTranslation("notifications.fips-stream-upload-failed")}: ${error.message}`
                );
            }
        };

        proto._createFipsStreamMetadata = function createFipsStreamMetadata(payload, fipsUpload) {
            if (!globalThis.FipsStreamTransferProtocol?.buildStreamDescriptor) return null;
            if (payload.requestFields?.payloadPrivacy?.mode !== "private") return null;
            if (!this._roomIds?.fips) return null;

            const identity = globalThis.meshdropNostrIdentity?.getIdentity?.();
            const keyDelivery = payload.requestFields?.payloadEncryption?.keyDelivery;
            if (
                keyDelivery?.type !== "nip44"
                || !this._isNostrPubkey(keyDelivery.senderPubkey)
                || !this._isNostrPubkey(keyDelivery.recipientPubkey)
            ) return null;
            if (!this._isNostrPubkey(identity?.pubkey) || !this._recipientNostrPubkey()) return null;

            const sessionId = payload.requestFields?.payloadEncryption?.transferId;
            const payloadHeaders = payload.payloadHeaders || [];
            const bytesSent = payloadHeaders.reduce((total, header) => total + Number(header.size || 0), 0);
            const descriptor = FipsStreamTransferProtocol.buildStreamDescriptor({
                ownerPubkey: identity.pubkey,
                sessionId,
                baseUrl: fipsUpload.baseUrl,
                files: fipsUpload.descriptors
            });

            return {
                descriptor,
                proofSeed: FipsStreamTransferProtocol.buildStreamProofSeed({
                    bytesSent,
                    senderRuntime: globalThis.meshdropFipsStreamTransfer?.runtimeId?.() || FipsStreamTransferProtocol.runtimeId()
                })
            };
        };

        proto._onFipsFilesTransferRequest = function onFipsFilesTransferRequest(request) {
            if (!request.fipsStream?.descriptor) {
                this.sendJSON({type: 'files-transfer-response', accepted: false, reason: 'fips-stream-required'});
                Events.fire('notify-user', Localization.getTranslation("notifications.fips-stream-required"));
                return;
            }
            request.fips = true;
            this._onFilesTransferRequest(request);
        };

        if (originalOnMessage) {
            proto._onMessage = function onMessageWithFipsStream(message) {
                if (typeof message === 'string') {
                    try {
                        const parsed = JSON.parse(message);
                        if (parsed.type === 'fips-request') {
                            if (this._allowsNostrPeer?.() === false) {
                                this.sendJSON({type: 'files-transfer-response', accepted: false, reason: 'not-followed'});
                                return;
                            }
                            return this._onFipsFilesTransferRequest(parsed);
                        }
                    } catch {
                        return originalOnMessage.call(this, message);
                    }
                }
                return originalOnMessage.call(this, message);
            };
        }

        if (originalRespond) {
            proto._respondToFileTransferRequest = function respondToFileTransferRequestWithFipsStream(accepted) {
                const pendingRequest = this._requestPending;
                if (!pendingRequest?.fips) return originalRespond.call(this, accepted);

                this.sendJSON({type: 'files-transfer-response', accepted, fips: true});
                if (accepted) {
                    this._requestAccepted = pendingRequest;
                    this._totalBytesReceived = 0;
                    this._receivedFileIndex = 0;
                    this._busy = true;
                    this._filesReceived = [];
                }
                this._requestPending = null;
                if (accepted) this._downloadFipsFiles(pendingRequest);
            };
        }

        proto._downloadFipsFiles = async function downloadFipsFiles(request) {
            try {
                const stream = FipsStreamTransferProtocol.validateStreamRequest(request);
                const downloadedFiles = [];
                const expectedTotalSize = request.payloadHeaders
                    ? request.payloadHeaders.reduce((total, payloadHeader) => total + payloadHeader.size, 0)
                    : request.totalSize;
                const descriptors = stream.descriptor.endpoint.files || request.fipsDescriptors || [];
                for (let i = 0; i < descriptors.length; i++) {
                    const file = await globalThis.meshdropFipsStreamTransfer.downloadDescriptor(
                        descriptors[i],
                        request.payloadHeaders?.[i] || request.header[i],
                        stream.descriptor
                    );

                    this._totalBytesReceived += file.size;
                    this._onDownloadProgress(this._totalBytesReceived / Math.max(expectedTotalSize, 1));
                    downloadedFiles.push(file);
                }
                const files = await this._decryptPayloadFiles(downloadedFiles, request);
                const proof = await FipsStreamTransferProtocol.finalizeStreamProof({
                    request,
                    encryptedFiles: downloadedFiles,
                    decryptedFiles: files,
                    recipientRuntime: globalThis.meshdropFipsStreamTransfer?.runtimeId?.() || FipsStreamTransferProtocol.runtimeId()
                });
                Events.fire('route-proof', proof);

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
            } catch (error) {
                console.error(error);
                Events.fire(
                    'notify-user',
                    `${Localization.getTranslation("notifications.fips-stream-download-failed")}: ${error.message}`
                );
                Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
                this._busy = false;
                this._filesReceived = [];
                this._requestAccepted = null;
            }
        };

        if (originalResponse) {
            proto._onFileTransferRequestResponded = function onFileTransferRequestRespondedWithFipsStream(message) {
                if (!message?.fips) return originalResponse.call(this, message);

                if (!message.accepted) {
                    Events.fire('set-progress', {peerId: this._peerId, progress: 1, status: 'wait'});
                    this._filesRequested = null;
                    this._selectedTransfer = null;
                    if (message.reason === 'fips-stream-required') {
                        Events.fire('notify-user', Localization.getTranslation("notifications.fips-stream-required"));
                    }
                    return;
                }
                Events.fire('file-transfer-accepted');
                Events.fire('set-progress', {
                    peerId: this._peerId,
                    progress: 0,
                    status: 'transfer',
                    transport: this._selectedTransfer
                });
            };
        }

        proto.requestFileTransfer.__meshdropFipsStreamPatched = true;
        return true;
    },

    async preparePrivatePayload(files, headers, transfer) {
        const originalTrusted = this._isBlossomKeyDeliveryChannelTrusted;
        const hadOwnTrusted = Object.prototype.hasOwnProperty.call(this, "_isBlossomKeyDeliveryChannelTrusted");
        this._isBlossomKeyDeliveryChannelTrusted = () => false;
        try {
            return await this._prepareTransferPayload(files, headers, {
                ...transfer,
                privacyMode: "private"
            });
        } finally {
            if (hadOwnTrusted) {
                this._isBlossomKeyDeliveryChannelTrusted = originalTrusted;
            } else {
                delete this._isBlossomKeyDeliveryChannelTrusted;
            }
        }
    },

    patchPeer(peer) {
        let proto = peer;
        while (proto && !Object.prototype.hasOwnProperty.call(proto, "requestFileTransfer")) {
            proto = Object.getPrototypeOf(proto);
        }
        return this.patchPeerPrototype(proto);
    },

    apply() {
        this.patchPeerAvailabilityProtocol();
        try {
            if (typeof Peer !== "undefined") this.patchPeerPrototype(Peer.prototype);
        } catch {
            return false;
        }
        return true;
    }
};

MeshDropFipsStreamIntegration.apply();
globalThis.MeshDropFipsStreamIntegration = MeshDropFipsStreamIntegration;
