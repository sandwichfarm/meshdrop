import { sdk } from "./sdk.js";

export const { createBackup, restoreInit } = sdk.setupBackups(async () => sdk.Backups.ofVolumes("main"));
