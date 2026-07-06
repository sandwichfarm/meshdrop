import fs from "node:fs/promises";
import path from "node:path";

export async function writeNativeSource(stageDir, target, manifest, env = process.env) {
    if (target === "ios") {
        await writeIosNativeSource(stageDir, manifest);
        return;
    }
    await writeAndroidNativeSource(stageDir, manifest, env);
}

async function writeIosNativeSource(stageDir, manifest) {
    const iosRoot = path.join(stageDir, "native", "ios");
    const nativeDir = path.join(stageDir, "native", "ios", "MeshDrop");
    const shareExtensionDir = path.join(stageDir, "native", "ios", "MeshDropShareExtension");
    const xcodeProjectDir = path.join(iosRoot, "MeshDrop.xcodeproj");
    const xcodeSchemeDir = path.join(xcodeProjectDir, "xcshareddata", "xcschemes");
    const resourceDir = path.join(nativeDir, "Resources", "meshdrop");
    const manifestJson = JSON.stringify(manifest, null, 2);

    await fs.mkdir(nativeDir, {recursive: true});
    await fs.mkdir(shareExtensionDir, {recursive: true});
    await fs.mkdir(xcodeSchemeDir, {recursive: true});
    await fs.cp(path.join(stageDir, "app"), resourceDir, {recursive: true});
    await fs.writeFile(path.join(stageDir, "native", "ios", "README.md"), iosReadme());
    await fs.writeFile(path.join(xcodeProjectDir, "project.pbxproj"), iosXcodeProjectPbxproj(manifest.version));
    await fs.writeFile(path.join(xcodeSchemeDir, "MeshDrop.xcscheme"), iosXcodeScheme());
    await fs.writeFile(path.join(nativeDir, "MeshDropApp.swift"), iosAppSource());
    await fs.writeFile(path.join(nativeDir, "MeshDropView.swift"), iosViewSource());
    await fs.writeFile(path.join(nativeDir, "MeshDropViewController.swift"), iosViewControllerSource(manifestJson));
    await fs.writeFile(path.join(nativeDir, "MeshDropShareInbox.swift"), iosShareInboxSource());
    await fs.writeFile(path.join(nativeDir, "Info.plist"), iosInfoPlist());
    await fs.writeFile(path.join(nativeDir, "MeshDrop.entitlements"), iosAppEntitlements());
    await fs.writeFile(path.join(shareExtensionDir, "ShareViewController.swift"), iosShareExtensionSource());
    await fs.writeFile(path.join(shareExtensionDir, "Info.plist"), iosShareExtensionInfoPlist());
    await fs.writeFile(path.join(shareExtensionDir, "MeshDropShareExtension.entitlements"), iosShareExtensionEntitlements());
}

async function writeAndroidNativeSource(stageDir, manifest, env) {
    const nativeRoot = path.join(stageDir, "native", "android");
    const appSrc = path.join(nativeRoot, "app", "src", "main");
    const assetDir = path.join(appSrc, "assets", "meshdrop");

    await fs.cp(path.join(stageDir, "app"), assetDir, {recursive: true});
    await copyAndroidNativeTools(appSrc, env);
    await fs.writeFile(path.join(nativeRoot, "README.md"), androidReadme());
    await writeAndroidGradleFiles(nativeRoot, manifest);
    await writeAndroidManifestFiles(appSrc);
    await writeAndroidActivity(appSrc, manifest);
}

const androidNativeToolAbis = [
    {abi: "arm64-v8a", env: "ARM64_V8A"},
    {abi: "armeabi-v7a", env: "ARMEABI_V7A"},
    {abi: "x86_64", env: "X86_64"}
];

const androidNativeTools = [
    {tool: "fips", env: "FIPS"},
    {tool: "fipsctl", env: "FIPSCTL"},
    {tool: "pln", env: "PLN"}
];

async function copyAndroidNativeTools(appSrc, env) {
    for (const {abi, env: abiEnv} of androidNativeToolAbis) {
        for (const {tool, env: toolEnv} of androidNativeTools) {
            const source = env[`MESHDROP_ANDROID_${toolEnv}_${abiEnv}`];
            if (!source) continue;
            if (!path.isAbsolute(source)) {
                throw new Error(`MESHDROP_ANDROID_${toolEnv}_${abiEnv} must be an absolute path`);
            }
            await fs.access(source);
            const toolDir = path.join(appSrc, "jniLibs", abi);
            await fs.mkdir(toolDir, {recursive: true});
            await fs.copyFile(source, path.join(toolDir, `libmeshdrop_${tool}.so`));
        }
    }
}

function androidReadme() {
    return [
        "# MeshDrop Android Native Source",
        "",
        "This source wraps the packaged `app/` directory in `android.webkit.WebView` and injects `meshdrop-target.json`.",
        "Build and signing require an Android SDK. This artifact is source only and does not prove device transfer UAT.",
        ""
    ].join("\n");
}

function iosReadme() {
    return [
        "# MeshDrop iOS Native Source",
        "",
        "This source wraps the packaged `app/` directory in `WKWebView` and injects `meshdrop-target.json` at document start.",
        "WKWebView file inputs are wired to the native document picker through `WKUIDelegate`.",
        "Share extension source is included under `MeshDropShareExtension/` and stages shared files through an App Group container.",
        "The generated `MeshDrop.xcodeproj` has app and share-extension targets plus matching App Group entitlements.",
        "Enable the same App Group entitlement for the app and extension before building the share-sheet path.",
        "Build and signing require Xcode on macOS. This artifact is source only and does not prove device transfer UAT.",
        ""
    ].join("\n");
}

function iosAppSource() {
    return [
        "import SwiftUI",
        "",
        "@main",
        "struct MeshDropApp: App {",
        "    var body: some Scene {",
        "        WindowGroup {",
        "            MeshDropView()",
        "        }",
        "    }",
        "}",
        ""
    ].join("\n");
}

function iosViewSource() {
    return [
        "import SwiftUI",
        "import WebKit",
        "",
        "struct MeshDropView: UIViewControllerRepresentable {",
        "    func makeUIViewController(context: Context) -> MeshDropViewController {",
        "        MeshDropViewController()",
        "    }",
        "",
        "    func updateUIViewController(_ viewController: MeshDropViewController, context: Context) {}",
        "}",
        ""
    ].join("\n");
}

function iosViewControllerSource(manifestJson) {
    return [
        "import UIKit",
        "import UniformTypeIdentifiers",
        "import WebKit",
        "",
        "final class MeshDropViewController: UIViewController, WKUIDelegate, UIDocumentPickerDelegate, WKScriptMessageHandler {",
        "    private let targetManifest = #\"\"\"",
        ...manifestJson.split("\n").map(line => `    ${line}`),
        "    \"\"\"#",
        "    private var webView: WKWebView!",
        "    private var fileSelectionCompletion: (([URL]?) -> Void)?",
        "",
        "    override func viewDidLoad() {",
        "        super.viewDidLoad()",
        "        let configuration = WKWebViewConfiguration()",
        "        let source = \"globalThis.__meshdropTargetManifest = \\(targetManifest);\"",
        "        let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)",
        "        configuration.userContentController.addUserScript(script)",
        "        configuration.userContentController.addUserScript(WKUserScript(",
        "            source: MeshDropShareInbox.bootstrapScript(),",
        "            injectionTime: .atDocumentStart,",
        "            forMainFrameOnly: false",
        "        ))",
        "        configuration.userContentController.add(self, name: \"meshdropShareInbox\")",
        "        webView = WKWebView(frame: view.bounds, configuration: configuration)",
        "        webView.uiDelegate = self",
        "        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]",
        "        view.addSubview(webView)",
        "        guard let url = Bundle.main.url(forResource: \"index\", withExtension: \"html\", subdirectory: \"meshdrop\") else {",
        "            fatalError(\"MeshDrop app/index.html is missing from the app bundle\")",
        "        }",
        "        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())",
        "    }",
        "",
        "    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {",
        "        guard message.name == \"meshdropShareInbox\",",
        "            let body = message.body as? [String: Any],",
        "            let requestId = body[\"id\"] as? String,",
        "            let fileName = body[\"name\"] as? String",
        "        else { return }",
        "",
        "        let responseScript = MeshDropShareInbox.fileResponseScript(requestId: requestId, fileName: fileName)",
        "        webView.evaluateJavaScript(responseScript, completionHandler: nil)",
        "    }",
        "",
        "    @available(iOS 18.4, *)",
        "    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {",
        "        fileSelectionCompletion?(nil)",
        "        fileSelectionCompletion = completionHandler",
        "        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)",
        "        picker.allowsMultipleSelection = parameters.allowsMultipleSelection",
        "        picker.delegate = self",
        "        present(picker, animated: true)",
        "    }",
        "",
        "    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {",
        "        fileSelectionCompletion?(urls)",
        "        fileSelectionCompletion = nil",
        "    }",
        "",
        "    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {",
        "        fileSelectionCompletion?(nil)",
        "        fileSelectionCompletion = nil",
        "    }",
        "}",
        ""
    ].join("\n");
}

function iosShareInboxSource() {
    return [
        "import Foundation",
        "",
        ...iosShareInboxModelsSource(),
        ...iosShareInboxCoreSource(),
        ""
    ].join("\n");
}

function iosShareInboxModelsSource() {
    return [
        "struct MeshDropSharedFile: Codable {",
        "    let name: String",
        "    let path: String",
        "    let receivedAt: String",
        "}",
        "",
        "private struct MeshDropSharedFileResponse: Codable {",
        "    let id: String",
        "    let name: String?",
        "    let base64: String?",
        "    let error: String?",
        "}",
        "",
        "private enum MeshDropShareInboxError: Error {",
        "    case missingInbox",
        "    case missingManifestEntry",
        "    case pathEscapesInbox",
        "}",
        ""
    ];
}

