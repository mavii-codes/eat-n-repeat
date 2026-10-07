import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const accessToken = request.headers.get("authorization");
  
  const response = await fetch(`${getApiUrl()}/api/events/order-chat/${orderId}/stream${accessToken ? `?token=${accessToken}` : ""}`, {
    headers: {
      ...(accessToken ? { Authorization: accessToken } : {}),
    },
  });

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Failed to connect to SSE" }, { status: 500 });
  }

  // Create a readable stream to proxy the SSE
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(new TextEncoder().encode(decoder.decode(value, { stream: true })));
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}