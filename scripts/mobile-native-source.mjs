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
    const resourceDir = path.join(nativeDir, "Resources", "meshdrop");
    const manifestJson = JSON.stringify(manifest, null, 2);

    await fs.mkdir(nativeDir, {recursive: true});
    await fs.cp(path.join(stageDir, "app"), resourceDir, {recursive: true});
    await fs.writeFile(path.join(stageDir, "native", "ios", "README.md"), iosReadme());
    await fs.writeFile(path.join(nativeDir, "MeshDropApp.swift"), iosAppSource());
    await fs.writeFile(path.join(nativeDir, "MeshDropView.swift"), iosViewSource());
    await fs.writeFile(path.join(nativeDir, "MeshDropViewController.swift"), iosViewControllerSource(manifestJson));
    await fs.writeFile(path.join(nativeDir, "Info.plist"), iosInfoPlist());
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
        "import WebKit",
        "",
        "final class MeshDropViewController: UIViewController {",
        `    private let targetManifest = #"""${manifestJson}"""#`,
        "    private var webView: WKWebView!",
        "",
        "    override func viewDidLoad() {",
        "        super.viewDidLoad()",
        "        let configuration = WKWebViewConfiguration()",
        "        let source = \"globalThis.__meshdropTargetManifest = \\(targetManifest);\"",
        "        let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)",
        "        configuration.userContentController.addUserScript(script)",
        "        webView = WKWebView(frame: view.bounds, configuration: configuration)",
        "        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]",
        "        view.addSubview(webView)",
        "        guard let url = Bundle.main.url(forResource: \"index\", withExtension: \"html\", subdirectory: \"meshdrop\") else {",
        "            fatalError(\"MeshDrop app/index.html is missing from the app bundle\")",
        "        }",
        "        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())",
        "    }",
        "}",
        ""
    ].join("\n");
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
        "    <activity android:name=\".MainActivity\" android:exported=\"true\">",
        "      <intent-filter>",
        "        <action android:name=\"android.intent.action.MAIN\" />",
        "        <category android:name=\"android.intent.category.LAUNCHER\" />",
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
        "import android.content.pm.ApplicationInfo;",
        "import android.os.Bundle;",
        "import android.webkit.WebSettings;",
        "import android.webkit.WebView;",
        "import android.webkit.WebViewClient;",
        "",
        "public final class MainActivity extends Activity {",
        `    private static final String TARGET_MANIFEST = ${escapedManifest};`,
        "",
        "    @Override",
        "    protected void onCreate(Bundle savedInstanceState) {",
        "        super.onCreate(savedInstanceState);",
        "        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {",
        "            WebView.setWebContentsDebuggingEnabled(true);",
        "        }",
        "        WebView webView = new WebView(this);",
        "        WebSettings settings = webView.getSettings();",
        "        settings.setJavaScriptEnabled(true);",
        "        settings.setDomStorageEnabled(true);",
        "        settings.setAllowFileAccess(true);",
        "        settings.setAllowFileAccessFromFileURLs(true);",
        "        webView.setWebViewClient(new WebViewClient() {",
        "            @Override",
        "            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {",
        "                view.evaluateJavascript(\"if (globalThis.HTMLCanvasElement) { delete HTMLCanvasElement.prototype.transferControlToOffscreen; } globalThis.__meshdropTargetManifest = \" + TARGET_MANIFEST + \";\", null);",
        "            }",
        "        });",
        "        setContentView(webView);",
        "        webView.loadUrl(\"file:///android_asset/meshdrop/index.html\");",
        "    }",
        "}",
        ""
    ].join("\n");
}