function iosShareInboxCoreSource() {
    return [
        "enum MeshDropShareInbox {",
        "    static let appGroupIdentifier = \"group.farm.sandwich.meshdrop\"",
        "    static let inboxDirectoryName = \"SharedFiles\"",
        "    static let manifestFileName = \"share-inbox.json\"",
        "",
        "    static func inboxURL() -> URL? {",
        "        FileManager.default",
        "            .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?",
        "            .appendingPathComponent(inboxDirectoryName, isDirectory: true)",
        "    }",
        "",
        "    static func readManifest() throws -> [MeshDropSharedFile] {",
        "        guard let inbox = inboxURL() else { return [] }",
        "        let manifest = inbox.appendingPathComponent(manifestFileName)",
        "        guard FileManager.default.fileExists(atPath: manifest.path) else { return [] }",
        "        let data = try Data(contentsOf: manifest)",
        "        return try JSONDecoder().decode([MeshDropSharedFile].self, from: data)",
        "    }",
        "",
        ...iosShareInboxBootstrapSource(),
        ...iosShareInboxFileResponseSource(),
        ...iosShareInboxFileReadSource(),
        ...iosShareInboxJsonSource(),
        "}"
    ];
}

function iosShareInboxBootstrapSource() {
    return [
        "    static func bootstrapScript() -> String {",
        "        let files = (try? readManifest()) ?? []",
        "        let json = jsonString(files, fallback: \"[]\")",
        "        return \"\"\"",
        "        (() => {",
        "            const files = \\(json);",
        "            globalThis.__meshdropSharedFiles = files;",
        "            globalThis.meshdropShareInbox = {",
        "                list() {",
        "                    return Promise.resolve(files);",
        "                },",
        "                read(name) {",
        "                    return new Promise((resolve, reject) => {",
        "                        const handler = globalThis.webkit?.messageHandlers?.meshdropShareInbox;",
        "                        if (!handler) {",
        "                            reject(new Error(\"meshdropShareInbox bridge is unavailable\"));",
        "                            return;",
        "                        }",
        "                        const id = globalThis.crypto?.randomUUID",
        "                            ? globalThis.crypto.randomUUID()",
        "                            : `${Date.now()}-${Math.random()}`;",
        "                        const listener = event => {",
        "                            if (!event.detail || event.detail.id !== id) { return; }",
        "                            window.removeEventListener(\"meshdrop:share-inbox-file\", listener);",
        "                            if (event.detail.error) {",
        "                                reject(new Error(event.detail.error));",
        "                                return;",
        "                            }",
        "                            resolve(event.detail);",
        "                        };",
        "                        window.addEventListener(\"meshdrop:share-inbox-file\", listener);",
        "                        handler.postMessage({ id, name });",
        "                    });",
        "                }",
        "            };",
        "            window.dispatchEvent(new CustomEvent(\"meshdrop:shared-files\", { detail: files }));",
        "        })();",
        "        \"\"\"",
        "    }",
        "",
    ];
}

function iosShareInboxFileResponseSource() {
    return [
        "    static func fileResponseScript(requestId: String, fileName: String) -> String {",
        "        let response: MeshDropSharedFileResponse",
        "        do {",
        "            let (entry, data) = try readSharedFile(named: fileName)",
        "            response = MeshDropSharedFileResponse(",
        "                id: requestId,",
        "                name: entry.name,",
        "                base64: data.base64EncodedString(),",
        "                error: nil",
        "            )",
        "        } catch {",
        "            response = MeshDropSharedFileResponse(",
        "                id: requestId,",
        "                name: fileName,",
        "                base64: nil,",
        "                error: String(describing: error)",
        "            )",
        "        }",
        "",
        "        let json = jsonString(response, fallback: \"{}\")",
        "        return \"window.dispatchEvent(new CustomEvent(\\\"meshdrop:share-inbox-file\\\", { detail: \\(json) }));\"",
        "    }",
        "",
    ];
}

function iosShareInboxFileReadSource() {
    return [
        "    private static func readSharedFile(named fileName: String) throws -> (MeshDropSharedFile, Data) {",
        "        guard let inbox = inboxURL() else { throw MeshDropShareInboxError.missingInbox }",
        "        let requestedPath = URL(fileURLWithPath: fileName).lastPathComponent",
        "        guard let entry = try readManifest().first(where: { $0.path == requestedPath }) else {",
        "            throw MeshDropShareInboxError.missingManifestEntry",
        "        }",
        "        let fileURL = inbox.appendingPathComponent(entry.path, isDirectory: false)",
        "        let inboxPath = inbox.standardizedFileURL.path + \"/\"",
        "        guard fileURL.standardizedFileURL.path.hasPrefix(inboxPath) else {",
        "            throw MeshDropShareInboxError.pathEscapesInbox",
        "        }",
        "        return (entry, try Data(contentsOf: fileURL))",
        "    }",
        "",
    ];
}

function iosShareInboxJsonSource() {
    return [
        "    private static func jsonString<T: Encodable>(_ value: T, fallback: String) -> String {",
        "        guard let data = try? JSONEncoder().encode(value),",
        "            let json = String(data: data, encoding: .utf8)",
        "        else {",
        "            return fallback",
        "        }",
        "        return json",
        "    }",
    ];
}

function iosShareExtensionSource() {
    return [
        "import Foundation",
        "import Social",
        "import UniformTypeIdentifiers",
        "",
        "final class ShareViewController: SLComposeServiceViewController {",
        "    private let appGroupIdentifier = \"group.farm.sandwich.meshdrop\"",
        "    private let inboxDirectoryName = \"SharedFiles\"",
        "    private let manifestFileName = \"share-inbox.json\"",
        "",
        ...iosShareExtensionLifecycleSource(),
        ...iosShareExtensionStageSource(),
        ...iosShareExtensionHelperSource(),
        "}",
        "",
        "private struct StagedFile: Codable {",
        "    let name: String",
        "    let path: String",
        "    let receivedAt: String",
        "}",
        ""
    ].join("\n");
}

function iosShareExtensionLifecycleSource() {
    return [
        "    override func isContentValid() -> Bool {",
        "        true",
        "    }",
        "",
        "    override func didSelectPost() {",
        "        stageSharedFiles { [weak self] in",
        "            self?.extensionContext?.completeRequest(returningItems: nil)",
        "        }",
        "    }",
        "",
        "    override func configurationItems() -> [Any]! {",
        "        []",
        "    }",
        ""
    ];
}

function iosShareExtensionStageSource() {
    return [
        "    private func stageSharedFiles(completion: @escaping () -> Void) {",
        "        guard let attachments = extensionContext?.inputItems",
        "            .compactMap({ $0 as? NSExtensionItem })",
        "            .flatMap({ $0.attachments ?? [] }),",
        "            let inbox = FileManager.default",
        "                .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?",
        "                .appendingPathComponent(inboxDirectoryName, isDirectory: true)",
        "        else {",
        "            completion()",
        "            return",
        "        }",
        "",
        "        try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)",
        "        let providers: [NSItemProvider] = attachments",
        "        let group = DispatchGroup()",
        "        var stagedFiles: [StagedFile] = []",
        "        let lock = NSLock()",
        "",
        "        for provider in providers {",
        "            guard provider.hasItemConformingToTypeIdentifier(UTType.item.identifier) else { continue }",
        "            group.enter()",
        "            provider.loadFileRepresentation(forTypeIdentifier: UTType.item.identifier) { fileURL, _ in",
        "                defer { group.leave() }",
        "                guard let fileURL else { return }",
        "                let destination = inbox.appendingPathComponent(Self.safeName(for: fileURL.lastPathComponent))",
        "                try? FileManager.default.removeItem(at: destination)",
        "                do {",
        "                    try FileManager.default.copyItem(at: fileURL, to: destination)",
        "                    lock.lock()",
        "                    stagedFiles.append(StagedFile(name: destination.lastPathComponent, path: destination.lastPathComponent, receivedAt: Self.timestamp()))",
        "                    lock.unlock()",
        "                }",
        "                catch {",
        "                    return",
        "                }",
        "            }",
        "        }",
        "",
        "        group.notify(queue: .main) {",
        "            Self.writeManifest(stagedFiles, in: inbox, named: self.manifestFileName)",
        "            completion()",
        "        }",
        "    }",
        ""
    ];
}

function iosShareExtensionHelperSource() {
    return [
        "    private static func safeName(for name: String) -> String {",
        "        name.components(separatedBy: CharacterSet(charactersIn: \"/:\")).joined(separator: \"-\")",
        "    }",
        "",
        "    private static func timestamp() -> String {",
        "        ISO8601DateFormatter().string(from: Date())",
        "    }",
        "",
        "    private static func writeManifest(_ stagedFiles: [StagedFile], in inbox: URL, named manifestFileName: String) {",
        "        let manifest = inbox.appendingPathComponent(manifestFileName)",
        "        guard let data = try? JSONEncoder().encode(stagedFiles) else { return }",
        "        try? data.write(to: manifest, options: .atomic)",
        "    }",
        ""
    ];
}

function iosInfoPlist() {
    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\"",
        "  \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
        "<plist version=\"1.0\">",
        "<dict>",
        "  <key>CFBundleDisplayName</key>",
        "  <string>MeshDrop</string>",
        "  <key>CFBundleExecutable</key>",
        "  <string>$(EXECUTABLE_NAME)</string>",
        "  <key>CFBundleIdentifier</key>",
        "  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>",
        "  <key>CFBundleName</key>",
        "  <string>$(PRODUCT_NAME)</string>",
        "  <key>CFBundlePackageType</key>",
        "  <string>APPL</string>",
        "  <key>CFBundleShortVersionString</key>",
        "  <string>$(MARKETING_VERSION)</string>",
        "  <key>CFBundleVersion</key>",
        "  <string>$(CURRENT_PROJECT_VERSION)</string>",
        "  <key>LSRequiresIPhoneOS</key>",
        "  <true/>",
        "  <key>WKAppBoundDomains</key>",
        "  <array/>",
        "</dict>",
        "</plist>",
        ""
    ].join("\n");
}

function iosAppEntitlements() {
    return iosAppGroupEntitlementsXml();
}

function iosShareExtensionInfoPlist() {
    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\"",
        "  \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
        "<plist version=\"1.0\">",
        "<dict>",
        "  <key>CFBundleDisplayName</key>",
        "  <string>MeshDrop Share</string>",
        "  <key>CFBundleExecutable</key>",
        "  <string>$(EXECUTABLE_NAME)</string>",
        "  <key>CFBundleIdentifier</key>",
        "  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>",
        "  <key>CFBundleName</key>",
        "  <string>$(PRODUCT_NAME)</string>",
        "  <key>CFBundlePackageType</key>",
        "  <string>XPC!</string>",
        "  <key>CFBundleShortVersionString</key>",
        "  <string>$(MARKETING_VERSION)</string>",
        "  <key>CFBundleVersion</key>",
        "  <string>$(CURRENT_PROJECT_VERSION)</string>",
        "  <key>NSExtension</key>",
        "  <dict>",
        "    <key>NSExtensionPointIdentifier</key>",
        "    <string>com.apple.share-services</string>",
        "    <key>NSExtensionPrincipalClass</key>",
        "    <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>",
        "    <key>NSExtensionAttributes</key>",
        "    <dict>",
        "      <key>NSExtensionActivationRule</key>",
        "      <dict>",
        "        <key>NSExtensionActivationSupportsFileWithMaxCount</key>",
        "        <integer>20</integer>",
        "      </dict>",
        "    </dict>",
        "  </dict>",
        "</dict>",
        "</plist>",
        ""
    ].join("\n");
}

