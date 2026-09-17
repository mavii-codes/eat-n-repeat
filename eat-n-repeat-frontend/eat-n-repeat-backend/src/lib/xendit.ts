import { Xendit } from "xendit-node";
import { env } from "@/config/env";

let client: Xendit | null = null;

export function getXenditClient(): Xendit {
  if (!client) {
    client = new Xendit({ secretKey: env.xendit.secretKey });
  }
  return client;
}

export const xenditClient = {
  get Invoice() {
    return getXenditClient().Invoice;
  },
} as unknown as Xendit;
