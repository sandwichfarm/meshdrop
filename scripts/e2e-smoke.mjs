import {spawn} from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";

import {WebSocketServer} from "ws";
import {chromium} from "/usr/lib/node_modules/playwright/index.mjs";

const repoRoot = new URL("..", import.meta.url);
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/usr/bin/chromium";

const helpers = [];

async function main() {
    const appPort = await freePort();
    const relay = await startFakeRelay();
    const blossom = await startFakeBlossom();
    const fips = await startFakeFips();
    const app = startApp(appPort, relay.port, blossom.port, fips.port);
    helpers.push(app);

    const baseUrl = `http://127.0.0.1:${appPort}`;
    await waitForHttp(`${baseUrl}/config`);

    const browser = await chromium.launch({
        headless: true,
        executablePath: chromiumPath
    });

    try {
        await runVisibilityScenario(browser, baseUrl);

        await runTransferScenario(browser, baseUrl, {
            name: "direct",
            fileName: "direct.txt",
            contents: ["direct-ok"]
        });

        await runTransferScenario(browser, baseUrl, {
            name: "blossom",
            fileName: "blossom.txt",
            contents: ["blossom-ok"],
            setupSender: async page => {
                await connectNostrIdentity(page);
                await page.evaluate(() => globalThis.meshdropBlossomTransfer.enable());
                await page.waitForFunction(() => globalThis.meshdropBlossomTransfer.isActive());
            }
        });

        await runTransferScenario(browser, baseUrl, {
            name: "hashtree",
            fileName: "hashtree-a.txt",
            contents: ["hashtree-a", "hashtree-b"],
            setupSender: async page => {
                await connectNostrIdentity(page);
                await page.evaluate(() => globalThis.meshdropHashtreeTransfer.enable());
                await page.waitForFunction(() => globalThis.meshdropHashtreeTransfer.isActive());
            }
        });

        await runTransferScenario(browser, baseUrl, {
            name: "fips",
            fileName: "fips.txt",
            contents: ["fips-ok"],
            setupBoth: async pages => {
                await Promise.all(pages.map(page => page.evaluate(() => globalThis.meshdropFipsDiscovery.enable())));
                await Promise.all(pages.map(page => (
                    page.waitForFunction(() => globalThis.meshdropFipsDiscovery.isActive())
                )));
            }
        });

        await runTransferScenario(browser, baseUrl, {
            name: "nostr",
            fileName: "nostr.txt",
            contents: ["nostr-ok"],
            nostrOnly: true,
            setupBoth: async pages => {
                await Promise.all(pages.map(connectNostrIdentity));
                await Promise.all(pages.map(page => page.evaluate(() => globalThis.meshdropNostrMesh.connect())));
                await Promise.all(pages.map(page => page.waitForFunction(() => globalThis.meshdropNostrMesh._active)));
            }
        });
    }
    finally {
        await browser.close();
    }

    console.log(`Browser E2E smoke passed on ${baseUrl}`);
}

async function runVisibilityScenario(browser, baseUrl) {
    const context = await newContext(browser, "unsigned", {signer: false});
    const page = await context.newPage();

    try {
        await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
        await waitForHydration(page);
        await page.waitForFunction(() => !document.getElementById("fips-discovery").hasAttribute("hidden"));

        const visibility = await page.evaluate(() => ({
            nostrIdentity: document.getElementById("nostr-identity").hasAttribute("hidden"),
            nostrMesh: document.getElementById("nostr-mesh").hasAttribute("hidden"),
            blossom: document.getElementById("blossom-transfer").hasAttribute("hidden"),
            hashtree: document.getElementById("hashtree-transfer").hasAttribute("hidden"),
            fips: document.getElementById("fips-discovery").hasAttribute("hidden")
        }));

        assert(visibility.nostrIdentity, "Nostr sign-in should be hidden without a NIP-07 signer");
        assert(visibility.nostrMesh, "Nostr mesh should be hidden before sign-in");
        assert(visibility.blossom, "Blossom transfer should be hidden before sign-in");
        assert(visibility.hashtree, "Hashtree transfer should be hidden before sign-in");
        assert(!visibility.fips, "FIPS discovery should be visible when the daemon is reachable");
    }
    finally {
        await context.close();
    }
}

