import assert from "node:assert/strict";
import WebSocket from "ws";

import {androidPackageName, run, sleep, stripCarriageReturns} from "./android-apk-runtime-utils.mjs";

const cdpCommandTimeoutMs = 60000;

export async function connectAndroidWebView(adb, serial) {
    const socket = await findWebViewDevtoolsSocket(adb, serial);
    const port = await forwardDevtools(adb, serial, socket);
    const webSocketUrl = await findPageDebuggerUrl(port);
    const cdp = await connectCdp(webSocketUrl);

    return {
        cdp,
        port,
        async close() {
            cdp.close();
            await run(adb, ["-s", serial, "forward", "--remove", `tcp:${port}`]).catch(() => {});
        }
    };
}

export async function evaluate(cdp, expression, options = {}) {
    const result = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise: options.awaitPromise === true,
        returnByValue: options.returnByValue !== false
    });
    assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.text || "runtime evaluation failed");
    assert(result.result, "CDP Runtime.evaluate returned no result");
    return result.result.value;
}

async function findWebViewDevtoolsSocket(adb, serial) {
    const pid = await findPackagePid(adb, serial);
    const preferredSocket = pid ? `webview_devtools_remote_${pid}` : "";

    for (let i = 0; i < 60; i += 1) {
        const {stdout} = await run(adb, ["-s", serial, "shell", "cat", "/proc/net/unix"]);
        const sockets = [...stdout.matchAll(/@?(webview_devtools_remote(?:_\d+)?)/g)].map(match => match[1]);
        if (preferredSocket && sockets.includes(preferredSocket)) {
            return preferredSocket;
        }
        if (sockets.length > 0) {
            return sockets[0];
        }
        await sleep(1000);
    }

    throw new Error(`Timed out waiting for Android WebView DevTools socket for ${androidPackageName}`);
}

async function findPackagePid(adb, serial) {
    try {
        const {stdout} = await run(adb, ["-s", serial, "shell", "pidof", androidPackageName]);
        return stripCarriageReturns(stdout).trim().split(/\s+/)[0] || "";
    }
    catch {
        return "";
    }
}

async function forwardDevtools(adb, serial, socket) {
    const {stdout} = await run(adb, ["-s", serial, "forward", "tcp:0", `localabstract:${socket}`]);
    return stripCarriageReturns(stdout).trim();
}

async function findPageDebuggerUrl(port) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find(target => target.type === "page" && target.url.startsWith("file:///android_asset/meshdrop/"));
    assert(page, "Android WebView DevTools did not expose the MeshDrop page target");
    assert(page.webSocketDebuggerUrl, "Android WebView target did not expose a debugger WebSocket URL");
    return page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
}

async function fetchJson(url) {
    let lastError = null;
    for (let i = 0; i < 30; i += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return response.json();
            }
        }
        catch (error) {
            lastError = error;
        }
        await sleep(500);
    }
    throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`);
}

function connectCdp(webSocketUrl) {
    const ws = new WebSocket(webSocketUrl);
    const pending = new Map();
    const listeners = new Map();
    let nextId = 1;

    ws.on("message", data => {
        const message = JSON.parse(data.toString());
        if (message.id && pending.has(message.id)) {
            const {resolve, reject} = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) {
                reject(new Error(`${message.error.code}: ${message.error.message}`));
                return;
            }
            resolve(message.result);
            return;
        }
        if (message.method && listeners.has(message.method)) {
            for (const listener of listeners.get(message.method)) {
                listener(message.params || {});
            }
        }
    });

    return new Promise((resolve, reject) => {
        ws.once("open", () => {
            resolve({
                on(method, listener) {
                    const existing = listeners.get(method) || [];
                    existing.push(listener);
                    listeners.set(method, existing);
                },
                send(method, params = {}) {
                    const id = nextId;
                    nextId += 1;
                    return new Promise((sendResolve, sendReject) => {
                        const timeout = setTimeout(() => {
                            pending.delete(id);
                            sendReject(new Error(`Timed out waiting for CDP ${method}`));
                        }, cdpCommandTimeoutMs);
                        pending.set(id, {
                            resolve(result) {
                                clearTimeout(timeout);
                                sendResolve(result);
                            },
                            reject(error) {
                                clearTimeout(timeout);
                                sendReject(error);
                            }
                        });
                        ws.send(JSON.stringify({id, method, params}));
                    });
                },
                close() {
                    ws.close();
                }
            });
        });
        ws.once("error", reject);
    });
}
