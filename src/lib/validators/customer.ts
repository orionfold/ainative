import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  // slug is optional — derived from name when omitted (ensureCustomer handles it).
  slug: z
    .string()
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens")
    .optional(),
  industry: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  industry: z.string().max(80).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const linkProjectSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type LinkProjectInput = z.infer<typeof linkProjectSchema>;
