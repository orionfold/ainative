import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/packs/catalog", () => ({
  findPackTemplate: vi.fn(),
}));
vi.mock("@/lib/packs/update", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/packs/update")>();
  return {
    ...actual,
    updatePack: vi.fn(),
  };
});

import { POST } from "../route";
import { findPackTemplate } from "@/lib/packs/catalog";
import { updatePack, PackNotInstalledError } from "@/lib/packs/update";
import { PackValidationError } from "@/lib/packs/format";
import { PackLicenseError } from "@/lib/licensing/gate";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/packs/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const REPORT = {
  packId: "relay-agency-pro",
  previousVersion: "0.1.0",
  newVersion: "0.2.0",
  upToDate: false,
  backedUp: [],
};

describe("POST /api/packs/update", () => {
  beforeEach(() => {
    vi.mocked(findPackTemplate).mockReset();
    vi.mocked(updatePack).mockReset();
  });

  it("updates a bundled pack by id and returns the report", async () => {
    vi.mocked(findPackTemplate).mockReturnValue({
      id: "relay-agency-pro",
      dir: "/pkg/src/lib/packs/templates/relay-agency-pro",
    });
    vi.mocked(updatePack).mockResolvedValue(REPORT);

    const res = await POST(makeRequest({ id: "relay-agency-pro" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.previousVersion).toBe("0.1.0");
    expect(body.newVersion).toBe("0.2.0");
    // Bundled ids only — the update source is the resolved template dir.
    expect(updatePack).toHaveBeenCalledWith("relay-agency-pro", {
      source: "/pkg/src/lib/packs/templates/relay-agency-pro",
    });
  });

  it("400s on malformed JSON and on a missing id", async () => {
    expect((await POST(makeRequest("{not json"))).status).toBe(400);
    expect((await POST(makeRequest({}))).status).toBe(400);
  });

  it("404s for an id that is not a bundled template", async () => {
    vi.mocked(findPackTemplate).mockReturnValue(null);
    const res = await POST(makeRequest({ id: "no-such-pack" }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
    expect(updatePack).not.toHaveBeenCalled();
  });

  it("409s with not_installed when the pack was never installed", async () => {
    vi.mocked(findPackTemplate).mockReturnValue({
      id: "relay-agency-pro",
      dir: "/pkg/templates/relay-agency-pro",
    });
    vi.mocked(updatePack).mockRejectedValue(
      new PackNotInstalledError('Pack "relay-agency-pro" is not installed.')
    );
    const res = await POST(makeRequest({ id: "relay-agency-pro" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("not_installed");
  });

  it("402s with license_required when the renewal gate refuses (D4 soft gate)", async () => {
    vi.mocked(findPackTemplate).mockReturnValue({
      id: "relay-agency-pro",
      dir: "/pkg/templates/relay-agency-pro",
    });
    vi.mocked(updatePack).mockRejectedValue(
      new PackLicenseError(
        "Your installed relay-agency-pro keeps working — renew at https://orionfold.com/relay/",
        "missing"
      )
    );
    const res = await POST(makeRequest({ id: "relay-agency-pro" }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("license_required");
    expect(body.error).toMatch(/keeps working/);
  });

  it("422s with pack_invalid on a validation failure", async () => {
    vi.mocked(findPackTemplate).mockReturnValue({
      id: "relay-agency-pro",
      dir: "/pkg/templates/relay-agency-pro",
    });
    vi.mocked(updatePack).mockRejectedValue(
      new PackValidationError("bad pack")
    );
    const res = await POST(makeRequest({ id: "relay-agency-pro" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("pack_invalid");
  });

  it("500s with update_failed on an unexpected error", async () => {
    vi.mocked(findPackTemplate).mockReturnValue({
      id: "relay-agency-pro",
      dir: "/pkg/templates/relay-agency-pro",
    });
    vi.mocked(updatePack).mockRejectedValue(new Error("disk full"));
    const res = await POST(makeRequest({ id: "relay-agency-pro" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("update_failed");
  });
});
