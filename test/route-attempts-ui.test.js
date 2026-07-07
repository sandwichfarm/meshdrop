import test from "node:test";
import assert from "node:assert/strict";

await import("../public/scripts/ui.js");

const availability = globalThis.PeerAvailabilityProtocol;
const routeStatus = globalThis.PeerRouteStatusProtocol;

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.attributes = new Map();
        this.childNodes = [];
        this.dataset = {};
        this.className = "";
        this.title = "";
    }

    append(...nodes) {
        this.childNodes.push(...nodes);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    get textContent() {
        return this.childNodes.map(node => node.textContent || "").join("");
    }
}

function installFakeDom() {
    globalThis.document = {
        createElement: tagName => new FakeElement(tagName)
    };
}

test("route attempt summaries expose state, reason, and privacy labels without protocol jargon", () => {
    const attempt = routeStatus.attempt({
        route: "fips",
        state: "disabled",
        reason: "requires-native-app",
        backendOnly: true
    });

    assert.equal(attempt.route, "fips");
    assert.equal(attempt.routeLabel, "FIPS");
    assert.equal(attempt.stateLabel, "Unavailable");
    assert.equal(attempt.message, "FIPS unavailable");
    assert.equal(attempt.reason, "Requires native app");
    assert.deepEqual(attempt.privacyLabels, [
        "End-to-end encrypted",
        "Backend-only route"
    ]);
});

test("route proof summaries only mark complete when bytes and hash match without fallback", () => {
    const proof = {
        senderRuntime: "browser:sender.meshdrop.test",
        recipientRuntime: "browser:recipient.meshdrop.test",
        routeType: "pollen",
        dataPlanePrimitive: "pollen-object-store",
        webRtcUsed: false,
        instanceRelayed: true,
        bytesSent: 285,
        bytesReceived: 285,
        hashMatched: true,
        fallbackUsed: false
    };

    assert.deepEqual(routeStatus.proofSummary(proof), {
        route: "pollen",
        routeLabel: "Pollen",
        state: "complete",
        stateLabel: "Complete",
        message: "Complete on Pollen",
        dataPlane: "pollen-object-store",
        bytes: "285 B sent / 285 B received",
        privacyLabels: [
            "End-to-end encrypted",
            "Relayed by your instance",
            "Relayed by peer instance"
        ]
    });

    assert.equal(routeStatus.proofSummary({...proof, hashMatched: false}), null);
    assert.equal(routeStatus.proofSummary({...proof, fallbackUsed: true}), null);
    assert.equal(routeStatus.proofSummary({...proof, bytesReceived: 100}), null);
});

test("route attempts combine available candidates with latest route status", () => {
    const attempts = routeStatus.attemptsForPeer({
        _roomIds: {
            nostr: "meshdrop-nostr",
            pollen: "meshdrop-pollen"
        },
        routeStatuses: [
            {route: "pollen", state: "requested", reason: "private-route"},
            {route: "fips", state: "disabled", reason: "overlay-unavailable", backendOnly: true}
        ]
    });

    assert.deepEqual(
        attempts.map(attempt => [attempt.route, attempt.state, attempt.reason]),
        [
            ["nostr", "candidate", ""],
            ["pollen", "requested", "Private route requested"],
            ["fips", "disabled", "Overlay network unavailable"]
        ]
    );
    assert.equal(attempts[0].message, "Clearnet available");
    assert.deepEqual(attempts[1].privacyLabels, ["End-to-end encrypted"]);
    assert.deepEqual(attempts[2].privacyLabels, [
        "End-to-end encrypted",
        "Backend-only route"
    ]);
});

test("route attempt visuals keep peer cards compact while preserving accessible detail", () => {
    const attempts = [
        routeStatus.attempt({route: "nostr", state: "disabled", reason: "clearnet-disabled"}),
        routeStatus.attempt({route: "fips", state: "requested", reason: "private-route"}),
        routeStatus.attempt({route: "pollen", state: "requested", reason: "private-route"})
    ].map(attempt => routeStatus.visualAttempt(attempt));

    assert.deepEqual(
        attempts.map(attempt => [attempt.route, attempt.visibleLabel, attempt.tone]),
        [
            ["nostr", "", "blocked"],
            ["fips", "", "pending"],
            ["pollen", "", "pending"]
        ]
    );

    const visibleCopy = attempts.map(attempt => attempt.visibleLabel).join(" ");
    assert.equal(visibleCopy.trim(), "");
    assert.match(attempts[0].ariaLabel, /Clearnet unavailable/);
    assert.match(attempts[1].ariaLabel, /Private route requested/);
    assert.match(attempts[2].title, /Pollen/);
});

test("route attempt visual chips keep status words out of layout", () => {
    installFakeDom();
    const chip = routeStatus.createVisualAttemptChip(
        routeStatus.attempt({route: "fips", state: "requested", reason: "private-route"}),
        "transport-choice-route route-attempt"
    );

    assert.equal(chip.textContent, "");
    assert.equal(chip.className, "transport-choice-route route-attempt");
    assert.equal(chip.dataset.route, "fips");
    assert.equal(chip.dataset.state, "requested");
    assert.equal(chip.dataset.tone, "pending");
    assert.equal(chip.getAttribute("role"), "img");
    assert.match(chip.getAttribute("aria-label"), /Private route requested/);
    assert.match(chip.title, /FIPS/);
    assert.equal(chip.childNodes[0].className, "route-attempt-symbol");
    assert.equal(chip.childNodes[0].getAttribute("aria-hidden"), "true");
});

test("route choice options can expose route-attempt metadata for renderers", () => {
    const options = availability.optionsFor({
        id: "peer",
        _roomIds: {nostr: "meshdrop-nostr"},
        routeStatuses: [{route: "nostr", state: "connecting", reason: "priority"}]
    });

    const webrtc = options.find(option => option.id === "webrtc");
    assert.equal(webrtc.attempt.stateLabel, "Connecting");
    assert.equal(webrtc.attempt.message, "Connecting on Clearnet...");
    assert.deepEqual(webrtc.attempt.privacyLabels, [
        "End-to-end encrypted",
        "Direct data path"
    ]);
});

test("storage route attempt metadata does not overstate encryption", () => {
    const previousHashtree = globalThis.meshdropHashtreeTransfer;
    const previousBlossom = globalThis.meshdropBlossomTransfer;
    const previousPollen = globalThis.meshdropPollenTransfer;
    globalThis.meshdropHashtreeTransfer = {isActive: () => true};
    globalThis.meshdropBlossomTransfer = {isActive: () => true};
    globalThis.meshdropPollenTransfer = {isActive: () => true};

    try {
        const options = availability.optionsFor({});
        const hashtree = options.find(option => option.id === "hashtree");
        const blossom = options.find(option => option.id === "blossom");
        const pollen = options.find(option => option.id === "pollen");

        assert.deepEqual(hashtree.attempt.privacyLabels, ["Object-store route"]);
        assert.deepEqual(blossom.attempt.privacyLabels, [
            "End-to-end encrypted",
            "Object-store route"
        ]);
        assert.deepEqual(pollen.attempt.privacyLabels, ["Object-store route"]);
    } finally {
        globalThis.meshdropHashtreeTransfer = previousHashtree;
        globalThis.meshdropBlossomTransfer = previousBlossom;
        globalThis.meshdropPollenTransfer = previousPollen;
    }
});
