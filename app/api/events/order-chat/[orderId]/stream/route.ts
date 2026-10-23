import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const ac = new AbortController();
  const onClientAbort = () => ac.abort();
  request.signal.addEventListener("abort", onClientAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(
      `${getApiUrl()}/api/events/order-chat/${encodeURIComponent(orderId)}/stream${
        token ? `?token=${encodeURIComponent(token)}` : ""
      }`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
        signal: ac.signal,
      }
    );
  } catch {
    request.signal.removeEventListener("abort", onClientAbort);
    return NextResponse.json(
      { error: "Chat stream unavailable" },
      { status: 502 }
    );
  }

  if (!response.ok || !response.body) {
    request.signal.removeEventListener("abort", onClientAbort);
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to connect to chat stream", detail: detail.slice(0, 200) },
      { status: response.status || 500 }
    );
  }

  // Create a readable stream to proxy the SSE
  const reader = response.body.getReader();
  let closed = false;
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const closeSafely = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (error) {
        // Clean EOF (not controller.error) so EventSource reconnects without
        // ERR_INCOMPLETE_CHUNKED_ENCODING. Log once for real upstream failures.
        if (!cancelled && !request.signal.aborted) {
          console.warn("[order-chat-stream] upstream stream ended:", error);
        }
      } finally {
        request.signal.removeEventListener("abort", onClientAbort);
        closeSafely();
      }
    },
    async cancel() {
      cancelled = true;
      try {
        await reader.cancel();
      } catch {}
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
