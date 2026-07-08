import test from "node:test";
import assert from "node:assert/strict";

import {
    OverlayRelayPreflightError,
    loadTopologyEvidence,
    runOverlayRelayPreflight
} from "../scripts/overlay-relay-preflight.mjs";

const assertPreflightError = (fn, reason) => {
    assert.throws(fn, error => (
        error instanceof OverlayRelayPreflightError
        && error.reason === reason
    ));
};

test("overlay relay preflight fails closed without route-specific relay ICE config", () => {
    assertPreflightError(
        () => runOverlayRelayPreflight({routeType: "fips", env: {}}),
        "fips-relay-ice-not-configured"
    );
});

test("overlay relay preflight requires topology evidence for the named overlay", () => {
    const env = {
        FIPS_RELAY_ICE_URLS: "turn:[fd00::1234]:3478"
    };

    assertPreflightError(
        () => runOverlayRelayPreflight({routeType: "fips", env}),
        "fips-relay-topology-evidence-missing"
    );
    assertPreflightError(
        () => runOverlayRelayPreflight({
            routeType: "fips",
            env: {
                ...env,
                FIPS_RELAY_TOPOLOGY_EVIDENCE: JSON.stringify({
                    overlay: "pollen",
                    relayEndpoint: "turn:[fd00::1234]:3478"
                })
            }
        }),
        "topology-overlay-mismatch"
    );
    assertPreflightError(
        () => runOverlayRelayPreflight({
            routeType: "fips",
            env: {
                ...env,
                FIPS_RELAY_TOPOLOGY_EVIDENCE: JSON.stringify({
                    overlay: "fips",
                    relayEndpoint: "turn:other-relay.test:3478"
                })
            }
        }),
        "topology-relay-endpoint-mismatch"
    );
});

test("overlay relay preflight accepts matching relay config and topology evidence", () => {
    const env = {
        FIPS_RELAY_ICE_URLS: "turn:[fd00::1234]:3478,turns:[fd00::1234]:5349",
        FIPS_RELAY_TOPOLOGY_EVIDENCE: JSON.stringify({
            overlay: "fips",
            relayEndpoint: "turn:[fd00::1234]:3478",
            interface: "fips0"
        })
    };

    assert.deepEqual(runOverlayRelayPreflight({routeType: "fips", env}), {
        ok: true,
        routeType: "fips",
        status: "preflight-ready",
        relayEndpoints: ["turn:[fd00::1234]:3478", "turns:[fd00::1234]:5349"],
        topologyEvidence: {
            overlay: "fips",
            relayEndpoint: "turn:[fd00::1234]:3478",
            interface: "fips0"
        },
        blocker: "https://github.com/sandwichfarm/meshdrop/issues/152",
        provenTransfer: false
    });
});

test("overlay relay preflight loads topology evidence from route-specific JSON env", () => {
    assert.deepEqual(loadTopologyEvidence("pollen", {
        POLLEN_RELAY_TOPOLOGY_EVIDENCE: JSON.stringify({
            overlay: "pollen",
            relayEndpoint: "turn:pollen-relay.test:3478"
        })
    }), {
        overlay: "pollen",
        relayEndpoint: "turn:pollen-relay.test:3478"
    });
});
