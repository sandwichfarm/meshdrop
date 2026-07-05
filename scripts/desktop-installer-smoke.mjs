import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";

import {buildDesktopInstaller} from "./build-desktop-installer.mjs";

const execFileAsync = promisify(execFile);

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-installer-"));
    const verifyHome = path.join(tempDir, "verify-gnupg");
    const installDir = path.join(tempDir, "install");
    const binDir = path.join(tempDir, "bin");

    try {
        await fs.mkdir(verifyHome, {recursive: true, mode: 0o700});
        await fs.chmod(verifyHome, 0o700);
        const result = await buildDesktopInstaller({
            version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-installer-smoke",
            outDir: tempDir,
            bundleChromium: true,
            env: {
                ...process.env,
                MESH_DROP_BUILD_ID: "desktop-installer-smoke"
            }
        });

        await run("sha256sum", ["-c", path.basename(result.sha256Path)], {cwd: tempDir});
        await run("gpg", ["--batch", "--import", result.publicKeyPath], {
            env: {...process.env, GNUPGHOME: verifyHome}
        });
        await run("gpg", ["--batch", "--verify", result.signaturePath, result.installerPath], {
            env: {...process.env, GNUPGHOME: verifyHome}
        });

        const {stdout: metadataJson} = await execFileAsync(result.installerPath, ["--print-metadata"]);
        const metadata = JSON.parse(metadataJson);
        if (metadata.remainingProof.length !== 0) {
            throw new Error(`Installer still lists remaining proof: ${metadata.remainingProof.join(", ")}`);
        }

        await run(result.installerPath, [installDir], {
            env: {...process.env, MESHDROP_INSTALL_BIN_DIR: binDir}
        });
        const launcher = path.join(binDir, "meshdrop-desktop");
        const appDir = path.join(installDir, result.prefix, "app");
        const {stdout} = await execFileAsync(launcher, ["--meshdrop-print-config", "--app-dir", appDir]);
        const smoke = JSON.parse(stdout);

        if (smoke.target !== "desktop") throw new Error(`Expected desktop target, got ${smoke.target}`);
        if (smoke.shell !== "chromium") throw new Error(`Expected chromium shell, got ${smoke.shell}`);
        if (smoke.appIndexExists !== true) throw new Error("Installed launcher cannot read app/index.html");

        console.log(
            `Proof desktop-signed-installer: ${path.basename(result.installerPath)} signature verified and installed ${result.prefix}`
        );
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

function run(command, args, options = {}) {
    return execFileAsync(command, args, {
        cwd: options.cwd,
        env: options.env || process.env
    });
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
