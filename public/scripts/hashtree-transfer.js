const HashtreeTransferProtocol = {
    chunkSize: 2 * 1024 * 1024,
    fileType: 1,
    dirType: 2,
    blobLinkType: 0,
    fileLinkType: 1,
    mediaType: "application/vnd.hashtree.node+msgpack",
    storageKey: "meshdrop_hashtree_transfer_enabled",

    readEnabled(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) === "true";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    async sha256Hex(bytes) {
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return BlossomTransferProtocol.bytesToHex(new Uint8Array(digest));
    },

    hexToBytes(hex) {
        if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Invalid Hashtree hash");

        const bytes = new Uint8Array(32);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    },

    async blobBytes(blob) {
        return new Uint8Array(await blob.arrayBuffer());
    },

    encodeNode(type, links) {
        return this.concat([
            this.encodeMapHeader(2),
            this.encodeString("l"),
            this.encodeArrayHeader(links.length),
            ...links.map(link => this.encodeLink(link)),
            this.encodeString("t"),
            this.encodeUnsigned(type)
        ]);
    },

    encodeLink(link) {
        const entries = [["h", this.hexToBytes(link.hash)]];

        if (link.metadata) entries.push(["m", this.sortMetadata(link.metadata)]);
        if (link.name) entries.push(["n", link.name]);

        entries.push(["s", link.size]);
        entries.push(["t", link.type ?? this.blobLinkType]);

        return this.encodeMap(entries);
    },

    sortMetadata(metadata) {
        return Object.keys(metadata)
            .sort((a, b) => this.compareUtf8(a, b))
            .reduce((sorted, key) => {
                sorted[key] = metadata[key];
                return sorted;
            }, {});
    },

    compareUtf8(left, right) {
        const leftBytes = new TextEncoder().encode(left);
        const rightBytes = new TextEncoder().encode(right);
        const length = Math.min(leftBytes.length, rightBytes.length);

        for (let i = 0; i < length; i++) {
            if (leftBytes[i] !== rightBytes[i]) return leftBytes[i] - rightBytes[i];
        }

        return leftBytes.length - rightBytes.length;
    },

    encodeMap(entries) {
        const encodedEntries = [];
        for (const [key, value] of entries) {
            encodedEntries.push(this.encodeString(key), this.encodeValue(value));
        }
        return this.concat([this.encodeMapHeader(entries.length), ...encodedEntries]);
    },

    encodeArray(values) {
        return this.concat([this.encodeArrayHeader(values.length), ...values.map(value => this.encodeValue(value))]);
    },

    encodeValue(value) {
        if (value instanceof Uint8Array) return this.encodeBin(value);
        if (Array.isArray(value)) return this.encodeArray(value);
        if (typeof value === "string") return this.encodeString(value);
        if (typeof value === "number") return this.encodeUnsigned(value);
        if (value && typeof value === "object") {
            return this.encodeMap(Object.entries(value));
        }
        throw new Error("Unsupported Hashtree MessagePack value");
    },

    encodeMapHeader(length) {
        if (length < 16) return new Uint8Array([0x80 | length]);
        if (length <= 0xffff) return new Uint8Array([0xde, length >> 8, length & 0xff]);
        throw new Error("Hashtree map is too large");
    },

    encodeArrayHeader(length) {
        if (length < 16) return new Uint8Array([0x90 | length]);
        if (length <= 0xffff) return new Uint8Array([0xdc, length >> 8, length & 0xff]);
        throw new Error("Hashtree array is too large");
    },

    encodeString(value) {
        const bytes = new TextEncoder().encode(value);
        if (bytes.length < 32) return this.concat([new Uint8Array([0xa0 | bytes.length]), bytes]);
        if (bytes.length <= 0xff) return this.concat([new Uint8Array([0xd9, bytes.length]), bytes]);
        if (bytes.length <= 0xffff) return this.concat([new Uint8Array([0xda, bytes.length >> 8, bytes.length & 0xff]), bytes]);
        throw new Error("Hashtree string is too large");
    },

    encodeBin(bytes) {
        if (bytes.length <= 0xff) return this.concat([new Uint8Array([0xc4, bytes.length]), bytes]);
        if (bytes.length <= 0xffff) {
            return this.concat([new Uint8Array([0xc5, bytes.length >> 8, bytes.length & 0xff]), bytes]);
        }
        return this.concat([new Uint8Array([
            0xc6,
            bytes.length >>> 24,
            (bytes.length >>> 16) & 0xff,
            (bytes.length >>> 8) & 0xff,
            bytes.length & 0xff
        ]), bytes]);
    },

    encodeUnsigned(value) {
        if (!Number.isSafeInteger(value) || value < 0) throw new Error("Hashtree integer is invalid");
        if (value <= 0x7f) return new Uint8Array([value]);
        if (value <= 0xff) return new Uint8Array([0xcc, value]);
        if (value <= 0xffff) return new Uint8Array([0xcd, value >> 8, value & 0xff]);
        if (value <= 0xffffffff) {
            return new Uint8Array([
                0xce,
                value >>> 24,
                (value >>> 16) & 0xff,
                (value >>> 8) & 0xff,
                value & 0xff
            ]);
        }

        const bytes = new Uint8Array(9);
        bytes[0] = 0xcf;
        new DataView(bytes.buffer).setBigUint64(1, BigInt(value));
        return bytes;
    },

    concat(chunks) {
        const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
        const bytes = new Uint8Array(size);
        let offset = 0;

        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }

        return bytes;
    },

    decodeNode(bytes) {
        const decoder = new HashtreeMsgpackDecoder(bytes);
        const node = decoder.decode();

        if (!decoder.done()) throw new Error("Hashtree node has trailing bytes");
        if (!node || !Array.isArray(node.l)) throw new Error("Hashtree node links are missing");
        if (node.t !== this.fileType && node.t !== this.dirType) throw new Error("Hashtree node type is invalid");

        return node;
    },

    validateManifest(manifest, headers) {
        if (!manifest || manifest.version !== "HTS-01") throw new Error("Hashtree manifest version is invalid");
        if (!manifest.root || !/^[0-9a-f]{64}$/i.test(manifest.root.hash)) throw new Error("Hashtree root is invalid");
        if (!manifest.objects || typeof manifest.objects !== "object") throw new Error("Hashtree objects are missing");
        if (!Array.isArray(manifest.files) || manifest.files.length !== headers.length) {
            throw new Error("Hashtree file manifest is invalid");
        }

        for (let i = 0; i < headers.length; i++) {
            const file = manifest.files[i];
            if (file.name !== headers[i].name || file.size !== headers[i].size) {
                throw new Error("Hashtree file metadata mismatch");
            }
            if (!/^[0-9a-f]{64}$/i.test(file.hash)) throw new Error("Hashtree file hash is invalid");
        }
    }
};

