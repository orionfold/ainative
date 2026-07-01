import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { SignedLicense } from "./verify";

/**
 * Load a `{ payload, signature }` license envelope from `--license-url`.
 *
 * Accepts a local filesystem path, a `file://` URL, or an `http(s)://` URL
 * (the fulfilment email hands the buyer a signed bucket URL). Verification is
 * 100% offline — fetching just retrieves the bytes; the trust check is the
 * embedded-key Ed25519 verify (see ./verify), never a server round-trip.
 *
 * Fails loudly with a named LicenseLoadError on any acquisition or shape fault
 * (Principle #1/#2). Shape validation here is structural only — the real
 * authenticity gate is the signature verify downstream.
 */
export class LicenseLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LicenseLoadError";
  }
}

function assertEnvelope(value: unknown, origin: string): SignedLicense {
  if (!value || typeof value !== "object") {
    throw new LicenseLoadError(`License at ${origin} is not a JSON object.`);
  }
  const v = value as Record<string, unknown>;
  if (!("payload" in v) || v.payload == null) {
    throw new LicenseLoadError(`License at ${origin} has no payload.`);
  }
  const sig = v.signature;
  if (
    !sig ||
    typeof sig !== "object" ||
    typeof (sig as Record<string, unknown>).alg !== "string" ||
    typeof (sig as Record<string, unknown>).key_id !== "string" ||
    typeof (sig as Record<string, unknown>).value !== "string"
  ) {
    throw new LicenseLoadError(
      `License at ${origin} is missing a well-formed { alg, key_id, value } signature.`
    );
  }
  return v as unknown as SignedLicense;
}

function parse(text: string, origin: string): SignedLicense {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new LicenseLoadError(`License at ${origin} is not valid JSON.`, err);
  }
  return assertEnvelope(parsed, origin);
}

export async function loadLicense(urlOrPath: string): Promise<SignedLicense> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    let res: Response;
    try {
      res = await fetch(urlOrPath);
    } catch (err) {
      throw new LicenseLoadError(
        `Could not fetch license from ${urlOrPath}.`,
        err
      );
    }
    if (!res.ok) {
      throw new LicenseLoadError(
        `Fetching license from ${urlOrPath} failed: HTTP ${res.status}.`
      );
    }
    return parse(await res.text(), urlOrPath);
  }

  // Local path or file:// URL.
  const filePath = urlOrPath.startsWith("file://")
    ? fileURLToPath(urlOrPath)
    : urlOrPath;
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new LicenseLoadError(
      `Could not read license file at ${filePath}.`,
      err
    );
  }
  return parse(text, filePath);
}
