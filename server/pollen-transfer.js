import {spawn} from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {Transform} from "stream";
import {pipeline} from "stream/promises";

const pollenHashPattern = /^[0-9a-f]{64}$/i;

export function createPollenConfig(env = process.env) {
    return {
        enabled: env.POLLEN_TRANSFER !== "false",
        command: env.PLN_BIN || "pln",
        dir: env.PLN_DIR || "/var/lib/meshdrop/pln",
        maxUploadBytes: Number.parseInt(env.POLLEN_MAX_UPLOAD_BYTES || "", 10) || 2 * 1024 * 1024 * 1024
    };
}

export default class PollenTransferClient {
    constructor(config = createPollenConfig()) {
        this.config = config;
    }

    async status() {
        if (!this.config.enabled) return {enabled: false, available: false};

        const version = await this._run(["version", "--short"], {timeoutMs: 5000});
        if (version.code !== 0) {
            return {
                enabled: true,
                available: false,
                error: version.stderr || version.error || "pln is not available"
            };
        }

        const status = await this._run(["status"], {timeoutMs: 5000});
        return {
            enabled: true,
            available: status.code === 0,
            version: version.stdout.trim(),
            error: status.code === 0 ? "" : (status.stderr || status.error || "Pollen daemon is not running")
        };
    }

    async uploadStream(readable, {size = 0, type = ""} = {}) {
        if (!this.config.enabled) throw new Error("Pollen transfer is disabled");
        if (size > this.config.maxUploadBytes) throw new Error("Pollen upload exceeds configured size limit");

        const child = this._spawn(["seed", "-"]);
        const output = this._collect(child);

        try {
            await pipeline(readable, this._uploadSizeGuard(), child.stdin);
        } catch (error) {
            child.kill("SIGTERM");
            throw error;
        }
        const result = await output;
        if (result.code !== 0) throw new Error(result.stderr || result.error || "Pollen upload failed");

        const hash = this._parseSeedHash(result.stdout);
        return {
            hash,
            size,
            type: type || "application/octet-stream"
        };
    }

    async fetchToTemp(hash) {
        if (!this.config.enabled) throw new Error("Pollen transfer is disabled");
        if (!pollenHashPattern.test(hash || "")) throw new Error("Invalid Pollen blob hash");

        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "meshdrop-pollen-"));
        const filePath = path.join(tempDir, hash);
        try {
            const result = await this._run(["fetch", hash, filePath], {timeoutMs: 10 * 60 * 1000});
            if (result.code !== 0) throw new Error(result.stderr || result.error || "Pollen download failed");
            return {
                path: filePath,
                cleanup: () => fs.promises.rm(tempDir, {recursive: true, force: true})
            };
        } catch (error) {
            await fs.promises.rm(tempDir, {recursive: true, force: true});
            throw error;
        }
    }

    _parseSeedHash(stdout) {
        const hash = (stdout || "").trim().split(/\s+/).find(token => pollenHashPattern.test(token));
        if (!hash) throw new Error("Pollen upload did not return a blob hash");
        return hash.toLowerCase();
    }

    _uploadSizeGuard() {
        let received = 0;
        return new Transform({
            transform: (chunk, _encoding, callback) => {
                received += chunk.length;
                if (received > this.config.maxUploadBytes) {
                    callback(new Error("Pollen upload exceeds configured size limit"));
                    return;
                }
                callback(null, chunk);
            }
        });
    }

    _spawn(args) {
        return spawn(this.config.command, args, {
            env: {
                ...process.env,
                PLN_DIR: this.config.dir
            },
            stdio: ["pipe", "pipe", "pipe"]
        });
    }

    _run(args, {timeoutMs = 30000} = {}) {
        const child = this._spawn(args);
        const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
        return this._collect(child)
            .finally(() => clearTimeout(timer));
    }

    _collect(child) {
        let stdout = "";
        let stderr = "";
        let error = "";

        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", chunk => { stdout += chunk; });
        child.stderr?.on("data", chunk => { stderr += chunk; });
        child.on("error", err => { error = err.message; });

        return new Promise(resolve => {
            child.on("close", code => resolve({
                code,
                stdout,
                stderr: stderr.trim(),
                error
            }));
        });
    }
}
