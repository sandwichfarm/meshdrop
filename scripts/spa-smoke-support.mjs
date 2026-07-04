import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {finalizeEvent, generateSecretKey, getPublicKey} from "nostr-tools/pure";

export function createProofIdentityPair() {
    const a = createProofIdentity("a");
    const b = createProofIdentity("b");
    a.followPubkeys = [b.pubkey];
    b.followPubkeys = [a.pubkey];
    return {a, b};
}

export function createProofIdentity(name) {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);

    return {
        name,
        secretKey,
        pubkey,
        displayName: `npub ${pubkey.slice(0, 8)}`,
        followPubkeys: []
    };
}

export async function installProofSigner(page, identity) {
    await page.exposeFunction("__meshdropSignEvent", unsignedEvent => finalizeEvent({
        ...unsignedEvent,
        pubkey: identity.pubkey
    }, identity.secretKey));
}

export async function loadPlaywright(playwrightModulePath) {
    if (playwrightModulePath) {
        try {
            await fs.access(playwrightModulePath);
            return import(pathToFileURL(playwrightModulePath).href);
        } catch (error) {
            if (process.env.PLAYWRIGHT_MODULE_PATH) {
                throw new Error(`PLAYWRIGHT_MODULE_PATH is not readable: ${playwrightModulePath}\n${error.message}`);
            }
        }
    }

    return import("playwright");
}

export function startStaticServer(root) {
    const server = http.createServer(async (request, response) => {
        const urlPath = new URL(request.url, "http://127.0.0.1").pathname;
        const requested = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
        let filePath = path.join(root, requested === "/" ? "index.html" : requested);

        if (path.relative(root, filePath).startsWith("..")) {
            response.writeHead(403).end();
            return;
        }

        try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
            const body = await fs.readFile(filePath);
            response.writeHead(200, {"content-type": contentType(filePath)});
            response.end(body);
        } catch {
            const body = await fs.readFile(await fallbackIndexPath(root));
            response.writeHead(200, {"content-type": "text/html; charset=utf-8"});
            response.end(body);
        }
    });

    return new Promise(resolve => {
        server.listen(0, "127.0.0.1", () => {
            resolve({
                close: callback => server.close(callback),
                port: server.address().port
            });
        });
    });
}

async function fallbackIndexPath(root) {
    const rootIndex = path.join(root, "index.html");
    try {
        await fs.access(rootIndex);
        return rootIndex;
    } catch {
        return path.join(root, "app", "index.html");
    }
}

export function parseRelayUrls(value) {
    return [...new Set(String(value)
        .split(/[\s,]+/)
        .map(relay => relay.trim().replace(/\/+$/, ""))
        .filter(relay => /^wss?:\/\/[^/\s]+/.test(relay)))];
}

export function run(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}\n${stderr}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function contentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
    if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".mp3")) return "audio/mpeg";
    if (filePath.endsWith(".ogg")) return "audio/ogg";
    return "application/octet-stream";
}
