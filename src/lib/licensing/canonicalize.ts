/**
 * Canonical-JSON serialization for the `orionfold.license/v1` contract.
 *
 * This is a VERBATIM port of the `canonicalization_js` reference committed in
 * the shared conformance vector (`license-conformance-v1.json`), which is the
 * authoritative cross-language form. The Python issuer signs over
 * `json.dumps(payload, sort_keys=True, separators=(",",":"), ensure_ascii=False)`;
 * this reproduces the identical bytes in JS so signatures verify offline.
 *
 * The four rules it must satisfy (validated against the vector's per-case
 * `canonical_utf8` + `canonical_sha256_12`):
 *   1. sort object keys at EVERY level (recursive)
 *   2. no inter-token whitespace (compact)
 *   3. UTF-8, emit non-ASCII raw (ensure_ascii=False)
 *   4. no floats anywhere (ints/bool/null/string/list/object only)
 *
 * Do NOT "improve" this — any deviation drifts the bytes and silently breaks
 * every signature. The conformance test is the contract.
 */
function canonicalize(v: unknown): string {
  if (Array.isArray(v)) {
    return "[" + v.map(canonicalize).join(",") + "]";
  }
  if (v && typeof v === "object") {
    return (
      "{" +
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonicalize((v as Record<string, unknown>)[k])
        )
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(v);
}

/**
 * Canonical UTF-8 bytes of a license payload — the exact bytes that were
 * signed. Callers verify Ed25519 over THIS, never over the pretty-printed
 * on-disk envelope.
 */
export function canonicalBytes(payload: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(payload));
}
