import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {Transform} from "stream";
import {pipeline} from "stream/promises";

const idPattern = /^[0-9a-f]{32}$/i;
const tokenPattern = /^[0-9a-f]{64}$/i;
const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function createFipsStreamConfig(env = process.env) {
    return {
        enabled: env.FIPS_STREAM_TRANSFER !== "false",
        dir: env.FIPS_STREAM_DIR || path.join(os.tmpdir(), "meshdrop-fips-stream"),
        maxUploadBytes: Number.parseInt(env.FIPS_STREAM_MAX_UPLOAD_BYTES || "", 10) || DEFAULT_MAX_UPLOAD_BYTES,
        ttlMs: Number.parseInt(env.FIPS_STREAM_TTL_MS || "", 10) || DEFAULT_TTL_MS
    };
}

export default class FipsStreamTransferClient {
    constructor(config = createFipsStreamConfig()) {
        this.config = config;
        this.records = new Map();
    }

    async status(fipsStatus = {}) {
        return {
            enabled: !!this.config.enabled,
            available: !!this.config.enabled && fipsStatus.available === true && !!fipsStatus.ipv6Addr,
            ipv6Addr: fipsStatus.ipv6Addr || "",
            primitive: "fips-http-stream",
            maxUploadBytes: this.config.maxUploadBytes
        };
    }

    async uploadStream(readable, {size = 0, type = ""} = {}) {
        if (!this.config.enabled) throw new Error("FIPS stream transfer is disabled");
        if (Number(size) > this.config.maxUploadBytes) throw new Error("FIPS stream upload exceeds configured size limit");

        await fs.promises.mkdir(this.config.dir, {recursive: true, mode: 0o700});
        this.cleanupExpired();

        const id = crypto.randomBytes(16).toString("hex");
        const token = crypto.randomBytes(32).toString("hex");
        const filePath = path.join(this.config.dir, id);
        const hash = crypto.createHash("sha256");
        let received = 0;

        const guard = new Transform({
            transform: (chunk, _encoding, callback) => {
                received += chunk.length;
                if (received > this.config.maxUploadBytes) {
                    callback(new Error("FIPS stream upload exceeds configured size limit"));
                    return;
                }
                hash.update(chunk);
                callback(null, chunk);
            }
        });

        try {
            await pipeline(readable, guard, fs.createWriteStream(filePath, {mode: 0o600}));
        } catch (error) {
            await fs.promises.rm(filePath, {force: true});
            throw error;
        }

        const record = {
            id,
            token,
            path: filePath,
            size: received,
            type: type || "application/octet-stream",
            sha256: hash.digest("hex"),
            expiresAt: Date.now() + this.config.ttlMs
        };
        this.records.set(id, record);

        return this.publicDescriptor(record);
    }

    publicDescriptor(record) {
        return {
            id: record.id,
            token: record.token,
            size: record.size,
            type: record.type,
            sha256: record.sha256,
            expiresAt: record.expiresAt
        };
    }

    openDownload(id, token) {
        if (!idPattern.test(id || "")) throw new Error("invalid FIPS stream id");
        if (!tokenPattern.test(token || "")) throw new Error("invalid FIPS stream token");
        this.cleanupExpired();

        const record = this.records.get(String(id).toLowerCase());
        if (!record || record.token !== String(token).toLowerCase()) {
            throw new Error("invalid FIPS stream token");
        }
        if (record.expiresAt <= Date.now()) {
            this.deleteRecord(record);
            throw new Error("FIPS stream descriptor expired");
        }

        return {
            path: record.path,
            size: record.size,
            type: record.type,
            sha256: record.sha256
        };
    }

    cleanupExpired(now = Date.now()) {
        for (const record of this.records.values()) {
            if (record.expiresAt <= now) this.deleteRecord(record);
        }
    }

    deleteRecord(record) {
        this.records.delete(record.id);
        fs.rm(record.path, {force: true}, () => {});
    }
}
