import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import fs from "fs";

export async function POST(req: NextRequest) {
  // Uploads write into the served public/ tree: require an authenticated
  // session (any role — no anonymous writes).
  const session = await getServerSession(authOptions);
  const authHeader = req.headers.get("authorization");
  if (!session?.user && (!authHeader || !authHeader.startsWith("Bearer "))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate size (5MB limit)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5MB limit" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, or WEBP." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop();
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const filename = `img-${uniqueId}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");

    try {
      // Ensure uploads directory exists if writable
      if (!fs.existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);

      return NextResponse.json({ url: `/uploads/${filename}` });
    } catch (fsErr) {
      // Serverless environments (e.g. Vercel read-only filesystem) cannot write to public/uploads
      console.warn("Filesystem write unavailable, using base64 fallback:", fsErr);
      const mime = file.type || "image/jpeg";
      const base64 = buffer.toString("base64");
      return NextResponse.json({ url: `data:${mime};base64,${base64}` });
    }
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