async function runTransferScenario(browser, baseUrl, options) {
    const contextA = await newContext(browser, "a");
    const contextB = await newContext(browser, "b");
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const logs = watchPages(options.name, [pageA, pageB]);

    try {
        await Promise.all([
            pageA.goto(baseUrl, {waitUntil: "domcontentloaded"}),
            pageB.goto(baseUrl, {waitUntil: "domcontentloaded"})
        ]);

        await Promise.all([waitForHydration(pageA), waitForHydration(pageB)]);
        await assertMeshDropBranding(pageA);

        if (options.nostrOnly) {
            await leaveIpRoom(pageA);
            await leaveIpRoom(pageB);
        }

        if (options.setupBoth) await options.setupBoth([pageA, pageB]);
        if (options.setupSender) await options.setupSender(pageA);
        if (options.setupReceiver) await options.setupReceiver(pageB);

        const peerId = await waitForConnectedPeer(pageA, options.nostrOnly ? "nostr" : null);
        await sendFiles(pageA, peerId, options.fileName, options.contents);

        const received = await waitForReceivedFiles(pageB, options.contents.length);
        assertReceived(options, received);
        assert(!logs.pageErrors.length, `${options.name}: page errors: ${logs.pageErrors.join("\n")}`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function newContext(browser, identityName, options = {}) {
    const context = await browser.newContext({
        serviceWorkers: "block"
    });

    await context.addInitScript(({name, signer}) => {
        globalThis.__meshdropDisableNostrRelayNetwork = true;

        const pubkey = name === "a"
            ? "1".repeat(64)
            : "2".repeat(64);
        const displayName = `npub ${pubkey.slice(0, 8)}`;
        let counter = 0;

        if (signer) {
            globalThis.nostr = {
                getPublicKey: async () => pubkey,
                signEvent: async event => ({
                    ...event,
                    pubkey,
                    id: `${pubkey.slice(0, 32)}${String(++counter).padStart(32, "0")}`.slice(0, 64),
                    sig: "3".repeat(128)
                }),
                nip04: {
                    encrypt: async (_pubkey, plaintext) => plaintext,
                    decrypt: async (_pubkey, ciphertext) => ciphertext
                }
            };

            localStorage.setItem("meshdrop_nostr_identity", JSON.stringify({
                pubkey,
                displayName,
                picture: "",
                relays: {read: [], write: []},
                blossomServers: [],
                event: {
                    kind: 27235,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ["client", "meshdrop"],
                        ["origin", location.origin],
                        ["name", displayName]
                    ],
                    content: "MeshDrop Nostr identity",
                    pubkey,
                    id: `${pubkey.slice(0, 32)}${"0".repeat(32)}`,
                    sig: "3".repeat(128)
                }
            }));
        }

        globalThis.__meshdropE2E = {
            connected: [],
            received: [],
            configLoaded: false,
            wsConnected: false
        };

        window.addEventListener("config", () => {
            globalThis.__meshdropE2E.configLoaded = true;
        });

        window.addEventListener("ws-connected", () => {
            globalThis.__meshdropE2E.wsConnected = true;
        });

        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropE2E.connected.push(event.detail.peerId);
        });

        window.addEventListener("files-transfer-request", event => {
            window.dispatchEvent(new CustomEvent("respond-to-files-transfer-request", {
                detail: {
                    to: event.detail.peerId,
                    accepted: true
                }
            }));
        });

        window.addEventListener("files-received", async event => {
            const files = await Promise.all(event.detail.files.map(async file => ({
                name: file.name,
                type: file.type,
                size: file.size,
                text: await file.text()
            })));
            globalThis.__meshdropE2E.received.push({peerId: event.detail.peerId, files});
        });
    }, {name: identityName, signer: options.signer !== false});

    return context;
}

function watchPages(name, pages) {
    const pageErrors = [];

    pages.forEach((page, index) => {
        const label = `${name}:${index === 0 ? "sender" : "receiver"}`;
        page.on("pageerror", error => pageErrors.push(`${label}: ${error.message}`));
        page.on("console", message => {
            if (message.type() !== "error") return;
            const text = message.text();
            if (text.includes("RTCErrorEvent")) return;
            console.warn(`${label} console error: ${text}`);
        });
    });

    return {pageErrors};
}

async function waitForHydration(page) {
    await page.waitForFunction(() => (
        globalThis.meshdropNostrIdentity
        && globalThis.meshdropNostrMesh
        && globalThis.meshdropBlossomTransfer
        && globalThis.meshdropHashtreeTransfer
        && globalThis.meshdropFipsDiscovery
        && globalThis.__meshdropE2E.configLoaded
        && globalThis.__meshdropE2E.wsConnected
        && document.querySelector("x-peers")
    ));
}

