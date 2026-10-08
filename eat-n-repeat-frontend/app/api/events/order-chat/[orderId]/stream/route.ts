import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config-shared";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  // EventSource cannot set request headers, so the token travels as a
  // query parameter. Forward it (plus any Authorization header) upstream.
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const queryToken = request.nextUrl.searchParams.get("token");
  const token = headerToken || queryToken;

  const response = await fetch(
    `${getApiUrl()}/api/events/order-chat/${encodeURIComponent(orderId)}/stream${
      token ? `?token=${encodeURIComponent(token)}` : ""
    }`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to connect to chat stream", detail: detail.slice(0, 200) },
      { status: response.status || 500 }
    );
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
