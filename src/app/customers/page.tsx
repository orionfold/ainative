import { db } from "@/lib/db";
import { customers, projects } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { PageShell } from "@/components/shared/page-shell";
import { CustomerList, type CustomerListRow } from "@/components/customers/customer-list";
import { getCostByCustomer } from "@/lib/usage/ledger";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      slug: customers.slug,
      status: customers.status,
      industry: customers.industry,
      notes: customers.notes,
      projectCount: count(projects.id),
    })
    .from(customers)
    .leftJoin(projects, eq(projects.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(customers.name);

  // Join in per-customer cost over the trailing 30 days.
  const costRollup = await getCostByCustomer(30);
  const costById = new Map(
    costRollup
      .filter((c) => c.customerId != null)
      .map((c) => [c.customerId as string, c.costMicros])
  );

  const initialCustomers: CustomerListRow[] = rows.map((row) => ({
    ...row,
    costMicros: costById.get(row.id) ?? 0,
  }));

  return (
    <PageShell
      title="Customers"
      description="The accounts you run ops for. Link projects to a customer to attribute AI spend and see per-customer cost roll up."
    >
      <CustomerList initialCustomers={initialCustomers} />
    </PageShell>
  );
}
