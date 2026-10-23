import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public read-only review channel. No sign-in required: the backend only
// broadcasts public rating data (averageRating, ratingCount, displayName,
// comment) — never myRating/hasReviewed, emails, or tokens. An Authorization
// header is forwarded when present so upstream can attach customer-specific
// context in the future, but the stream works without it (guests included).
export async function GET(request: NextRequest) {
  const accessToken = request.headers.get("authorization");

  const ac = new AbortController();
  const onClientAbort = () => ac.abort();
  request.signal.addEventListener("abort", onClientAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/api/events/reviews/stream`, {
      headers: {
        ...(accessToken ? { Authorization: accessToken } : {}),
      },
      cache: "no-store",
      signal: ac.signal,
    });
  } catch {
    request.signal.removeEventListener("abort", onClientAbort);
    return NextResponse.json(
      { error: "Review stream unavailable" },
      { status: 502 },
    );
  }

  if (!response.ok || !response.body) {
    request.signal.removeEventListener("abort", onClientAbort);
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to connect to review stream", detail: detail.slice(0, 200) },
      { status: response.status || 500 },
    );
  }

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
          console.warn("[reviews-stream] upstream stream ended:", error);
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
