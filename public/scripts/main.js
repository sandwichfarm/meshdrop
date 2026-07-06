class PairDrop {

    constructor() {
        this.$headerNotificationBtn = globalThis.$('notification');
        this.$headerEditPairedDevicesBtn = globalThis.$('edit-paired-devices');
        this.$footerPairedDevicesBadge = globalThis.$$('.discovery-wrapper .badge-room-secret');
        this.$headerInstallBtn = globalThis.$('install');

        this.deferredStyles = [
            "styles/styles-deferred.css"
        ];
        this.deferredScripts = [
            "scripts/browser-tabs-connector.js",
            "scripts/util.js",
            "scripts/nostr-relays.js",
            "scripts/nostr-relay-globals.js",
            "scripts/nostr-pubkey.js",
            "scripts/nostr-android-signer.js",
            "scripts/nostr-identity.js",
            "scripts/local-discovery.js",
            "scripts/nostr-mesh.js",
            "scripts/nostr-mesh-autostart.js",
            "scripts/blossom-transfer.js",
            "scripts/hashtree-transfer.js",
            "scripts/pollen-transfer.js",
            "scripts/fips-discovery.js",
            "scripts/network.js",
            "scripts/ui.js",
            "scripts/native-share-inbox.js",
            "scripts/nostr-login-dialog.js",
            "scripts/libs/heic2any.min.js",
            "scripts/libs/no-sleep.min.js",
            "scripts/libs/qr-code.min.js",
            "scripts/libs/zip.min.js"
        ];

        this.registerServiceWorker();

        globalThis.Events.on('beforeinstallprompt', e => this.onPwaInstallable(e));

        this.persistentStorage = new globalThis.PersistentStorage();
        this.localization = new globalThis.Localization();
        this.themeUI = new globalThis.ThemeUI();
        this.backgroundCanvas = new globalThis.BackgroundCanvas();
        this.headerUI = new globalThis.HeaderUI();
        this.centerUI = new globalThis.CenterUI();
        this.footerUI = new globalThis.FooterUI();

        this.initialize()
            .then(_ => {
                console.log("Initialization completed.");
            });
    }

    async initialize() {
        // Translate page before fading in
        await this.localization.setInitialTranslation()
        console.log("Initial translation successful.");

        // Show "Loading..." until connected to WsServer
        await this.footerUI.showLoading();

        // Evaluate css shifting UI elements and fade in UI elements
        await this.evaluatePermissionsAndRoomSecrets();
        await this.headerUI.evaluateOverflowing();
        await this.headerUI.fadeIn();
        await this.footerUI._evaluateFooterBadges();
        await this.footerUI.fadeIn();
        await this.centerUI.fadeIn();
        await this.backgroundCanvas.fadeIn();

        // Load deferred assets
        console.log("Load deferred assets...");
        await this.loadDeferredAssets();
        console.log("Loading of deferred assets completed.");

        console.log("Hydrate UI...");
        await this.hydrate();
        console.log("UI hydrated.");

        // Evaluate url params as soon as ws is connected
        console.log("Evaluate URL params as soon as websocket connection is established.");
        globalThis.Events.on('ws-connected', _ => this.evaluateUrlParams(), {once: true});
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator && ["http:", "https:"].includes(location.protocol)) {
            const hadController = !!navigator.serviceWorker.controller;
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!hadController || refreshing) return;
                refreshing = true;
                window.location.reload();
            });

            navigator.serviceWorker
                .register('service-worker.js')
                .then(serviceWorker => {
                    console.log('Service Worker registered');
                    window.serviceWorker = serviceWorker;
                    serviceWorker?.update?.();
                });
        }
    }

    onPwaInstallable(e) {
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            // only display install btn when not installed
            this.$headerInstallBtn.removeAttribute('hidden');
            this.$headerInstallBtn.addEventListener('click', () => {
                this.$headerInstallBtn.setAttribute('hidden', true);
                e.prompt();
            });
        }
        return e.preventDefault();
    }

    async evaluatePermissionsAndRoomSecrets() {
        // Check whether notification permissions have already been granted
        if ('Notification' in window && Notification.permission !== 'granted') {
            this.$headerNotificationBtn.removeAttribute('hidden');
        }

        let roomSecrets = await globalThis.PersistentStorage.getAllRoomSecrets();
        if (roomSecrets.length > 0) {
            this.$headerEditPairedDevicesBtn.removeAttribute('hidden');
            this.$footerPairedDevicesBadge.removeAttribute('hidden');
        }
    }

    loadDeferredAssets() {
        const stylePromises = this.deferredStyles.map(url => this.loadAndApplyStylesheet(url));

        return Promise.all(stylePromises)
            .then(() => this.loadDeferredScripts());
    }

    async loadDeferredScripts() {
        for (const url of this.deferredScripts) {
            await this.loadAndApplyScript(url);
        }
    }

    loadStyleSheet(url) {
        return new Promise((resolve, reject) => {
            let stylesheet = document.createElement('link');
            stylesheet.rel = 'preload';
            stylesheet.as = 'style';
            stylesheet.href = url;
            stylesheet.onload = _ => {
                stylesheet.onload = null;
                stylesheet.rel = 'stylesheet';
                resolve();
            };
            stylesheet.onerror = reject;

            document.head.appendChild(stylesheet);
        });
    }

    async loadAndApplyStylesheet(url) {
        try {
            await this.loadStyleSheet(url);
            console.log(`Stylesheet loaded successfully: ${url}`);
        } catch (error) {
            console.error('Error loading stylesheet:', error);
        }
    }

    loadScript(url) {
        return new Promise((resolve, reject) => {
            let script = document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;

            document.body.appendChild(script);
        });
    }

    async loadAndApplyScript(url) {
        try {
            await this.loadScript(url);
            console.log(`Script loaded successfully: ${url}`);
        } catch (error) {
            console.error('Error loading script:', error);
        }
    }

    async hydrate() {
        this.aboutUI = new globalThis.AboutUI();
        this.peersUI = new globalThis.PeersUI();
        this.languageSelectDialog = new globalThis.LanguageSelectDialog();
        this.receiveFileDialog = new globalThis.ReceiveFileDialog();
        this.receiveRequestDialog = new globalThis.ReceiveRequestDialog();
        this.sendTextDialog = new globalThis.SendTextDialog();
        this.receiveTextDialog = new globalThis.ReceiveTextDialog();
        this.pairDeviceDialog = new globalThis.PairDeviceDialog();
        this.clearDevicesDialog = new globalThis.EditPairedDevicesDialog();
        this.publicRoomDialog = new globalThis.PublicRoomDialog();
        this.base64Dialog = new globalThis.Base64Dialog();
        this.shareTextDialog = new globalThis.ShareTextDialog();
        this.protocolSettingsDialog = new globalThis.ProtocolSettingsDialog();
        this.transferChoiceDialog = new globalThis.TransferChoiceDialog();
        this.nostrLoginDialog = new globalThis.NostrLoginDialog();
        this.toast = new globalThis.Toast();
        this.notifications = new globalThis.Notifications();
        this.networkStatusUI = new globalThis.NetworkStatusUI();
        this.webShareTargetUI = new globalThis.WebShareTargetUI();
        this.nativeShareInboxUI = new globalThis.NativeShareInboxUI();
        this.webFileHandlersUI = new globalThis.WebFileHandlersUI();
        this.noSleepUI = new globalThis.NoSleepUI();
        this.broadCast = new globalThis.BrowserTabsConnector();
        this.nostrIdentity = new globalThis.NostrIdentityController();
        this.localDiscovery = new globalThis.LocalDiscoveryController();
        this.nostrMesh = new globalThis.NostrMeshConnection();
        this.nostrMeshAutostart = new globalThis.NostrMeshAutostartController();
        this.blossomTransfer = new globalThis.BlossomTransferController();
        this.hashtreeTransfer = new globalThis.HashtreeTransferController();
        this.pollenTransfer = new globalThis.PollenTransferController();
        this.fipsDiscovery = new globalThis.FipsDiscoveryController();
        this.server = new globalThis.ServerConnection();
        this.peers = new globalThis.PeersManager(this.server);
        if (globalThis.__meshdropE2E) {
            globalThis.__meshdropE2E.peersManager = this.peers;
        }
    }

    async evaluateUrlParams() {
        // get url params
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash.substring(1);

        // evaluate url params
        if (urlParams.has('pair_key')) {
            const pairKey = urlParams.get('pair_key');
            this.pairDeviceDialog._pairDeviceJoin(pairKey);
        }
        else if (urlParams.has('room_id')) {
            const roomId = urlParams.get('room_id');
            this.publicRoomDialog._joinPublicRoom(roomId);
        }
        else if (urlParams.has('base64text')) {
            const base64Text = urlParams.get('base64text');
            await this.base64Dialog.evaluateBase64Text(base64Text, hash);
        }
        else if (urlParams.has('base64zip')) {
            const base64Zip = urlParams.get('base64zip');
            await this.base64Dialog.evaluateBase64Zip(base64Zip, hash);
        }
        else if (urlParams.has("share_target")) {
            const shareTargetType = urlParams.get("share_target");
            const title = urlParams.get('title') || '';
            const text = urlParams.get('text') || '';
            const url = urlParams.get('url') || '';
            await this.webShareTargetUI.evaluateShareTarget(shareTargetType, title, text, url);
        }
        else if (urlParams.has("file_handler")) {
            await this.webFileHandlersUI.evaluateLaunchQueue();
        }
        else if (urlParams.has("init")) {
            const init = urlParams.get("init");
            if (init === "pair") {
                this.pairDeviceDialog._pairDeviceInitiate();
            }
            else if (init === "public_room") {
                this.publicRoomDialog._createPublicRoom();
            }
        }

        // remove url params from url
        const urlWithoutParams = globalThis.getUrlWithoutArguments();
        window.history.replaceState({}, "Rewrite URL", urlWithoutParams);

        console.log("URL params evaluated.");
    }
}

new PairDrop();
