const nativeShareInboxEvents = globalThis.Events;
const nativeShareInboxLocalization = globalThis.Localization;
const nativeShareInboxQueueMicrotask = globalThis.queueMicrotask
    || (callback => Promise.resolve().then(callback));

class NativeShareInboxUI {
    constructor() {
        this._signature = "";
        nativeShareInboxEvents.on("meshdrop:shared-files", event => {
            this.evaluate(event.detail).catch(error => {
                console.error("Failed to read native share inbox", error);
                nativeShareInboxEvents.fire(
                    "notify-user",
                    nativeShareInboxLocalization.getTranslation("notifications.file-content-incorrect")
                );
            });
        });
        nativeShareInboxQueueMicrotask(() => {
            this.evaluate().catch(error => {
                console.error("Failed to read native share inbox", error);
            });
        });
    }

    async evaluate(entries = null, inbox = globalThis.meshdropShareInbox) {
        if (!inbox || typeof inbox.read !== "function") return [];

        const sharedEntries = Array.isArray(entries) ? entries : await this._list(inbox);
        if (!sharedEntries.length) return [];

        const signature = this._signatureFor(sharedEntries);
        if (signature && signature === this._signature) return [];
        this._signature = signature;

        const files = await Promise.all(sharedEntries.map(entry => this._file(entry, inbox)));
        if (!files.length) return [];

        nativeShareInboxEvents.fire("activate-share-mode", {files});
        return files;
    }

    async _list(inbox) {
        if (typeof inbox.list !== "function") return [];
        const entries = await inbox.list();
        return Array.isArray(entries) ? entries : [];
    }

    _signatureFor(entries) {
        return entries
            .map(entry => [entry.path || "", entry.name || "", entry.receivedAt || ""].join(":"))
            .join("\n");
    }

    async _file(entry, inbox) {
        const response = await inbox.read(entry.path || entry.name);
        const bytes = this._bytesFromBase64(response.base64 || "");
        const lastModified = Date.parse(entry.receivedAt || "") || Date.now();
        return new File([bytes], entry.name || response.name || "shared-file", {
            type: entry.type || "application/octet-stream",
            lastModified
        });
    }

    _bytesFromBase64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}

globalThis.NativeShareInboxUI = NativeShareInboxUI;
