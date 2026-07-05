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
    const nativeDir = path.join(stageDir, "native", "ios", "MeshDrop");
    const shareExtensionDir = path.join(stageDir, "native", "ios", "MeshDropShareExtension");
    const resourceDir = path.join(nativeDir, "Resources", "meshdrop");
    const manifestJson = JSON.stringify(manifest, null, 2);

    await fs.mkdir(nativeDir, {recursive: true});
    await fs.mkdir(shareExtensionDir, {recursive: true});
    await fs.cp(path.join(stageDir, "app"), resourceDir, {recursive: true});
    await fs.writeFile(path.join(stageDir, "native", "ios", "README.md"), iosReadme());
    await fs.writeFile(path.join(nativeDir, "MeshDropApp.swift"), iosAppSource());
    await fs.writeFile(path.join(nativeDir, "MeshDropView.swift"), iosViewSource());
    await fs.writeFile(path.join(nativeDir, "MeshDropViewController.swift"), iosViewControllerSource(manifestJson));
    await fs.writeFile(path.join(nativeDir, "MeshDropShareInbox.swift"), iosShareInboxSource());
    await fs.writeFile(path.join(nativeDir, "Info.plist"), iosInfoPlist());
    await fs.writeFile(path.join(shareExtensionDir, "ShareViewController.swift"), iosShareExtensionSource());
    await fs.writeFile(path.join(shareExtensionDir, "Info.plist"), iosShareExtensionInfoPlist());
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
        `    private let targetManifest = #"""${manifestJson}"""#`,
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
        "  <key>CFBundleIdentifier</key>",
        "  <string>farm.sandwich.meshdrop</string>",
        "  <key>WKAppBoundDomains</key>",
        "  <array/>",
        "</dict>",
        "</plist>",
        ""
    ].join("\n");
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
        "  <key>CFBundleIdentifier</key>",
        "  <string>farm.sandwich.meshdrop.share</string>",
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
        "    private static final int FILE_CHOOSER_REQUEST = 2407;",
        `    private static final String TARGET_MANIFEST = ${escapedManifest};`,
        "    private WebView webView;",
        "    private ValueCallback<Uri[]> filePathCallback;",
        "    private String pendingShareScript;",
        "    private boolean pageLoaded;",
        "",
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
        "",
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
        "",
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
        "",
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
        "    }",
        "}",
        ""
    ].join("\n");
}
