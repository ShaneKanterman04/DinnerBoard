import { NextResponse } from "next/server";
import { clearSessionCookie, currentSession, setSessionCookie } from "@/lib/auth";
import { getMembers, isSetup, joinHousehold, login } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ authenticated: false, setup: isSetup() });
  return NextResponse.json({ authenticated: true, setup: true, ...session, members: getMembers(session.household.id) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const context = body.inviteCode
      ? joinHousehold({ inviteCode: body.inviteCode, name: body.name })
      : login(body.name);
    await setSessionCookie(context.household.id, context.member.id);
    return NextResponse.json({ authenticated: true, ...context, members: getMembers(context.household.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sign in." }, { status: 400 });
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