globalThis.HashtreeTransferProtocol = HashtreeTransferProtocol;

class HashtreeMsgpackDecoder {

    constructor(bytes) {
        this.bytes = bytes;
        this.offset = 0;
    }

    done() {
        return this.offset === this.bytes.length;
    }

    decode() {
        const marker = this.readByte();

        if (marker <= 0x7f) return marker;
        if ((marker & 0xe0) === 0xa0) return this.readString(marker & 0x1f);
        if ((marker & 0xf0) === 0x80) return this.readMap(marker & 0x0f);
        if ((marker & 0xf0) === 0x90) return this.readArray(marker & 0x0f);
        if (marker === 0xcc) return this.readByte();
        if (marker === 0xcd) return this.readUint16();
        if (marker === 0xce) return this.readUint32();
        if (marker === 0xcf) return Number(this.readUint64());
        if (marker === 0xc4) return this.readBytes(this.readByte());
        if (marker === 0xc5) return this.readBytes(this.readUint16());
        if (marker === 0xc6) return this.readBytes(this.readUint32());
        if (marker === 0xd9) return this.readString(this.readByte());
        if (marker === 0xda) return this.readString(this.readUint16());
        if (marker === 0xdc) return this.readArray(this.readUint16());
        if (marker === 0xde) return this.readMap(this.readUint16());

        throw new Error("Unsupported Hashtree MessagePack marker");
    }

    readArray(length) {
        const value = [];
        for (let i = 0; i < length; i++) value.push(this.decode());
        return value;
    }

    readMap(length) {
        const value = {};
        for (let i = 0; i < length; i++) value[this.decode()] = this.decode();
        return value;
    }

    readString(length) {
        return new TextDecoder().decode(this.readBytes(length));
    }

    readBytes(length) {
        if (this.offset + length > this.bytes.length) throw new Error("Hashtree MessagePack is truncated");

        const value = this.bytes.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    readByte() {
        if (this.offset >= this.bytes.length) throw new Error("Hashtree MessagePack is truncated");
        return this.bytes[this.offset++];
    }

    readUint16() {
        const value = (this.readByte() << 8) | this.readByte();
        return value >>> 0;
    }

    readUint32() {
        return (
            this.readByte() * 0x1000000 +
            (this.readByte() << 16) +
            (this.readByte() << 8) +
            this.readByte()
        ) >>> 0;
    }

    readUint64() {
        const high = BigInt(this.readUint32());
        const low = BigInt(this.readUint32());
        return (high << 32n) | low;
    }
}

class HashtreeTransferController {

