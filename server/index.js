import {spawn} from "child_process";
import fs from "fs";

import PairDropServer from "./server.js";
import PairDropWsServer from "./ws-server.js";
import FipsControlClient, {createFipsConfig} from "./fips-control.js";
import FipsStreamTransferClient, {createFipsStreamConfig} from "./fips-stream-transfer.js";
import PollenTransferClient, {createPollenConfig} from "./pollen-transfer.js";
import MeshFederation, {createFederationConfig} from "./federation.js";
import {createRelayIceConfig} from "./relay-ice-config.js";

const writeStdout = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
const writeStderr = value => process.stderr.write(`${value}\n`);

process.on('SIGINT', () => {
    writeStdout("SIGINT Received, exiting...")
    process.exit(0)
})

process.on('SIGTERM', () => {
    writeStdout("SIGTERM Received, exiting...")
    process.exit(0)
})

process.on('uncaughtException', (error, origin) => {
    writeStderr('----- Uncaught exception -----')
    writeStderr(error?.stack || error)
    writeStderr('----- Exception origin -----')
    writeStderr(origin)
})
process.on('unhandledRejection', (reason, promise) => {
    writeStderr('----- Unhandled Rejection at -----')
    writeStderr(promise)
    writeStderr('----- Reason -----')
    writeStderr(reason?.stack || reason)
})

let conf = {};

conf.debugMode = process.env.DEBUG_MODE === "true";

conf.port = process.env.PORT || 3000;

conf.wsFallback = process.argv.includes('--include-ws-fallback') || process.env.WS_FALLBACK === "true";

conf.rtcConfig = process.env.RTC_CONFIG && process.env.RTC_CONFIG !== "false"
    ? JSON.parse(fs.readFileSync(process.env.RTC_CONFIG, 'utf8'))
    : {
        "sdpSemantics": "unified-plan",
        "iceServers": [
            {
                "urls": "stun:stun.l.google.com:19302"
            }
        ]
    };


conf.signalingServer = process.env.SIGNALING_SERVER && process.env.SIGNALING_SERVER !== "false"
    ? process.env.SIGNALING_SERVER
    : false;

conf.nostrMesh = {
    relays: (process.env.NOSTR_RELAYS || "wss://bucket.coracle.social")
        .split(",")
        .map(relay => relay.trim())
        .filter(Boolean)
};

conf.blossom = {
    servers: (process.env.BLOSSOM_SERVERS || "")
        .split(",")
        .map(server => server.trim())
        .filter(Boolean)
};

conf.pollen = {
    ...createPollenConfig(),
    relayIce: createRelayIceConfig("pollen")
};
conf.pollenClient = new PollenTransferClient(conf.pollen);

conf.federation = createFederationConfig();
conf.fips = {
    ...createFipsConfig(),
    room: conf.federation.fips.room,
    relayIce: createRelayIceConfig("fips")
};
conf.fipsClient = new FipsControlClient(conf.fips);
conf.fipsStream = createFipsStreamConfig();
conf.fipsStreamClient = new FipsStreamTransferClient(conf.fipsStream);
conf.federationClient = new MeshFederation(conf.federation, {
    fipsClient: conf.fipsClient,
    pollenClient: conf.pollenClient
});

conf.ipv6Localize = parseInt(process.env.IPV6_LOCALIZE) || false;

let rateLimit = false;
if (process.argv.includes('--rate-limit') || process.env.RATE_LIMIT === "true") {
    rateLimit = 5;
}
else {
    let envRateLimit = parseInt(process.env.RATE_LIMIT);
    if (!isNaN(envRateLimit)) {
        rateLimit = envRateLimit;
    }
}
conf.rateLimit = rateLimit;

