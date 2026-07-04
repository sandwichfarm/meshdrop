import {spawn} from "node:child_process";

const image = process.env.MESHDROP_DOCKER_IMAGE || "meshdrop:smoke";
const container = `meshdrop-smoke-${process.pid}`;

async function main() {
    await run("docker", ["build", "-t", image, "."]);

    let started = false;
    try {
        await run("docker", [
            "run",
            "-d",
            "--name",
            container,
            "-p",
            "127.0.0.1::3000",
            "-e",
            "FIPS_DISCOVERY=true",
            "-e",
            "NOSTR_ROOM=docker-smoke",
            image
        ]);
        started = true;

        const port = await mappedPort();
        const baseUrl = `http://127.0.0.1:${port}`;

        await waitForHttp(`${baseUrl}/config`);
        await waitForHealth();

        const config = await getJson(`${baseUrl}/config`);
        assert(config.nostrMesh?.room === "docker-smoke", "Nostr mesh config was not exposed");
        assert(config.fips?.enabled === true, "FIPS config was not enabled in container");
        assert(config.pollen?.enabled === true, "Pollen config was not enabled in container");
        assert(config.pollen?.room === "meshdrop-pollen", "Pollen federation room was not exposed");
        assert(Array.isArray(config.blossom?.servers), "Blossom config was not exposed");

        const fipsStatus = await getJson(`${baseUrl}/fips/status`);
        assert(fipsStatus.enabled === true, "FIPS status did not reflect configured discovery");
        assert(fipsStatus.available === false, "Smoke container should not have an attached FIPS daemon");

        const pollenStatus = await getJson(`${baseUrl}/pollen/status`);
        assert(pollenStatus.enabled === true, "Pollen status did not reflect configured transfer");
        assert(pollenStatus.available === true, "Container-local Pollen daemon was not reachable");
        assert(pollenStatus.version, "Container-local Pollen version was not reported");

        const federation = await getJson(`${baseUrl}/.well-known/meshdrop-federation`);
        assert(federation.kind === "meshdrop-federation", "Federation descriptor missing");
        assert(federation.pollen?.serviceName, "Pollen federation service was not advertised");

        const page = await getText(baseUrl);
        assert(page.includes("<title>MeshDrop"), "MeshDrop title missing from served page");
        assert(page.includes("https://github.com/sandwichfarm/PairDrop"), "MeshDrop GitHub link missing from info overlay");
        assert(page.includes("https://nostr.com"), "Nostr link missing from info overlay");
        assert(page.includes("https://github.com/hzrd149/blossom"), "Blossom link missing from info overlay");
        assert(page.includes("https://hashtree.cc"), "Hashtree link missing from info overlay");
        assert(page.includes("https://github.com/nostr-protocol/nips/pull/363"), "NIP-100 link missing from info overlay");
        assert(page.includes("https://fips.network"), "FIPS link missing from info overlay");
        assert(page.includes("https://github.com/schlagmichdoch/PairDrop"), "PairDrop credit link missing from info overlay");
        assert(page.includes("id=\"nostr-identity\""), "Nostr identity control missing from served page");
        assert(page.includes("id=\"nostr-mesh\""), "Nostr mesh control missing from served page");
        assert(page.includes("id=\"fips-discovery\""), "FIPS discovery control missing from served page");
        assert(page.includes("id=\"blossom-transfer\""), "Blossom transfer control missing from served page");
        assert(page.includes("id=\"hashtree-transfer\""), "Hashtree transfer control missing from served page");

        console.log(`Docker smoke passed for ${image} on ${baseUrl}`);
    }
    finally {
        if (started) await run("docker", ["rm", "-f", container], {allowFailure: true});
    }
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: new URL("..", import.meta.url),
            stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
        });
        let stdout = "";
        let stderr = "";

        if (options.capture) {
            child.stdout.on("data", chunk => stdout += chunk.toString("utf8"));
            child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
        }

        child.on("error", reject);
        child.on("close", code => {
            if (code === 0 || options.allowFailure) {
                resolve(stdout.trim());
            }
            else {
                reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stderr}`));
            }
        });
    });
}

async function mappedPort() {
    for (let i = 0; i < 30; i++) {
        const output = await run("docker", ["port", container, "3000/tcp"], {capture: true});
        const match = output.match(/127\.0\.0\.1:(\d+)/);
        if (match) return match[1];
        await delay(250);
    }

    throw new Error("Docker did not publish container port 3000");
}

async function waitForHttp(url) {
    for (let i = 0; i < 60; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        }
        catch {
            // Retry until the container finishes booting.
        }

        await delay(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

async function waitForHealth() {
    for (let i = 0; i < 40; i++) {
        const status = await run("docker", [
            "inspect",
            "--format",
            "{{.State.Health.Status}}",
            container
        ], {capture: true});

        if (status === "healthy") return;
        if (status === "unhealthy") throw new Error("Container healthcheck failed");
        await delay(500);
    }

    throw new Error("Timed out waiting for healthy container");
}

async function getJson(url) {
    const response = await fetch(url);
    assert(response.ok, `${url} returned ${response.status}`);
    return response.json();
}

async function getText(url) {
    const response = await fetch(url);
    assert(response.ok, `${url} returned ${response.status}`);
    return response.text();
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
