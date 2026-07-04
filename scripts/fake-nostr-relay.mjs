import {WebSocketServer} from "ws";

export function startFakeRelay() {
    const wss = new WebSocketServer({port: 0, host: "127.0.0.1"});
    const subscriptions = new Map();
    const history = [];

    wss.on("connection", socket => {
        subscriptions.set(socket, new Map());
        socket.on("message", raw => {
            const message = parseRelayMessage(raw);
            if (!message) return;

            if (message[0] === "REQ" && message[1]) {
                const filters = message.slice(2).filter(filter => filter && typeof filter === "object");
                subscriptions.get(socket).set(message[1], filters);
                history.forEach(event => {
                    if (matchesAnyRelayFilter(event, filters)) sendRelayEvent(socket, message[1], event);
                });
                return;
            }

            if (message[0] !== "EVENT" || !message[1]) return;

            const event = message[1];
            history.push(event);
            socket.send(JSON.stringify(["OK", event.id || "", true, ""]));
            publishToSubscribers(subscriptions, event);
        });
        socket.on("close", () => subscriptions.delete(socket));
    });

    return new Promise(resolve => {
        wss.on("listening", () => {
            resolve({
                close: callback => {
                    for (const client of wss.clients) client.terminate();
                    wss.close(callback);
                },
                url: `ws://127.0.0.1:${wss.address().port}`
            });
        });
    });
}

function parseRelayMessage(raw) {
    try {
        return JSON.parse(raw.toString("utf8"));
    } catch {
        return null;
    }
}

function publishToSubscribers(subscriptions, event) {
    for (const [client, clientSubscriptions] of subscriptions.entries()) {
        for (const [subscriptionId, filters] of clientSubscriptions.entries()) {
            if (matchesAnyRelayFilter(event, filters)) sendRelayEvent(client, subscriptionId, event);
        }
    }
}

function sendRelayEvent(socket, subscriptionId, event) {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
}

function matchesAnyRelayFilter(event, filters) {
    return filters.some(filter => matchesRelayFilter(event, filter));
}

function matchesRelayFilter(event, filter) {
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter["#p"] && !eventRecipients(event).some(pubkey => filter["#p"].includes(pubkey))) return false;
    return true;
}

function eventRecipients(event) {
    return (event.tags || []).filter(tag => tag[0] === "p").map(tag => tag[1]);
}
