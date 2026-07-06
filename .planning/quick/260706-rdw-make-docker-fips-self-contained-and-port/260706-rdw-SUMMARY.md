---
status: complete
date: 2026-07-06
---

# Summary

Made Docker FIPS self-contained by installing upstream `jmcorgan/fips` v0.4.0 Linux release tarballs during the image
build. The Dockerfile now maps Docker `amd64`/`arm64` to upstream `x86_64`/`aarch64`, downloads `checksums-linux.txt`,
verifies the tarball with `sha256sum`, installs `fips` and `fipsctl` into `/usr/local/bin`, runs both `--version`
commands at build time, and fails fast for unsupported architectures.

Removed the host `/usr/bin/fips` and `/usr/bin/fipsctl` bind mounts from `docker-compose.yml`. Compose now only mounts
`fips.yaml`, keeps `/dev/net/tun` and `NET_ADMIN`, and runs with the image-owned binaries. Startup now requires both
`fips` and `fipsctl` before starting the daemon, with a clearer missing-tool/config log.

Added regression coverage to keep Docker from returning to host-mounted FIPS binaries. `npm run test:docker` now also
checks that the built image contains `fips` and `fipsctl` under `/usr/local/bin`.

Evidence:

- Upstream research: official `jmcorgan/fips` v0.4.0 release exposes Linux `fips-0.4.0-linux-x86_64.tar.gz`,
  `fips-0.4.0-linux-aarch64.tar.gz`, and `checksums-linux.txt`; local tarball inspection confirmed `fips` and
  `fipsctl` are present and `--version` works without a daemon.
- Red regression: `node --test test/docker-smoke-script.test.js` failed before implementation on missing
  `ARG FIPS_VERSION=v0.4.0`.
- Focused regression after implementation: `node --test test/docker-smoke-script.test.js` passed, 2/2.
- `docker compose build --no-cache` passed; build log showed
  `fips-0.4.0-linux-x86_64.tar.gz: OK`, `fips 0.4.0 (rev d5ee526f0e)`, and
  `fipsctl 0.4.0 (rev d5ee526f0e)`.
- `docker compose up -d --force-recreate` started container `meshdrop` from this worktree after removing the stale
  old `meshdrop` container that still had host `/usr/bin/fips` mounts.
- `docker logs meshdrop` showed `Starting FIPS daemon with /etc/fips/fips.yaml`, `FIPS 0.4.0`, `TUN device active`,
  `Control socket listening path=/run/fips/control.sock`, and `FIPS running`.
- `docker exec meshdrop sh -lc 'command -v fips && command -v fipsctl && test -f /etc/fips/fips.yaml && fips --version && fipsctl --version'`
  passed and printed `/usr/local/bin/fips`, `/usr/local/bin/fipsctl`, and both v0.4.0 versions.
- `curl -fsS http://127.0.0.1:3000/fips/status` returned `enabled: true`, `available: true`, an npub, and an IPv6
  address from the live daemon.
- `docker inspect meshdrop --format '{{json .Mounts}}'` showed only the repo `fips.yaml` bind mount and Pollen data
  volume, with no `/usr/bin/fips` or `/usr/bin/fipsctl` bind mount.
- `npm run test:docker` passed, including image binary checks plus local, Pollen, admin, and two-host Nostr transfer
  proofs.
- `npm test` passed, 249/249.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean, 100/100.
- `npx --yes aislop scan .` still fails on pre-existing baseline warnings outside touched files: noble-ciphers unused
  expressions, duplicate code blocks, large files, long functions, hardcoded URL, TODO/info findings.

Known gap:

- No arm64 Docker build was run locally. The Dockerfile has an explicit arm64 mapping to the upstream aarch64 tarball
  and fails closed for any other architecture.
