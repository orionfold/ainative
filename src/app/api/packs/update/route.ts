import { NextResponse } from "next/server";
import { z } from "zod";
import { findPackTemplate } from "@/lib/packs/catalog";
import { updatePack, PackNotInstalledError } from "@/lib/packs/update";
import { PackValidationError } from "@/lib/packs/format";
import { PackLicenseError } from "@/lib/licensing/gate";

/**
 * Update an installed BUNDLED pack from the /packs gallery. Same security
 * posture as the install route: the body carries a bundled template id only —
 * never a filesystem path or git URL (a LAN-reachable `--hostname 0.0.0.0`
 * instance must not clone attacker-supplied sources). The CLI keeps the
 * path/git surface.
 *
 * A 402 `license_required` is the renewal soft gate (D4): the installed pack
 * keeps working; only the update needs an active license. The UI's cue to
 * point at Settings → License.
 */

const BodySchema = z.object({
  id: z.string().min(1),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON.", code: "bad_request" },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        code: "validation_failed",
      },
      { status: 400 }
    );
  }

  const template = findPackTemplate(parsed.data.id);
  if (!template) {
    return NextResponse.json(
      {
        error: `No bundled pack named "${parsed.data.id}".`,
        code: "not_found",
      },
      { status: 404 }
    );
  }

  try {
    const report = await updatePack(parsed.data.id, { source: template.dir });
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof PackNotInstalledError) {
      return NextResponse.json(
        { error: err.message, code: "not_installed" },
        { status: 409 }
      );
    }
    if (err instanceof PackLicenseError) {
      return NextResponse.json(
        { error: err.message, code: "license_required" },
        { status: 402 }
      );
    }
    if (err instanceof PackValidationError) {
      return NextResponse.json(
        { error: err.message, code: "pack_invalid" },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        code: "update_failed",
      },
      { status: 500 }
    );
  }
}
