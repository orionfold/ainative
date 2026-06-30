"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CustomerFormSheet } from "./customer-form-sheet";

export interface CustomerListRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  industry: string | null;
  notes: string | null;
  projectCount: number;
  costMicros: number;
}

function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

export function CustomerList({ initialCustomers }: { initialCustomers: CustomerListRow[] }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerListRow[]>(initialCustomers);
  const [sheetOpen, setSheetOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/customers", { cache: "no-store" });
    if (res.ok) {
      // The list API doesn't include cost; preserve existing cost values by slug.
      const next = (await res.json()) as Array<Omit<CustomerListRow, "costMicros">>;
      setCustomers((prev) => {
        const costBySlug = new Map(prev.map((c) => [c.slug, c.costMicros]));
        return next.map((c) => ({ ...c, costMicros: costBySlug.get(c.slug) ?? 0 }));
      });
      router.refresh();
    }
  }, [router]);

  const columns = useMemo<ColumnDef<CustomerListRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.slug}</span>
          </div>
        ),
      },
      {
        accessorKey: "industry",
        header: "Industry",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.industry || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        accessorKey: "projectCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Projects" />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.projectCount}</span>,
      },
      {
        accessorKey: "costMicros",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cost (30d)" />,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUsd(row.original.costMicros)}</span>
        ),
      },
    ],
    []
  );

  if (customers.length === 0) {
    return (
      <>
        <EmptyState
          icon={Users}
          heading="No customers yet"
          description="Add the accounts you run ops for. Link projects to a customer to see per-customer cost roll up here."
          action={
            <Button onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Customer
            </Button>
          }
        />
        <CustomerFormSheet
          mode="create"
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSaved={refresh}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Customer
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={customers}
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
      />
      <CustomerFormSheet
        mode="create"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={refresh}
      />
    </div>
  );
}
