import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config-shared";

async function proxyRequest(
  request: NextRequest,
  path: string,
  options: RequestInit = {}
) {
  const accessToken = request.headers.get("authorization");
  
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: accessToken } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  return proxyRequest(request, `/api/order-chat/${encodeURIComponent(orderId)}/messages`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const body = await request.json();
  return proxyRequest(request, `/api/order-chat/${encodeURIComponent(orderId)}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}