"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerFormSheet, type CustomerFormValues } from "./customer-form-sheet";

export function CustomerDetailActions({ customer }: { customer: CustomerFormValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1.5" />
        Edit
      </Button>
      <CustomerFormSheet
        mode="edit"
        customer={customer}
        open={open}
        onOpenChange={setOpen}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
