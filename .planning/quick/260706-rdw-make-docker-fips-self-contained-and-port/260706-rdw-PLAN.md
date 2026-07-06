---
quick_id: 260706-rdw
status: planned
date: 2026-07-06
slug: make-docker-fips-self-contained-and-port
must_haves:
  truths:
    - Docker image carries fips and fipsctl in /usr/local/bin.
    - docker-compose.yml does not bind-mount host fips binaries.
    - FIPS_DISCOVERY=true starts from compose when fips.yaml is mounted.
    - Unsupported Docker architectures fail during build instead of runtime.
  artifacts:
    - Dockerfile
    - docker-compose.yml
    - scripts/start-with-fips.sh
    - scripts/docker-smoke.mjs
    - tests/docs for Docker FIPS portability
  key_links:
    - https://github.com/jmcorgan/fips/releases/tag/v0.4.0
---

# Quick Task 260706-rdw: Docker FIPS Self-Contained Packaging

## Research

Official upstream FIPS v0.4.0 publishes Linux `x86_64` and `aarch64` tarballs plus `checksums-linux.txt`.
The release notes also document source/Nix build paths, but Docker can use release tarballs for the supported
Linux container architectures and fail clearly for everything else.

## Tasks

1. Lock Docker portability behavior.
   - Files: `test/docker-smoke-script.test.js`
   - Action: Assert Dockerfile packages FIPS with checksum verification, compose has no host binary mounts, and smoke checks in-container binaries/logs.
   - Verify: focused `node --test test/docker-smoke-script.test.js` fails before implementation and passes after.
   - Done: tests cover the regression directly.

2. Package FIPS in the image and remove host binary assumptions.
   - Files: `Dockerfile`, `docker-compose.yml`, `scripts/start-with-fips.sh`, `scripts/docker-smoke.mjs`
   - Action: Add architecture-aware FIPS release download/checksum/install/version proof, remove host fips/fipsctl binds, keep config/TUN/NET_ADMIN mounts, and make smoke inspect binaries plus startup logs.
   - Verify: Docker build and compose runtime proof show FIPS daemon start without host binary mounts.
   - Done: `command -v fips`, `command -v fipsctl`, and logs prove image-owned binaries.

3. Update operator docs and GSD summary.
   - Files: `docs/uat/docker.md`, `.planning/STATE.md`, `.planning/quick/.../SUMMARY.md`
   - Action: Document self-contained FIPS packaging and current proof/gaps.
   - Verify: `git diff --check`, `npm test`, Docker smoke, AI-slop scans.
   - Done: completion evidence is recorded before commit.
