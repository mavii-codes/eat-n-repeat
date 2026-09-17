import { NextResponse } from "next/server";
import { registerCustomer } from "@/lib/customer/customer-store";

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

    const user = await registerCustomer({ name, email, password, phone });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
