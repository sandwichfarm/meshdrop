import express from "express";
import RateLimit from "express-rate-limit";
import {fileURLToPath} from "url";
import path, {dirname} from "path";
import http from "http";
import {adminPublicConfig, createAdminConfig, verifySignedAdminRequest} from "./admin-auth.js";
import {normalizeNpubDiscoveryNetworkId} from "./npub-network.js";
import {createRuntimeCapabilities} from "./runtime-capabilities.js";

const writeStdout = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
const writeStderr = error => process.stderr.write(`${error?.stack || error?.message || error}\n`);

export default class PairDropServer {

    constructor(conf) {
        const admin = conf.admin || createAdminConfig();
        const app = express();
        app.use(express.json({limit: "64kb"}));

        if (conf.rateLimit) {
            const limiter = RateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 1000, // Limit each IP to 1000 requests per `window` (here, per 5 minutes)
                message: 'Too many requests from this IP Address, please try again after 5 minutes.',
                standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
                legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            })

            app.use(limiter);
            // ensure correct client ip and not the ip of the reverse proxy is used for rate limiting
            // see https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues

            app.set('trust proxy', conf.rateLimit);

            if (!conf.debugMode) {
                writeStdout("Use DEBUG_MODE=true to find correct number for RATE_LIMIT.");
            }
        }

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        const publicPathAbs = path.join(__dirname, '../public');
        app.use(express.static(publicPathAbs));

        if (conf.debugMode && conf.rateLimit) {
            writeStdout("");
            writeStdout("----DEBUG RATE_LIMIT----");
            writeStdout(
                "To find out the correct value for RATE_LIMIT go to '/ip' " +
                "and ensure the returned IP-address is the IP-address of your client."
            );
            writeStdout("See https://github.com/express-rate-limit/express-rate-limit#troubleshooting-proxy-issues for more info");
            app.get('/ip', (req, res) => {
                res.send(req.ip);
            })
        }

        // By default, clients connecting to your instance use the signaling server of your instance to connect to other devices.
        // By using `WS_SERVER`, you can host an instance that uses another signaling server.
        app.get('/config', (req, res) => {
            const fipsRoom = normalizeNpubDiscoveryNetworkId(conf.fips.room);
            const pollenRoom = normalizeNpubDiscoveryNetworkId(conf.federation?.pollen?.room);
            res.send({
                signalingServer: conf.signalingServer,
                nostrMesh: conf.nostrMesh,
                blossom: conf.blossom,
                pollen: {
                    enabled: conf.pollen.enabled,
                    maxUploadBytes: conf.pollen.maxUploadBytes,
                    room: pollenRoom
                },
                fips: {
                    enabled: conf.fips.enabled,
                    room: fipsRoom
                },
                admin: adminPublicConfig(admin),
                capabilities: createRuntimeCapabilities({
                    ...conf,
                    admin,
                    fips: {...conf.fips, room: fipsRoom},
                    federation: {
                        ...conf.federation,
                        pollen: {...conf.federation?.pollen, room: pollenRoom}
                    }
                }),
                buttons: conf.buttons
            });
        });

        app.get('/fips/status', async (req, res) => {
            res.send(await conf.fipsClient.status());
        });

        app.get('/pollen/status', async (req, res) => {
            res.send(await conf.pollenClient.status());
        });

        app.get('/.well-known/meshdrop-federation', (req, res) => {
            if (!conf.federation?.enabled || !conf.federationClient) {
                res.status(404).send({error: "MeshDrop federation is disabled"});
                return;
            }

            res.send(conf.federationClient.snapshot());
        });

        app.post('/federation/events', async (req, res) => {
            if (!conf.federation?.enabled || !conf.federationClient) {
                res.status(404).send({error: "MeshDrop federation is disabled"});
                return;
            }

            res.send(await conf.federationClient.receiveEvents(req.body));
        });

        app.post('/pollen/upload', async (req, res) => {
            try {
                const descriptor = await conf.pollenClient.uploadStream(req, {
                    size: Number(req.headers["content-length"] || 0),
                    type: req.headers["content-type"] || "application/octet-stream"
                });
                res.send(descriptor);
            } catch (error) {
                res.status(502).send({error: error.message});
            }
        });

        app.get('/pollen/download/:hash', async (req, res) => {
            let tempFile = null;
            try {
                tempFile = await conf.pollenClient.fetchToTemp(req.params.hash);
                res.sendFile(tempFile.path, {
                    headers: {
                        "Content-Type": "application/octet-stream"
                    }
                }, async error => {
                    await tempFile.cleanup();
                    if (error && !res.headersSent) res.status(502).send({error: error.message});
                });
            } catch (error) {
                if (tempFile) await tempFile.cleanup();
                res.status(502).send({error: error.message});
            }
        });

        app.post('/settings/fips/peers', async (req, res) => {
            try {
                const adminRequest = verifySignedAdminRequest(admin, req.body?.event);
                if (!adminRequest.ok) {
                    res.status(403).send({error: adminRequest.error});
                    return;
                }
                if (adminRequest.request.action !== "settings.fips.peers") {
                    res.status(400).send({error: "admin_action_mismatch"});
                    return;
                }

                res.send(await conf.fipsClient.savePeers(adminRequest.request.peers || []));
            } catch (error) {
                res.status(502).send({error: error.message});
            }
        });

        app.use((req, res) => {
            res.redirect(301, '/');
        });

        app.get('/', (req, res) => {
            res.sendFile('index.html');
            writeStdout(`Serving client files from:\n${publicPathAbs}`);
        });

        const hostname = conf.localhostOnly ? '127.0.0.1' : null;
        const server = http.createServer(app);

        server.listen(conf.port, hostname);

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                writeStderr(err);
                writeStdout("Error EADDRINUSE received, exiting process without restarting process...");
                process.exit(1)
            }
        });

        this.server = server
    }
}
