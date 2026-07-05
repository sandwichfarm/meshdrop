class AndroidNostrSigner {

    static timeoutMs = 120000;

    static isAvailable() {
        try {
            return !!globalThis.meshdropAndroidBridge?.isNostrSignerInstalled?.();
        } catch {
            return false;
        }
    }

    constructor(identityProvider) {
        this._identityProvider = identityProvider;
        this._package = "";
    }

    async getPublicKey() {
        const response = await this._request({type: "get_public_key"});
        this._package = response.package || this._package || "";
        return response.result;
    }

    async signEvent(event) {
        const response = await this._request({
            type: "sign_event",
            payload: JSON.stringify(event),
            current_user: this._identityProvider()?.pubkey || event.pubkey || "",
            returnType: "event",
            package: this._package || ""
        });
        return response.event ? JSON.parse(response.event) : {...event, sig: response.result};
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
