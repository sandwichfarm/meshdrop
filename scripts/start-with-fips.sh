#!/bin/sh
set -eu

fips_pid=""
pollen_pid=""
app_pid=""

shutdown() {
    if [ -n "$app_pid" ]; then
        kill "$app_pid" 2>/dev/null || true
    fi
    if [ -n "$pollen_pid" ]; then
        kill "$pollen_pid" 2>/dev/null || true
    fi
    if [ -n "$fips_pid" ]; then
        kill "$fips_pid" 2>/dev/null || true
    fi
}

trap shutdown INT TERM

node scripts/set-service-worker-version.mjs

if [ "${FIPS_DISCOVERY:-true}" != "false" ]; then
    mkdir -p /run/fips

    if command -v fips >/dev/null 2>&1 && command -v fipsctl >/dev/null 2>&1 && [ -f "${FIPS_CONFIG:-/etc/fips/fips.yaml}" ]; then
        echo "Starting FIPS daemon with ${FIPS_CONFIG:-/etc/fips/fips.yaml}"
        fips --config "${FIPS_CONFIG:-/etc/fips/fips.yaml}" &
        fips_pid="$!"
    else
        echo "FIPS daemon not started: fips or fipsctl binary or config file is missing"
    fi
fi

if [ "${POLLEN_TRANSFER:-true}" != "false" ]; then
    if command -v pln >/dev/null 2>&1; then
        export PLN_DIR="${PLN_DIR:-/var/lib/meshdrop/pln}"
        mkdir -p "$PLN_DIR"

        if [ "${POLLEN_NOSTR_CLUSTER_BOOTSTRAP:-true}" != "false" ] \
            && [ -n "${MESHDROP_DISCOVERY_NPUBS:-${MESHDROP_NPUBS:-}}" ] \
            && [ ! -f "$PLN_DIR/keys/delegation.cert.pb" ]; then
            export POLLEN_DAEMON_DEFERRED=1
            echo "Deferring Pollen daemon: waiting for MeshDrop Nostr cluster bootstrap"
        else
            echo "Starting Pollen daemon with PLN_DIR=$PLN_DIR"
            set -- up --name "${POLLEN_NAME:-meshdrop}" --port "${POLLEN_PORT:-60611}"
            if [ "${POLLEN_PUBLIC:-false}" = "true" ]; then
                set -- "$@" --public
            fi
            if [ -n "${POLLEN_IPS:-}" ]; then
                set -- "$@" --ips "${POLLEN_IPS}"
            fi
            pln "$@" &
            pollen_pid="$!"
        fi
    else
        echo "Pollen daemon not started: pln binary is missing"
    fi
fi

npm start &
app_pid="$!"

wait "$app_pid"
