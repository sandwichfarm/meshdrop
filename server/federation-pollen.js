import net from "net";
import {spawn} from "child_process";

const noop = () => undefined;

export class FederationPollenTransport {

    constructor({config, pollenClient = null, trace = noop}) {
        this.config = config;
        this.pollenClient = pollenClient;
        this.trace = trace;
    }

    async ensureService() {
        if (!this.config.pollen.enabled) return;

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
