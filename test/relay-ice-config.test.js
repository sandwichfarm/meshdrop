import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import {createRelayIceConfig} from "../server/relay-ice-config.js";

test("WebRTC bridge config parses TURN env URLs and credentials", () => {
    assert.deepEqual(createRelayIceConfig("fips", {
        FIPS_RELAY_ICE_URLS: "turn:fips-relay.test:3478, turns:fips-relay.test:5349",
        FIPS_RELAY_ICE_USERNAME: "meshdrop",
        FIPS_RELAY_ICE_CREDENTIAL: "secret"
    }), {
        supported: true,
        rtcConfig: {
            iceServers: [{
                urls: ["turn:fips-relay.test:3478", "turns:fips-relay.test:5349"],
                username: "meshdrop",
                credential: "secret"
            }],
            iceTransportPolicy: "relay"
        }
    });
});

test("WebRTC bridge config rejects STUN-only env URLs", () => {
    assert.deepEqual(createRelayIceConfig("pollen", {
        POLLEN_RELAY_ICE_URLS: "stun:stun.l.google.com:19302"
    }), {
        supported: false,
        unavailableReason: "pollen-relay-ice-not-configured"
    });
});

test("WebRTC bridge config reads RTC config files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meshdrop-relay-ice-"));
    const configPath = path.join(dir, "relay.json");
    fs.writeFileSync(configPath, JSON.stringify({
        iceServers: [
            {urls: "stun:ignored.test:19302"},
            {urls: "turn:pollen-relay.test:3478", username: "pollen", credential: "secret"}
        ]
    }));

    assert.deepEqual(createRelayIceConfig("pollen", {
        POLLEN_RELAY_ICE_CONFIG: configPath
    }), {
        supported: true,
        rtcConfig: {
            iceServers: [{urls: "turn:pollen-relay.test:3478", username: "pollen", credential: "secret"}],
            iceTransportPolicy: "relay"
        }
    });
});

test("WebRTC bridge config accepts instance ICE bridge env without legacy relay env vars", () => {
    assert.deepEqual(createRelayIceConfig("fips", {
        FIPS_INSTANCE_ICE_BRIDGE_URLS: "turn:fips-instance.test:3478?transport=tcp",
        FIPS_INSTANCE_ICE_BRIDGE_USERNAME: "bridge-user",
        FIPS_INSTANCE_ICE_BRIDGE_CREDENTIAL: "bridge-secret",
        FIPS_INSTANCE_ICE_BRIDGE_TOPOLOGY_EVIDENCE: JSON.stringify({
            overlay: "fips",
            instance: "meshdrop-a"
        })
    }), {
        supported: true,
        source: "instance",
        bridgeRole: "fips-instance-ice-bridge",
        topologyEvidence: {
            overlay: "fips",
            instance: "meshdrop-a"
        },
        rtcConfig: {
            iceServers: [{
                urls: ["turn:fips-instance.test:3478?transport=tcp"],
                username: "bridge-user",
                credential: "bridge-secret"
            }],
            iceTransportPolicy: "relay"
        }
    });
});
