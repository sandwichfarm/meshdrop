import { sdk } from "./sdk.js";
import { meshdropImageId, uiPort } from "./utils.js";

export const main = sdk.setupMain(async ({ effects }) => {
  return sdk.Daemons.of(effects).addDaemon("meshdrop", {
    subcontainer: await sdk.SubContainer.of(
      effects,
      { imageId: meshdropImageId },
      sdk.Mounts.of().mountVolume({
        volumeId: "main",
        subpath: null,
        mountpoint: "/data",
        readonly: false
      }),
      "meshdrop"
    ),
    exec: {
      command: ["scripts/start-with-fips.sh"],
      env: {
        NODE_ENV: "production",
        MESHDROP_TARGET: "start9",
        PORT: `${uiPort}`,
        RATE_LIMIT: "false",
        WS_FALLBACK: "false",
        NOSTR_RELAYS: "wss://bucket.coracle.social",
        MESHDROP_ADMIN_NPUB: "",
        BLOSSOM_SERVERS: "",
        FIPS_DISCOVERY: "false",
        POLLEN_TRANSFER: "true",
        PLN_DIR: "/data/pln",
        POLLEN_PORT: "60611"
      }
    },
    ready: {
      display: "Web Interface",
      fn: () =>
        sdk.healthCheck.checkPortListening(effects, uiPort, {
          successMessage: "MeshDrop web interface is ready",
          errorMessage: "MeshDrop web interface is not reachable"
        })
    },
    requires: []
  });
});
