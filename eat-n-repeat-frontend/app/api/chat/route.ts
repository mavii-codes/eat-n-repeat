import { NextRequest, NextResponse } from "next/server";
import { initialAdminData } from "@/lib/admin/mock-data";

/**
 * POST /api/chat — server-side Barista AI (ONLINE mode only).
 *
 * The client calls this ONLY on the public site. Local/LAN browsers use the
 * built-in keyword fallback and must never reach here (see CustomerChatBot).
 * All secrets (GEMINI_API_KEY, BACKEND_URL) stay server-side.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:4000";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const UPSTREAM_TIMEOUT_MS = 12000;
const MAX_MESSAGE_CHARS = 500;

// Tiny in-memory per-IP throttle (cost control, best-effort per instance).
const hitsByIp = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  hitsByIp.set(ip, hits);
  if (hitsByIp.size > 500) hitsByIp.clear();
  return hits.length > RATE_LIMIT;
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function fetchJson(url: string, timeoutMs: number): Promise<any | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildCafeContext(): { text: string } {
  const data = initialAdminData;
  const categoryName = (id: string) =>
    data.menuCategories.find((c) => c.id === id)?.name || "General";

  const menuLines = data.menuItems
    .filter((m) => !m.archived)
    .map(
      (m) =>
        `- ${m.name} (₱${Number(m.price).toFixed(2)}) [${categoryName(m.categoryId)}] ` +
        `${m.available ? "available" : "CURRENTLY UNAVAILABLE"} — ${m.description || ""}`
    );

  const s = data.systemSettings as any;
  const d = data.deliverySettings as any;

  const text = [
    `Cafe: ${s?.cafeName || "Eat n RepEat Cafe"}, ${s?.address || ""}.`,
    `Hours: ${s?.openingTime || "?"}–${s?.closingTime || "?"}, ${s?.phone || ""}.`,
    `Delivery: base fee ₱${d?.baseDeliveryFee ?? "?"}, free minimum ₱${d?.freeDeliveryMinimum ?? "?"}, max radius ${d?.maxDeliveryRadiusKm ?? "?"}km.`,
    `MENU (live prices/availability as listed — quote these exactly, never invent):`,
    ...menuLines,
  ].join("\n");

  return { text };
}

const SYSTEM_PROMPT = `You are Barista AI for Eat n RepEat Cafe (Cordova, Cebu).
Answer ONLY from the CAFE DATA below. Quote menu prices and availability
exactly as listed. If the answer is not in the data, say you don't know and
suggest asking staff. Never invent dishes, prices, hours, or policies.
Keep replies under 80 words, friendly café tone. No markdown tables.`;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { fallback: true, message: "Too many requests — please wait a moment." },
      { status: 429 }
    );
  }

  let message = "";
  try {
    const body = await req.json();
    if (typeof body?.message === "string") message = body.message.trim();
  } catch {
    return NextResponse.json({ fallback: true }, { status: 400 });
  }
  if (!message) return NextResponse.json({ fallback: true }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) message = message.slice(0, MAX_MESSAGE_CHARS);

  if (!GEMINI_API_KEY) {
    // Key not configured (e.g. local dev) — client falls back silently.
    return NextResponse.json({ fallback: true }, { status: 503 });
  }

  const { text: cafeText } = buildCafeContext();

  // Live addons + availability (best-effort; static context still stands alone).
  const [addonsJson, availabilityJson] = await Promise.all([
    fetchJson(`${BACKEND_URL}/api/addons`, 6000),
    fetchJson(`${BACKEND_URL}/api/sync/status`, 6000),
  ]);
  const liveLines: string[] = [];
  if (addonsJson?.addons?.length) {
    const names = addonsJson.addons
      .filter((a: any) => a.available !== false)
      .slice(0, 12)
      .map((a: any) => `${a.name} (₱${Number(a.price).toFixed(2)})`)
      .join(", ");
    if (names) liveLines.push(`Live add-ons: ${names}.`);
  }
  if (availabilityJson) {
    liveLines.push(
      `Ordering status: ${availabilityJson.onlineOrdering || "unknown"}.`
    );
  }

  const prompt = `${SYSTEM_PROMPT}\n\nCAFE DATA:\n${cafeText}\n${liveLines.join("\n")}\n\nCustomer: ${message}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 220, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
    if (!res.ok) return NextResponse.json({ fallback: true }, { status: 502 });
    const data = await res.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => (typeof p?.text === "string" ? p.text : ""))
        .join("")
        .trim() || "";
    if (!reply) return NextResponse.json({ fallback: true }, { status: 502 });
    return NextResponse.json({ reply, source: "ai" });
  } catch {
    return NextResponse.json({ fallback: true }, { status: 502 });
  }
}
