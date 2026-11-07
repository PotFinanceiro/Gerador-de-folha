import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await criarClienteServidor();
    await supabase.auth.signOut();
  } catch {}
  return NextResponse.json({ ok: true });
}
