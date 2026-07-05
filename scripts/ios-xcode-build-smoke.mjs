import {prepareIosNativeSource, runIosSimulatorBuild} from "./ios-xcode-smoke-helpers.mjs";

async function main() {
    const version = process.env.MESHDROP_IOS_XCODE_SMOKE_VERSION || "0.0.0-xcode-smoke";
    const prepared = await prepareIosNativeSource({
        version,
        smokeName: "ios-xcode-smoke",
        buildId: "ios-xcode-smoke"
    });

    try {
        await runIosSimulatorBuild({projectPath: prepared.projectPath});

        console.log(`Proof ios-xcode-build:${version}: MeshDrop scheme builds for iOS Simulator without code signing`);
    }
    finally {
        await prepared.cleanup();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
