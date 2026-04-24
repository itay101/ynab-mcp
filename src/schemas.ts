import { z } from "zod";

export const budgetIdSchema = z
  .string()
  .optional()
  .describe("The budget ID. Omit or use 'last-used' for the most recently accessed budget.");

export const lastKnowledgeSchema = z
  .number()
  .int()
  .optional()
  .describe(
    "Server knowledge token for delta requests. Returns only data changed since this value."
  );
