import {spawn} from "child_process";
import fs from "fs";

import PairDropServer from "./server.js";
import PairDropWsServer from "./ws-server.js";
import FipsControlClient, {createFipsConfig} from "./fips-control.js";

// Handle SIGINT
process.on('SIGINT', () => {
    console.info("SIGINT Received, exiting...")
    process.exit(0)
})

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.info("SIGTERM Received, exiting...")
    process.exit(0)
})

// Handle APP ERRORS
process.on('uncaughtException', (error, origin) => {
    console.log('----- Uncaught exception -----')
    console.log(error)
    console.log('----- Exception origin -----')
    console.log(origin)
})
process.on('unhandledRejection', (reason, promise) => {
    console.log('----- Unhandled Rejection at -----')
    console.log(promise)
    console.log('----- Reason -----')
    console.log(reason)
})

// Evaluate arguments for deployment with Docker and Node.js
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
        .filter(Boolean),
    room: process.env.NOSTR_ROOM || "meshdrop"
};

conf.blossom = {
    servers: (process.env.BLOSSOM_SERVERS || "")
        .split(",")
        .map(server => server.trim())
        .filter(Boolean)
};

conf.fips = createFipsConfig();
conf.fipsClient = new FipsControlClient(conf.fips);

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

// Evaluate arguments for deployment with Node.js only
conf.autoStart = process.argv.includes('--auto-restart');

conf.localhostOnly = process.argv.includes('--localhost-only');


// Validate configuration
if (conf.ipv6Localize) {
    if (!(0 < conf.ipv6Localize && conf.ipv6Localize < 8)) {
        console.error("ipv6Localize must be an integer between 1 and 7");
        process.exit(1);
    }

    console.log("IPv6 client IPs will be localized to",
        conf.ipv6Localize,
        conf.ipv6Localize === 1 ? "segment" : "segments");
}

if (conf.signalingServer) {
    const isValidUrl = /[a-z|0-9|\-._~:\/?#\[\]@!$&'()*+,;=]+$/.test(conf.signalingServer);
    const containsProtocol = /:\/\//.test(conf.signalingServer)
    const endsWithSlash = /\/$/.test(conf.signalingServer)
    if (!isValidUrl || containsProtocol) {
        console.error("SIGNALING_SERVER must be a valid url without the protocol prefix.\n" +
            "Examples of valid values: `meshdrop.example`, `meshdrop.example:3000`, `example.com/meshdrop`");
        process.exit(1);
    }

    if (!endsWithSlash) {
        conf.signalingServer += "/";
    }

    if (process.env.RTC_CONFIG || conf.wsFallback || conf.ipv6Localize) {
        console.error("SIGNALING_SERVER cannot be used alongside WS_FALLBACK, RTC_CONFIG or IPV6_LOCALIZE as these " +
            "configurations are specified by the signaling server.\n" +
            "To use this instance as the signaling server do not set SIGNALING_SERVER");
        process.exit(1);
    }
}

// Logs for debugging
if (conf.debugMode) {
    console.log("DEBUG_MODE is active. To protect privacy, do not use in production.");
    console.debug("\n");
    console.debug("----DEBUG ENVIRONMENT VARIABLES----")
    console.debug(JSON.stringify(conf, null, 4));
    console.debug("\n");
}

// Start a new MeshDrop instance when an uncaught exception occurs
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

// Start server to serve client files
const meshDropServer = new PairDropServer(conf);

if (!conf.signalingServer) {
    // Start websocket server if SIGNALING_SERVER is not set
    new PairDropWsServer(meshDropServer.server, conf);
} else {
    console.log(
        "This instance does not include a signaling server. Clients on this instance connect to the following signaling server:",
        conf.signalingServer
    );
}

console.log('\nMeshDrop is running on port', conf.port);
