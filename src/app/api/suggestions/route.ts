import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { addSuggestion, getSuggestions, setSuggestionStatus } from "@/lib/db";
import { broadcast } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  return NextResponse.json({ suggestions: getSuggestions(session.household.id) });
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const suggestion = addSuggestion(session.household.id, session.member, await request.json());
    broadcast(session.household.id);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add suggestion." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    setSuggestionStatus(session.household.id, session.member, body.id, body.status);
    broadcast(session.household.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update suggestion." }, { status: 400 });
  }
}

