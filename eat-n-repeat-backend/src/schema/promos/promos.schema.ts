import { z } from "zod";

/** POST /api/promos/validate body. subtotal = item subtotal (incl. selected
 *  add-ons) EXCLUDING delivery fee, sent as number or fixed-2 string. The
 *  client never discounts or totals anything — it only asks for a preview. */
export const promoValidateSchema = z.object({
  code: z.string().trim().min(1, "This code isn't valid").max(20),
  subtotal: z.coerce.number().min(0).optional().default(0),
  channel: z.enum(["online", "pos"]).optional().default("online"),
});

export type PromoValidateInput = z.infer<typeof promoValidateSchema>;

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,20}$/, "Code must be 4-20 letters (A-Z) and digits only");

/** Case-tolerant enum: the API documents UPPERCASE values, but admin clients
 *  may send "percent"/"everyone" — normalize before the enum check. */
function upperEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z.enum(values),
  );
}

/** Same, with an implicit default when the field is omitted. */
function upperEnumWithDefault<T extends readonly [string, ...string[]]>(
  values: T,
  dflt: T[number],
) {
  return z.preprocess(
    (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z.enum(values).default(dflt),
  );
}

/** Admin promo create body. starts_at/ends_at are ISO strings. */
export const promoCreateSchema = z.object({
  code: codeSchema,
  description: z.string().trim().max(500).optional().nullable(),
  type: upperEnum(["PERCENT", "FIXED"]),
  value: z.coerce.number().gt(0, "Value must be greater than 0"),
  max_discount: z.coerce.number().gt(0).optional().nullable(),
  min_order: z.coerce.number().min(0).optional().default(0),
  starts_at: z.string().min(1),
  ends_at: z.string().optional().nullable(),
  total_limit: z.coerce.number().int().min(1).optional().nullable(),
  per_customer_limit_once: z.boolean().optional().default(false),
  audience: upperEnumWithDefault(["EVERYONE", "LOGGED_IN"], "EVERYONE"),
  channel: upperEnumWithDefault(["ONLINE", "POS", "BOTH"], "BOTH"),
  active: z.boolean().optional().default(true),
});

/** Admin promo edit: same shape but every field optional (code immutable). */
export const promoUpdateSchema = z.object({
  description: z.string().trim().max(500).optional().nullable(),
  type: upperEnum(["PERCENT", "FIXED"]).optional(),
  value: z.coerce.number().gt(0, "Value must be greater than 0").optional(),
  max_discount: z.coerce.number().gt(0).optional().nullable(),
  min_order: z.coerce.number().min(0).optional(),
  starts_at: z.string().min(1).optional(),
  ends_at: z.string().optional().nullable(),
  total_limit: z.coerce.number().int().min(1).optional().nullable(),
  per_customer_limit_once: z.boolean().optional(),
  audience: upperEnum(["EVERYONE", "LOGGED_IN"]).optional(),
  channel: upperEnum(["ONLINE", "POS", "BOTH"]).optional(),
  active: z.boolean().optional(),
});

export type PromoCreateInput = z.infer<typeof promoCreateSchema>;
export type PromoUpdateInput = z.infer<typeof promoUpdateSchema>;
