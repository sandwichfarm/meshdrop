const cacheVersion = 'v1.11.9-route-status-polish-verified';
const cacheTitle = `meshdrop-cache-${cacheVersion}`;
const relativePathsToCache = [
    './',
    'index.html',
    'manifest.json',
    'styles/styles-main.css',
    'styles/styles-deferred.css',
    'scripts/browser-tabs-connector.js',
    'scripts/localization.js',
    'scripts/main.js',
    'scripts/network.js',
    'scripts/persistent-storage.js',
    'scripts/ui.js',
    'scripts/ui-main.js',
    'scripts/util.js',
    'scripts/nostr-relays.js',
    'scripts/route-contract.js',
    'scripts/nostr-mesh-autostart.js',
    'scripts/worker/canvas-worker.js',
    'scripts/libs/noble-ciphers/LICENSE',
    'scripts/libs/noble-ciphers/_polyval.js',
    'scripts/libs/noble-ciphers/aes.js',
    'scripts/libs/noble-ciphers/utils.js',
    'scripts/libs/noble-hashes/LICENSE',
    'scripts/libs/noble-hashes/_md.js',
    'scripts/libs/noble-hashes/_u64.js',
    'scripts/libs/noble-hashes/sha2.js',
    'scripts/libs/noble-hashes/utils.js',
    'scripts/libs/heic2any.min.js',
    'scripts/libs/no-sleep.min.js',
    'scripts/libs/qr-code.min.js',
    'scripts/libs/zip.min.js',
    'sounds/blop.mp3',
    'sounds/blop.ogg',
    'images/favicon-96x96.png',
    'images/favicon-96x96-notification.png',
    'images/android-chrome-192x192.png',
    'images/android-chrome-192x192-maskable.png',
    'images/android-chrome-512x512.png',
    'images/android-chrome-512x512-maskable.png',
    'images/apple-touch-icon.png',
    'fonts/OpenSans/static/OpenSans-Medium.ttf',
    'lang/ar.json',
    'lang/be.json',
    'lang/bg.json',
    'lang/ca.json',
    'lang/cs.json',
    'lang/da.json',
    'lang/de.json',
    'lang/en.json',
    'lang/es.json',
    'lang/et.json',
    'lang/eu.json',
    'lang/fa.json',
    'lang/fr.json',
    'lang/he.json',
    'lang/hu.json',
    'lang/id.json',
    'lang/it.json',
    'lang/ja.json',
    'lang/kn.json',
    'lang/ko.json',
    'lang/nb.json',
    'lang/nl.json',
    'lang/nn.json',
    'lang/pl.json',
    'lang/pt-BR.json',
    'lang/ro.json',
    'lang/ru.json',
    'lang/sk.json',
    'lang/ta.json',
    'lang/tr.json',
    'lang/uk.json',
    'lang/zh-CN.json',
    'lang/zh-HK.json',
    'lang/zh-TW.json'
];
const relativePathsNotToCache = [
    'config'
]

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(cacheTitle)
            .then(function(cache) {
                return cache
                    .addAll(relativePathsToCache)
                    .then(_ => {
                        self.skipWaiting();
                    });
            })
    );
});

const fromNetwork = (request, timeout) =>
    new Promise((resolve, reject) => {
        const timeoutId = setTimeout(reject, timeout);
        fetch(request, {cache: "no-store"})
            .then(response => {
                if (response.redirected) {
                    throw new Error("Fetch is redirect. Abort usage and cache!");
                }

                clearTimeout(timeoutId);
                resolve(response);

                if (doNotCacheRequest(request)) return;

                updateCache(request)
                    .catch(err => console.error("Cache could not be updated for", request.url, err));
            })
            .catch(error => {
                console.error(`Could not fetch ${request.url}.`);
                reject(error);
            });
    });

const fromCache = request =>
    caches
        .open(cacheTitle)
        .then(cache =>
            cache.match(request)
        );

const rootUrl = location.href.substring(0, location.href.length - "service-worker.js".length);
const rootUrlLength = rootUrl.length;

const doNotCacheRequest = request => {
    const requestRelativePath = request.url.substring(rootUrlLength);
    return relativePathsNotToCache.indexOf(requestRelativePath) !== -1
};

const updateCache = request => new Promise((resolve, reject) => {
    caches
        .open(cacheTitle)
        .then(cache =>
            fetch(request, {cache: "no-store"})
                .then(response => {
                    if (response.redirected) {
                        throw new Error("Fetch is redirect. Abort usage and cache!");
                    }

                    cache
                        .put(request, response)
                        .then(() => resolve());
                })
                .catch(reason => reject(reason))
        );
});

self.addEventListener('fetch', function(event) {
    const swOrigin = new URL(self.location.href).origin;
    const requestOrigin = new URL(event.request.url).origin;

    if (swOrigin !== requestOrigin) {
        // Do not handle requests from other origin
        event.respondWith(fetch(event.request));
    }
    else if (event.request.method === "POST") {
        // Requests related to Web Share Target.
        event.respondWith((async () => {
            const share_url = await evaluateRequestData(event.request);
            return Response.redirect(encodeURI(share_url), 302);
        })());
    }
    else {
        // Regular requests not related to Web Share Target:
        // If request is excluded from cache -> respondWith fromNetwork
        // else -> try fromCache first
        event.respondWith(
            doNotCacheRequest(event.request)
                ? fromNetwork(event.request, 10000)
                : fromCache(event.request)
                    .then(rsp => {
                        // if fromCache resolves to undefined fetch from network instead
                        if (!rsp) {
                            throw new Error("No match found.");
                        }
                        return rsp;
                    })
                    .catch(error => {
                        console.error("Could not retrieve request from cache:", event.request.url, error);
                        return fromNetwork(event.request, 10000);
                    })
        );
    }
});

self.addEventListener('activate', evt => {
    evt.waitUntil(globalThis.clients.claim());
    return evt.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== cacheTitle) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    )
});

const evaluateRequestData = async function (request) {
    const formData = await request.formData();
    const title = formData.get("title");
    const text = formData.get("text");
    const url = formData.get("url");
    const files = formData.getAll("allfiles");

    const pairDropUrl = request.url;

    if (files && files.length > 0) {
        let fileObjects = [];
        for (let i=0; i<files.length; i++) {
            fileObjects.push({
                name: files[i].name,
                buffer: await files[i].arrayBuffer()
            });
        }

        return new Promise(resolve => {
            const DBOpenRequest = indexedDB.open('pairdrop_store');
            DBOpenRequest.onsuccess = e => {
                const db = e.target.result;
                for (let i = 0; i < fileObjects.length; i++) {
                    const transaction = db.transaction('share_target_files', 'readwrite');
                    const objectStore = transaction.objectStore('share_target_files');

                    const objectStoreRequest = objectStore.add(fileObjects[i]);
                    objectStoreRequest.onsuccess = _ => {
                        if (i === fileObjects.length - 1) resolve(pairDropUrl + '?share_target=files');
                    }
                }
            }
            DBOpenRequest.onerror = _ => {
                resolve(pairDropUrl);
            }
        });
    }

    let urlArgument = '?share_target=text';

    if (title) urlArgument += `&title=${title}`;
    if (text) urlArgument += `&text=${text}`;
    if (url) urlArgument += `&url=${url}`;

    return pairDropUrl + urlArgument;
}
