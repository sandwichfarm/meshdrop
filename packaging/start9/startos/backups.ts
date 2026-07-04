import { sdk } from "./sdk";

export const backups = sdk.setupBackups(async () => ({
  volumes: ["main"],
  exclusions: []
}));
