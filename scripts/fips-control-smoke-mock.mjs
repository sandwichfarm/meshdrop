import fs from "node:fs";
import net from "node:net";

const port = Number(process.env.FIPS_CONTROL_SOCKET || "21210");
const logPath = process.env.MESHDROP_FIPS_CONTROL_SMOKE_LOG || "/tmp/meshdrop-fips-control-smoke.jsonl";

fs.writeFileSync(logPath, "");

const server = net.createServer(socket => {
    let buffer = "";
    socket.on("data", chunk => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.trim()) continue;
            const request = JSON.parse(line);
            fs.appendFileSync(logPath, `${JSON.stringify(request)}\n`);
            socket.write(`${JSON.stringify(responseFor(request))}\n`);
        }
    });
});

server.listen(port, "127.0.0.1");

function responseFor(request) {
    if (request.command === "show_status") {
        return {status: "ok", data: {npub: "npub1smokefips", peer_count: 0, estimated_mesh_size: 1}};
    }

    if (request.command === "show_peers") {
        return {status: "ok", data: {peers: []}};
    }

    if (request.command === "connect" || request.command === "restart") {
        return {status: "ok", data: {accepted: true}};
    }

    return {status: "error", message: `unsupported command ${request.command}`};
}
