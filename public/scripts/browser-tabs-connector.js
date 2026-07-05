class BrowserTabsConnector {
    constructor() {
        if (!('BroadcastChannel' in window)) return;

        this.bc = new BroadcastChannel('pairdrop');
        this.bc.addEventListener('message', e => this._onMessage(e));
        globalThis.Events.on('broadcast-send', e => this._broadcastSend(e.detail));
    }

    _broadcastSend(message) {
        this.bc.postMessage(message);
    }

    _onMessage(e) {
        console.log('Broadcast:', e.data)
        switch (e.data.type) {
            case 'self-display-name-changed':
                globalThis.Events.fire('self-display-name-changed', e.data.detail);
                break;
        }
    }

    static peerIsSameBrowser(peerId) {
        let peerIdsBrowser = JSON.parse(localStorage.getItem('peer_ids_browser'));
        return peerIdsBrowser
            ? peerIdsBrowser.indexOf(peerId) !== -1
            : false;
    }

    static async addPeerIdToLocalStorage() {
        const peerId = sessionStorage.getItem('peer_id');
        if (!peerId) return false;

        let peerIdsBrowser = [];
        let peerIdsBrowserOld = JSON.parse(localStorage.getItem('peer_ids_browser'));

        if (peerIdsBrowserOld) peerIdsBrowser.push(...peerIdsBrowserOld);
        peerIdsBrowser.push(peerId);
        peerIdsBrowser = peerIdsBrowser.filter((peer, index, peers) => peers.indexOf(peer) === index);
        localStorage.setItem('peer_ids_browser', JSON.stringify(peerIdsBrowser));

        return peerIdsBrowser;
    }

    static async removePeerIdFromLocalStorage(peerId) {
        let peerIdsBrowser = JSON.parse(localStorage.getItem('peer_ids_browser'));
        if (!peerId || !peerIdsBrowser) return false;

        const index = peerIdsBrowser.indexOf(peerId);
        if (index === -1) return false;

        peerIdsBrowser.splice(index, 1);
        localStorage.setItem('peer_ids_browser', JSON.stringify(peerIdsBrowser));
        return peerId;
    }


    static async removeOtherPeerIdsFromLocalStorage() {
        const peerId = sessionStorage.getItem('peer_id');
        if (!peerId) return false;

        let peerIdsBrowser = [peerId];
        localStorage.setItem('peer_ids_browser', JSON.stringify(peerIdsBrowser));
        return peerIdsBrowser;
    }
}

globalThis.BrowserTabsConnector = BrowserTabsConnector;
