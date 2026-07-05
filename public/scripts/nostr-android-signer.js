class AndroidNostrSigner {

    static timeoutMs = 120000;

    static isAvailable() {
        try {
            return !!globalThis.meshdropAndroidBridge?.isNostrSignerInstalled?.();
        } catch {
            return false;
        }
    }

    constructor(identityProvider, packageName = "") {
        this._identityProvider = identityProvider;
        this._package = packageName;
        this.nip04 = {
            encrypt: (pubkey, plaintext) => this._cipher("nip04_encrypt", pubkey, plaintext),
            decrypt: (pubkey, ciphertext) => this._cipher("nip04_decrypt", pubkey, ciphertext)
        };
        this.nip44 = {
            encrypt: (pubkey, plaintext) => this._cipher("nip44_encrypt", pubkey, plaintext),
            decrypt: (pubkey, ciphertext) => this._cipher("nip44_decrypt", pubkey, ciphertext)
        };
    }

    async getPublicKey() {
        const response = await this._request({
            type: "get_public_key",
            permissions: JSON.stringify([
                {type: "sign_event", kind: 27235},
                {type: "nip04_encrypt"},
                {type: "nip04_decrypt"},
                {type: "nip44_encrypt"},
                {type: "nip44_decrypt"}
            ])
        });
        this._package = response.package || this._package || "";
        return response.result;
    }

    getPackage() {
        return this._package;
    }

    async signEvent(event) {
        const response = await this._request({
            type: "sign_event",
            payload: JSON.stringify(event),
            current_user: this._currentUser() || event.pubkey || "",
            returnType: "event",
            package: this._package || ""
        });
        return response.event ? JSON.parse(response.event) : {...event, sig: response.result};
    }

    async _cipher(type, pubkey, payload) {
        const response = await this._request({
            type,
            payload,
            pubkey,
            current_user: this._currentUser(),
            package: this._package || ""
        });
        return response.result;
    }

    _currentUser() {
        return this._identityProvider()?.pubkey || "";
    }

    _request(request) {
        const bridge = globalThis.meshdropAndroidBridge;
        if (!bridge?.requestNostrSigner) throw new Error("Android signer bridge is unavailable");

        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const payload = {...request, id};

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Android signer timed out"));
            }, AndroidNostrSigner.timeoutMs);

            const onResult = event => {
                if (event.detail?.id !== id) return;
                cleanup();
                if (event.detail.rejected) {
                    reject(new Error("Android signer request rejected"));
                    return;
                }
                if (event.detail.error) {
                    reject(new Error(event.detail.error));
                    return;
                }
                resolve(event.detail);
            };

            const cleanup = () => {
                clearTimeout(timeout);
                globalThis.removeEventListener?.("android-nostr-signer-result", onResult);
            };

            globalThis.addEventListener?.("android-nostr-signer-result", onResult);
            const started = bridge.requestNostrSigner(JSON.stringify(payload));
            if (!started) {
                cleanup();
                reject(new Error("Android signer could not be opened"));
            }
        });
    }
}

globalThis.AndroidNostrSigner = AndroidNostrSigner;
