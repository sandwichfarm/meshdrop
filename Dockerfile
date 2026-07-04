FROM node:22-trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libdbus-1-3 \
        libsystemd0 \
    && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH
ARG PLN_VERSION=v0.0.1-dev.21
RUN set -eux; \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "$arch" in amd64|arm64) ;; *) echo "unsupported pln arch: $arch" >&2; exit 1 ;; esac; \
    version="${PLN_VERSION#v}"; \
    asset="pln_${version}_linux_${arch}.tar.gz"; \
    base_url="https://github.com/sambigeara/pollen/releases/download/${PLN_VERSION}"; \
    tmp_dir="$(mktemp -d)"; \
    curl -fsSL "${base_url}/checksums.txt" -o "${tmp_dir}/checksums.txt"; \
    curl -fsSL "${base_url}/${asset}" -o "${tmp_dir}/${asset}"; \
    grep " ${asset}$" "${tmp_dir}/checksums.txt" | (cd "${tmp_dir}" && sha256sum -c -); \
    tar -xzf "${tmp_dir}/${asset}" -C /usr/local/bin pln; \
    chmod 0755 /usr/local/bin/pln; \
    rm -rf "${tmp_dir}"; \
    pln version

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

RUN NODE_ENV="production" npm ci --omit=dev

# Directories and files excluded via .dockerignore
COPY --chown=node:node . .
ARG MESH_DROP_COMMIT=nogit
ENV MESH_DROP_COMMIT="${MESH_DROP_COMMIT}"
RUN MESH_DROP_COMMIT="${MESH_DROP_COMMIT}" node scripts/set-service-worker-version.mjs \
    && chmod +x scripts/start-with-fips.sh

# environment settings
ENV NODE_ENV="production"
ENV FIPS_CONFIG="/etc/fips/fips.yaml"
ENV PLN_DIR="/var/lib/meshdrop/pln"
ENV POLLEN_TRANSFER="true"
ENV POLLEN_PORT="60611"

EXPOSE 3000
EXPOSE 2121/udp
EXPOSE 8443/tcp
EXPOSE 60611/udp

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["scripts/start-with-fips.sh"]
