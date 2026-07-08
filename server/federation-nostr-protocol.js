export const FEDERATION_KIND = 20385;
export const FIPS_FEDERATION_PROTOCOL = "meshdrop-fips-nostr-discovery";
export const POLLEN_FEDERATION_PROTOCOL = "meshdrop-pollen-nostr-discovery";
export const DISCOVERY_FAILURE_BACKOFF_MS = 60_000;
export const errorMessage = error => error?.message || String(error);
export const noop = () => undefined;