function iosShareExtensionEntitlements() {
    return iosAppGroupEntitlementsXml();
}

function iosAppGroupEntitlementsXml() {
    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\"",
        "  \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
        "<plist version=\"1.0\">",
        "<dict>",
        "  <key>com.apple.security.application-groups</key>",
        "  <array>",
        "    <string>group.farm.sandwich.meshdrop</string>",
        "  </array>",
        "</dict>",
        "</plist>",
        ""
    ].join("\n");
}

function iosXcodeProjectPbxproj(version) {
    return [
        "// !$*UTF8*$!",
        "{",
        "\tarchiveVersion = 1;",
        "\tclasses = {};",
        "\tobjectVersion = 56;",
        "\tobjects = {",
        ...iosXcodeFileReferences(),
        ...iosXcodeBuildFiles(),
        ...iosXcodeGroups(),
        ...iosXcodeBuildPhases(),
        ...iosXcodeTargets(),
        ...iosXcodeProjectObject(),
        ...iosXcodeBuildConfigurations(version),
        "\t};",
        "\trootObject = A00000000000000000000001;",
        "}",
        ""
    ].join("\n");
}

function iosXcodeFileReferences() {
    return [
        "\t\tA00000000000000000000010 /* MeshDrop.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; path = MeshDrop.app; sourceTree = BUILT_PRODUCTS_DIR;};",
        "\t\tA00000000000000000000011 /* MeshDropShareExtension.appex */ = {isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; path = MeshDropShareExtension.appex; sourceTree = BUILT_PRODUCTS_DIR;};",
        "\t\tA00000000000000000000020 /* MeshDropApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MeshDropApp.swift; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000021 /* MeshDropView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MeshDropView.swift; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000022 /* MeshDropViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MeshDropViewController.swift; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000023 /* MeshDropShareInbox.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MeshDropShareInbox.swift; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000024 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000025 /* MeshDrop.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = MeshDrop.entitlements; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000026 /* Resources */ = {isa = PBXFileReference; lastKnownFileType = folder; path = Resources; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000030 /* ShareViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ShareViewController.swift; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000031 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000032 /* MeshDropShareExtension.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = MeshDropShareExtension.entitlements; sourceTree = \"<group>\";};"
    ];
}

function iosXcodeBuildFiles() {
    return [
        "\t\tA00000000000000000000120 /* MeshDropApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = A00000000000000000000020 /* MeshDropApp.swift */;};",
        "\t\tA00000000000000000000121 /* MeshDropView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A00000000000000000000021 /* MeshDropView.swift */;};",
        "\t\tA00000000000000000000122 /* MeshDropViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A00000000000000000000022 /* MeshDropViewController.swift */;};",
        "\t\tA00000000000000000000123 /* MeshDropShareInbox.swift in Sources */ = {isa = PBXBuildFile; fileRef = A00000000000000000000023 /* MeshDropShareInbox.swift */;};",
        "\t\tA00000000000000000000124 /* Resources in Resources */ = {isa = PBXBuildFile; fileRef = A00000000000000000000026 /* Resources */;};",
        "\t\tA00000000000000000000130 /* ShareViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A00000000000000000000030 /* ShareViewController.swift */;};",
        "\t\tA00000000000000000000131 /* MeshDropShareExtension.appex in Embed App Extensions */ = {isa = PBXBuildFile; fileRef = A00000000000000000000011 /* MeshDropShareExtension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, );};};"
    ];
}

function iosXcodeGroups() {
    return [
        "\t\tA00000000000000000000002 = {isa = PBXGroup; children = (A00000000000000000000003, A00000000000000000000004, A00000000000000000000005, ); sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000003 /* MeshDrop */ = {isa = PBXGroup; children = (A00000000000000000000020, A00000000000000000000021, A00000000000000000000022, A00000000000000000000023, A00000000000000000000024, A00000000000000000000025, A00000000000000000000026, ); path = MeshDrop; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000004 /* MeshDropShareExtension */ = {isa = PBXGroup; children = (A00000000000000000000030, A00000000000000000000031, A00000000000000000000032, ); path = MeshDropShareExtension; sourceTree = \"<group>\";};",
        "\t\tA00000000000000000000005 /* Products */ = {isa = PBXGroup; children = (A00000000000000000000010, A00000000000000000000011, ); name = Products; sourceTree = \"<group>\";};"
    ];
}

function iosXcodeBuildPhases() {
    return [
        "\t\tA00000000000000000000040 /* Sources */ = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000120, A00000000000000000000121, A00000000000000000000122, A00000000000000000000123, ); runOnlyForDeploymentPostprocessing = 0;};",
        "\t\tA00000000000000000000041 /* Resources */ = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000124, ); runOnlyForDeploymentPostprocessing = 0;};",
        "\t\tA00000000000000000000042 /* Frameworks */ = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;};",
        "\t\tA00000000000000000000043 /* Embed App Extensions */ = {isa = PBXCopyFilesBuildPhase; buildActionMask = 2147483647; dstPath = \"\"; dstSubfolderSpec = 13; files = (A00000000000000000000131, ); name = \"Embed App Extensions\"; runOnlyForDeploymentPostprocessing = 0;};",
        "\t\tA00000000000000000000050 /* Sources */ = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000130, ); runOnlyForDeploymentPostprocessing = 0;};",
        "\t\tA00000000000000000000051 /* Resources */ = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;};",
        "\t\tA00000000000000000000052 /* Frameworks */ = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;};"
    ];
}

function iosXcodeTargets() {
    return [
        "\t\tA00000000000000000000060 /* MeshDrop */ = {isa = PBXNativeTarget; buildConfigurationList = A00000000000000000000080 /* Build configuration list for PBXNativeTarget \\\"MeshDrop\\\" */; buildPhases = (A00000000000000000000040, A00000000000000000000041, A00000000000000000000042, A00000000000000000000043, ); dependencies = (A00000000000000000000070, ); name = MeshDrop; productName = MeshDrop; productReference = A00000000000000000000010 /* MeshDrop.app */; productType = \"com.apple.product-type.application\";};",
        "\t\tA00000000000000000000061 /* MeshDropShareExtension */ = {isa = PBXNativeTarget; buildConfigurationList = A00000000000000000000090 /* Build configuration list for PBXNativeTarget \\\"MeshDropShareExtension\\\" */; buildPhases = (A00000000000000000000050, A00000000000000000000051, A00000000000000000000052, ); dependencies = (); name = MeshDropShareExtension; productName = MeshDropShareExtension; productReference = A00000000000000000000011 /* MeshDropShareExtension.appex */; productType = \"com.apple.product-type.app-extension\";};",
        "\t\tA00000000000000000000070 /* PBXTargetDependency */ = {isa = PBXTargetDependency; target = A00000000000000000000061 /* MeshDropShareExtension */; targetProxy = A00000000000000000000071 /* PBXContainerItemProxy */;};",
        "\t\tA00000000000000000000071 /* PBXContainerItemProxy */ = {isa = PBXContainerItemProxy; containerPortal = A00000000000000000000001 /* Project object */; proxyType = 1; remoteGlobalIDString = A00000000000000000000061; remoteInfo = MeshDropShareExtension;};"
    ];
}

function iosXcodeProjectObject() {
    return [
        "\t\tA00000000000000000000001 /* Project object */ = {isa = PBXProject; attributes = {BuildIndependentTargetsInParallel = 1; LastSwiftUpdateCheck = 1640; LastUpgradeCheck = 1640; TargetAttributes = {A00000000000000000000060 = {CreatedOnToolsVersion = 16.4;}; A00000000000000000000061 = {CreatedOnToolsVersion = 16.4;};};}; buildConfigurationList = A00000000000000000000081 /* Build configuration list for PBXProject \\\"MeshDrop\\\" */; compatibilityVersion = \"Xcode 14.0\"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base, ); mainGroup = A00000000000000000000002; productRefGroup = A00000000000000000000005 /* Products */; projectDirPath = \"\"; projectRoot = \"\"; targets = (A00000000000000000000060, A00000000000000000000061, );};"
    ];
}

function iosXcodeBuildConfigurations(version) {
    return [
        ...iosXcodeProjectConfigurations(),
        ...iosXcodeAppConfigurations(version),
        ...iosXcodeShareExtensionConfigurations(version),
        "\t\tA00000000000000000000081 /* Build configuration list for PBXProject \\\"MeshDrop\\\" */ = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000082, A00000000000000000000083, ); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;};",
        "\t\tA00000000000000000000080 /* Build configuration list for PBXNativeTarget \\\"MeshDrop\\\" */ = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000084, A00000000000000000000085, ); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;};",
        "\t\tA00000000000000000000090 /* Build configuration list for PBXNativeTarget \\\"MeshDropShareExtension\\\" */ = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000091, A00000000000000000000092, ); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;};"
    ];
}

function iosXcodeProjectConfigurations() {
    return [
        "\t\tA00000000000000000000082 /* Debug */ = {isa = XCBuildConfiguration; buildSettings = {ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; CLANG_ENABLE_OBJC_ARC = YES; CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES; ENABLE_STRICT_OBJC_MSGSEND = YES; GCC_C_LANGUAGE_STANDARD = gnu17; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SWIFT_VERSION = 5.0;}; name = Debug;};",
        "\t\tA00000000000000000000083 /* Release */ = {isa = XCBuildConfiguration; buildSettings = {ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; CLANG_ENABLE_OBJC_ARC = YES; CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES; ENABLE_STRICT_OBJC_MSGSEND = YES; GCC_C_LANGUAGE_STANDARD = gnu17; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SWIFT_VERSION = 5.0;}; name = Release;};"
    ];
}

