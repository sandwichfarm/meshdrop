import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import {generateSecretKey, getPublicKey, nip19, utils} from "nostr-tools";

import FipsControlClient, {createFipsConfig, DEFAULT_FIPS_CONTROL_SOCKET} from "../server/fips-control.js";

async function withFipsControlServer(handler, testBody) {
    const server = net.createServer(socket => {
        let request = "";

        socket.on("data", chunk => {
            request += chunk.toString("utf8");
            if (!request.includes("\n")) return;

            const payload = JSON.parse(request);
            socket.end(`${JSON.stringify(handler(payload))}\n`);
        });
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

    try {
        await testBody(server.address().port);
    }
    finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("FIPS config uses the in-container control socket by default", () => {
    const config = createFipsConfig({});

    assert.equal(config.enabled, true);
    assert.equal(config.room, "");
    assert.equal(config.timeoutMs, 1000);
    assert.equal(config.controlSocket, DEFAULT_FIPS_CONTROL_SOCKET);
});

test("FIPS config can be disabled explicitly", () => {
    const config = createFipsConfig({FIPS_DISCOVERY: "false"});

    assert.equal(config.enabled, false);
    assert.equal(config.room, "");
});

test("FIPS config derives its federation room from the configured npub network", () => {
    const localSecret = generateSecretKey();
    const peerSecret = generateSecretKey();
    const peerPubkey = getPublicKey(peerSecret);
    const config = createFipsConfig({
        FIPS_CONTROL_SOCKET: "21210",
        FIPS_ROOM: "meshdrop-test",
        MESHDROP_NOSTR_SECRET_KEY: utils.bytesToHex(localSecret),
        MESHDROP_DISCOVERY_NPUBS: nip19.npubEncode(peerPubkey),
        FIPS_CONTROL_TIMEOUT_MS: "2500"
    });

    assert.equal(config.enabled, true);
    assert.equal(config.controlSocket, "21210");
    assert.equal(config.controlHost, "127.0.0.1");
    assert.match(config.room, /^npub-network:[a-f0-9]{32}$/);
    assert.notEqual(config.room, "meshdrop-test");
    assert.equal(config.timeoutMs, 2500);
    assert.equal(config.eventCommand, "events");
});

test("FIPS config supports a TCP control host override", () => {
    const config = createFipsConfig({
        FIPS_CONTROL_SOCKET: "21210",
        FIPS_CONTROL_HOST: "host.docker.internal"
    });

    assert.equal(config.controlSocket, "21210");
    assert.equal(config.controlHost, "host.docker.internal");
});

test("FIPS control client streams peer discovery events when daemon supports them", async () => {
    const commands = [];
    const server = net.createServer(socket => {
        let request = "";

        socket.on("data", chunk => {
            request += chunk.toString("utf8");
            if (!request.includes("\n")) return;

            commands.push(JSON.parse(request));
            socket.write(`${JSON.stringify({
                status: "ok",
                data: {
                    type: "peer_discovered",
                    peer: {
                        npub: "npub1peer",
                        display_name: "Peer",
                        ipv6_addr: "fd00::2",
                        connectivity: "connected",
                        transport_type: "udp",
                        transport_addr: "203.0.113.9:2121"
                    }
                }
            })}\n`);
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

    try {
        const events = [];
        const client = new FipsControlClient({
            enabled: true,
            controlSocket: String(server.address().port),
            controlHost: "127.0.0.1",
            room: "npub-network:test",
            timeoutMs: 1000,
            eventCommand: "events"
        });
        const listener = client.listenPeerEvents(event => events.push(event));

        await new Promise(resolve => setTimeout(resolve, 50));
        listener.close();

        assert.deepEqual(commands, [{
            command: "events",
            params: {topics: ["peer"], child_objects: true}
        }]);
        assert.deepEqual(events, [{
            type: "peer-joined",
            peer: {
                npub: "npub1peer",
                displayName: "Peer",
                ipv6Addr: "fd00::2",
                connectivity: "connected",
                transportType: "udp",
                transportAddr: "203.0.113.9:2121",
                direction: undefined,
                treeDepth: undefined
            },
            raw: {
                status: "ok",
                data: {
                    type: "peer_discovered",
                    peer: {
                        npub: "npub1peer",
                        display_name: "Peer",
                        ipv6_addr: "fd00::2",
                        connectivity: "connected",
                        transport_type: "udp",
                        transport_addr: "203.0.113.9:2121"
                    }
                }
            }
        }]);
    }
    finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test("FIPS control client reads status and peers from line-delimited JSON", async () => {
    await withFipsControlServer(request => {
        if (request.command === "show_status") {
            return {
                status: "ok",
                data: {
                    npub: "npub1local",
                    ipv6_addr: "fd00::1",
                    peer_count: 1,
                    estimated_mesh_size: 7
                }
            };
        }

        if (request.command === "show_peers") {
            return {
                status: "ok",
                data: {
                    peers: [{
                        npub: "npub1peer",
                        display_name: "Peer",
                        ipv6_addr: "fd00::2",
                        connectivity: "connected",
                        transport_type: "udp",
                        transport_addr: "203.0.113.9:2121",
                        direction: "outbound",
                        tree_depth: 2
                    }]
                }
            };
        }

        return {status: "error", message: "unknown command"};
    }, async port => {
        const client = new FipsControlClient({
            enabled: true,
            controlSocket: String(port),
            controlHost: "127.0.0.1",
            room: "npub-network:test",
            timeoutMs: 1000
        });
        const status = await client.status();

        assert.equal(status.enabled, true);
        assert.equal(status.available, true);
        assert.equal(status.npub, "npub1local");
        assert.equal(status.ipv6Addr, "fd00::1");
        assert.equal(status.peerCount, 1);
        assert.equal(status.meshSize, 7);
        assert.deepEqual(status.peers, [{
            npub: "npub1peer",
            displayName: "Peer",
            ipv6Addr: "fd00::2",
            connectivity: "connected",
            transportType: "udp",
            transportAddr: "203.0.113.9:2121",
            direction: "outbound",
            treeDepth: 2
        }]);
    });
});

test("FIPS control client reports unavailable daemon without throwing", async () => {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));

    const client = new FipsControlClient({
        enabled: true,
        controlSocket: String(port),
        controlHost: "127.0.0.1",
        room: "meshdrop-test",
        timeoutMs: 100
    });
    const status = await client.status();

    assert.equal(status.enabled, true);
    assert.equal(status.available, false);
    assert.equal(status.room, "");
    assert.match(status.error, /ECONNREFUSED|connect/);
});

test("FIPS control client saves peers then requests a server restart", async () => {
    const commands = [];
    await withFipsControlServer(request => {
        commands.push(request);
        return {status: "ok", data: {accepted: true}};
    }, async port => {
        const client = new FipsControlClient({
            enabled: true,
            controlSocket: String(port),
            controlHost: "127.0.0.1",
            room: "npub-network:test",
            timeoutMs: 1000
        });

        const result = await client.savePeers([{
            npub: "npub1peer",
            alias: "Peer",
            transport: "tcp",
            address: "203.0.113.9:2121"
        }]);

        assert.equal(result.restart.available, true);
        assert.deepEqual(commands, [
            {
                command: "connect",
                params: {
                    npub: "npub1peer",
                    address: "203.0.113.9:2121",
                    transport: "tcp"
                }
            },
            {
                command: "restart"
            }
        ]);
    });
});

test("FIPS control client reports restart command failures without losing saved peers", async () => {
    await withFipsControlServer(request => {
        if (request.command === "restart") return {status: "error", message: "unknown command"};
        return {status: "ok", data: {accepted: true}};
    }, async port => {
        const client = new FipsControlClient({
            enabled: true,
            controlSocket: String(port),
            controlHost: "127.0.0.1",
            room: "npub-network:test",
            timeoutMs: 1000
        });

        const result = await client.savePeers([{npub: "npub1peer", address: "203.0.113.9:2121"}]);

        assert.equal(result.peers.length, 1);
        assert.equal(result.restart.available, false);
        assert.equal(result.restart.error, "unknown command");
    });
});
