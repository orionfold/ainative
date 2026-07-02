import { NextResponse } from "next/server";
import { seedSampleData } from "@/lib/data/seed";
import { isDataOpsAllowed } from "@/lib/data/staging-gate";

export async function POST() {
  if (!isDataOpsAllowed()) {
    return NextResponse.json(null, { status: 404 });
  }

  try {
    const seeded = await seedSampleData();
    return NextResponse.json({ success: true, seeded });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[seed] failed:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