function iosXcodeAppConfigurations(version) {
    return [
        `\t\tA00000000000000000000084 /* Debug */ = {isa = XCBuildConfiguration; buildSettings = {ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_ENTITLEMENTS = MeshDrop/MeshDrop.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = ""; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = MeshDrop/Info.plist; MARKETING_VERSION = ${version}; PRODUCT_BUNDLE_IDENTIFIER = farm.sandwich.meshdrop; PRODUCT_NAME = "$(TARGET_NAME)"; SKIP_INSTALL = NO; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2";}; name = Debug;};`,
        `\t\tA00000000000000000000085 /* Release */ = {isa = XCBuildConfiguration; buildSettings = {ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_ENTITLEMENTS = MeshDrop/MeshDrop.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = ""; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = MeshDrop/Info.plist; MARKETING_VERSION = ${version}; PRODUCT_BUNDLE_IDENTIFIER = farm.sandwich.meshdrop; PRODUCT_NAME = "$(TARGET_NAME)"; SKIP_INSTALL = NO; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2";}; name = Release;};`
    ];
}

function iosXcodeShareExtensionConfigurations(version) {
    return [
        `\t\tA00000000000000000000091 /* Debug */ = {isa = XCBuildConfiguration; buildSettings = {CODE_SIGN_ENTITLEMENTS = MeshDropShareExtension/MeshDropShareExtension.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = ""; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = MeshDropShareExtension/Info.plist; MARKETING_VERSION = ${version}; PRODUCT_BUNDLE_IDENTIFIER = farm.sandwich.meshdrop.share; PRODUCT_NAME = "$(TARGET_NAME)"; SKIP_INSTALL = YES; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2";}; name = Debug;};`,
        `\t\tA00000000000000000000092 /* Release */ = {isa = XCBuildConfiguration; buildSettings = {CODE_SIGN_ENTITLEMENTS = MeshDropShareExtension/MeshDropShareExtension.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = ""; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = MeshDropShareExtension/Info.plist; MARKETING_VERSION = ${version}; PRODUCT_BUNDLE_IDENTIFIER = farm.sandwich.meshdrop.share; PRODUCT_NAME = "$(TARGET_NAME)"; SKIP_INSTALL = YES; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2";}; name = Release;};`
    ];
}

function iosXcodeScheme() {
    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<Scheme LastUpgradeVersion=\"1640\" version=\"1.7\">",
        "  <BuildAction parallelizeBuildables=\"YES\" buildImplicitDependencies=\"YES\">",
        "    <BuildActionEntries>",
        "      <BuildActionEntry buildForTesting=\"YES\" buildForRunning=\"YES\" buildForProfiling=\"YES\" buildForArchiving=\"YES\" buildForAnalyzing=\"YES\">",
        "        <BuildableReference BuildableIdentifier=\"primary\" BlueprintIdentifier=\"A00000000000000000000060\" BuildableName=\"MeshDrop.app\" BlueprintName=\"MeshDrop\" ReferencedContainer=\"container:MeshDrop.xcodeproj\" />",
        "      </BuildActionEntry>",
        "      <BuildActionEntry buildForTesting=\"YES\" buildForRunning=\"YES\" buildForProfiling=\"YES\" buildForArchiving=\"YES\" buildForAnalyzing=\"YES\">",
        "        <BuildableReference BuildableIdentifier=\"primary\" BlueprintIdentifier=\"A00000000000000000000061\" BuildableName=\"MeshDropShareExtension.appex\" BlueprintName=\"MeshDropShareExtension\" ReferencedContainer=\"container:MeshDrop.xcodeproj\" />",
        "      </BuildActionEntry>",
        "    </BuildActionEntries>",
        "  </BuildAction>",
        "  <LaunchAction buildConfiguration=\"Debug\" selectedDebuggerIdentifier=\"Xcode.DebuggerFoundation.Debugger.LLDB\" selectedLauncherIdentifier=\"Xcode.DebuggerFoundation.Launcher.LLDB\" launchStyle=\"0\" useCustomWorkingDirectory=\"NO\" ignoresPersistentStateOnLaunch=\"NO\" debugDocumentVersioning=\"YES\" debugServiceExtension=\"internal\" allowLocationSimulation=\"YES\">",
        "    <BuildableProductRunnable runnableDebuggingMode=\"0\">",
        "      <BuildableReference BuildableIdentifier=\"primary\" BlueprintIdentifier=\"A00000000000000000000060\" BuildableName=\"MeshDrop.app\" BlueprintName=\"MeshDrop\" ReferencedContainer=\"container:MeshDrop.xcodeproj\" />",
        "    </BuildableProductRunnable>",
        "  </LaunchAction>",
        "  <ProfileAction buildConfiguration=\"Release\" shouldUseLaunchSchemeArgsEnv=\"YES\" savedToolIdentifier=\"\" useCustomWorkingDirectory=\"NO\" debugDocumentVersioning=\"YES\">",
        "    <BuildableProductRunnable runnableDebuggingMode=\"0\">",
        "      <BuildableReference BuildableIdentifier=\"primary\" BlueprintIdentifier=\"A00000000000000000000060\" BuildableName=\"MeshDrop.app\" BlueprintName=\"MeshDrop\" ReferencedContainer=\"container:MeshDrop.xcodeproj\" />",
        "    </BuildableProductRunnable>",
        "  </ProfileAction>",
        "  <AnalyzeAction buildConfiguration=\"Debug\" />",
        "  <ArchiveAction buildConfiguration=\"Release\" revealArchiveInOrganizer=\"YES\" />",
        "</Scheme>",
        ""
    ].join("\n");
}

async function writeAndroidGradleFiles(nativeRoot, manifest) {
    await fs.writeFile(path.join(nativeRoot, "settings.gradle"), androidSettingsGradle());
    await fs.writeFile(path.join(nativeRoot, "build.gradle"), androidRootBuildGradle());
    await fs.mkdir(path.join(nativeRoot, "app"), {recursive: true});
    await fs.writeFile(path.join(nativeRoot, "app", "build.gradle"), androidAppBuildGradle(manifest));
}

function androidSettingsGradle() {
    return [
        "pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }",
        "dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }",
        "rootProject.name = \"MeshDrop\"",
        "include \":app\"",
        ""
    ].join("\n");
}

function androidRootBuildGradle() {
    return [
        "plugins {",
        "    id \"com.android.application\" version \"9.2.0\" apply false",
        "}",
        ""
    ].join("\n");
}

function androidAppBuildGradle(manifest) {
    return [
        "plugins {",
        "    id \"com.android.application\"",
        "}",
        "",
        "def releaseStoreFile = System.getenv(\"MESHDROP_ANDROID_RELEASE_STORE_FILE\")",
        "def releaseStorePassword = System.getenv(\"MESHDROP_ANDROID_RELEASE_STORE_PASSWORD\")",
        "def releaseKeyAlias = System.getenv(\"MESHDROP_ANDROID_RELEASE_KEY_ALIAS\")",
        "def releaseKeyPassword = System.getenv(\"MESHDROP_ANDROID_RELEASE_KEY_PASSWORD\")",
        "def hasReleaseSigning = releaseStoreFile && releaseStorePassword && releaseKeyAlias && releaseKeyPassword",
        "",
        "android {",
        "    namespace \"farm.sandwich.meshdrop\"",
        "    compileSdk 36",
        "",
        "    defaultConfig {",
        "        applicationId \"farm.sandwich.meshdrop\"",
        "        minSdk 26",
        "        targetSdk 36",
        "        versionCode 1",
        `        versionName "${manifest.version}"`,
        "    }",
        "",
        "    packagingOptions {",
        "        jniLibs {",
        "            useLegacyPackaging true",
        "        }",
        "    }",
        "",
        "    signingConfigs {",
        "        if (hasReleaseSigning) {",
        "            release {",
        "                storeFile file(releaseStoreFile)",
        "                storePassword releaseStorePassword",
        "                keyAlias releaseKeyAlias",
        "                keyPassword releaseKeyPassword",
        "            }",
        "        }",
        "    }",
        "",
        "    buildTypes {",
        "        release {",
        "            if (hasReleaseSigning) {",
        "                signingConfig signingConfigs.release",
        "            }",
        "        }",
        "    }",
        "}",
        ""
    ].join("\n");
}

async function writeAndroidManifestFiles(appSrc) {
    await fs.writeFile(path.join(appSrc, "AndroidManifest.xml"), androidManifestXml());
    await fs.mkdir(path.join(appSrc, "res", "values"), {recursive: true});
    await fs.writeFile(path.join(appSrc, "res", "values", "styles.xml"), androidStylesXml());
    await fs.mkdir(path.join(appSrc, "res", "xml"), {recursive: true});
    await fs.writeFile(path.join(appSrc, "res", "xml", "network_security_config.xml"), androidNetworkSecurityConfigXml());
}

function androidManifestXml() {
    return [
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
        "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">",
        "  <uses-permission android:name=\"android.permission.INTERNET\" />",
        "  <uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\" />",
        "  <uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\" />",
        "  <uses-permission android:name=\"android.permission.CHANGE_WIFI_MULTICAST_STATE\" />",
        "  <queries>",
        "    <intent>",
        "      <action android:name=\"android.intent.action.VIEW\" />",
        "      <category android:name=\"android.intent.category.BROWSABLE\" />",
        "      <data android:scheme=\"nostrsigner\" />",
        "    </intent>",
        "  </queries>",
        "  <application android:theme=\"@style/AppTheme\" android:label=\"MeshDrop\" android:usesCleartextTraffic=\"false\" android:networkSecurityConfig=\"@xml/network_security_config\">",
        "    <activity android:name=\".MainActivity\" android:exported=\"true\" android:launchMode=\"singleTop\">",
        "      <intent-filter>",
        "        <action android:name=\"android.intent.action.MAIN\" />",
        "        <category android:name=\"android.intent.category.LAUNCHER\" />",
        "      </intent-filter>",
        "      <intent-filter>",
        "        <action android:name=\"android.intent.action.SEND\" />",
        "        <category android:name=\"android.intent.category.DEFAULT\" />",
        "        <data android:mimeType=\"*/*\" />",
        "      </intent-filter>",
        "      <intent-filter>",
        "        <action android:name=\"android.intent.action.SEND_MULTIPLE\" />",
        "        <category android:name=\"android.intent.category.DEFAULT\" />",
        "        <data android:mimeType=\"*/*\" />",
        "      </intent-filter>",
        "    </activity>",
        "  </application>",
        "</manifest>",
        ""
    ].join("\n");
}

