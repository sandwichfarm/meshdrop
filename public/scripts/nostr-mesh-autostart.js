/* eslint-disable no-undef */

class NostrMeshAutostartController {

    constructor() {
        this._scheduled = false;

        Events.on("config", _ => this._schedule());
        Events.on("nostr-identity-changed", _ => this._schedule());
        Events.on("nostr-signer-available-changed", _ => this._schedule());

        this._schedule();
    }

    _schedule() {
        if (this._scheduled) return;

        this._scheduled = true;
        setTimeout(() => {
            this._scheduled = false;
            this._startIfReady();
        }, 0);
    }

    _startIfReady() {
        const anchor = $("nostr-mesh");
        if (anchor?.getAttribute("aria-hidden") !== "true") return;

        const mesh = globalThis.meshdropNostrMesh;
        const identityController = globalThis.meshdropNostrIdentity;
        const identity = identityController?.getIdentity?.();
        if (!mesh || !identity?.pubkey || mesh._active || mesh._connecting || !mesh._configLoaded) return;
        if (!globalThis.NostrMeshProtocol?.enabledFromConfig?.(mesh._config)) return;
        if (!identityController.canEncrypt?.()) return;

        mesh.connect({notify: false, remember: false})
            .then(() => this._publishStartupPresence(mesh))
            .catch(error => {
                console.warn("Nostr mesh autostart failed", error);
            });
    }

    _publishStartupPresence(mesh) {
        [500, 1500, 3500].forEach(delay => {
            setTimeout(() => {
                if (mesh._active) mesh._publishPresence("connect");
            }, delay);
        });
    }
}

globalThis.NostrMeshAutostartController = NostrMeshAutostartController;
