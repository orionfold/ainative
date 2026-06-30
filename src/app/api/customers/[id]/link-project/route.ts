import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { linkProjectSchema } from "@/lib/validators/customer";

// Link an existing project to this customer (sets projects.customerId).
// Pass projectId: null is NOT supported here — unlink would be a separate concern.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const body = await req.json();
  const parsed = linkProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const customer = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .get();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await db
    .update(projects)
    .set({ customerId, updatedAt: new Date() })
    .where(eq(projects.id, parsed.data.projectId));

  return NextResponse.json({ customerId, projectId: parsed.data.projectId });
}
