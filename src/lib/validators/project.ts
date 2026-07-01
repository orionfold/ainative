import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  workingDirectory: z.string().max(500).optional(),
  // FK to customers.id; null/absent = unlinked. Attributes AI spend to a customer.
  customerId: z.string().min(1).nullish(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  workingDirectory: z.string().max(500).optional(),
  status: z.enum(["active", "paused", "completed"]).optional(),
  // FK to customers.id; null clears the link, absent leaves it unchanged.
  customerId: z.string().min(1).nullish(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