function androidNetworkSecurityConfigXml() {
    return [
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
        "<network-security-config>",
        "  <domain-config cleartextTrafficPermitted=\"true\">",
        "    <domain includeSubdomains=\"false\">127.0.0.1</domain>",
        "    <domain includeSubdomains=\"false\">localhost</domain>",
        "  </domain-config>",
        "</network-security-config>",
        ""
    ].join("\n");
}

function androidStylesXml() {
    return [
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
        "<resources>",
        "  <style name=\"AppTheme\" parent=\"android:style/Theme.Material.Light.NoActionBar\" />",
        "</resources>",
        ""
    ].join("\n");
}

async function writeAndroidActivity(appSrc, manifest) {
    const javaDir = path.join(appSrc, "java", "farm", "sandwich", "meshdrop");
    const manifestJson = JSON.stringify(manifest, null, 2);
    const escapedManifest = JSON.stringify(manifestJson);

    await fs.mkdir(javaDir, {recursive: true});
    await fs.writeFile(path.join(javaDir, "MainActivity.java"), androidActivitySource(escapedManifest));
}

function androidActivitySource(escapedManifest) {
    return [
        ...androidActivityHeader(escapedManifest),
        ...androidActivityLifecycle(),
        ...androidActivityShareHandling(),
        ...androidActivityFileHelpers(),
        ...androidActivityBridge(),
        "}",
        ""
    ].join("\n");
}

const androidActivityHeaderPrefix = [
    "package farm.sandwich.meshdrop;",
    "",
    "import android.app.Activity;",
    "import android.content.Context;",
    "import android.content.Intent;",
    "import android.content.pm.ApplicationInfo;",
    "import android.net.Uri;",
    "import android.os.Build;",
    "import android.os.Bundle;",
    "import android.provider.OpenableColumns;",
    "import android.database.Cursor;",
    "import android.util.Base64;",
    "import android.webkit.JavascriptInterface;",
    "import android.webkit.ValueCallback;",
    "import android.webkit.WebChromeClient;",
    "import android.webkit.WebSettings;",
    "import android.webkit.WebView;",
    "import android.webkit.WebViewClient;",
    "import java.io.ByteArrayOutputStream;",
    "import java.io.File;",
    "import java.io.FileInputStream;",
    "import java.io.FileOutputStream;",
    "import java.io.InputStream;",
    "import java.io.OutputStream;",
    "import java.net.ServerSocket;",
    "import java.net.Socket;",
    "import java.nio.charset.StandardCharsets;",
    "import java.security.MessageDigest;",
    "import java.util.ArrayList;",
    "import java.util.Arrays;",
    "import java.util.HashMap;",
    "import java.util.List;",
    "import java.util.Locale;",
    "import java.util.Map;",
    "import org.json.JSONObject;",
    "",
    "public final class MainActivity extends Activity {",
    "    private static final int FILE_CHOOSER_REQUEST = 2407;",
    "    private static final int NOSTR_SIGNER_REQUEST = 2408;"
];

const androidActivityHeaderSuffix = [
    "    private WebView webView;",
    "    private ValueCallback<Uri[]> filePathCallback;",
    "    private String pendingShareScript;",
    "    private boolean pageLoaded;",
    "    private MeshDropNativeBackend nativeBackend;",
    "    private String nativeBackendBaseUrl = \"\";",
    ""
];

function androidActivityHeader(escapedManifest) {
    return [
        ...androidActivityHeaderPrefix,
        `    private static final String TARGET_MANIFEST = ${escapedManifest};`,
        ...androidActivityHeaderSuffix
    ];
}

function androidActivityOnCreate() {
	return [
		"    @Override",
		"    protected void onCreate(Bundle savedInstanceState) {",
        "        super.onCreate(savedInstanceState);",
        "        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {",
        "            WebView.setWebContentsDebuggingEnabled(true);",
        "        }",
        "        startNativeBackend();",
        "        webView = new WebView(this);",
        "        WebSettings settings = webView.getSettings();",
        "        settings.setJavaScriptEnabled(true);",
        "        settings.setDomStorageEnabled(true);",
        "        settings.setAllowFileAccess(true);",
        "        settings.setAllowFileAccessFromFileURLs(true);",
        "        webView.addJavascriptInterface(new MeshDropAndroidBridge(), \"meshdropAndroidBridge\");",
        "        webView.setWebChromeClient(new WebChromeClient() {",
        "            @Override",
        "            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {",
        "                if (filePathCallback != null) filePathCallback.onReceiveValue(null);",
        "                filePathCallback = callback;",
        "                try {",
        "                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);",
        "                    return true;",
        "                } catch (Exception error) {",
        "                    filePathCallback = null;",
        "                    return false;",
        "                }",
        "            }",
        "        });",
        "        webView.setWebViewClient(new WebViewClient() {",
        "            @Override",
        "            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {",
        "                pageLoaded = false;",
        "                view.evaluateJavascript(androidBootstrapScript(), null);",
        "            }",
        "            @Override",
        "            public void onPageFinished(WebView view, String url) {",
        "                pageLoaded = true;",
        "                dispatchPendingShare();",
        "            }",
        "        });",
        "        setContentView(webView);",
		"        handleShareIntent(getIntent());",
		"        webView.loadUrl(\"file:///android_asset/meshdrop/index.html\");",
		"    }",
		""
	];
}

function androidActivityLifecycleEvents() {
	return [
		"",
		"    @Override",
		"    protected void onNewIntent(Intent intent) {",
        "        super.onNewIntent(intent);",
        "        setIntent(intent);",
        "        handleShareIntent(intent);",
        "    }",
        "",
        "    @Override",
        "    protected void onActivityResult(int requestCode, int resultCode, Intent data) {",
        "        super.onActivityResult(requestCode, resultCode, data);",
        "        if (requestCode == NOSTR_SIGNER_REQUEST) {",
        "            dispatchNostrSignerResult(resultCode, data);",
        "            return;",
        "        }",
        "        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;",
        "        Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);",
        "        filePathCallback.onReceiveValue(results);",
        "        filePathCallback = null;",
        "    }",
        "",
        "    @Override",
        "    protected void onDestroy() {",
        "        if (nativeBackend != null) nativeBackend.stop();",
        "        super.onDestroy();",
        "    }",
        "",
        "    private void startNativeBackend() {",
        "        nativeBackend = new MeshDropNativeBackend(this, new File(getFilesDir(), \"meshdrop-pollen\"));",
        "        try {",
        "            nativeBackend.start();",
        "            nativeBackendBaseUrl = nativeBackend.baseUrl();",
        "        } catch (Exception error) {",
        "            nativeBackendBaseUrl = \"\";",
        "        }",
        "    }",
        "",
        "    private String androidBootstrapScript() {",
        "        return \"if (globalThis.HTMLCanvasElement) { delete HTMLCanvasElement.prototype.transferControlToOffscreen; }\"",
        "            + \"globalThis.__meshdropTargetManifest = \" + TARGET_MANIFEST + \";\"",
        "            + \"globalThis.__meshdropAndroidNativeBackend = {\"",
        "            + \"alive:\" + (!nativeBackendBaseUrl.isEmpty()) + \",\"",
        "            + \"baseUrl:\" + quote(nativeBackendBaseUrl) + \",\"",
        "            + \"fipsRustCore:false,\"",
        "            + \"pollenStore:'android-native'\"",
        "            + \"};\";",
		"    }",
		""
	];
}

function androidActivityLifecycle() {
	return [
		...androidActivityOnCreate(),
		...androidActivityLifecycleEvents()
	];
}

function androidActivityShareHandling() {
    return [
        "    private void handleShareIntent(Intent intent) {",
        "        if (intent == null) return;",
        "        String action = intent.getAction();",
        "        if (Intent.ACTION_SEND.equals(action)) {",
        "            Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);",
        "            if (stream != null) {",
        "                queueSharedFiles(List.of(stream));",
        "                return;",
        "            }",
        "            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);",
        "            if (text != null) queueSharedText(text.toString());",
        "        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {",
        "            ArrayList<Uri> streams = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);",
        "            if (streams != null && !streams.isEmpty()) queueSharedFiles(streams);",
        "        }",
        "    }",
        "",
        "    private void queueSharedFiles(List<Uri> uris) {",
        "        try {",
        "            List<String> files = new ArrayList<>();",
        "            for (Uri uri : uris) files.add(sharedFileJson(uri));",
        "            pendingShareScript = \"globalThis.meshdropAndroidNativeShare.receiveFiles([\" + String.join(\",\", files) + \"]);\";",
        "            dispatchPendingShare();",
        "        } catch (Exception error) {",
        "            pendingShareScript = \"globalThis.meshdropAndroidNativeShare.receiveError(\" + quote(error.getMessage()) + \");\";",
        "            dispatchPendingShare();",
        "        }",
        "    }",
        "",
        "    private void queueSharedText(String text) {",
        "        pendingShareScript = \"globalThis.meshdropAndroidNativeShare.receiveText(\" + quote(text) + \");\";",
        "        dispatchPendingShare();",
        "    }",
        "",
        "    private void dispatchPendingShare() {",
        "        if (webView == null || pendingShareScript == null || !pageLoaded) return;",
        "        String script = nativeShareBridgeScript() + pendingShareScript;",
        "        pendingShareScript = null;",
        "        webView.evaluateJavascript(script, null);",
        "    }",
        ""
    ];
}

function androidActivityFileHelpers() {
    return [
        "    private String sharedFileJson(Uri uri) throws Exception {",
        "        byte[] bytes = readAllBytes(uri);",
        "        return \"{\"",
        "            + \"\\\"name\\\":\" + quote(displayName(uri)) + \",\"",
        "            + \"\\\"type\\\":\" + quote(getContentResolver().getType(uri)) + \",\"",
        "            + \"\\\"base64\\\":\" + quote(Base64.encodeToString(bytes, Base64.NO_WRAP))",
        "            + \"}\";",
        "    }",
        "",
        "    private byte[] readAllBytes(Uri uri) throws Exception {",
        "        InputStream input = \"file\".equals(uri.getScheme())",
        "            ? new FileInputStream(new File(uri.getPath()))",
        "            : getContentResolver().openInputStream(uri);",
        "        if (input == null) throw new IllegalArgumentException(\"Cannot open shared URI\");",
        "        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {",
        "            byte[] buffer = new byte[8192];",
        "            int read;",
        "            while ((read = stream.read(buffer)) != -1) output.write(buffer, 0, read);",
        "            return output.toByteArray();",
        "        }",
        "    }",
        "",
        "    private String displayName(Uri uri) {",
        "        if (\"content\".equals(uri.getScheme())) {",
        "            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {",
        "                if (cursor != null && cursor.moveToFirst()) {",
        "                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);",
        "                    if (index >= 0) return cursor.getString(index);",
        "                }",
        "            }",
        "        }",
        "        String path = uri.getPath();",
        "        if (path == null || path.isEmpty()) return \"meshdrop-shared-file\";",
        "        return new File(path).getName();",
        "    }",
        ""
    ];
}

