import { NextResponse } from "next/server";
import { apagarSessao } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await apagarSessao();
  return NextResponse.json({ ok: true });
}
