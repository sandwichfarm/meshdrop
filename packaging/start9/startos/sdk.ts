import { StartSdk } from "@start9labs/start-sdk";

import { staticManifest } from "./manifest/index.js";

export const sdk = StartSdk.of().withManifest(staticManifest).build(true);
