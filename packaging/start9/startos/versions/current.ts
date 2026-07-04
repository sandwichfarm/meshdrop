import { IMPOSSIBLE, VersionInfo } from "@start9labs/start-sdk";

export const current = VersionInfo.of({
  version: "__MESHDROP_EXVER__",
  releaseNotes: {
    en_US: "Initial MeshDrop StartOS package source."
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE
  }
});
