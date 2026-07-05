class NostrPubkey {

    static pubkeyRegex = /^[0-9a-f]{64}$/i;
    static bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

    static normalize(pubkey, source = "NIP-07 signer") {
        if (typeof pubkey !== "string") throw new Error(`${source} returned a non-string public key`);

        const trimmed = pubkey.trim();
        if (NostrPubkey.pubkeyRegex.test(trimmed)) return trimmed.toLowerCase();
        if (trimmed.toLowerCase().startsWith("npub1")) return NostrPubkey.npubToHex(trimmed, source);

        throw new Error(`${source} returned an invalid public key`);
    }

    static npubToHex(npub, source) {
        const decoded = NostrPubkey.bech32Decode(npub, source);
        if (decoded.hrp !== "npub") throw new Error(`${source} returned an invalid npub public key`);

        const bytes = NostrPubkey.convertBits(decoded.words, 5, 8, false, source);
        if (bytes.length !== 32) throw new Error(`${source} returned an invalid npub public key`);

        return bytes.map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    static bech32Decode(value, source) {
        const bech32 = value.toLowerCase();
        const separator = bech32.lastIndexOf("1");
        if (separator < 1) throw new Error(`${source} returned an invalid npub public key`);

        const hrp = bech32.slice(0, separator);
        const data = bech32.slice(separator + 1);
        const values = [...data].map(char => NostrPubkey.bech32Charset.indexOf(char));
        if (values.includes(-1) || values.length < 6) {
            throw new Error(`${source} returned an invalid npub public key`);
        }

        if (!NostrPubkey.bech32VerifyChecksum(hrp, values)) {
            throw new Error(`${source} returned an invalid npub checksum`);
        }

        return {hrp, words: values.slice(0, -6)};
    }

    static bech32VerifyChecksum(hrp, values) {
        return NostrPubkey.bech32Polymod([...NostrPubkey.bech32HrpExpand(hrp), ...values]) === 1;
    }

    static bech32HrpExpand(hrp) {
        const highBits = [...hrp].map(char => char.charCodeAt(0) >> 5);
        const lowBits = [...hrp].map(char => char.charCodeAt(0) & 31);
        return [...highBits, 0, ...lowBits];
    }

    static bech32Polymod(values) {
        const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        let chk = 1;

        for (const value of values) {
            const top = chk >> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ value;
            for (let i = 0; i < generators.length; i++) {
                if ((top >> i) & 1) chk ^= generators[i];
            }
        }

        return chk;
    }

    static convertBits(data, fromBits, toBits, pad, source) {
        let accumulator = 0;
        let bits = 0;
        const result = [];
        const maxValue = (1 << toBits) - 1;
        const maxAccumulator = (1 << (fromBits + toBits - 1)) - 1;

        for (const value of data) {
            if (value < 0 || (value >> fromBits) !== 0) {
                throw new Error(`${source} returned an invalid npub public key`);
            }
            accumulator = ((accumulator << fromBits) | value) & maxAccumulator;
            bits += fromBits;
            while (bits >= toBits) {
                bits -= toBits;
                result.push((accumulator >> bits) & maxValue);
            }
        }

        if (pad) {
            if (bits > 0) result.push((accumulator << (toBits - bits)) & maxValue);
        } else if (bits >= fromBits || ((accumulator << (toBits - bits)) & maxValue)) {
            throw new Error(`${source} returned an invalid npub public key`);
        }

        return result;
    }
}

globalThis.NostrPubkey = NostrPubkey;
