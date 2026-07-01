import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { canonicalBytes } from "../canonicalize";
import vector from "./fixtures/license-conformance-v1.json";

/**
 * Acceptance gate for the canonical-JSON port. The shared conformance vector
 * (owned by Website/Proof) carries 4 named cases, each with the exact
 * `canonical_utf8` string and a `canonical_sha256_12` drift-hash. Our TS
 * canonicalizer MUST reproduce both byte-for-byte for every case — otherwise
 * every cross-language signature silently fails. We do NOT re-derive the rules
 * from prose; we reproduce the committed reference.
 */
describe("canonicalBytes — conformance vector", () => {
  for (const c of vector.cases) {
    it(`reproduces canonical_utf8 for case "${c.name}"`, () => {
      const bytes = canonicalBytes(c.payload);
      expect(new TextDecoder().decode(bytes)).toBe(c.canonical_utf8);
    });

    it(`reproduces canonical_sha256_12 for case "${c.name}"`, () => {
      const bytes = canonicalBytes(c.payload);
      const hash = crypto
        .createHash("sha256")
        .update(bytes)
        .digest("hex")
        .slice(0, 12);
      expect(hash).toBe(c.canonical_sha256_12);
    });
  }
});
