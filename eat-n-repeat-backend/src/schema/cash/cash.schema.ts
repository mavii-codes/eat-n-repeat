import { z } from "zod";

export const endShiftSchema = z.object({
  shiftId: z.string().min(1, "shiftId is required"),
  actualCash: z.number().min(0, "Invalid actual cash amount"),
  notes: z.string().trim().max(2000).optional(),
});

export const flagShiftSchema = z.object({
  reason: z.string().trim().min(1, "A flag reason is required.").max(255),
});

export const addFloatSchema = z.object({
  amount: z.number().positive("Invalid amount"),
  reason: z.string().min(1, "Reason is required"),
});

export const editAuditSignoffSchema = z.object({
  status: z.preprocess(
    (val) => (typeof val === "string" ? val.toLowerCase().trim() : val),
    z.enum(["unverified", "verified", "flagged"])
  ),
  reason: z.string().trim().max(255).optional(),
}).refine(
  (data) => {
    if (data.status === "flagged") {
      return Boolean(data.reason && data.reason.trim().length > 0);
    }
    return true;
  },
  {
    message: "A flag reason is required when flagging a shift.",
    path: ["reason"],
  }
);

export type EndShiftInput = z.infer<typeof endShiftSchema>;
export type AddFloatInput = z.infer<typeof addFloatSchema>;
export type FlagShiftInput = z.infer<typeof flagShiftSchema>;
export type EditAuditSignoffInput = z.infer<typeof editAuditSignoffSchema>;