    constructor() {
        this.$button = $("hashtree-transfer");
        this._active = false;
        this._preferredActive = HashtreeTransferProtocol.readEnabled();

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", _ => {
            this._render();
            this._restorePreferredActive();
        });
        Events.on("nostr-identity-changed", _ => {
            this.disable(false, false);
            this._render();
            this._restorePreferredActive();
        });
        Events.on("nostr-server-list-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        Events.on("protocol-server-preferences-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        Events.on("nostr-signer-available-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        globalThis.meshdropHashtreeTransfer = this;
        this._restorePreferredActive();
    }

    toggle() {
        if (this._active) {
            this.disable();
            return;
        }

        this.enable();
    }

    enable({notify = true, remember = true} = {}) {
        if (!globalThis.meshdropNostrIdentity?.getIdentity()) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.hashtree-transfer-identity-required"));
            return;
        }

        const serverState = this._serverListState();
        if (serverState.status === "loading") {
            if (notify) Events.fire("notify-user", "Waiting for your Blossom server list from Nostr relays.");
            return;
        }

        if (serverState.status === "missing" || serverState.status === "error") {
            if (notify) Events.fire("notify-user", "No Blossom server list was found for this Nostr identity.");
            return;
        }

        if (!this._serverUrls().length) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.hashtree-transfer-server-required"));
            return;
        }