function androidActivityBridge() {
    return [
        ...androidNostrSignerBridge(),
        ...androidNativeShareBridge(),
        ...androidNativeBackendServer(),
        ...androidBridgeHelpers()
    ];
}

function androidNostrSignerBridge() {
    return [
        "    public final class MeshDropAndroidBridge {",
        "        @JavascriptInterface",
        "        public boolean isNostrSignerInstalled() {",
        "            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(\"nostrsigner:\"));",
        "            return !getPackageManager().queryIntentActivities(intent, 0).isEmpty();",
        "        }",
        "",
        "        @JavascriptInterface",
        "        public boolean requestNostrSigner(String requestJson) {",
        "            try {",
        "                JSONObject request = new JSONObject(requestJson);",
        "                String payload = request.optString(\"payload\", \"\");",
        "                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(\"nostrsigner:\" + Uri.encode(payload)));",
        "                intent.addCategory(Intent.CATEGORY_BROWSABLE);",
        "                intent.putExtra(\"type\", request.optString(\"type\", \"get_public_key\"));",
        "                intent.putExtra(\"id\", request.optString(\"id\", \"\"));",
        "                if (request.has(\"current_user\")) intent.putExtra(\"current_user\", request.optString(\"current_user\", \"\"));",
        "                if (request.has(\"pubkey\")) intent.putExtra(\"pubkey\", request.optString(\"pubkey\", \"\"));",
        "                if (request.has(\"permissions\")) intent.putExtra(\"permissions\", request.optString(\"permissions\", \"\"));",
        "                if (request.has(\"returnType\")) intent.putExtra(\"returnType\", request.optString(\"returnType\", \"\"));",
        "                String packageName = request.optString(\"package\", \"\");",
        "                if (!packageName.isEmpty()) intent.setPackage(packageName);",
        "                runOnUiThread(() -> startActivityForResult(intent, NOSTR_SIGNER_REQUEST));",
        "                return true;",
        "            } catch (Exception error) {",
        "                dispatchNostrSignerError(\"\", error.getMessage());",
        "                return false;",
        "            }",
        "        }",
        "    }",
        "",
        "    private void dispatchNostrSignerResult(int resultCode, Intent data) {",
        "        String id = data == null ? \"\" : data.getStringExtra(\"id\");",
        "        if (resultCode != Activity.RESULT_OK) {",
        "            dispatchNostrSignerError(id, \"Android signer failed\");",
        "            return;",
        "        }",
        "        boolean rejected = data != null && data.getBooleanExtra(\"rejected\", false);",
        "        String result = data == null ? \"\" : data.getStringExtra(\"result\");",
        "        String event = data == null ? \"\" : data.getStringExtra(\"event\");",
        "        String packageName = data == null ? \"\" : data.getStringExtra(\"package\");",
        "        dispatchNostrSignerScript(id, result, event, packageName, rejected, \"\");",
        "    }",
        "",
        "    private void dispatchNostrSignerError(String id, String message) {",
        "        dispatchNostrSignerScript(id, \"\", \"\", \"\", false, message == null ? \"Android signer failed\" : message);",
        "    }",
        "",
        "    private void dispatchNostrSignerScript(String id, String result, String event, String packageName, boolean rejected, String error) {",
        "        if (webView == null) return;",
        "        String script = \"window.dispatchEvent(new CustomEvent('android-nostr-signer-result', {detail: {\"",
        "            + \"id:\" + quote(id) + \",\"",
        "            + \"result:\" + quote(result) + \",\"",
        "            + \"event:\" + quote(event) + \",\"",
        "            + \"package:\" + quote(packageName) + \",\"",
        "            + \"rejected:\" + rejected + \",\"",
        "            + \"error:\" + quote(error)",
        "            + \"}}));\";",
        "        runOnUiThread(() -> webView.evaluateJavascript(script, null));",
        "    }",
        ""
    ];
}

function androidNativeShareBridge() {
    return [
        "    private String nativeShareBridgeScript() {",
        "        return \"(() => {\"",
        "            + \"if (globalThis.meshdropAndroidNativeShare) return;\"",
        "            + \"globalThis.meshdropAndroidNativeShare = {\"",
        "            + \"  receiveFiles(files) {\"",
        "            + \"    globalThis.__meshdropAndroidNativeSharePayload = {files};\"",
        "            + \"    window.dispatchEvent(new CustomEvent('android-native-share-received',\"",
        "            + \"      {detail: {files: files.map(file => ({name: file.name, type: file.type, base64Length: file.base64.length}))}}));\"",
        "            + \"  },\"",
        "            + \"  receiveText(text) {\"",
        "            + \"    globalThis.__meshdropAndroidNativeSharePayload = {text};\"",
        "            + \"    window.dispatchEvent(new CustomEvent('android-native-share-received', {detail: {text}}));\"",
        "            + \"  },\"",
        "            + \"  receiveError(message) {\"",
        "            + \"    globalThis.__meshdropAndroidNativeSharePayload = {error: message};\"",
        "            + \"    window.dispatchEvent(new CustomEvent('android-native-share-error', {detail: {message}}));\"",
        "            + \"  }\"",
        "            + \"};\"",
        "            + \"})();\";",
        "    }",
        ""
    ];
}

const androidNativeBackendClassStart = [
    "    private static final class MeshDropNativeBackend {",
    "        private final Context context;",
    "        private final File storeDir;",
    "        private final File binDir;",
    "        private final Map<String, File> nativeTools = new HashMap<>();",
    "        private Process plnProcess;",
    "        private Process fipsProcess;",
    "        private ServerSocket serverSocket;",
    "        private Thread thread;",
    "        private volatile boolean running;",
    "",
    "        MeshDropNativeBackend(Context context, File storeDir) {",
    "            this.context = context.getApplicationContext();",
    "            this.storeDir = storeDir;",
    "            this.binDir = new File(context.getFilesDir(), \"meshdrop-native-bin\");",
    "        }",
    "",
    "        void start() throws Exception {",
    "            if (!storeDir.exists() && !storeDir.mkdirs()) throw new IllegalStateException(\"Cannot create Pollen store\");",
    "            prepareNativeTools();",
    "            serverSocket = new ServerSocket(0, 50, java.net.InetAddress.getByName(\"127.0.0.1\"));",
        "            running = true;",
        "            thread = new Thread(this::serve, \"meshdrop-native-backend\");",
        "            thread.setDaemon(true);",
        "            thread.start();",
        "        }",
        "",
        "        String baseUrl() {",
        "            return \"http://127.0.0.1:\" + serverSocket.getLocalPort();",
        "        }",
        "",
        "        void stop() {",
        "            running = false;",
        "            try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) {}",
    "            stopProcess(plnProcess);",
    "            stopProcess(fipsProcess);",
        "        }",
        "",
        "        private void serve() {",
        "            while (running) {",
        "                try {",
        "                    Socket socket = serverSocket.accept();",
        "                    new Thread(() -> handle(socket), \"meshdrop-native-request\").start();",
		"                } catch (Exception error) {",
		"                    if (running) error.printStackTrace();",
		"                }",
    "            }",
    "        }",
    "",
    "        private void prepareNativeTools() throws Exception {",
    "            nativeTools.clear();",
    "            if (!binDir.exists() && !binDir.mkdirs()) throw new IllegalStateException(\"Cannot create native tool dir\");",
    "            for (String abi : Build.SUPPORTED_ABIS) {",
    "                installNativeTool(abi, \"fips\");",
    "                installNativeTool(abi, \"fipsctl\");",
    "                installNativeTool(abi, \"pln\");",
    "            }",
    "        }",
    "",
    "        private void installNativeTool(String abi, String tool) {",
    "            if (nativeTools.containsKey(tool)) return;",
    "            File nativeLibrary = new File(context.getApplicationInfo().nativeLibraryDir, \"libmeshdrop_\" + tool + \".so\");",
    "            if (nativeLibrary.isFile()) {",
    "                nativeTools.put(tool, nativeLibrary);",
    "                return;",
    "            }",
    "            String assetPath = \"meshdrop-native/\" + abi + \"/\" + tool;",
    "            File outputFile = new File(binDir, tool);",
    "            try (InputStream input = context.getAssets().open(assetPath); FileOutputStream output = new FileOutputStream(outputFile)) {",
    "                copyStream(input, output);",
    "                outputFile.setExecutable(true, true);",
    "                nativeTools.put(tool, outputFile);",
    "            } catch (Exception ignored) {}",
    "        }",
    "",
    "        private boolean hasTool(String tool) {",
    "            return nativeTools.containsKey(tool);",
    "        }",
    ""
];

