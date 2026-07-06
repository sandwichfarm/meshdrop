import net from "net";
import {spawn} from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const noop = () => undefined;

export class FederationPollenTransport {

    constructor({config, pollenClient = null, trace = noop}) {
        this.config = config;
        this.pollenClient = pollenClient;
        this.trace = trace;
        this.daemonProcess = null;
        this.localIdentity = null;
    }

    async ensureService() {
        if (!this.config.pollen.enabled) return;

        await this.ensureDaemon();
        const status = this.pollenClient ? await this.pollenClient.status() : {available: true};
        if (!status.available) {
            this.trace("pollen status unavailable", status.error || "no status error");
            return;
        }

        this.trace("pollen serve", this.config.pollen.serviceName, `port=${this.config.port}`);
        const result = await this._runPln(["serve", String(this.config.port), this.config.pollen.serviceName]);
        if (result.code !== 0 && !/already|exists|registered/i.test(`${result.stderr}\n${result.stdout}`)) {
            throw new Error(result.stderr || result.error || "pln serve failed");
        }
        this.trace("pollen serve ok", this.config.pollen.serviceName, `code=${result.code}`);
    }

    async connectService(serverId, serviceName) {
        const localPort = await findFreePort();
        this.trace("pollen connect", `server=${serverId}`, `service=${serviceName}`, `localPort=${localPort}`);
        const result = await this._runPln(["connect", serviceName, String(localPort)]);
        if (result.code !== 0) throw new Error(result.stderr || result.error || "pln connect failed");

        return `http://127.0.0.1:${localPort}${this.config.basePath}`;
    }

    async identity() {
        const nodeId = await this.nodeId().catch(() => "");
        const rootHash = this.rootHash();
        const storedMembership = this.hasMembership();
        const daemonStatus = this.pollenClient
            ? await this.pollenClient.status().catch(() => ({available: false}))
            : {available: false};
        const hasMembership = storedMembership
            || (daemonStatus.available && !rootHash && !this.config.pollen.daemonDeferred);
        const bootstrapRole = this.bootstrapRole();
        this.localIdentity = {
            nodeId,
            rootHash,
            hasMembership,
            bootstrapRole,
            canInvite: hasMembership && bootstrapRole === "root",
            needsInvite: this.config.pollen.clusterBootstrap && !hasMembership && bootstrapRole === "joiner"
        };
        return this.localIdentity;
    }

    async createInvite(subjectNodeId) {
        if (!this.config.pollen.enabled || !subjectNodeId) return "";
        await this.ensureDaemon();
        const result = await this._runPln([
            "invite",
            "--publisher",
            "--ttl",
            this.config.pollen.inviteTtl,
            "--subject",
            subjectNodeId
        ]);
        if (result.code !== 0) {
            this.trace("pollen invite failed", subjectNodeId, result.stderr || result.error || "pln invite failed");
            return "";
        }
        return result.stdout.trim();
    }

    async joinInvite(token) {
        if (!this.config.pollen.enabled || !token) return false;
        if (this.hasMembership()) {
            this.trace("pollen invite ignored", "local membership already exists");
            return false;
        }

        const result = await this._runPln(["join", token, "--no-up"]);
        if (result.code !== 0) throw new Error(result.stderr || result.error || "pln join failed");
        this.trace("pollen invite joined", result.stdout.trim() || "credentials enrolled");
        this.localIdentity = null;
        await this.ensureDaemon(true);
        return true;
    }

    async nodeId() {
        const result = await this._runPln(["id"]);
        if (result.code !== 0) throw new Error(result.stderr || result.error || "pln id failed");
        return result.stdout.trim();
    }

    rootHash() {
        const rootPath = path.join(this.config.pollen.dir, "keys", "root.pub");
        try {
            return crypto.createHash("sha256").update(fs.readFileSync(rootPath)).digest("hex");
        } catch {
            return "";
        }
    }

    hasMembership() {
        return fs.existsSync(path.join(this.config.pollen.dir, "keys", "delegation.cert.pb"));
    }

    bootstrapRole() {
        if (!this.config.pollen.clusterBootstrap) return "root";
        const pubkeys = [this.config.nostr.pubkey, ...this.config.nostr.recipientPubkeys].filter(Boolean).sort();
        return pubkeys[0] === this.config.nostr.pubkey ? "root" : "joiner";
    }

    async ensureDaemon(force = false) {
        if (!this.config.pollen.enabled) return false;
        if (this.daemonProcess && !this.daemonProcess.killed) return true;

        const hasMembership = this.hasMembership();
        const role = this.bootstrapRole();
        if (!force && this.config.pollen.clusterBootstrap && !hasMembership && role === "joiner") {
            this.trace("pollen daemon deferred", "waiting for encrypted Nostr invite");
            return false;
        }

        const status = this.pollenClient ? await this.pollenClient.status().catch(() => ({available: false})) : {available: false};
        if (status.available) return true;

        const args = ["up", "--name", this.config.pollen.name, "--port", String(this.config.pollen.port)];
        if (this.config.pollen.public) args.push("--public");
        if (this.config.pollen.ips.length) args.push("--ips", this.config.pollen.ips.join(","));
        this.trace("pollen daemon start", args.join(" "));
        this.daemonProcess = spawn(this.config.pollen.command, args, {
            env: {...process.env, PLN_DIR: this.config.pollen.dir},
            stdio: ["ignore", "pipe", "pipe"]
        });
        this.daemonProcess.stdout.on("data", chunk => this.trace("pollen daemon", chunk.toString("utf8").trim()));
        this.daemonProcess.stderr.on("data", chunk => this.trace("pollen daemon", chunk.toString("utf8").trim()));
        this.daemonProcess.on("close", code => {
            this.trace("pollen daemon stopped", `code=${code}`);
            this.daemonProcess = null;
        });

        await this._waitForStatus();
        return true;
    }

    stop() {
        if (this.daemonProcess && !this.daemonProcess.killed) {
            this.daemonProcess.kill();
        }
        this.daemonProcess = null;
    }

    _runPln(args) {
        const child = spawn(this.config.pollen.command, args, {
            env: {...process.env, PLN_DIR: this.config.pollen.dir},
            stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";
        let error = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", chunk => { stdout += chunk; });
        child.stderr.on("data", chunk => { stderr += chunk; });
        child.on("error", err => { error = err.message; });

        return new Promise(resolve => {
            child.on("close", code => resolve({code, stdout, stderr: stderr.trim(), error}));
        });
    }

    async _waitForStatus() {
        const deadline = Date.now() + 10000;
        let lastError = "";
        while (Date.now() < deadline) {
            const result = await this._runPln(["status"]);
            if (result.code === 0) return;
            lastError = result.stderr || result.error || result.stdout.trim();
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        throw new Error(lastError || "pln daemon did not become ready");
    }
}

function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}
