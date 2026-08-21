import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config";



export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, phone } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { message: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    const res = await fetch(`${getApiUrl()}/api/customer-auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ message: data.message || "Registration failed." }, { status: res.status });
    }

    return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
