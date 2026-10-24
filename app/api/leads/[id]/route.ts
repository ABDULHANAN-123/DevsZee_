import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const statuses = ["new", "contacted", "closed"] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const status = body && typeof body === "object"
      ? (body as Record<string, unknown>).status
      : undefined;

    if (!id || !statuses.includes(status as (typeof statuses)[number])) {
      return NextResponse.json({ error: "Invalid lead ID or status." }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Lead status update failed:", error.message);
      return NextResponse.json({ error: "Could not update lead status." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Lead status route failed:", error);
    return NextResponse.json({ error: "Could not update lead status." }, { status: 500 });
  }
}