        this._active = true;
        this._render();
        if (remember) this._setPreferredActive(true);
        if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.hashtree-transfer-enabled"));
    }

    disable(notify = true, remember = notify) {
        if (!this._active) return;

        this._active = false;
        this._render();

        if (remember) this._setPreferredActive(false);
        if (notify) {
            Events.fire("notify-user", Localization.getTranslation("notifications.hashtree-transfer-disabled"));
        }
    }

    isActive() {
        return this._active;
    }

    _setPreferredActive(enabled) {
        this._preferredActive = !!enabled;
        HashtreeTransferProtocol.writeEnabled(this._preferredActive);
    }

    _restorePreferredActive() {
        if (!this._preferredActive || this._active) return;

        this.enable({notify: false, remember: false});
    }

    async uploadFiles(files, onProgress = () => {}) {
        const objects = {};
        const fileRoots = [];

        for (let i = 0; i < files.length; i++) {
            fileRoots.push(await this.uploadFile(files[i], objects));
            onProgress((i + 1) / files.length);
        }

        const root = files.length === 1
            ? fileRoots[0]
            : await this.uploadDirNode(fileRoots, objects);

        return {
            version: "HTS-01",
            root: {hash: root.hash, type: root.type, size: root.size},
            files: fileRoots.map(fileRoot => ({
                name: fileRoot.name,
                mime: fileRoot.mime,
                size: fileRoot.size,
                hash: fileRoot.hash
            })),
            objects
        };
    }

    async uploadFile(file, objects) {
        const links = [];

        for (let offset = 0; offset < file.size; offset += HashtreeTransferProtocol.chunkSize) {
            const chunk = file.slice(offset, offset + HashtreeTransferProtocol.chunkSize);
            const descriptor = await this.uploadObject(chunk, objects);
            links.push({
                hash: descriptor.sha256,
                size: descriptor.size,
                type: HashtreeTransferProtocol.blobLinkType
            });
        }

        const nodeBytes = HashtreeTransferProtocol.encodeNode(HashtreeTransferProtocol.fileType, links);
        const descriptor = await this.uploadObject(new Blob([nodeBytes], {type: HashtreeTransferProtocol.mediaType}), objects);

        return {
            name: file.name,
            mime: file.type,
            size: file.size,
            hash: descriptor.sha256,
            type: HashtreeTransferProtocol.fileType
        };
    }

    async uploadDirNode(fileRoots, objects) {
        const links = fileRoots
            .map(fileRoot => ({
                hash: fileRoot.hash,
                name: fileRoot.name,
                size: fileRoot.size,
                type: HashtreeTransferProtocol.fileLinkType,
                metadata: fileRoot.mime ? {mime: fileRoot.mime} : null
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const nodeBytes = HashtreeTransferProtocol.encodeNode(HashtreeTransferProtocol.dirType, links);
        const descriptor = await this.uploadObject(new Blob([nodeBytes], {type: HashtreeTransferProtocol.mediaType}), objects);

        return {
            hash: descriptor.sha256,
            type: HashtreeTransferProtocol.dirType,
            size: fileRoots.reduce((total, fileRoot) => total + fileRoot.size, 0)
        };
    }

    async uploadObject(blob, objects) {
        const descriptor = await globalThis.meshdropBlossomTransfer.uploadFile(
            blob,
            this._serverUrls()[0]
        );
        objects[descriptor.sha256] = descriptor;
        return descriptor;
    }

    async downloadFiles(manifest, headers, onProgress = () => {}) {
        HashtreeTransferProtocol.validateManifest(manifest, headers);

        const files = [];
        let totalBytes = 0;

        const rootNode = await this.downloadNode(manifest.root.hash, manifest);
        this.validateRootNode(rootNode, manifest.files);

        for (let i = 0; i < manifest.files.length; i++) {
            const file = await this.downloadFile(manifest.files[i], headers[i], manifest);
            totalBytes += file.size;
            onProgress(totalBytes / headers.reduce((total, header) => total + header.size, 0));
            files.push(file);
        }

        return files;
    }

    validateRootNode(rootNode, files) {
        if (files.length === 1) {
            if (rootNode.t !== HashtreeTransferProtocol.fileType) throw new Error("Hashtree root file is invalid");
            return;
        }

        if (rootNode.t !== HashtreeTransferProtocol.dirType) throw new Error("Hashtree root directory is invalid");

        const linksByName = new Map(rootNode.l.map(link => [link.n, link]));
        for (const file of files) {
            const link = linksByName.get(file.name);
            if (!link) throw new Error("Hashtree root link is missing");
            if (BlossomTransferProtocol.bytesToHex(link.h) !== file.hash) throw new Error("Hashtree root link hash mismatch");
            if (link.s !== file.size) throw new Error("Hashtree root link size mismatch");
            if ((link.t ?? HashtreeTransferProtocol.blobLinkType) !== HashtreeTransferProtocol.fileLinkType) {
                throw new Error("Hashtree root link type mismatch");
            }
        }
    }

    async downloadFile(fileEntry, header, manifest) {
        const node = await this.downloadNode(fileEntry.hash, manifest);
        if (node.t !== HashtreeTransferProtocol.fileType) throw new Error("Hashtree file node is invalid");

        const chunks = [];
        let size = 0;

        for (const link of node.l) {
            if ((link.t ?? HashtreeTransferProtocol.blobLinkType) !== HashtreeTransferProtocol.blobLinkType) {
                throw new Error("Hashtree file link is invalid");
            }

            const chunk = await this.downloadObject(BlossomTransferProtocol.bytesToHex(link.h), manifest);
            if (chunk.length !== link.s) throw new Error("Hashtree chunk size mismatch");
            chunks.push(chunk);
            size += chunk.length;
        }

        if (size !== header.size) throw new Error("Hashtree reconstructed file size mismatch");

        return new File(chunks, header.name, {
            type: header.mime || fileEntry.mime || "application/octet-stream"
        });
    }

    async downloadNode(hash, manifest) {
        const bytes = await this.downloadObject(hash, manifest);
        return HashtreeTransferProtocol.decodeNode(bytes);
    }

    async downloadObject(hash, manifest) {
        const descriptor = manifest.objects[hash];
        if (!descriptor) throw new Error("Hashtree object descriptor is missing");

        const response = await fetch(descriptor.url);
        if (!response.ok) throw new Error(`Hashtree object download failed with ${response.status}`);

        const bytes = new Uint8Array(await response.arrayBuffer());
        const actualHash = await HashtreeTransferProtocol.sha256Hex(bytes);
        if (actualHash !== hash) throw new Error("Hashtree object hash mismatch");
        if (bytes.length !== descriptor.size) throw new Error("Hashtree object size mismatch");

        return bytes;
    }

    _render() {
        if (!this.$button) return;

        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        this.$button.toggleAttribute("hidden", !identity);
        if (!identity) return;

        const translationKey = this._active
            ? "header.hashtree-transfer-disable"
            : "header.hashtree-transfer-enable";

        const serverState = this._serverListState();
        const unavailable = ["loading", "missing", "error"].includes(serverState.status);

        this.$button.title = this._titleForState(serverState.status)
            || Localization.getTranslation(`${translationKey}_title`);
        this.$button.classList.toggle("selected", this._active);
        this.$button.classList.toggle("loading", serverState.status === "loading");
        this.$button.classList.toggle("unavailable", unavailable);
        this.$button.setAttribute("aria-disabled", unavailable ? "true" : "false");
        this.$button.setAttribute("data-state", serverState.status);

        this.$button.removeAttribute("data-badge");
    }

    _serverUrls() {
        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        if (!identity) return globalThis.meshdropBlossomTransfer?._serverUrls() || [];

        return ProtocolServerPreferences.selectedServers("hashtree", identity.blossomServers);
    }

    _serverListState() {
        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        if (!identity) return {status: "idle", servers: []};

        return {
            status: identity.blossomServerListStatus || "loading",
            servers: ProtocolServerPreferences.normalizeServers(identity.blossomServers)
        };
    }

    _titleForState(status) {
        if (status === "loading") return "Waiting for your Blossom server list from Nostr relays.";
        if (status === "missing") return "No Blossom server list was found for this Nostr identity.";
        if (status === "error") return "Blossom server list lookup failed.";
        return "";
    }
}

globalThis.HashtreeTransferController = HashtreeTransferController;
