import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {Transform} from "stream";
import {pipeline} from "stream/promises";

const idPattern = /^[0-9a-f]{32}$/i;
const tokenPattern = /^[0-9a-f]{64}$/i;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function routeDir(routeType, env = process.env) {
    const baseDir = env.OVERLAY_STREAM_DIR || path.join(os.tmpdir(), "meshdrop-overlay-stream");
    return path.join(baseDir, routeType || "unknown");
}

export function createOverlayStreamClients(overlayNetworks = {}, env = process.env) {
    return Object.fromEntries(Object.entries(overlayNetworks).map(([routeType, config]) => [
        routeType,
        new OverlayStreamTransferClient({
            ...config,
            dir: routeDir(routeType, env),
            ttlMs: Number.parseInt(env[`${routeType.toUpperCase()}_STREAM_TTL_MS`] || "", 10) || DEFAULT_TTL_MS
        })
    ]));
}

export default class OverlayStreamTransferClient {
    constructor(config = {}) {
        this.config = {
            ...config,
            dir: config.dir || routeDir(config.routeType),
            ttlMs: config.ttlMs || DEFAULT_TTL_MS
        };
        this.records = new Map();
    }

    async status() {
        const available = this.config.enabled === true
            && this.config.configured === true
            && !!this.config.streamEndpoint;
        const status = {
            enabled: available,
            available,
            routeType: this.config.routeType,
            primitive: this.config.primitive || `${this.config.routeType}-http-stream`,
            destination: this.config.destination || "",
            streamEndpoint: this.config.streamEndpoint || "",
            maxUploadBytes: this.config.maxUploadBytes
        };
        if (!available) {
            status.unavailableReason = this.config.unavailableReason || "overlay-adapter-not-configured";
        }
        return status;
    }

    async uploadStream(readable, {size = 0, type = ""} = {}) {
        const status = await this.status();
        if (!status.available) throw new Error("overlay stream transfer is unavailable");
        if (Number(size) > this.config.maxUploadBytes) {
            throw new Error("overlay stream upload exceeds configured size limit");
        }

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
                    callback(new Error("overlay stream upload exceeds configured size limit"));
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
            routeType: this.config.routeType,
            primitive: this.config.primitive,
            destination: this.config.destination,
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
            routeType: record.routeType,
            primitive: record.primitive,
            destination: record.destination,
            downloadUrl: `${this.config.streamEndpoint}/download/${record.id}`,
            size: record.size,
            type: record.type,
            sha256: record.sha256,
            expiresAt: record.expiresAt
        };
    }

    openDownload(id, token) {
        if (!idPattern.test(id || "")) throw new Error("invalid overlay stream id");
        if (!tokenPattern.test(token || "")) throw new Error("invalid overlay stream token");
        this.cleanupExpired();

        const record = this.records.get(String(id).toLowerCase());
        if (!record || record.token !== String(token).toLowerCase()) {
            throw new Error("invalid overlay stream token");
        }
        if (record.expiresAt <= Date.now()) {
            this.deleteRecord(record);
            throw new Error("overlay stream descriptor expired");
        }

        return {
            path: record.path,
            routeType: record.routeType,
            primitive: record.primitive,
            destination: record.destination,
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
