import test from "node:test";
import assert from "node:assert/strict";

class FakeTextNode {
    constructor(text) {
        this.nodeType = 3;
        this.textContent = text;
    }
}

class FakeFragment {
    constructor() {
        this.childNodes = [];
    }

    appendChild(node) {
        this.childNodes.push(node);
        return node;
    }
}

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.attributes = new Map();
        this.childNodes = [];
        this._textContent = "";
    }

    appendChild(node) {
        if (node instanceof FakeFragment) {
            this.childNodes.push(...node.childNodes);
            return node;
        }
        this.childNodes.push(node);
        return node;
    }

    replaceChildren(...nodes) {
        this.childNodes = [];
        nodes.forEach(node => this.appendChild(node));
        this._textContent = "";
    }

    set textContent(value) {
        this.childNodes = [];
        this._textContent = String(value);
    }

    get textContent() {
        if (this.childNodes.length) {
            return this.childNodes.map(node => node.textContent).join("");
        }
        return this._textContent;
    }

    set href(value) {
        this.attributes.set("href", String(value));
    }

    get href() {
        return this.attributes.get("href");
    }

    set target(value) {
        this.attributes.set("target", String(value));
    }

    get target() {
        return this.attributes.get("target");
    }

    set rel(value) {
        this.attributes.set("rel", String(value));
    }

    get rel() {
        return this.attributes.get("rel");
    }
}

function installFakeDom() {
    globalThis.document = {
        createDocumentFragment: () => new FakeFragment(),
        createTextNode: text => new FakeTextNode(text),
        createElement: tagName => new FakeElement(tagName),
        importNode: node => node
    };
    globalThis.DOMParser = class {
        parseFromString(markup) {
            const root = markup.includes("<svg") ? new FakeElement("svg") : new FakeElement("html");
            return {documentElement: root};
        }
    };
    globalThis.isUrlValid = value => {
        try {
            const url = new URL(value);
            return ["http:", "https:", "mailto:"].includes(url.protocol);
        }
        catch {
            return false;
        }
    };
}

installFakeDom();
await import("../public/scripts/ui.js");

const {MeshDropSafeDom} = globalThis;

test("renderReceivedText creates safe anchor nodes without parsing message HTML", () => {
    installFakeDom();
    const target = new FakeElement("div");

    MeshDropSafeDom.renderReceivedText(target, `Open www.example.com <img src=x onerror=alert(1)>`);

    assert.equal(target.childNodes.length, 3);
    assert.equal(target.childNodes[0].textContent, "Open ");
    assert.equal(target.childNodes[1].tagName, "A");
    assert.equal(target.childNodes[1].href, "http://www.example.com");
    assert.equal(target.childNodes[1].target, "_blank");
    assert.equal(target.childNodes[1].rel, "noreferrer");
    assert.equal(target.childNodes[1].textContent, "www.example.com");
    assert.equal(target.childNodes[2].textContent, " <img src=x onerror=alert(1)>");
});

test("renderReceivedText preserves invalid links as plain text", () => {
    installFakeDom();
    const target = new FakeElement("div");

    MeshDropSafeDom.renderReceivedText(target, "See example.com and mailto:user@example.com");

    assert.equal(target.childNodes.length, 3);
    assert.equal(target.childNodes[0].textContent, "See example.com and ");
    assert.equal(target.childNodes[1].tagName, "A");
    assert.equal(target.childNodes[1].href, "mailto:user@example.com");
    assert.equal(target.childNodes[1].textContent, "mailto:user@example.com");
    assert.equal(target.childNodes[2].textContent, "");
});

test("setQrSvg imports only SVG roots", () => {
    installFakeDom();
    const target = new FakeElement("div");

    MeshDropSafeDom.setQrSvg(target, "<svg><path /></svg>");

    assert.equal(target.childNodes.length, 1);
    assert.equal(target.childNodes[0].tagName, "SVG");
    assert.throws(
        () => MeshDropSafeDom.setQrSvg(target, "<html></html>"),
        /invalid SVG/
    );
});
