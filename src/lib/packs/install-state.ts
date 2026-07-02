import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Install-state sidecar — `<appsDir>/<id>/install-state.json`, written by
 * `installPack` after a successful install/update. It records WHAT version
 * landed and the sha256 of every dropped artifact at its DESTINATION path, so
 * `pack update` can (a) compare versions without re-reading the pack source
 * and (b) detect user-edited files to back up before overwriting.
 *
 * Read is FAIL-OPEN by design: a missing or corrupt sidecar means "version
 * unknown, treat every file as potentially user-modified" — pre-0.21 installs
 * (which never wrote one) must update safely, and a broken sidecar must never
 * block an update (it degrades to backup-everything, not refusal).
 *
 * The machine-written manifest.yaml is deliberately NOT tracked here — it is
 * regenerated on every install, so it is never "user-modified".
 */

export const InstallStateSchema = z
  .object({
    packVersion: z.string().min(1),
    installedAt: z.string().min(1),
    /** Dropped-artifact relPath (pack space, e.g. "profiles/x--y/SKILL.md") → sha256 hex of the DEST bytes. */
    files: z.record(z.string(), z.string()),
  })
  .strict();

export type InstallState = z.infer<typeof InstallStateSchema>;

export function installStatePath(appsDir: string, appId: string): string {
  return path.join(appsDir, appId, "install-state.json");
}

/** Fail-open read: missing/corrupt/schema-invalid all return null. */
export function readInstallState(
  appsDir: string,
  appId: string
): InstallState | null {
  try {
    const raw = fs.readFileSync(installStatePath(appsDir, appId), "utf-8");
    const parsed = InstallStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Atomic temp-rename write, mirroring the manifest writer's discipline. */
export function writeInstallState(
  appsDir: string,
  appId: string,
  state: InstallState
): void {
  const dir = path.join(appsDir, appId);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.install-state.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  fs.renameSync(tmp, installStatePath(appsDir, appId));
}

export function hashFileSha256(absPath: string): string {
  return createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}
