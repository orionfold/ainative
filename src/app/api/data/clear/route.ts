import { NextResponse } from "next/server";
import { clearAllData } from "@/lib/data/clear";
import { isDataOpsAllowed } from "@/lib/data/staging-gate";

export async function POST() {
  if (!isDataOpsAllowed()) {
    return NextResponse.json(null, { status: 404 });
  }

  try {
    const deleted = clearAllData();
    return NextResponse.json({ success: true, deleted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
