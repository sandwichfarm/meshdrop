import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ciWorkflow = fs.readFileSync(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");

function assertRuntimeChangeGate(jobName) {
    const escaped = jobName.replaceAll("-", "\\-");
    assert.match(ciWorkflow, new RegExp(`${escaped}:\\n(?:    .+\\n)+    needs: \\[ci-change-scope, unit\\]`));
    assert.match(ciWorkflow, new RegExp(`${escaped}:\\n(?:    .+\\n)+    if: needs\\.ci-change-scope\\.outputs\\.runtime == 'true'`));
}

test("CI classifies runtime-affecting changes before expensive runtime jobs", () => {
    assert.match(ciWorkflow, /ci-change-scope:/);
    assert.match(ciWorkflow, /name: CI change scope/);
    assert.match(ciWorkflow, /runtime: \$\{\{ steps\.classify\.outputs\.runtime \}\}/);
    assert.match(ciWorkflow, /\$\{\{ github\.event_name \}\}" == "workflow_dispatch"/);
    assert.match(ciWorkflow, /runtime=true/);
    assert.match(ciWorkflow, /public\/\*\*/);
    assert.match(ciWorkflow, /server\/\*\*/);
    assert.match(ciWorkflow, /scripts\/\*\*/);
    assert.match(ciWorkflow, /packaging\/\*\*/);
    assert.match(ciWorkflow, /package-lock\.json/);
    assert.match(ciWorkflow, /Dockerfile/);
    assert.match(ciWorkflow, /docker-compose\.yml/);
});

test("CI gates baseline browser and Docker runtime smokes by change scope", () => {
    assert.match(ciWorkflow, /browser-transfer:/);
    assert.match(ciWorkflow, /name: Browser transfer smoke/);
    assertRuntimeChangeGate("browser-transfer");
    assert.match(ciWorkflow, /spa-browser-matrix:/);
    assert.match(ciWorkflow, /name: SPA browser matrix/);
    assertRuntimeChangeGate("spa-browser-matrix");
    assert.match(ciWorkflow, /docker-smoke:/);
    assert.match(ciWorkflow, /name: Docker smoke/);
    assertRuntimeChangeGate("docker-smoke");
    assert.match(ciWorkflow, /docker-smoke:\n(?:    .+\n)+    timeout-minutes: 35/);
});

test("CI runs desktop and mobile target artifact transfer smoke", () => {
    assert.match(ciWorkflow, /Install desktop native shell dependencies/);
    assert.match(ciWorkflow, /libgtk-4-dev libwebkitgtk-6\.0-dev/);
    assert.match(ciWorkflow, /target-artifacts:/);
    assert.match(ciWorkflow, /name: Target artifact transfer smoke/);
    assertRuntimeChangeGate("target-artifacts");
    assert.match(ciWorkflow, /npx playwright install --with-deps chromium/);
    assert.match(ciWorkflow, /npm run test:target-artifacts/);
});

test("CI proves Desktop Chromium shell transfers and signed installer", () => {
    assert.match(ciWorkflow, /desktop-chromium-shell:/);
    assert.match(ciWorkflow, /name: Desktop Chromium shell and installer smoke/);
    assertRuntimeChangeGate("desktop-chromium-shell");
    assert.match(ciWorkflow, /npx playwright install --with-deps chromium/);
    assert.match(ciWorkflow, /npm run test:desktop-chromium/);
    assert.match(ciWorkflow, /npm run test:desktop-chromium-bundled/);
    assert.match(ciWorkflow, /npm run test:desktop-installer/);
});

test("CI builds mobile native-source artifacts through package scripts", () => {
    assert.match(ciWorkflow, /mobile-native-source-artifacts:/);
    assert.match(ciWorkflow, /name: Mobile native source artifact smoke/);
    assertRuntimeChangeGate("mobile-native-source-artifacts");
    assert.match(ciWorkflow, /npm run build:ios:native-source -- --version 0\.0\.0-ci --out-dir "\$\{out_dir\}"/);
    assert.match(ciWorkflow, /npm run build:android:native-source -- --version 0\.0\.0-ci --out-dir "\$\{out_dir\}"/);
    assert.match(ciWorkflow, /meshdrop-ios-native-source-0\.0\.0-ci\.tar\.gz/);
    assert.match(ciWorkflow, /MeshDropViewController\.swift/);
    assert.match(ciWorkflow, /Resources\/meshdrop\/index\.html/);
    assert.match(ciWorkflow, /meshdrop-android-native-source-0\.0\.0-ci\.tar\.gz/);
    assert.match(ciWorkflow, /AndroidManifest\.xml/);
    assert.match(ciWorkflow, /MainActivity\.java/);
    assert.match(ciWorkflow, /assets\/meshdrop\/index\.html/);
});

test("CI proves generated iOS native source builds with Xcode", () => {
    assert.match(ciWorkflow, /ios-xcode-build:/);
    assert.match(ciWorkflow, /name: iOS Xcode native-source, simulator app, and device app smoke/);
    assert.match(ciWorkflow, /runs-on: macos-15/);
    assertRuntimeChangeGate("ios-xcode-build");
    assert.match(ciWorkflow, /npm run test:ios-xcode-build/);
    assert.match(ciWorkflow, /npm run test:ios-simulator-app/);
    assert.match(ciWorkflow, /npm run test:ios-device-app/);
});

test("CI builds Android APK artifact through package script", () => {
    assert.match(ciWorkflow, /android-apk-artifact:/);
    assert.match(ciWorkflow, /name: Android APK artifact smoke/);
    assertRuntimeChangeGate("android-apk-artifact");
    assert.match(ciWorkflow, /npm run test:android-apk/);
});

test("CI proves Android WebView capability and picker UI through an emulator", () => {
    assert.match(ciWorkflow, /android-webview-emulator:/);
    assert.match(ciWorkflow, /name: Android WebView emulator smokes/);
    assertRuntimeChangeGate("android-webview-emulator");
    assert.match(ciWorkflow, /sdkmanager="\$\{ANDROID_HOME\}\/cmdline-tools\/latest\/bin\/sdkmanager"/);
    assert.match(ciWorkflow, /ANDROID_AVD_HOME="\$\{RUNNER_TEMP\}\/android-avd"/);
    assert.match(ciWorkflow, /echo "ANDROID_AVD_HOME=\$\{ANDROID_AVD_HOME\}" >> "\$\{GITHUB_ENV\}"/);
    assert.match(ciWorkflow, /"\$\{sdkmanager\}" "platform-tools" "emulator" "platforms;android-36" "system-images;android-36;google_apis;x86_64"/);
    assert.match(ciWorkflow, /avdmanager="\$\{ANDROID_HOME\}\/cmdline-tools\/latest\/bin\/avdmanager"/);
    assert.match(ciWorkflow, /"\$\{avdmanager\}" create avd/);
    assert.match(ciWorkflow, /MESHDROP_ANDROID_AVD: meshdrop_ci_api_36/);
    assert.match(ciWorkflow, /MESHDROP_ANDROID_EMULATOR_PORT: "5554"/);
    assert.match(ciWorkflow, /MESHDROP_ANDROID_BOOT_TIMEOUT_MS: "300000"/);
    assert.match(ciWorkflow, /npm run test:android-webview-capabilities/);
    assert.match(ciWorkflow, /npm run test:android-picker-ui/);
});

test("CI builds Android release APK artifact through package script", () => {
    assert.match(ciWorkflow, /android-release-apk-artifact:/);
    assert.match(ciWorkflow, /name: Android release APK artifact smoke/);
    assertRuntimeChangeGate("android-release-apk-artifact");
    assert.match(ciWorkflow, /npm run test:android-release-apk/);
});
