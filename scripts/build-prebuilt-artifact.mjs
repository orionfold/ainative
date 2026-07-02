// Build the downloadable production-build artifact for a release
// (feat-ship-production-build-for-npx, #10).
//
// Packs the repo's `.next` output — minus dev/deploy-only paths — into
// dist-artifacts/relay-next-build-<version>.tgz plus a .sha256 sidecar, ready
// for `gh release upload`. Run `npm run build` first (CI does; locally the
// script refuses to run without a BUILD_ID rather than tar half a build).
//
// The prune list is the Tauri-era desktop list (scripts/tauri.mjs at 172fedb1)
// plus *.nft.json: those are output-file-tracing manifests for deployment
// platforms; `next start` never reads them and they were ~26 MB of the 41 MB
// artifact when measured (2026-07-01).
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tar from "tar";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(repoRoot, ".next");
const outDir = path.join(repoRoot, "dist-artifacts");
const MAX_GZIPPED_BYTES = 50 * 1024 * 1024; // acceptance criterion: ≤ 50 MB

const PRUNED_TOP_LEVEL = new Set([
  "cache",
  "dev",
  "diagnostics",
  "trace",
  "trace-build",
  "turbopack",
  "types",
  // Symlinks to serverExternalPackages (better-sqlite3, sharp, ...). Windows
  // can't extract symlink tar entries without privileges, so the artifact
  // ships a manifest instead and the CLI recreates the links at extract time
  // (relinkExternalPackages in src/lib/desktop/prebuilt-download.ts).
  "node_modules",
]);

/**
 * Record .next/node_modules/<pkg>-<hash> → <package path> so the CLI can
 * rebuild the links on the customer's machine. The compiled server chunks
 * require() the hashed names at runtime, so losing one is a launch-breaking
 * bug — anything unexpected here fails the build rather than shipping quietly.
 */
function buildExternalPackagesManifest() {
  const linksDir = path.join(nextDir, "node_modules");
  const links = {};
  if (existsSync(linksDir)) {
    for (const entry of readdirSync(linksDir)) {
      const entryPath = path.join(linksDir, entry);
      if (!lstatSync(entryPath).isSymbolicLink()) {
        console.error(
          `${entryPath} is not a symlink — Next changed how it emits external ` +
            `packages. Update build-prebuilt-artifact.mjs + relinkExternalPackages before shipping.`,
        );
        process.exit(1);
      }
      const target = readlinkSync(entryPath).replace(/\\/g, "/");
      const marker = "node_modules/";
      const markerIndex = target.lastIndexOf(marker);
      if (markerIndex === -1) {
        console.error(`${entryPath} points outside node_modules (${target}) — refusing to ship.`);
        process.exit(1);
      }
      links[entry] = target.slice(markerIndex + marker.length);
    }
  }
  return { version: 1, links };
}

function shouldInclude(entryPath) {
  // tar filter paths look like ".next", ".next/server/app.js", ...
  const relative = entryPath.replace(/^\.next\/?/, "");
  if (!relative) return true;
  const [topLevel] = relative.split("/");
  if (PRUNED_TOP_LEVEL.has(topLevel)) return false;
  if (relative.endsWith(".nft.json")) return false;
  return true;
}

async function main() {
  const version = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf-8")).version;

  if (!existsSync(path.join(nextDir, "BUILD_ID"))) {
    console.error(
      "No .next/BUILD_ID found — run `npm run build` before building the artifact.",
    );
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const tgzPath = path.join(outDir, `relay-next-build-${version}.tgz`);

  const manifest = buildExternalPackagesManifest();
  writeFileSync(
    path.join(nextDir, "relay-external-packages.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    `External packages manifest: ${Object.keys(manifest.links).length} link(s) — ` +
      Object.values(manifest.links).join(", "),
  );

  await tar.create(
    {
      gzip: true,
      file: tgzPath,
      cwd: repoRoot,
      portable: true,
      filter: shouldInclude,
    },
    [".next"],
  );

  const bytes = readFileSync(tgzPath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const shaPath = `${tgzPath}.sha256`;
  writeFileSync(shaPath, `${sha}  ${path.basename(tgzPath)}\n`);

  const sizeMb = (statSync(tgzPath).size / (1024 * 1024)).toFixed(1);
  console.log(`Artifact: ${tgzPath} (${sizeMb} MB gzipped)`);
  console.log(`Checksum: ${shaPath} (${sha})`);

  if (statSync(tgzPath).size > MAX_GZIPPED_BYTES) {
    console.error(
      `Artifact exceeds the 50 MB budget (${sizeMb} MB). Something new is being ` +
        `bundled — inspect .next and extend the prune list deliberately, don't raise the cap.`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
