import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    buildMobileNativeSourcePackage,
    buildMobilePackage,
    listTarEntries,
    parseArgs,
    readTarEntry
} from "../scripts/build-mobile-package.mjs";

const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
const expectedRemainingProof = [
    "native mobile shell source artifact",
    "native mobile app package build",
    "native mobile WebRTC transfer UAT",
    "mobile file picker and share sheet",
    "Bluetooth transport negotiation"
];
const expectedNativeSourceRemainingProof = [
    "native mobile app package build",
    "native mobile WebRTC transfer UAT",
    "mobile file picker and share sheet",
    "Bluetooth transport negotiation"
];
const expectedIosNativeSourceRemainingProof = [
    "native mobile app package build",
    "native mobile WebRTC transfer UAT",
    "mobile file picker and share sheet"
];

for (const target of ["ios", "android"]) {
    test(`${target} package builder creates source artifact with target metadata`, async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `meshdrop-${target}-test-`));

        try {
            const result = await buildMobilePackage({
                target,
                version: "0.0.0 test",
                outDir: tempDir,
                env: {
                    MESH_DROP_BUILD_ID: "unit"
                }
            });
            const entries = await listTarEntries(result.artifactPath);
            const prefix = `meshdrop-${target}-0.0.0-test`;

            assert.equal(result.version, "0.0.0-test");
            assert.equal(result.target, target);
            assert(entries.includes(`${prefix}/app/index.html`));
            assert(entries.includes(`${prefix}/app/scripts/runtime-capabilities.js`));
            assert(entries.includes(`${prefix}/app/service-worker.js`));
            assert(entries.includes(`${prefix}/meshdrop-target.json`));
            assert(entries.includes(`${prefix}/README-${target.toUpperCase()}.md`));
            assert(entries.includes(`${prefix}/UAT-MOBILE.md`));
            assert(!entries.some(entry => entry.includes("/server/")));
            assert(!entries.some(entry => entry.includes("/node_modules/")));

            const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
            assert.equal(manifest.target, target);
            assert.equal(manifest.nativeShellBuilt, false);
            assert.equal(manifest.nativeShellSourceBuilt, false);
            assert.equal(manifest.runtime.platform, "mobile");
            assert.equal(manifest.runtime.hasBackend, false);
            assert.equal(manifest.runtime.sharedInstance, false);
            assert.equal(manifest.transports.webrtc, true);
            assert.equal(manifest.transports.nostr, true);
            assert.equal(manifest.transports.blossom, true);
            assert.equal(manifest.transports.hashtree, true);
            assert.equal(manifest.transports.localDiscovery, false);
            assert.equal(manifest.transports.pollen, false);
            assert.equal(manifest.transports.fips, false);
            assert.equal(manifest.transports.bluetooth, false);
            assert.deepEqual(manifest.remainingProof, expectedRemainingProof);

            const readme = await readTarEntry(result.artifactPath, `${prefix}/README-${target.toUpperCase()}.md`);
            assert.match(readme, /not a signed mobile app/i);
        }
        finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    });

    test(`${target} native source builder creates platform wrapper source artifact`, async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `meshdrop-${target}-native-source-test-`));

        try {
            const result = await buildMobileNativeSourcePackage({
                target,
                version: "0.0.0 test",
                outDir: tempDir,
                env: {
                    MESH_DROP_BUILD_ID: "unit-native-source"
                }
            });
            const entries = await listTarEntries(result.artifactPath);
            const prefix = `meshdrop-${target}-native-source-0.0.0-test`;
            const nativeRoot = `${prefix}/native/${target}`;

            assert.equal(result.version, "0.0.0-test");
            assert.equal(result.target, target);
            assert.equal(result.nativeSource, true);
            assert(entries.includes(`${prefix}/app/index.html`));
            assert(entries.includes(`${prefix}/meshdrop-target.json`));
            assert(entries.includes(`${prefix}/README-${target.toUpperCase()}.md`));
            assert(entries.includes(`${prefix}/UAT-MOBILE.md`));
            assert(entries.includes(`${nativeRoot}/README.md`));

            if (target === "ios") {
                assert(entries.includes(`${nativeRoot}/MeshDrop.xcodeproj/project.pbxproj`));
                assert(entries.includes(`${nativeRoot}/MeshDrop.xcodeproj/xcshareddata/xcschemes/MeshDrop.xcscheme`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/MeshDropApp.swift`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/MeshDropViewController.swift`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/MeshDropShareInbox.swift`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/MeshDrop.entitlements`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/Resources/meshdrop/index.html`));
                assert(entries.includes(`${nativeRoot}/MeshDropShareExtension/ShareViewController.swift`));
                assert(entries.includes(`${nativeRoot}/MeshDropShareExtension/Info.plist`));
                assert(entries.includes(`${nativeRoot}/MeshDropShareExtension/MeshDropShareExtension.entitlements`));
            }
            else {
                assert(entries.includes(`${nativeRoot}/settings.gradle`));
                assert(entries.includes(`${nativeRoot}/app/build.gradle`));
                assert(entries.includes(`${nativeRoot}/app/src/main/AndroidManifest.xml`));
                assert(entries.includes(`${nativeRoot}/app/src/main/res/xml/network_security_config.xml`));
                assert(entries.includes(`${nativeRoot}/app/src/main/assets/meshdrop/index.html`));
                assert(entries.includes(`${nativeRoot}/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`));
            }

            const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
            assert.equal(manifest.name, `meshdrop-${target}-native-source`);
            assert.equal(manifest.target, target);
            assert.equal(manifest.nativeShellBuilt, false);
            assert.equal(manifest.nativeShellSourceBuilt, true);
            assert.equal(manifest.runtime.platform, "mobile");
            assert.equal(manifest.runtime.hasBackend, false);
            assert.equal(manifest.runtime.sharedInstance, false);
            assert.equal(manifest.transports.webrtc, false);
            assert.equal(manifest.transports.nostr, false);
            assert.equal(manifest.transports.localDiscovery, false);
            assert.equal(manifest.transports.pollen, false);
            assert.equal(manifest.transports.fips, false);
            assert.equal(manifest.transports.bluetooth, false);
            assert.equal(manifest.nativeSource.sourceRoot, `native/${target}`);
            assert.deepEqual(
                manifest.remainingProof,
                target === "ios" ? expectedIosNativeSourceRemainingProof : expectedNativeSourceRemainingProof
            );
            if (target === "ios") {
                assert.equal(manifest.capabilities.transports.bluetooth.supported, false);
                assert.equal(manifest.capabilities.transports.bluetooth.transferSupported, false);
                assert.equal(manifest.capabilities.transports.bluetooth.apiAvailable, false);
                assert.equal(manifest.capabilities.transports.bluetooth.nativeBridgeAvailable, false);
                assert.equal(
                    manifest.capabilities.transports.bluetooth.unavailableReason,
                    "bluetooth-transfer-not-implemented"
                );
            }
            else {
                assert.equal(manifest.capabilities, undefined);
            }

            const wrapperSource = await readTarEntry(
                result.artifactPath,
                target === "ios"
                    ? `${nativeRoot}/MeshDrop/MeshDropViewController.swift`
                    : `${nativeRoot}/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`
            );
            assert.match(wrapperSource, /__meshdropTargetManifest/);
            if (target === "ios") {
                assert.match(wrapperSource, /private let targetManifest = #"""\n\s+\{/);
                assert.match(wrapperSource, /\n\s+"""#/);
                assert.match(wrapperSource, /WKUIDelegate/);
                assert.match(wrapperSource, /UIDocumentPickerDelegate/);
                assert.match(wrapperSource, /@available\(iOS 18\.4, \*\)/);
                assert.match(wrapperSource, /runOpenPanelWith/);
                assert.match(wrapperSource, /UIDocumentPickerViewController/);
                assert.match(wrapperSource, /documentPickerWasCancelled/);
                assert.match(wrapperSource, /WKScriptMessageHandler/);
                assert.match(wrapperSource, /MeshDropShareInbox\.bootstrapScript\(\)/);
                assert.match(wrapperSource, /configuration\.userContentController\.add\(self, name: "meshdropShareInbox"\)/);
                assert.match(wrapperSource, /MeshDropShareInbox\.fileResponseScript/);

                const shareInboxSource = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDrop/MeshDropShareInbox.swift`
                );
                const shareExtensionSource = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDropShareExtension/ShareViewController.swift`
                );
                const shareExtensionPlist = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDropShareExtension/Info.plist`
                );
                const appPlist = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDrop/Info.plist`
                );
                const xcodeProject = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDrop.xcodeproj/project.pbxproj`
                );
                const xcodeScheme = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDrop.xcodeproj/xcshareddata/xcschemes/MeshDrop.xcscheme`
                );
                const appEntitlements = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDrop/MeshDrop.entitlements`
                );
                const shareEntitlements = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/MeshDropShareExtension/MeshDropShareExtension.entitlements`
                );
                assert.match(shareInboxSource, /containerURL\(forSecurityApplicationGroupIdentifier:/);
                assert.match(shareInboxSource, /share-inbox\.json/);
                assert.match(shareExtensionSource, /SLComposeServiceViewController/);
                assert.match(shareExtensionSource, /NSExtensionItem/);
                assert.match(shareExtensionSource, /NSItemProvider/);
                assert.match(shareExtensionSource, /loadFileRepresentation/);
                assert.match(shareExtensionSource, /containerURL\(forSecurityApplicationGroupIdentifier:/);
                assert.match(shareExtensionSource, /group\.farm\.sandwich\.meshdrop/);
                assert.match(appPlist, /<key>CFBundleIdentifier<\/key>\n  <string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/);
                assert.match(appPlist, /<key>CFBundleExecutable<\/key>\n  <string>\$\(EXECUTABLE_NAME\)<\/string>/);
                assert.match(appPlist, /<key>CFBundlePackageType<\/key>\n  <string>APPL<\/string>/);
                assert.match(appPlist, /<key>CFBundleVersion<\/key>\n  <string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/);
                assert.match(shareExtensionPlist, /com\.apple\.share-services/);
                assert.match(shareExtensionPlist, /NSExtensionActivationRule/);
                assert.match(shareExtensionPlist, /NSExtensionActivationSupportsFileWithMaxCount/);
                assert.match(shareExtensionPlist, /<key>CFBundleIdentifier<\/key>\n  <string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/);
                assert.match(shareExtensionPlist, /<key>CFBundlePackageType<\/key>\n  <string>XPC!<\/string>/);
                assert.match(xcodeProject, /PBXNativeTarget/);
                assert.match(xcodeProject, /com\.apple\.product-type\.application/);
                assert.match(xcodeProject, /com\.apple\.product-type\.app-extension/);
                assert.match(xcodeProject, /CODE_SIGN_ENTITLEMENTS = MeshDrop\/MeshDrop\.entitlements/);
                assert.match(xcodeProject, /CODE_SIGN_ENTITLEMENTS = MeshDropShareExtension\/MeshDropShareExtension\.entitlements/);
                assert.match(xcodeProject, /INFOPLIST_FILE = MeshDrop\/Info\.plist/);
                assert.match(xcodeProject, /INFOPLIST_FILE = MeshDropShareExtension\/Info\.plist/);
                assert.match(xcodeProject, /MARKETING_VERSION = 0\.0\.0-test/);
                assert.match(xcodeProject, /SKIP_INSTALL = NO/);
                assert.match(xcodeScheme, /MeshDrop\.app/);
                assert.match(xcodeScheme, /MeshDropShareExtension\.appex/);
                assert.match(appEntitlements, /com\.apple\.security\.application-groups/);
                assert.match(appEntitlements, /group\.farm\.sandwich\.meshdrop/);
                assert.match(shareEntitlements, /com\.apple\.security\.application-groups/);
                assert.match(shareEntitlements, /group\.farm\.sandwich\.meshdrop/);
                assert.match(shareInboxSource, /static func bootstrapScript\(\) -> String/);
                assert.match(shareInboxSource, /globalThis\.__meshdropSharedFiles/);
                assert.match(shareInboxSource, /globalThis\.meshdropShareInbox/);
                assert.match(shareInboxSource, /window\.dispatchEvent\(new CustomEvent\("meshdrop:shared-files"/);
                assert.match(shareInboxSource, /static func fileResponseScript\(requestId: String, fileName: String\)/);
                assert.match(shareInboxSource, /base64EncodedString\(\)/);
                assert.match(shareInboxSource, /pathEscapesInbox/);
            }
            else {
                const androidManifest = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/app/src/main/AndroidManifest.xml`
                );
                const networkConfig = await readTarEntry(
                    result.artifactPath,
                    `${nativeRoot}/app/src/main/res/xml/network_security_config.xml`
                );
                assert.match(wrapperSource, /ApplicationInfo\.FLAG_DEBUGGABLE/);
                assert.match(wrapperSource, /WebView\.setWebContentsDebuggingEnabled\(true\)/);
                assert.match(wrapperSource, /WebChromeClient/);
                assert.match(wrapperSource, /onShowFileChooser/);
                assert.match(wrapperSource, /meshdropAndroidNativeShare/);
                assert.match(wrapperSource, /meshdropAndroidBridge/);
                assert.match(wrapperSource, /MeshDropNativeBackend/);
                assert.match(wrapperSource, /ServerSocket\(0, 50, java\.net\.InetAddress\.getByName\("127\.0\.0\.1"\)\)/);
                assert.match(wrapperSource, /__meshdropAndroidNativeBackend/);
                assert.match(wrapperSource, /\/pollen\/status/);
                assert.match(wrapperSource, /\/pollen\/upload/);
                assert.match(wrapperSource, /\/pollen\/download\//);
                assert.match(wrapperSource, /\/fips\/status/);
                assert.match(wrapperSource, /rust-fips-core-not-linked/);
                assert.match(wrapperSource, /isNostrSignerInstalled/);
                assert.match(wrapperSource, /requestNostrSigner/);
                assert.match(wrapperSource, /android-nostr-signer-result/);
                assert.match(wrapperSource, /permissions/);
                assert.match(wrapperSource, /android-native-share-received/);
                assert.match(wrapperSource, /setAllowFileAccessFromFileURLs\(true\)/);
                assert.match(wrapperSource, /delete HTMLCanvasElement\.prototype\.transferControlToOffscreen/);
                assert.match(androidManifest, /android\.permission\.INTERNET/);
                assert.match(androidManifest, /android\.permission\.ACCESS_NETWORK_STATE/);
                assert.match(androidManifest, /android\.permission\.ACCESS_WIFI_STATE/);
                assert.match(androidManifest, /android\.permission\.CHANGE_WIFI_MULTICAST_STATE/);
                assert.match(androidManifest, /<queries>/);
                assert.match(androidManifest, /android:scheme="nostrsigner"/);
                assert.match(androidManifest, /android:launchMode="singleTop"/);
                assert.match(androidManifest, /android.intent.action.SEND/);
                assert.match(androidManifest, /android.intent.action.SEND_MULTIPLE/);
                assert.match(androidManifest, /android:usesCleartextTraffic="false"/);
                assert.match(androidManifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
                assert.match(networkConfig, /cleartextTrafficPermitted="true"/);
                assert.match(networkConfig, /127\.0\.0\.1/);
                assert.match(networkConfig, /localhost/);
                const gradleBuild = await readTarEntry(result.artifactPath, `${nativeRoot}/app/build.gradle`);
                assert.match(gradleBuild, /MESHDROP_ANDROID_RELEASE_STORE_FILE/);
                assert.match(gradleBuild, /signingConfigs/);
                assert.match(gradleBuild, /buildTypes/);
            }

            const readme = await readTarEntry(result.artifactPath, `${prefix}/README-${target.toUpperCase()}.md`);
            assert.match(readme, /not a signed app/i);
        }
        finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    });
}

