import {spawn} from "node:child_process";

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export async function mappedPort(container) {
    for (let i = 0; i < 30; i++) {
        const output = await run("docker", ["port", container, "3000/tcp"], {capture: true});
        const match = output.match(/127\.0\.0\.1:(\d+)/);
        if (match) return match[1];
        await delay(250);
    }

    throw new Error(`Docker did not publish ${container} port 3000`);
}

export async function waitForHealth(container) {
    for (let i = 0; i < 40; i++) {
        const status = await run("docker", [
            "inspect",
            "--format",
            "{{.State.Health.Status}}",
            container
        ], {capture: true});

        if (status === "healthy") return;
        if (status === "unhealthy") throw new Error(`${container} healthcheck failed`);
        await delay(500);
    }

    throw new Error(`Timed out waiting for ${container} to become healthy`);
}

export async function waitForHttp(url) {
    for (let i = 0; i < 60; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // Retry until the container finishes booting.
        }

        await delay(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

export async function launchOptions() {
    const options = {headless: true};
    const executablePath = await resolveChromiumPath();
    if (executablePath) options.executablePath = executablePath;
    return options;
}

export function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: new URL("..", import.meta.url),
            env: {...process.env, ...options.env},
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

async function resolveChromiumPath() {
    if (chromiumPath !== undefined) return chromiumPath;

    try {
        await import("node:fs/promises").then(fs => fs.access("/usr/bin/chromium"));
        return "/usr/bin/chromium";
    } catch {
        return "";
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
