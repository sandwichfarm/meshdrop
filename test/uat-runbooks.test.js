import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readDoc = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("target UAT runbooks cover shipped build surfaces without overclaiming", () => {
    const requiredDocs = [
        "docs/uat/spa.md",
        "docs/uat/docker.md",
        "docs/uat/start9.md",
        "docs/uat/umbrel.md",
        "docs/uat/desktop.md",
        "docs/uat/mobile.md",
        "docs/uat/release-target-images.md",
        "docs/uat/external-finishline-closeout.md",
        "docs/uat/target-status.md",
    ];

    for (const path of requiredDocs) {
        assert.equal(fs.existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`);
    }

    const spa = readDoc("docs/uat/spa.md");
    assert.match(spa, /PLAYWRIGHT_BROWSER=chromium/);
    assert.match(spa, /PLAYWRIGHT_BROWSER=firefox/);
    assert.match(spa, /PLAYWRIGHT_BROWSER=webkit/);
    assert.match(spa, /SPA browser matrix/);
    assert.match(spa, /Chromium and Firefox also connect two Nostr identities/);
    assert.match(spa, /WebKit transfer proof runs in the manual-only/);
    assert.match(spa, /MESHDROP_SPA_WEBKIT_TRANSFER=1/);
    assert.match(spa, /Proof backend-free-spa-nostr-webrtc:webkit/);
    assert.match(spa, /manual CI run `28716511864` passed the `SPA WebKit transfer UAT`/);
    assert.match(spa, /MESHDROP_SPA_PUBLIC_RELAY_URLS=wss:\/\/bucket\.coracle\.social/);
    assert.match(spa, /Proof public-spa-nostr-webrtc:<browser>/);
    assert.match(spa, /manual-only `SPA public relay UAT` job runs Chromium and Firefox/);
    assert.match(spa, /manual CI run `28713488687` passed the Chromium and Firefox/);

    assert.match(readDoc("docs/uat/docker.md"), /npm run test:docker/);
    assert.match(readDoc("docs/uat/docker.md"), /npm run test:docker:two-host/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_ADMIN_NPUB/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_DISCOVERY_NPUBS/);
    assert.match(readDoc("docs/uat/docker.md"), /Proof docker-two-host-nostr-webrtc/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_DOCKER_PUBLIC_RELAY_URLS=wss:\/\/bucket\.coracle\.social/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_DOCKER_PUBLIC_RELAY_ATTEMPTS/);
    assert.match(readDoc("docs/uat/docker.md"), /Proof docker-public-relay-two-host-webrtc/);
    assert.match(readDoc("docs/uat/docker.md"), /manual run `28715209725`/);
    assert.match(readDoc("docs/uat/docker.md"), /npm run test:docker:admin/);
    assert.match(readDoc("docs/uat/docker.md"), /Proof docker-deployed-admin-settings/);

    const start9 = readDoc("docs/uat/start9.md");
    assert.match(start9, /npm run build:start9/);
    assert.match(start9, /MESHDROP_TARGET=start9/);
    assert.match(start9, /MESHDROP_DISCOVERY_NPUBS/);
    assert.match(start9, /MESHDROP_ADMIN_NPUB/);
    assert.match(start9, /\.s9pk/);
    assert.match(start9, /npm run test:start9-package/);
    assert.match(start9, /MESHDROP_START9_UAT_URL/);
    assert.match(start9, /npm run test:start9-deployed/);
    assert.match(start9, /Proof start9-deployed-device-webrtc/);
    assert.match(start9, /local WebRTC and Pollen WebRTC/);
    assert.match(start9, /Not Proven/);

    const umbrel = readDoc("docs/uat/umbrel.md");
    assert.match(umbrel, /npm run build:umbrel/);
    assert.match(umbrel, /MESHDROP_TARGET=umbrel/);
    assert.match(umbrel, /MESHDROP_DISCOVERY_NPUBS/);
    assert.match(umbrel, /MESHDROP_ADMIN_NPUB/);
    assert.match(umbrel, /npm run test:umbrel-package/);
    assert.match(umbrel, /MESHDROP_UMBREL_UAT_URL/);
    assert.match(umbrel, /npm run test:umbrel-deployed/);
    assert.match(umbrel, /Proof umbrel-deployed-device-webrtc/);
    assert.match(umbrel, /local WebRTC and Pollen WebRTC/);
    assert.match(umbrel, /Not Proven/);

    const desktop = readDoc("docs/uat/desktop.md");
    assert.match(desktop, /npm run build:desktop/);
    assert.match(desktop, /npm run build:desktop:native/);
    assert.match(desktop, /npm run build:desktop:chromium/);
    assert.match(desktop, /npm run build:desktop:chromium-bundled/);
    assert.match(desktop, /npm run build:desktop:installer/);
    assert.match(desktop, /meshdrop-desktop-chromium-bundled-<version>\.tar\.gz/);
    assert.match(desktop, /meshdrop-desktop-chromium-bundled-installer-<version>\.run/);
    assert.match(desktop, /gpg-detached-armor/);
    assert.match(desktop, /sha256sum -c meshdrop-desktop-chromium-bundled-installer-<version>\.run\.sha256/);
    assert.match(desktop, /target` as `desktop`/);
    assert.match(desktop, /runtime\.platform` as `desktop`/);
    assert.match(desktop, /nativeShellBuilt` as `false`/);
    assert.match(desktop, /nativeShellBuilt` as `true`/);
    assert.match(desktop, /chromiumShellBuilt` are `true`/);
    assert.match(desktop, /bin\/meshdrop-desktop/);
    assert.match(desktop, /bin\/meshdrop-desktop-chromium\.mjs/);
    assert.match(desktop, /bin\/chromium\/chrome/);
    assert.match(desktop, /backend-only transports are not claimed/);
    assert.match(desktop, /bluetooth` is `false`/);
    assert.match(desktop, /Nostr WebRTC/);
    assert.match(desktop, /npm run test:target-artifacts/);
    assert.match(desktop, /npm run test:desktop-chromium/);
    assert.match(desktop, /npm run test:desktop-chromium-bundled/);
    assert.match(desktop, /npm run test:desktop-installer/);
    assert.match(desktop, /meshdrop-desktop-chromium-proof\.txt/);
    assert.match(desktop, /native desktop WebRTC transfer UAT/);
    assert.match(desktop, /bundled Chromium WebRTC/);
    assert.match(desktop, /signed installer verification\/install\/launch/);
    assert.match(desktop, /Not Proven/);

    const mobile = readDoc("docs/uat/mobile.md");
    assert.match(mobile, /npm run build:ios/);
    assert.match(mobile, /npm run build:android/);
    assert.match(mobile, /npm run build:ios:native-source/);
    assert.match(mobile, /npm run build:android:native-source/);
    assert.match(mobile, /npm run build:android:apk/);
    assert.match(mobile, /npm run build:android:release-apk/);
    assert.match(mobile, /npm run build:ios:device-app/);
    assert.match(mobile, /target` as `ios` or `android`/);
    assert.match(mobile, /runtime\.platform` as `mobile`/);
    assert.match(mobile, /nativeShellBuilt` as `false`/);
    assert.match(mobile, /nativeShellBuilt` is `true`/);
    assert.match(mobile, /nativeShellSourceBuilt` is `true`/);
    assert.match(mobile, /native-source artifacts do not claim unproven native transfer paths/);
    assert.match(mobile, /Android APK artifacts report `webrtc` and `nostr` as `true`/);
    assert.match(mobile, /meshdrop-android-debug\.apk/);
    assert.match(mobile, /gradleTask` set to `assembleDebug`/);
    assert.match(mobile, /meshdrop-android-release\.apk/);
    assert.match(mobile, /gradleTask` set to\s+`assembleRelease`/);
    assert.match(mobile, /`apksigner verify --print-certs`/);
    assert.match(mobile, /generated UAT keystore/);
    assert.match(mobile, /Play Store upload signing/);
    assert.match(mobile, /globalThis\.__meshdropTargetManifest/);
    assert.match(mobile, /bluetooth` is `false`/);
    assert.match(mobile, /capabilities\.transports\.bluetooth/);
    assert.match(mobile, /records Bluetooth as explicitly negotiated unsupported/);
    assert.match(mobile, /iOS native-source artifact proves Bluetooth capability negotiation only as unsupported/);
    assert.match(mobile, /npm run test:android-apk/);
    assert.match(mobile, /npm run test:android-release-apk/);
    assert.match(mobile, /npm run test:android-apk-install/);
    assert.match(mobile, /Proof android-apk-emulator-install/);
    assert.match(mobile, /farm\.sandwich\.meshdrop\/\.MainActivity/);
    assert.match(mobile, /npm run test:android-webview-capabilities/);
    assert.match(mobile, /Proof android-webview-capabilities/);
    assert.match(mobile, /native transfer claim=true/);
    assert.match(mobile, /Bluetooth transfer=false/);
    assert.match(mobile, /npm run test:android-webview-transfer/);
    assert.match(mobile, /Proof android-webview-nostr-webrtc/);
    assert.match(mobile, /meshdrop-android-webview-proof\.txt/);
    assert.match(mobile, /npm run test:android-share-file/);
    assert.match(mobile, /Proof android-share-file-nostr-webrtc/);
    assert.match(mobile, /ACTION_SEND` stream/);
    assert.match(mobile, /WebChromeClient\.onShowFileChooser/);
    assert.match(mobile, /npm run test:android-picker-ui/);
    assert.match(mobile, /Proof android-picker-ui/);
    assert.match(mobile, /native picker UI selected `meshdrop-picker-proof\.txt`/);
    assert.match(mobile, /meshdrop-android-share-proof\.txt/);
    assert.match(mobile, /npm run test:android-physical-device/);
    assert.match(mobile, /Proof android-physical-device-uat/);
    assert.match(mobile, /rejects emulator-only runs/);
    assert.match(mobile, /npm run test:target-artifacts/);
    assert.match(mobile, /Android WebView transfer proof alone does not prove physical Android device install UAT/);
    assert.match(mobile, /Android release APK artifact proves a release APK signed with a generated UAT keystore/);
    assert.match(mobile, /native mobile WebRTC transfer UAT/);
    assert.match(mobile, /Google Pixel 7 Pro `28031FDH300BS5`/);
    assert.match(mobile, /iOS native-source wrapper wires WKWebView file inputs to a document picker through the iOS 18\.4\+ open-panel hook/);
    assert.match(mobile, /iOS native-source artifact contains `native\/ios\/MeshDrop\.xcodeproj\/project\.pbxproj`/);
    assert.match(mobile, /shared `MeshDrop\.xcscheme`/);
    assert.match(mobile, /npm run test:ios-xcode-build/);
    assert.match(mobile, /npm run build:ios:simulator-app/);
    assert.match(mobile, /npm run test:ios-simulator-app/);
    assert.match(mobile, /packageType` as `unsigned-simulator-app`/);
    assert.match(mobile, /npm run test:ios-device-app/);
    assert.match(mobile, /packageType` as `unsigned-device-app`/);
    assert.match(mobile, /generic `iphoneos` `\.app` build product/);
    assert.match(mobile, /npm run test:ios-signed-device/);
    assert.match(mobile, /MESHDROP_IOS_DEVELOPMENT_TEAM/);
    assert.match(mobile, /MESHDROP_IOS_DEVICE_UDID/);
    assert.match(mobile, /Proof ios-signed-device-install/);
    assert.match(mobile, /installed and launched through\s+`devicectl`/);
    assert.match(mobile, /signed\/device-install harness/);
    assert.match(mobile, /matching App Group entitlement files/);
    assert.match(mobile, /iOS native-source artifact includes a share extension source scaffold/);
    assert.match(mobile, /MeshDropShareExtension\/ShareViewController\.swift/);
    assert.match(mobile, /globalThis\.__meshdropSharedFiles/);
    assert.match(mobile, /globalThis\.meshdropShareInbox\.list\(\)/);
    assert.match(mobile, /globalThis\.meshdropShareInbox\.read\(name\)/);
    assert.match(mobile, /firing `activate-share-mode`/);
    assert.match(mobile, /await globalThis\.meshdropShareInbox\.read\("<staged-name>"\)/);
    assert.match(mobile, /enters share mode for the staged file/);
    assert.match(mobile, /App\s+Group entitlement provisioning\s+on a signed device, share-sheet device UAT/);
    assert.match(
        mobile,
        /iOS device picker\s+UAT, App\s+Group entitlement provisioning\s+on a signed device, share-sheet device UAT/
    );
    assert.match(mobile, /share-inbox bridge exposed as `globalThis\.meshdropShareInbox`/);
    assert.match(mobile, /iOS Simulator app artifact proves an unsigned Simulator `\.app` package only/);
    assert.match(mobile, /Not Proven/);

    const releaseTargets = readDoc("docs/uat/release-target-images.md");
    for (const target of ["standalone", "start9", "umbrel"]) {
        assert.match(releaseTargets, new RegExp(`MESHDROP_TARGET=${target}`));
        assert.match(releaseTargets, new RegExp(`:${target}`));
    }
    assert.match(releaseTargets, /multi-architecture manifests for `linux\/amd64` and `linux\/arm64`/);
    assert.match(releaseTargets, /docker buildx imagetools inspect/);
    assert.match(releaseTargets, /release-verify\.yml/);
    assert.match(releaseTargets, /authenticated readback runs with GitHub Actions package/);
    assert.match(releaseTargets, /Android debug APK tarball/);
    assert.match(releaseTargets, /Android\s+release APK tarball/);
    assert.match(releaseTargets, /iOS Simulator app tarball/);
    assert.match(releaseTargets, /iOS unsigned device app tarball/);
    assert.doesNotMatch(releaseTargets, /physical-device install UAT and Bluetooth proof/);
    assert.match(releaseTargets, /signed Desktop Chromium\s+installer `\.run`/);
    assert.match(releaseTargets, /installer `\.asc`/);
    assert.match(releaseTargets, /installer `\.sha256`/);
    assert.match(releaseTargets, /installer `\.pubkey\.asc`/);
    assert.match(releaseTargets, /permissions and anonymous GHCR manifest readback/);
    assert.match(releaseTargets, /anonymous GHCR manifest readback/);
    assert.match(releaseTargets, /npm run verify:ghcr-anonymous -- v0\.x\.y/);
    assert.match(releaseTargets, /temporary `DOCKER_CONFIG`/);
    assert.match(releaseTargets, /npm run test:external-uat -- v0\.x\.y/);
    assert.match(releaseTargets, /Proof external-uat-finishline/);
    assert.match(releaseTargets, /docs\/uat\/external-finishline-closeout\.md/);
    assert.match(releaseTargets, /v0\.1\.5` release assets and authenticated GHCR readback are proven by release run `28760231569`/);
    assert.match(releaseTargets, /meshdrop-spa-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-desktop-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-desktop-chromium-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-desktop-chromium-bundled-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-desktop-chromium-bundled-installer-0\.1\.5\.run/);
    assert.match(releaseTargets, /meshdrop-desktop-linux-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-ios-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-android-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-ios-native-source-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-ios-simulator-app-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-ios-device-app-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-android-native-source-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-android-apk-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /meshdrop-android-release-apk-0\.1\.5\.tar\.gz/);
    assert.match(releaseTargets, /v0\.1\.5-standalone/);
    assert.match(releaseTargets, /Docker smoke passed for `ghcr\.io\/sandwichfarm\/meshdrop:v0\.1\.5-standalone`/);
    assert.match(releaseTargets, /Start9 source\s+tarball/);
    assert.match(releaseTargets, /Umbrel package tarball/);
    assert.match(releaseTargets, /`npm run verify:ghcr-anonymous -- v0\.1\.5` step failed with GHCR/);
    assert.match(releaseTargets, /Not proven/);

    const targetStatus = readDoc("docs/uat/target-status.md");
    for (const target of ["SPA", "Docker", "Start9", "Umbrel", "Desktop Native", "iOS", "Android", "Release Images"]) {
        assert.match(targetStatus, new RegExp(`\\| ${target} \\|`));
    }
    assert.match(
        targetStatus,
        /\| Release Images \| `v0\.1\.5` release assets, target images, authenticated readback, and Docker smoke verified; anonymous GHCR visibility blocks public release proof \|/
    );
    assert.match(targetStatus, /Release run `28760231569`/);
    assert.match(targetStatus, /Desktop Chromium bundled shell and installer, iOS source\/native-source\/Simulator app\/device app, Android source\/native-source\/debug APK\/release APK tarballs/);
    assert.match(targetStatus, /release readback `npm run verify:ghcr-anonymous -- v0\.1\.5` returns GHCR `unauthorized`/);
    assert.match(targetStatus, /Make `ghcr\.io\/sandwichfarm\/meshdrop` public/);
    assert.match(targetStatus, /npm run test:external-uat -- v0\.x\.y/);
    assert.match(targetStatus, /Start9 deployed UAT, Umbrel deployed UAT, iOS signed physical-device UAT, and anonymous GHCR readback/);
    assert.match(targetStatus, /Proof external-uat-finishline/);
    assert.match(targetStatus, /docs\/uat\/external-finishline-closeout\.md/);

    const externalFinishline = readDoc("docs/uat/external-finishline-closeout.md");
    assert.match(externalFinishline, /MacBook/);
    assert.match(externalFinishline, /npm run test:external-uat -- v0\.1\.5/);
    assert.match(externalFinishline, /gh auth refresh -h github\.com -s read:packages/);
    assert.match(externalFinishline, /npm run verify:ghcr-anonymous -- v0\.1\.5/);
    assert.match(externalFinishline, /MESHDROP_START9_UAT_URL/);
    assert.match(externalFinishline, /npm run test:start9-deployed/);
    assert.match(externalFinishline, /MESHDROP_UMBREL_UAT_URL/);
    assert.match(externalFinishline, /npm run test:umbrel-deployed/);
    assert.match(externalFinishline, /xcrun devicectl list devices/);
    assert.match(externalFinishline, /MESHDROP_IOS_DEVELOPMENT_TEAM/);
    assert.match(externalFinishline, /MESHDROP_IOS_DEVICE_UDID/);
    assert.match(externalFinishline, /npm run test:ios-signed-device/);
    assert.match(externalFinishline, /npm run test:android-physical-device/);
    assert.match(externalFinishline, /Proof external-uat-finishline/);
    assert.match(
        targetStatus,
        /\| SPA \| Chromium\/Firefox\/WebKit backend-free transfer smoke exists; Chromium\/Firefox public relay UAT exists \|/
    );
    assert.match(targetStatus, /manual run `28713488687` public relay jobs/);
    assert.match(targetStatus, /manual run `28716511864` WebKit transfer UAT/);
    assert.match(targetStatus, /\| SPA \|[^|]+\|[^|]+\| None recorded for current SPA runbook \|/);
    assert.match(targetStatus, /deterministic two-host relay, public relay two-host UAT, and deployed-admin UAT exists/);
    assert.match(targetStatus, /manual run `28715209725` Docker public relay UAT/);
    assert.match(targetStatus, /\| Docker \|[^|]+deployed-admin UAT exists[^|]+\|[^|]+\| None recorded for Docker \|/);
    assert.match(
        targetStatus,
        /\| Start9 \| Generated package environment transfer smoke and deployed-device UAT harness exist; real StartOS device pass open \|/
    );
    assert.match(targetStatus, /`npm run test:start9-package` proves package build/);
    assert.match(targetStatus, /Passing `MESHDROP_START9_UAT_URL=<url> npm run test:start9-deployed` after StartOS UI install/);
    assert.match(
        targetStatus,
        new RegExp([
            "\\| Desktop Native \\| Source artifact transfer smoke, GTK/WebKit runtime proof,",
            " Chromium shell transfer proof, bundled Chromium engine proof, Linux binary launcher proof,",
            " and signed Linux installer proof exist; GTK/WebKit native WebRTC remains gated off \\|"
        ].join(""))
    );
    assert.match(targetStatus, /`npm run build:desktop:native`; `npm run build:desktop:chromium`/);
    assert.match(targetStatus, /`npm run build:desktop:chromium-bundled`/);
    assert.match(targetStatus, /`npm run build:desktop:installer`/);
    assert.match(targetStatus, /`bin\/meshdrop-desktop-chromium` binary launcher packaging/);
    assert.match(targetStatus, /meshdrop-desktop-chromium-bundled-<version>\.tar\.gz/);
    assert.match(targetStatus, /signed installer metadata\/signature\/install proof/);
    assert.match(targetStatus, /`npm run test:desktop-native` proves the packaged GTK\/WebKit shell/);
    assert.match(targetStatus, /`npm run test:desktop-chromium` proves the packaged Chromium shell/);
    assert.match(targetStatus, /`npm run test:desktop-chromium-bundled` proves the packaged binary launcher uses bundled `bin\/chromium\/chrome`/);
    assert.match(targetStatus, /`npm run test:desktop-installer` proves the generated `\.run` installer SHA256/);
    assert.match(targetStatus, /None recorded for the signed Desktop Chromium installer path/);
    assert.match(targetStatus, /\| Umbrel \| Rendered package compose transfer smoke and deployed-node UAT harness exist; real Umbrel node pass open \|/);
    assert.match(targetStatus, /`npm run test:umbrel-package` proves package build/);
    assert.match(targetStatus, /Passing `MESHDROP_UMBREL_UAT_URL=<url> npm run test:umbrel-deployed` after Umbrel UI install/);
    assert.match(targetStatus, /\| iOS \| Source artifact transfer smoke, native-source wrapper artifact, Xcode project build smoke, unsigned Simulator app package proof, unsigned device app proof, signed-device install-and-launch harness, share extension source bridge, web share-inbox consumption proof, and Bluetooth negotiation proof exist; signed\/device pass open \|/);
    assert.match(
        targetStatus,
        /\| Android \| Source artifact transfer smoke, native-source wrapper artifact, debug APK build proof, signed release APK proof, emulator install proof, WebView capability and Bluetooth negotiation proof, WebView transfer proof, share-intent file proof, native picker UI proof, and physical-device hardware UAT passed \|/
    );
    assert.match(targetStatus, /`npm run build:ios`; `npm run build:ios:native-source`; `npm run build:ios:simulator-app`; `npm run build:ios:device-app`; `npm run test:ios-xcode-build`; `npm run test:ios-simulator-app`; `npm run test:ios-device-app`; `node --test test\/mobile-package\.test\.js`; `node --test test\/native-share-inbox\.test\.js`; `node --test test\/ios-signed-device-uat\.test\.js`/);
    assert.match(targetStatus, /wires iOS 18\.4\+ file inputs to `UIDocumentPickerViewController`/);
    assert.match(targetStatus, /includes `MeshDrop\.xcodeproj` and shared App Group entitlement files/);
    assert.match(targetStatus, /injects App Group share-inbox metadata through `globalThis\.__meshdropSharedFiles`/);
    assert.match(targetStatus, /exposes `globalThis\.meshdropShareInbox\.read\(name\)` for staged file bytes/);
    assert.match(targetStatus, /converts native share-inbox file responses into `File` objects/);
    assert.match(targetStatus, /fires `activate-share-mode`/);
    assert.match(targetStatus, /records Bluetooth as negotiated unsupported with no Web Bluetooth API, no Bluetooth native bridge, and no transfer support/);
    assert.match(targetStatus, /`npm run test:ios-xcode-build` proves the generated `MeshDrop` Xcode scheme builds for iOS Simulator without code signing/);
    assert.match(targetStatus, /`npm run test:ios-simulator-app` proves an unsigned `MeshDrop\.app` Simulator package can be built and inspected/);
    assert.match(targetStatus, /`npm run test:ios-device-app` proves an unsigned generic `iphoneos` `MeshDrop\.app` can be built and inspected/);
    assert.match(targetStatus, /signed-device harness rejects non-macOS\/no-device runs, requires signing\/device inputs, and uses `devicectl` to install and launch the signed app/);
    assert.match(targetStatus, /includes `MeshDropShareExtension\/ShareViewController\.swift`/);
    assert.match(targetStatus, /Passing `MESHDROP_IOS_DEVELOPMENT_TEAM=<team-id> MESHDROP_IOS_DEVICE_UDID=<device-udid> npm run test:ios-signed-device`/);
    assert.match(targetStatus, /`npm run build:android`; `npm run build:android:native-source`; `npm run build:android:apk`/);
    assert.match(targetStatus, /`npm run build:android:release-apk`/);
    assert.match(targetStatus, /`MESHDROP_ANDROID_AVD=Medium_Phone_API_36\.1 npm run test:android-apk-install`/);
    assert.match(targetStatus, /`MESHDROP_ANDROID_AVD=Medium_Phone_API_36\.1 npm run test:android-picker-ui`/);
    assert.match(targetStatus, /`MESHDROP_ANDROID_AVD=Medium_Phone_API_36\.1 npm run test:android-webview-capabilities`/);
    assert.match(targetStatus, /`MESHDROP_ANDROID_AVD=Medium_Phone_API_36\.1 npm run test:android-webview-transfer`/);
    assert.match(targetStatus, /`MESHDROP_ANDROID_AVD=Medium_Phone_API_36\.1 npm run test:android-share-file`/);
    assert.match(targetStatus, /`npm run build:ios:native-source`/);
    assert.match(targetStatus, /`npm run build:android:native-source`/);
    assert.match(targetStatus, /signed install, launch, and App Group entitlement proof/);
    assert.match(targetStatus, /share-sheet device UAT that reads `globalThis\.meshdropShareInbox` and shows share mode for the staged file/);
    assert.doesNotMatch(targetStatus, /Bluetooth negotiation, and native mobile transfer UAT/);
    assert.match(targetStatus, /Gradle-built debug APK artifact/);
    assert.match(targetStatus, /UAT-signed release APK verified by `apksigner`/);
    assert.match(targetStatus, /Android emulator install\/launch of `farm\.sandwich\.meshdrop\/\.MainActivity`/);
    assert.match(targetStatus, /Android native picker UI selection of `meshdrop-picker-proof\.txt`/);
    assert.match(targetStatus, /Android WebView `RTCPeerConnection`\/`WebSocket`\/`RTCDataChannel` capability evidence and Bluetooth API negotiation/);
    assert.match(targetStatus, /Android WebView sent `meshdrop-android-webview-proof\.txt`/);
    assert.match(targetStatus, /Android received an `ACTION_SEND` stream for `meshdrop-android-share-proof\.txt`/);
    assert.match(targetStatus, /node --test test\/android-physical-device-uat\.test\.js` proves the physical-device harness/);
    assert.match(targetStatus, /`npm run test:android-physical-device` passed on Google Pixel 7 Pro `28031FDH300BS5`/);
    assert.match(targetStatus, /None recorded for Android physical-device UAT/);
    assert.doesNotMatch(targetStatus, /Physical Android device install UAT and Bluetooth negotiation/);
    assert.doesNotMatch(targetStatus, /Android native file picker UI UAT/);
    assert.doesNotMatch(targetStatus, /signed Android release APK or AAB package/);
    assert.doesNotMatch(targetStatus, /native Android WebView file transfer UAT/);
    assert.doesNotMatch(targetStatus, /mobile file-picker\/share-sheet integration, Bluetooth/);
});