async function assertMeshDropBranding(page) {
    const branding = await page.evaluate(() => ({
        title: document.title,
        appName: document.querySelector("meta[name='application-name']")?.content,
        aboutLinks: [...document.querySelectorAll("#about a")]
            .map(link => link.href)
    }));

    assert(branding.title.startsWith("MeshDrop"), `Unexpected document title: ${branding.title}`);
    assert(branding.appName === "MeshDrop", `Unexpected application name: ${branding.appName}`);
    [
        "https://github.com/sandwichfarm/PairDrop",
        "https://nostr.com/",
        "https://github.com/hzrd149/blossom",
        "https://hashtree.cc/",
        "https://github.com/nostr-protocol/nips/pull/363",
        "https://fips.network/",
        "https://github.com/schlagmichdoch/PairDrop"
    ].forEach(href => {
        assert(branding.aboutLinks.includes(href), `Missing info overlay link: ${href}`);
    });
}

async function connectNostrIdentity(page) {
    const hasIdentity = await page.evaluate(() => !!globalThis.meshdropNostrIdentity.getIdentity());
    if (hasIdentity) return;

    await page.evaluate(() => globalThis.meshdropNostrIdentity.connect());
    await page.waitForFunction(() => !!globalThis.meshdropNostrIdentity.getIdentity());
}

async function leaveIpRoom(page) {
    await page.evaluate(() => {
        const peerIds = [...document.querySelectorAll("x-peer.type-ip")].map(peer => peer.id);
        for (const peerId of peerIds) {
            window.dispatchEvent(new CustomEvent("peer-disconnected", {detail: peerId}));
        }
    });
}

async function waitForConnectedPeer(page, roomType) {
    const peerId = await page.waitForFunction(type => {
        const selector = type ? `x-peer.type-${type}` : "x-peer";
        const peer = document.querySelector(selector);
        if (!peer) return "";
        if (!globalThis.__meshdropE2E.connected.includes(peer.id)) return "";
        return peer.id;
    }, roomType, {timeout: 20000});

    return peerId.jsonValue();
}

async function sendFiles(page, peerId, firstFileName, contents) {
    await page.evaluate(({to, fileName, payloads}) => {
        const files = payloads.map((payload, index) => {
            const name = index === 0 ? fileName : fileName.replace(/(\.[^.]+)?$/, `-${index + 1}$1`);
            return new File([payload], name, {type: "text/plain"});
        });

        window.dispatchEvent(new CustomEvent("files-selected", {
            detail: {to, files}
        }));
    }, {
        to: peerId,
        fileName: firstFileName,
        payloads: contents
    });
}

async function waitForReceivedFiles(page, expectedCount) {
    const handle = await page.waitForFunction(count => {
        const batch = globalThis.__meshdropE2E.received.at(-1);
        if (!batch || batch.files.length !== count) return null;
        return batch.files;
    }, expectedCount, {timeout: 30000});

    return handle.jsonValue();
}

function assertReceived(options, received) {
    const texts = received.map(file => file.text);
    assert(
        JSON.stringify(texts) === JSON.stringify(options.contents),
        `${options.name}: received ${JSON.stringify(texts)}, expected ${JSON.stringify(options.contents)}`
    );

    assert(
        received.every(file => file.name.startsWith(options.fileName.replace(/\.[^.]+$/, ""))),
        `${options.name}: received unexpected file names ${received.map(file => file.name).join(", ")}`
    );
}

