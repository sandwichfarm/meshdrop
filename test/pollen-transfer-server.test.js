import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {Readable} from "stream";

import PollenTransferClient, {createPollenConfig} from "../server/pollen-transfer.js";

const hash = "c".repeat(64);

async function fakePln() {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "meshdrop-fake-pln-"));
    const bin = path.join(dir, "pln");
    await fs.promises.writeFile(bin, `#!/bin/sh
set -eu
case "$1" in
  version) echo vtest ;;
  status) exit 0 ;;
  seed) cat >/dev/null; echo ${hash} ;;
  fetch) printf hello > "$3" ;;
  *) echo "unexpected $*" >&2; exit 1 ;;
esac
`);
    await fs.promises.chmod(bin, 0o755);
    return {
        bin,
        cleanup: () => fs.promises.rm(dir, {recursive: true, force: true})
    };
}

test("Pollen server client reports status and streams upload/download through pln", async () => {
    const pln = await fakePln();
    const client = new PollenTransferClient({
        enabled: true,
        command: pln.bin,
        dir: "/tmp/meshdrop-test-pln",
        maxUploadBytes: 1024
    });

    try {
        assert.deepEqual(await client.status(), {
            enabled: true,
            available: true,
            version: "vtest",
            error: ""
        });

        const descriptor = await client.uploadStream(Readable.from(["hello"]), {
            size: 5,
            type: "text/plain"
        });
        assert.deepEqual(descriptor, {
            hash,
            size: 5,
            type: "text/plain"
        });

        const fetched = await client.fetchToTemp(hash);
        try {
            assert.equal(await fs.promises.readFile(fetched.path, "utf8"), "hello");
        } finally {
            await fetched.cleanup();
        }
    } finally {
        await pln.cleanup();
    }
});

test("Pollen server client enforces streamed upload size limit", async () => {
    const pln = await fakePln();
    const client = new PollenTransferClient({
        enabled: true,
        command: pln.bin,
        dir: "/tmp/meshdrop-test-pln",
        maxUploadBytes: 3
    });

    try {
        await assert.rejects(
            client.uploadStream(Readable.from(["hello"]), {size: 0, type: "text/plain"}),
            /size limit/
        );
    } finally {
        await pln.cleanup();
    }
});

test("Pollen config defaults to container-local pln state", () => {
    assert.deepEqual(createPollenConfig({}), {
        enabled: true,
        command: "pln",
        dir: "/var/lib/meshdrop/pln",
        maxUploadBytes: 2 * 1024 * 1024 * 1024
    });
    assert.equal(createPollenConfig({POLLEN_TRANSFER: "false"}).enabled, false);
});
