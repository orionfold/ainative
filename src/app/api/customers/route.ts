import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, projects } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { createCustomerSchema } from "@/lib/validators/customer";
import { ensureCustomer, CustomerSlugError } from "@/lib/customers";

export async function GET() {
  const result = await db
    .select({
      id: customers.id,
      name: customers.name,
      slug: customers.slug,
      status: customers.status,
      industry: customers.industry,
      notes: customers.notes,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      projectCount: count(projects.id),
    })
    .from(customers)
    .leftJoin(projects, eq(projects.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(customers.name);

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Slug-idempotent: re-posting the same slug returns the existing customer (200)
    // rather than creating a duplicate. New customer → 201.
    const { customer, created } = await ensureCustomer({
      slug: parsed.data.slug,
      name: parsed.data.name,
      industry: parsed.data.industry ?? null,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status,
    });
    return NextResponse.json(customer, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof CustomerSlugError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
