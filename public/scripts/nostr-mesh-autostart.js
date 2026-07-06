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
        if (globalThis.__meshdropDisableNostrRelayNetwork && !globalThis.__meshdropAllowNostrRelayAutostart) return;

        const mesh = globalThis.meshdropNostrMesh;
        const identityController = globalThis.meshdropNostrIdentity;
        const identity = identityController?.getIdentity?.();
        if (!mesh || !identity?.pubkey || mesh._active || mesh._connecting || !mesh._configLoaded) return;
        if (!globalThis.NostrMeshProtocol?.enabledFromConfig?.(mesh._config)) return;
        if (!identityController.canEncrypt?.()) return;
        if (globalThis.NostrMeshProtocol?.hasEnabledPreference?.() && !globalThis.NostrMeshProtocol.readEnabled()) return;

        mesh.connect({notify: false, remember: false})
            .then(() => this._publishStartupPresence(mesh))
            .catch(error => {
                console.warn("Nostr mesh autostart failed", error);
            });
    }

    _publishStartupPresence(mesh) {
        [500, 1500, 3500].forEach(delay => {
            setTimeout(() => {
                if (!mesh._active) return;
                mesh._identity = globalThis.meshdropNostrIdentity?.getIdentity?.() || mesh._identity;
                mesh._publishPresence("connect");
            }, delay);
        });
    }
}

globalThis.NostrMeshAutostartController = NostrMeshAutostartController;
