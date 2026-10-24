import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from("leads")
      .select("id, created_at, session_id, name, contact, need, urgency, intent, status, raw_message")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Lead query failed:", error.message);
      return NextResponse.json({ error: "Could not load leads." }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Lead API failed:", error);
    return NextResponse.json({ error: "Could not load leads." }, { status: 500 });
  }
}