const androidNativeBackendRoutes = [
		"        private void handle(Socket socket) {",
		"            try (Socket client = socket) {",
		"                NativeRequest request = NativeRequest.read(client.getInputStream());",
        "                if (\"OPTIONS\".equals(request.method)) {",
        "                    writeJson(client.getOutputStream(), 204, \"{}\");",
        "                } else if (\"GET\".equals(request.method) && \"/pollen/status\".equals(request.path)) {",
        "                    writeJson(client.getOutputStream(), 200, pollenStatusJson());",
        "                } else if (\"POST\".equals(request.method) && \"/pollen/upload\".equals(request.path)) {",
        "                    writeJson(client.getOutputStream(), 200, storePollenObject(request.body, request.contentType()));",
        "                } else if (\"GET\".equals(request.method) && request.path.startsWith(\"/pollen/download/\")) {",
        "                    writePollenObject(client.getOutputStream(), request.path.substring(\"/pollen/download/\".length()));",
        "                } else if (\"GET\".equals(request.method) && \"/fips/status\".equals(request.path)) {",
        "                    writeJson(client.getOutputStream(), 200, fipsStatusJson());",
        "                } else {",
        "                    writeJson(client.getOutputStream(), 404, \"{\\\"error\\\":\\\"not found\\\"}\");",
        "                }",
        "            } catch (Exception error) {",
        "                try { writeJson(socket.getOutputStream(), 500, \"{\\\"error\\\":\" + jsonQuote(error.getMessage()) + \"}\"); } catch (Exception ignored) {}",
        "            }",
        "        }",
        "",
    "        private String pollenStatusJson() {",
    "            if (hasTool(\"pln\")) return plnStatusJson();",
    "            String[] files = storeDir.list((dir, name) -> name.endsWith(\".bin\"));",
    "            int count = files == null ? 0 : files.length;",
    "            return \"{\\\"enabled\\\":true,\\\"available\\\":true,\\\"version\\\":\\\"android-native-pollen-store\\\",\\\"backend\\\":\\\"android-native\\\",\\\"substrate\\\":\\\"android-object-store\\\",\\\"pln\\\":false,\\\"objects\\\":\" + count + \"}\";",
    "        }",
    "",
    "        private String fipsStatusJson() {",
		"            if (hasTool(\"fipsctl\")) return fipsctlStatusJson();",
		"            return \"{\\\"enabled\\\":true,\\\"available\\\":true,\\\"npub\\\":\\\"android-native\\\",\\\"ipv6Addr\\\":\\\"\\\",\\\"peerCount\\\":0,\\\"meshSize\\\":1,\\\"room\\\":\\\"npub-network:android-native\\\",\\\"backend\\\":\\\"android-native\\\",\\\"rustCore\\\":false,\\\"error\\\":\\\"rust-fips-core-not-linked\\\"}\";",
    "        }",
    "",
    "        private String plnStatusJson() {",
    "            try {",
    "                ensurePlnProcess();",
    "                NativeCommandResult version = runTool(\"pln\", Arrays.asList(\"--dir\", storeDir.getAbsolutePath(), \"version\", \"--short\"), null);",
    "                NativeCommandResult status = runTool(\"pln\", Arrays.asList(\"--dir\", storeDir.getAbsolutePath(), \"status\"), null);",
    "                boolean available = version.code == 0 && status.code == 0;",
    "                String error = available ? \"\" : firstNonEmpty(status.stderr, status.error, version.stderr, version.error);",
    "                return \"{\\\"enabled\\\":true,\\\"available\\\":\" + available + \",\\\"version\\\":\" + jsonQuote(version.stdout.trim()) + \",\\\"backend\\\":\\\"android-native-pln\\\",\\\"substrate\\\":\\\"pln\\\",\\\"pln\\\":true,\\\"wasmRuntime\\\":true,\\\"error\\\":\" + jsonQuote(error) + \"}\";",
    "            } catch (Exception error) {",
    "                return \"{\\\"enabled\\\":true,\\\"available\\\":false,\\\"backend\\\":\\\"android-native-pln\\\",\\\"substrate\\\":\\\"pln\\\",\\\"pln\\\":true,\\\"wasmRuntime\\\":true,\\\"error\\\":\" + jsonQuote(error.getMessage()) + \"}\";",
    "            }",
    "        }",
    "",
    "        private String fipsctlStatusJson() {",
    "            try {",
    "                ensureFipsProcess();",
    "                NativeCommandResult status = runTool(\"fipsctl\", Arrays.asList(\"--socket\", fipsControlSocket(), \"show\", \"status\"), null);",
    "                NativeCommandResult peers = runTool(\"fipsctl\", Arrays.asList(\"--socket\", fipsControlSocket(), \"show\", \"peers\"), null);",
    "                if (status.code != 0) throw new IllegalStateException(firstNonEmpty(status.stderr, status.error, \"fipsctl status failed\"));",
    "                String statusJson = status.stdout.trim();",
    "                String peersJson = peers.code == 0 ? peers.stdout.trim() : \"[]\";",
    "                return \"{\\\"enabled\\\":true,\\\"available\\\":true,\\\"backend\\\":\\\"android-native-fipsctl\\\",\\\"rustCore\\\":true,\\\"controlSocket\\\":\" + jsonQuote(fipsControlSocket()) + \",\\\"status\\\":\" + validJsonOrString(statusJson) + \",\\\"peers\\\":\" + validJsonOrString(peersJson) + \"}\";",
    "            } catch (Exception error) {",
    "                return \"{\\\"enabled\\\":true,\\\"available\\\":false,\\\"backend\\\":\\\"android-native-fipsctl\\\",\\\"rustCore\\\":true,\\\"error\\\":\" + jsonQuote(error.getMessage()) + \"}\";",
    "            }",
    "        }",
		""
];

