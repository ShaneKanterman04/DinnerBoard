import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { setupHousehold } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const context = setupHousehold({ householdName: body.householdName, plannerName: body.plannerName });
    await setSessionCookie(context.household.id, context.member.id);
    return NextResponse.json({ authenticated: true, ...context });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not set up DinnerBoard." }, { status: 400 });
  }
}