function startApp(port, relayPort, blossomPort, fipsPort) {
    const child = spawn("node", ["server/index.js", "--localhost-only"], {
        cwd: repoRoot,
        env: {
            ...process.env,
            PORT: String(port),
            NOSTR_RELAYS: `ws://127.0.0.1:${relayPort}`,
            NOSTR_ROOM: "e2e",
            BLOSSOM_SERVERS: `http://127.0.0.1:${blossomPort}`,
            FIPS_CONTROL_SOCKET: String(fipsPort),
            FIPS_ROOM: "e2e-fips",
            RTC_CONFIG: "false"
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", chunk => {
        if (process.env.MESHDROP_E2E_LOGS) process.stdout.write(chunk);
    });
    child.stderr.on("data", chunk => process.stderr.write(chunk));

    return {
        async close() {
            await stopChild(child);
        }
    };
}

async function startFakeRelay() {
    const port = await freePort();
    const wss = new WebSocketServer({port, host: "127.0.0.1"});
    const subscriptions = new Map();
    const history = [];

    wss.on("connection", socket => {
        subscriptions.set(socket, new Set());
        socket.on("message", raw => {
            let message;
            try {
                message = JSON.parse(raw.toString("utf8"));
            } catch {
                return;
            }

            if (message[0] === "REQ" && message[1]) {
                subscriptions.get(socket).add(message[1]);
                for (const event of history) sendRelayEvent(socket, message[1], event);
                return;
            }

            if (message[0] === "EVENT" && message[1]) {
                history.push(message[1]);
                for (const [client, subIds] of subscriptions.entries()) {
                    for (const subId of subIds) sendRelayEvent(client, subId, message[1]);
                }
            }
        });
        socket.on("close", () => subscriptions.delete(socket));
    });

    helpers.push({
        async close() {
            await new Promise(resolve => wss.close(resolve));
        }
    });

    return {port};
}

function sendRelayEvent(socket, subscriptionId, event) {
    if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
    }
}

async function startFakeBlossom() {
    const port = await freePort();
    const objects = new Map();
    const origin = `http://127.0.0.1:${port}`;

    const server = http.createServer(async (request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-SHA-256");

        if (request.method === "OPTIONS") {
            response.writeHead(204).end();
            return;
        }

        if (request.method === "PUT" && request.url === "/upload") {
            const body = await readRequest(request);
            const sha256 = crypto.createHash("sha256").update(body).digest("hex");
            assert(request.headers["x-sha-256"] === sha256, "Blossom upload hash header mismatch");
            objects.set(sha256, {
                body,
                type: request.headers["content-type"] || "application/octet-stream"
            });

            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({
                url: `${origin}/${sha256}`,
                sha256,
                size: body.length,
                type: request.headers["content-type"] || "application/octet-stream",
                uploaded: Math.floor(Date.now() / 1000)
            }));
            return;
        }

        if (request.method === "GET") {
            const sha256 = request.url.slice(1);
            const object = objects.get(sha256);
            if (!object) {
                response.writeHead(404).end();
                return;
            }

            response.setHeader("Content-Type", object.type);
            response.end(object.body);
            return;
        }

        response.writeHead(405).end();
    });

    await listen(server, port);
    helpers.push({
        async close() {
            await closeServer(server);
        }
    });

    return {port};
}

async function startFakeFips() {
    const port = await freePort();
    const server = net.createServer(socket => {
        let buffered = "";
        socket.on("data", chunk => {
            buffered += chunk.toString("utf8");
            if (!buffered.includes("\n")) return;

            const request = JSON.parse(buffered.split("\n")[0]);
            if (request.command === "show_status") {
                socket.end(JSON.stringify({
                    status: "ok",
                    data: {
                        npub: "npub1e2esmoke",
                        ipv6_addr: "fd00::1",
                        peer_count: 1,
                        estimated_mesh_size: 2
                    }
                }) + "\n");
                return;
            }

            if (request.command === "show_peers") {
                socket.end(JSON.stringify({
                    status: "ok",
                    data: {
                        peers: [{
                            npub: "npub1peer",
                            display_name: "FIPS peer",
                            ipv6_addr: "fd00::2",
                            connectivity: "direct",
                            transport_type: "webrtc",
                            transport_addr: "127.0.0.1",
                            direction: "outbound",
                            tree_depth: 1
                        }]
                    }
                }) + "\n");
                return;
            }

            socket.end(JSON.stringify({status: "error", message: "unknown command"}) + "\n");
        });
    });

    await listen(server, port, "127.0.0.1");
    helpers.push({
        async close() {
            await closeServer(server);
        }
    });

    return {port};
}

function readRequest(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

async function waitForHttp(url) {
    for (let i = 0; i < 80; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // Retry until the app server is ready.
        }

        await delay(250);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

async function freePort() {
    const server = net.createServer();
    await listen(server, 0, "127.0.0.1");
    const port = server.address().port;
    await closeServer(server);
    return port;
}

function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
            server.off("error", reject);
            resolve();
        });
    });
}

function closeServer(server) {
    return new Promise(resolve => server.close(resolve));
}

function stopChild(child) {
    return new Promise(resolve => {
        if (child.exitCode !== null) {
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
        }, 3000);

        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill("SIGTERM");
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

main()
    .catch(async error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await Promise.allSettled([...helpers].reverse().map(helper => helper.close()));
    });
