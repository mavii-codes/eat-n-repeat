import { z } from "zod";

export const cafeAvailabilityModeSchema = z.object({
  mode: z.enum(["AUTO", "FORCE_AVAILABLE", "FORCE_UNAVAILABLE"]),
});

export type CafeAvailabilityModeInput = z.infer<typeof cafeAvailabilityModeSchema>;
