import fs from "node:fs/promises";
import path from "node:path";

export async function writeNativeSource(stageDir, target, manifest) {
    if (target === "ios") {
        await writeIosNativeSource(stageDir, manifest);
        return;
    }
    await writeAndroidNativeSource(stageDir, manifest);
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

async function writeAndroidNativeSource(stageDir, manifest) {
    const nativeRoot = path.join(stageDir, "native", "android");
    const appSrc = path.join(nativeRoot, "app", "src", "main");
    const assetDir = path.join(appSrc, "assets", "meshdrop");

    await fs.cp(path.join(stageDir, "app"), assetDir, {recursive: true});
    await fs.writeFile(path.join(nativeRoot, "README.md"), androidReadme());
    await writeAndroidGradleFiles(nativeRoot, manifest);
    await writeAndroidManifestFiles(appSrc);
    await writeAndroidActivity(appSrc, manifest);
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
        "final class MeshDropViewController: UIViewController, WKUIDelegate, UIDocumentPickerDelegate {",
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
        "struct MeshDropSharedFile: Codable {",
        "    let name: String",
        "    let path: String",
        "    let receivedAt: String",
        "}",
        "",
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
        "}",
        ""
    ].join("\n");
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
    "import android.content.Intent;",
    "import android.content.pm.ApplicationInfo;",
    "import android.net.Uri;",
    "import android.os.Bundle;",
    "import android.provider.OpenableColumns;",
    "import android.database.Cursor;",
    "import android.util.Base64;",
    "import android.webkit.ValueCallback;",
    "import android.webkit.WebChromeClient;",
    "import android.webkit.WebSettings;",
    "import android.webkit.WebView;",
    "import android.webkit.WebViewClient;",
    "import java.io.ByteArrayOutputStream;",
    "import java.io.File;",
    "import java.io.FileInputStream;",
    "import java.io.InputStream;",
    "import java.util.ArrayList;",
    "import java.util.List;",
    "",
    "public final class MainActivity extends Activity {",
    "    private static final int FILE_CHOOSER_REQUEST = 2407;"
];

const androidActivityHeaderSuffix = [
    "    private WebView webView;",
    "    private ValueCallback<Uri[]> filePathCallback;",
    "    private String pendingShareScript;",
    "    private boolean pageLoaded;",
    ""
];

function androidActivityHeader(escapedManifest) {
    return [
        ...androidActivityHeaderPrefix,
        `    private static final String TARGET_MANIFEST = ${escapedManifest};`,
        ...androidActivityHeaderSuffix
    ];
}

function androidActivityLifecycle() {
    return [
        "    @Override",
        "    protected void onCreate(Bundle savedInstanceState) {",
        "        super.onCreate(savedInstanceState);",
        "        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {",
        "            WebView.setWebContentsDebuggingEnabled(true);",
        "        }",
        "        webView = new WebView(this);",
        "        WebSettings settings = webView.getSettings();",
        "        settings.setJavaScriptEnabled(true);",
        "        settings.setDomStorageEnabled(true);",
        "        settings.setAllowFileAccess(true);",
        "        settings.setAllowFileAccessFromFileURLs(true);",
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
        "                view.evaluateJavascript(\"if (globalThis.HTMLCanvasElement) { delete HTMLCanvasElement.prototype.transferControlToOffscreen; } globalThis.__meshdropTargetManifest = \" + TARGET_MANIFEST + \";\", null);",
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
        "        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;",
        "        Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);",
        "        filePathCallback.onReceiveValue(results);",
        "        filePathCallback = null;",
        "    }",
        ""
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
        "",
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