conf.buttons = {
    "donation_button": {
        "active": process.env.DONATION_BUTTON_ACTIVE,
        "link": process.env.DONATION_BUTTON_LINK,
        "title": process.env.DONATION_BUTTON_TITLE
    },
    "twitter_button": {
        "active": process.env.TWITTER_BUTTON_ACTIVE,
        "link": process.env.TWITTER_BUTTON_LINK,
        "title": process.env.TWITTER_BUTTON_TITLE
    },
    "mastodon_button": {
        "active": process.env.MASTODON_BUTTON_ACTIVE,
        "link": process.env.MASTODON_BUTTON_LINK,
        "title": process.env.MASTODON_BUTTON_TITLE
    },
    "bluesky_button": {
        "active": process.env.BLUESKY_BUTTON_ACTIVE,
        "link": process.env.BLUESKY_BUTTON_LINK,
        "title": process.env.BLUESKY_BUTTON_TITLE
    },
    "custom_button": {
        "active": process.env.CUSTOM_BUTTON_ACTIVE,
        "link": process.env.CUSTOM_BUTTON_LINK,
        "title": process.env.CUSTOM_BUTTON_TITLE
    },
    "privacypolicy_button": {
        "active": process.env.PRIVACYPOLICY_BUTTON_ACTIVE,
        "link": process.env.PRIVACYPOLICY_BUTTON_LINK,
        "title": process.env.PRIVACYPOLICY_BUTTON_TITLE
    }
};

conf.autoStart = process.argv.includes('--auto-restart');

conf.localhostOnly = process.argv.includes('--localhost-only');


if (conf.ipv6Localize) {
    if (!(0 < conf.ipv6Localize && conf.ipv6Localize < 8)) {
        writeStderr("ipv6Localize must be an integer between 1 and 7");
        process.exit(1);
    }

    writeStdout("IPv6 client IPs will be localized to",
        conf.ipv6Localize,
        conf.ipv6Localize === 1 ? "segment" : "segments");
}

if (conf.signalingServer) {
    let isValidUrl = false;
    try {
        new URL(`wss://${conf.signalingServer}`);
        isValidUrl = true;
    } catch {
        isValidUrl = false;
    }

    const containsProtocol = conf.signalingServer.includes("://")
    const endsWithSlash = conf.signalingServer.endsWith("/")
    if (!isValidUrl || containsProtocol) {
        writeStderr("SIGNALING_SERVER must be a valid url without the protocol prefix.\n" +
            "Examples of valid values: `meshdrop.example`, `meshdrop.example:3000`, `example.com/meshdrop`");
        process.exit(1);
    }

    if (!endsWithSlash) {
        conf.signalingServer += "/";
    }

    if (process.env.RTC_CONFIG || conf.wsFallback || conf.ipv6Localize) {
        writeStderr("SIGNALING_SERVER cannot be used alongside WS_FALLBACK, RTC_CONFIG or IPV6_LOCALIZE as these " +
            "configurations are specified by the signaling server.\n" +
            "To use this instance as the signaling server do not set SIGNALING_SERVER");
        process.exit(1);
    }
}

if (conf.debugMode) {
    writeStdout("DEBUG_MODE is active. To protect privacy, do not use in production.");
    writeStdout("");
    writeStdout("----DEBUG ENVIRONMENT VARIABLES----")
    writeStdout(JSON.stringify(conf, null, 4));
    writeStdout("");
}

if (conf.autoStart) {
    process.on(
        'uncaughtException',
        () => {
            process.once(
                'exit',
                () => spawn(
                    process.argv.shift(),
                    process.argv,
                    {
                        cwd: process.cwd(),
                        detached: true,
                        stdio: 'inherit'
                    }
                )
            );
            process.exit();
        }
    );
}

const meshDropServer = new PairDropServer(conf);

if (!conf.signalingServer) {
    const wsServer = new PairDropWsServer(meshDropServer.server, conf);
    conf.federationClient.attachWsServer(wsServer);
    conf.federationClient.start();
} else {
    writeStdout(
        "This instance does not include a signaling server. Clients on this instance connect to the following signaling server:",
        conf.signalingServer
    );
}

writeStdout('\nMeshDrop is running on port', conf.port);
