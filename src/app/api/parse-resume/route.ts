import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    // dynamic import to keep it server-only
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    const text = data.text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000);

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: "Parse failed", detail: String(e) }, { status: 500 });
  }
}