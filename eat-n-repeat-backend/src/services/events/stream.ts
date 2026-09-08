export { emitPaymentEvent, addSSEClient, removeSSEClient } from "@/lib/sse";

export class StreamService {
  async execute() {
    // Re-export SSE helpers — no additional logic needed
  }
}

export const streamService = new StreamService();
