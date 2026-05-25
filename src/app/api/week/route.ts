import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getWeek, saveMealSlot } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { mondayOf } from "@/lib/week";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  const weekStart = new URL(request.url).searchParams.get("weekStart") || mondayOf();
  return NextResponse.json({ weekStart, slots: getWeek(session.household.id, weekStart) });
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const slot = saveMealSlot(session.household.id, session.member, await request.json());
    broadcast(session.household.id);
    return NextResponse.json({ slot });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update dinner plan." }, { status: 400 });
  }
}