test("mobile package builder requires an explicit supported target", () => {
    assert.deepEqual(parseArgs(["--target", "ios"]), {
        version: packageJson.version,
        outDir: path.resolve(new URL("..", import.meta.url).pathname, "dist"),
        target: "ios",
        nativeSource: false,
        androidApk: false,
        androidReleaseApk: false
    });
    assert.deepEqual(parseArgs(["--target", "android", "--native-source"]), {
        version: packageJson.version,
        outDir: path.resolve(new URL("..", import.meta.url).pathname, "dist"),
        target: "android",
        nativeSource: true,
        androidApk: false,
        androidReleaseApk: false
    });
    assert.deepEqual(parseArgs(["--target", "android", "--android-apk"]), {
        version: packageJson.version,
        outDir: path.resolve(new URL("..", import.meta.url).pathname, "dist"),
        target: "android",
        nativeSource: false,
        androidApk: true,
        androidReleaseApk: false
    });
    assert.deepEqual(parseArgs(["--target", "android", "--android-release-apk"]), {
        version: packageJson.version,
        outDir: path.resolve(new URL("..", import.meta.url).pathname, "dist"),
        target: "android",
        nativeSource: false,
        androidApk: false,
        androidReleaseApk: true
    });
    assert.rejects(() => buildMobilePackage({target: "desktop"}), /ios or android/);
});