const androidNativeBackendStorage = [
    "        private String storePollenObject(byte[] body, String contentType) throws Exception {",
    "            if (hasTool(\"pln\")) return storePlnObject(body, contentType);",
    "            String hash = sha256Hex(body);",
    "            File objectFile = objectFile(hash);",
        "            try (FileOutputStream output = new FileOutputStream(objectFile)) {",
        "                output.write(body);",
        "            }",
        "            String type = contentType.isEmpty() ? \"application/octet-stream\" : contentType;",
        "            return \"{\\\"hash\\\":\" + jsonQuote(hash) + \",\\\"size\\\":\" + body.length + \",\\\"type\\\":\" + jsonQuote(type) + \",\\\"backend\\\":\\\"android-native\\\"}\";",
    "        }",
    "",
    "        private void writePollenObject(OutputStream output, String hash) throws Exception {",
        "            if (!hash.matches(\"[0-9a-fA-F]{64}\")) {",
        "                writeJson(output, 400, \"{\\\"error\\\":\\\"invalid hash\\\"}\");",
        "                return;",
    "            }",
    "            if (hasTool(\"pln\")) {",
    "                writePlnObject(output, hash.toLowerCase(Locale.ROOT));",
    "                return;",
    "            }",
    "            File objectFile = objectFile(hash.toLowerCase(Locale.ROOT));",
        "            if (!objectFile.isFile()) {",
        "                writeJson(output, 404, \"{\\\"error\\\":\\\"not found\\\"}\");",
        "                return;",
        "            }",
    "            writeResponse(output, 200, \"application/octet-stream\", readFile(objectFile));",
    "        }",
    "",
    "        private String storePlnObject(byte[] body, String contentType) throws Exception {",
    "            ensurePlnProcess();",
    "            NativeCommandResult result = runTool(\"pln\", Arrays.asList(\"--dir\", storeDir.getAbsolutePath(), \"seed\", \"-\"), body);",
    "            if (result.code != 0) throw new IllegalStateException(firstNonEmpty(result.stderr, result.error, \"Pollen pln upload failed\"));",
    "            String hash = parsePollenHash(result.stdout);",
    "            String type = contentType.isEmpty() ? \"application/octet-stream\" : contentType;",
    "            return \"{\\\"hash\\\":\" + jsonQuote(hash) + \",\\\"size\\\":\" + body.length + \",\\\"type\\\":\" + jsonQuote(type) + \",\\\"backend\\\":\\\"android-native-pln\\\",\\\"substrate\\\":\\\"pln\\\"}\";",
    "        }",
    "",
    "        private void writePlnObject(OutputStream output, String hash) throws Exception {",
    "            ensurePlnProcess();",
    "            File tempFile = new File(storeDir, hash + \".download\");",
    "            try {",
    "                NativeCommandResult result = runTool(\"pln\", Arrays.asList(\"--dir\", storeDir.getAbsolutePath(), \"fetch\", hash, tempFile.getAbsolutePath()), null);",
    "                if (result.code != 0) throw new IllegalStateException(firstNonEmpty(result.stderr, result.error, \"Pollen pln download failed\"));",
    "                writeResponse(output, 200, \"application/octet-stream\", readFile(tempFile));",
    "            } finally {",
    "                tempFile.delete();",
    "            }",
    "        }",
    "",
    "        private String parsePollenHash(String stdout) {",
    "            for (String token : stdout.trim().split(\"\\\\s+\")) {",
    "                if (token.matches(\"[0-9a-fA-F]{64}\")) return token.toLowerCase(Locale.ROOT);",
    "            }",
    "            throw new IllegalStateException(\"Pollen pln upload did not return a blob hash\");",
    "        }",
    "",
    "        private File objectFile(String hash) {",
        "            return new File(storeDir, hash + \".bin\");",
        "        }",
        "",
        "        private static byte[] readFile(File file) throws Exception {",
        "            try (InputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {",
        "                byte[] buffer = new byte[8192];",
        "                int read;",
        "                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);",
        "                return output.toByteArray();",
        "            }",
        "        }",
        "",
        "        private static String sha256Hex(byte[] body) throws Exception {",
        "            byte[] digest = MessageDigest.getInstance(\"SHA-256\").digest(body);",
        "            StringBuilder hex = new StringBuilder();",
        "            for (byte value : digest) hex.append(String.format(Locale.ROOT, \"%02x\", value & 0xff));",
        "            return hex.toString();",
        "        }",
        "",
        "        private static void writeJson(OutputStream output, int status, String json) throws Exception {",
        "            writeResponse(output, status, \"application/json\", json.getBytes(StandardCharsets.UTF_8));",
        "        }",
        "",
    "        private static void writeResponse(OutputStream output, int status, String contentType, byte[] body) throws Exception {",
        "            String statusText = status == 200 ? \"OK\" : status == 204 ? \"No Content\" : status == 400 ? \"Bad Request\" : status == 404 ? \"Not Found\" : \"Error\";",
        "            String headers = \"HTTP/1.1 \" + status + \" \" + statusText + \"\\r\\n\"",
        "                + \"Content-Type: \" + contentType + \"\\r\\n\"",
        "                + \"Content-Length: \" + body.length + \"\\r\\n\"",
        "                + \"Access-Control-Allow-Origin: *\\r\\n\"",
        "                + \"Access-Control-Allow-Methods: GET, POST, OPTIONS\\r\\n\"",
        "                + \"Access-Control-Allow-Headers: Content-Type\\r\\n\"",
        "                + \"Connection: close\\r\\n\\r\\n\";",
        "            output.write(headers.getBytes(StandardCharsets.UTF_8));",
    "            output.write(body);",
    "            output.flush();",
    "        }",
    "",
    "        private NativeCommandResult runTool(String tool, List<String> args, byte[] stdin) throws Exception {",
    "            File executable = nativeTools.get(tool);",
    "            if (executable == null) throw new IllegalStateException(tool + \" is not packaged\");",
    "            List<String> command = new ArrayList<>();",
    "            command.add(executable.getAbsolutePath());",
    "            command.addAll(args);",
    "            Process process = new ProcessBuilder(command).redirectErrorStream(false).start();",
    "            if (stdin != null) {",
    "                try (OutputStream input = process.getOutputStream()) {",
    "                    input.write(stdin);",
    "                }",
    "            } else {",
    "                process.getOutputStream().close();",
    "            }",
    "            byte[] stdout = readAll(process.getInputStream());",
    "            byte[] stderr = readAll(process.getErrorStream());",
    "            int code = process.waitFor();",
    "            return new NativeCommandResult(code, new String(stdout, StandardCharsets.UTF_8), new String(stderr, StandardCharsets.UTF_8).trim(), \"\");",
    "        }",
    "",
    "        private void ensurePlnProcess() throws Exception {",
    "            if (!hasTool(\"pln\")) throw new IllegalStateException(\"pln is not packaged\");",
    "            if (processAlive(plnProcess)) return;",
    "            plnProcess = startLongRunningTool(\"pln\", Arrays.asList(\"--dir\", storeDir.getAbsolutePath(), \"up\", \"--port\", \"0\"), \"meshdrop-native-pln\");",
    "            waitForTool(\"pln\", Arrays.asList(\"--dir\", storeDir.getAbsolutePath(), \"status\"), 10000);",
    "        }",
    "",
    "        private void ensureFipsProcess() throws Exception {",
    "            if (!hasTool(\"fips\") || !hasTool(\"fipsctl\")) throw new IllegalStateException(\"fips and fipsctl are not packaged\");",
    "            if (processAlive(fipsProcess)) return;",
    "            File configFile = writeFipsConfig();",
    "            fipsProcess = startLongRunningTool(\"fips\", Arrays.asList(\"-c\", configFile.getAbsolutePath()), \"meshdrop-native-fips\");",
    "            waitForTool(\"fipsctl\", Arrays.asList(\"--socket\", fipsControlSocket(), \"show\", \"status\"), 10000);",
    "        }",
    "",
    "        private File writeFipsConfig() throws Exception {",
    "            File fipsDir = new File(context.getFilesDir(), \"fips\");",
    "            if (!fipsDir.exists() && !fipsDir.mkdirs()) throw new IllegalStateException(\"Cannot create FIPS state dir\");",
    "            String yaml = \"node:\\n\"",
    "                + \"  leaf_only: true\\n\"",
    "                + \"  control:\\n\"",
    "                + \"    enabled: true\\n\"",
    "                + \"    socket_path: \\\"\" + fipsControlSocket() + \"\\\"\\n\"",
    "                + \"tun:\\n\"",
    "                + \"  enabled: false\\n\"",
    "                + \"dns:\\n\"",
    "                + \"  enabled: false\\n\"",
    "                + \"transports:\\n\"",
    "                + \"  udp:\\n\"",
    "                + \"    bind_addr: \\\"127.0.0.1:0\\\"\\n\"",
    "                + \"    outbound_only: true\\n\"",
    "                + \"    accept_connections: false\\n\"",
    "                + \"  tcp:\\n\"",
    "                + \"    bind_addr: \\\"127.0.0.1:0\\\"\\n\"",
    "                + \"peers: []\\n\";",
    "            File configFile = new File(fipsDir, \"fips.yaml\");",
    "            try (FileOutputStream output = new FileOutputStream(configFile)) {",
    "                output.write(yaml.getBytes(StandardCharsets.UTF_8));",
    "            }",
    "            return configFile;",
    "        }",
    "",
    "        private Process startLongRunningTool(String tool, List<String> args, String threadName) throws Exception {",
    "            File executable = nativeTools.get(tool);",
    "            if (executable == null) throw new IllegalStateException(tool + \" is not packaged\");",
    "            List<String> command = new ArrayList<>();",
    "            command.add(executable.getAbsolutePath());",
    "            command.addAll(args);",
    "            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();",
    "            Thread outputThread = new Thread(() -> drainStream(process.getInputStream()), threadName);",
    "            outputThread.setDaemon(true);",
    "            outputThread.start();",
    "            return process;",
    "        }",
    "",
    "        private void waitForTool(String tool, List<String> args, long timeoutMs) throws Exception {",
    "            long deadline = System.currentTimeMillis() + timeoutMs;",
    "            String lastError = \"\";",
    "            while (System.currentTimeMillis() < deadline) {",
    "                NativeCommandResult result = runTool(tool, args, null);",
    "                if (result.code == 0) return;",
    "                lastError = firstNonEmpty(result.stderr, result.error, result.stdout);",
    "                Thread.sleep(250);",
    "            }",
    "            throw new IllegalStateException(tool + \" did not become ready: \" + lastError);",
    "        }",
    "",
    "        private static boolean processAlive(Process process) {",
    "            if (process == null) return false;",
    "            try {",
    "                process.exitValue();",
    "                return false;",
    "            } catch (IllegalThreadStateException running) {",
    "                return true;",
    "            }",
    "        }",
    "",
    "        private static void stopProcess(Process process) {",
    "            if (process != null) process.destroy();",
    "        }",
    "",
    "        private String fipsControlSocket() {",
    "            return new File(context.getFilesDir(), \"fips/control.sock\").getAbsolutePath();",
    "        }",
    "",
    "        private static void drainStream(InputStream input) {",
    "            try (InputStream source = input) {",
    "                byte[] buffer = new byte[8192];",
    "                while (source.read(buffer) != -1) {}",
    "            } catch (Exception ignored) {}",
    "        }",
    "",
    "        private static void copyStream(InputStream input, OutputStream output) throws Exception {",
    "            byte[] buffer = new byte[8192];",
    "            int read;",
    "            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);",
    "        }",
    "",
    "        private static byte[] readAll(InputStream input) throws Exception {",
    "            try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {",
    "                copyStream(source, output);",
    "                return output.toByteArray();",
    "            }",
    "        }",
    "",
    "        private static String firstNonEmpty(String... values) {",
    "            for (String value : values) {",
    "                if (value != null && !value.trim().isEmpty()) return value.trim();",
    "            }",
    "            return \"\";",
    "        }",
    "",
    "        private static String validJsonOrString(String value) {",
    "            String trimmed = value == null ? \"\" : value.trim();",
    "            if ((trimmed.startsWith(\"{\") && trimmed.endsWith(\"}\")) || (trimmed.startsWith(\"[\") && trimmed.endsWith(\"]\"))) return trimmed;",
    "            return jsonQuote(trimmed);",
    "        }",
    "",
    "        private static String jsonQuote(String value) {",
    "            String safe = value == null ? \"\" : value;",
    "            return \"\\\"\" + safe.replace(\"\\\\\", \"\\\\\\\\\").replace(\"\\\"\", \"\\\\\\\"\").replace(\"\\n\", \"\\\\n\").replace(\"\\r\", \"\\\\r\") + \"\\\"\";",
    "        }",
    "    }",
    "",
    "    private static final class NativeCommandResult {",
    "        final int code;",
    "        final String stdout;",
    "        final String stderr;",
    "        final String error;",
    "",
    "        NativeCommandResult(int code, String stdout, String stderr, String error) {",
    "            this.code = code;",
    "            this.stdout = stdout;",
    "            this.stderr = stderr;",
    "            this.error = error;",
    "        }",
    "    }",
    ""
];

const androidNativeBackendRequest = [
		"    private static final class NativeRequest {",
		"        final String method;",
		"        final String path;",
        "        final Map<String, String> headers;",
        "        final byte[] body;",
        "",
        "        NativeRequest(String method, String path, Map<String, String> headers, byte[] body) {",
        "            this.method = method;",
        "            this.path = path;",
        "            this.headers = headers;",
        "            this.body = body;",
        "        }",
        "",
        "        String contentType() {",
        "            String value = headers.get(\"content-type\");",
        "            return value == null ? \"\" : value;",
        "        }",
        "",
        "        static NativeRequest read(InputStream input) throws Exception {",
        "            ByteArrayOutputStream headerBytes = new ByteArrayOutputStream();",
        "            int previous3 = -1;",
        "            int previous2 = -1;",
        "            int previous1 = -1;",
        "            int current;",
        "            while ((current = input.read()) != -1) {",
        "                headerBytes.write(current);",
        "                if (previous3 == '\\r' && previous2 == '\\n' && previous1 == '\\r' && current == '\\n') break;",
        "                previous3 = previous2;",
        "                previous2 = previous1;",
        "                previous1 = current;",
        "            }",
        "            String headerText = headerBytes.toString(StandardCharsets.UTF_8.name());",
        "            String[] lines = headerText.split(\"\\r?\\n\");",
        "            if (lines.length == 0 || lines[0].trim().isEmpty()) throw new IllegalArgumentException(\"empty request\");",
        "            String[] requestLine = lines[0].split(\" \", 3);",
        "            Map<String, String> headers = new HashMap<>();",
        "            for (int i = 1; i < lines.length; i++) {",
        "                int separator = lines[i].indexOf(':');",
        "                if (separator <= 0) continue;",
        "                headers.put(lines[i].substring(0, separator).trim().toLowerCase(Locale.ROOT), lines[i].substring(separator + 1).trim());",
        "            }",
        "            int contentLength = Integer.parseInt(headers.getOrDefault(\"content-length\", \"0\"));",
        "            byte[] body = new byte[contentLength];",
        "            int offset = 0;",
        "            while (offset < contentLength) {",
        "                int read = input.read(body, offset, contentLength - offset);",
        "                if (read < 0) break;",
        "                offset += read;",
        "            }",
        "            return new NativeRequest(requestLine[0], requestLine[1], headers, body);",
		"        }",
		"    }",
		""
];

function androidNativeBackendServer() {
	return [
		...androidNativeBackendClassStart,
		...androidNativeBackendRoutes,
		...androidNativeBackendStorage,
		...androidNativeBackendRequest
	];
}

function androidBridgeHelpers() {
    return [
        "    private String quote(String value) {",
        "        String safe = value == null ? \"\" : value;",
        "        return \"\\\"\" + safe",
        "            .replace(\"\\\\\", \"\\\\\\\\\")",
        "            .replace(\"\\\"\", \"\\\\\\\"\")",
        "            .replace(\"\\n\", \"\\\\n\")",
        "            .replace(\"\\r\", \"\\\\r\")",
        "            + \"\\\"\";",
        "    }"
    ];
}
