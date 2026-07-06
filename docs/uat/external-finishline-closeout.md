# External UAT Finish-Line Closeout

This guide is for the release operator closing the remaining external UAT gaps from a MacBook.

After reading it, you should be able to make `npm run test:external-uat -- v0.1.5` print
`Proof external-uat-finishline`.

## What This Closes

The final verifier proves four external surfaces in one run:

- Start9 installed-device UAT.
- Umbrel installed-node UAT.
- iOS signed physical-device UAT from macOS/Xcode.
- Anonymous GHCR readback for the release images.

Android physical-device UAT is not part of this final verifier because the current target ledger already records a
passing physical-device run. If you want to refresh that evidence, connect an Android device and run the optional
Android step below.

## Start From Current Master

```sh
git fetch origin
git checkout master
git pull --ff-only origin master
npm ci
```

Check the current failing state:

```sh
npm run test:external-uat -- v0.1.5
```

Do not call the finish line closed until this command prints `Proof external-uat-finishline`.

## Make GHCR Publicly Readable

Refresh the GitHub CLI token with package-read access:

```sh
gh auth refresh -h github.com -s read:packages
gh auth status
```

Prove the token can inspect the package:

```sh
gh api /orgs/sandwichfarm/packages/container/meshdrop --jq '{name,visibility,html_url}'
```

Then make the package public in the GitHub web UI:

1. Open the `sandwichfarm` organization on GitHub.
2. Open Packages.
3. Open the `meshdrop` container package.
4. Open package settings.
5. Change visibility to public.

GitHub documents that public Container registry packages allow anonymous access, while most other GitHub Packages
registries require authentication even for public packages. It also warns that making a package public is irreversible:
https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility

Verify anonymous readback:

```sh
npm run verify:ghcr-anonymous -- v0.1.5
```

Pass condition: the command checks every `standalone`, `start9`, and `umbrel` tag pair for `linux/amd64` and
`linux/arm64` without using your Docker login state.

## Close Start9

Install MeshDrop on the real StartOS device. Get the service URL that your MacBook can reach.

Smoke the URL first:

```sh
export MESHDROP_START9_UAT_URL="https://your-start9-service-url"
curl -fsS "$MESHDROP_START9_UAT_URL/config" | jq .
```

Run the deployed-device UAT:

```sh
MESHDROP_START9_UAT_URL="$MESHDROP_START9_UAT_URL" npm run test:start9-deployed
```

Pass condition: `Proof start9-deployed-device-webrtc`.

## Close Umbrel

Install MeshDrop on the real Umbrel node. Get the service URL that your MacBook can reach.

Smoke the URL first:

```sh
export MESHDROP_UMBREL_UAT_URL="http://your-umbrel-service-url"
curl -fsS "$MESHDROP_UMBREL_UAT_URL/config" | jq .
```

Run the deployed-node UAT:

```sh
MESHDROP_UMBREL_UAT_URL="$MESHDROP_UMBREL_UAT_URL" npm run test:umbrel-deployed
```

Pass condition: `Proof umbrel-deployed-device-webrtc`.

## Close iOS On MacBook

Install Xcode on the MacBook. Then select it for command-line tools:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
xcrun devicectl list devices
```

Apple documents `devicectl` as the Xcode command-line tool for managing devices connected to the host:
https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference

Prepare the iPhone:

1. Enable Developer Mode.
2. Connect by USB.
3. Trust this Mac.
4. Confirm the device appears in `xcrun devicectl list devices`.

Find your Apple Developer Team ID and the physical device UDID, then run:

```sh
MESHDROP_IOS_DEVELOPMENT_TEAM="<team-id>" \
MESHDROP_IOS_DEVICE_UDID="<device-udid>" \
npm run test:ios-signed-device
```

Pass condition: `Proof ios-signed-device-install`.

## Optional Android Refresh

The final external verifier does not require Android. Use this only if you want to refresh the physical Android record.

Connect the Android device and enable USB debugging:

```sh
adb devices -l
npm run test:android-physical-device
```

Pass condition: `Proof android-physical-device-uat`.

## Run The Final Gate

After the individual Start9, Umbrel, iOS, and GHCR checks pass:

```sh
MESHDROP_START9_UAT_URL="https://your-start9-service-url" \
MESHDROP_UMBREL_UAT_URL="http://your-umbrel-service-url" \
MESHDROP_IOS_DEVELOPMENT_TEAM="<team-id>" \
MESHDROP_IOS_DEVICE_UDID="<device-udid>" \
npm run test:external-uat -- v0.1.5
```

Pass condition:

```text
Proof external-uat-finishline
```

## Evidence To Save

Save the full command output for these checks:

```sh
npm run verify:ghcr-anonymous -- v0.1.5
MESHDROP_START9_UAT_URL=... npm run test:start9-deployed
MESHDROP_UMBREL_UAT_URL=... npm run test:umbrel-deployed
MESHDROP_IOS_DEVELOPMENT_TEAM=... MESHDROP_IOS_DEVICE_UDID=... npm run test:ios-signed-device
npm run test:external-uat -- v0.1.5
```

Record the final proof in the target UAT status ledger and release notes only after the final command passes.
