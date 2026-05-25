import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireSession();
  const subscription = await request.json();
  if (!subscription?.endpoint) return NextResponse.json({ error: "Missing push endpoint." }, { status: 400 });
  db.prepare(`INSERT INTO push_subscriptions VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET subscription_json=excluded.subscription_json`)
    .run(subscription.endpoint, session.household.id, session.member.id, JSON.stringify(subscription), new Date().toISOString());
  return NextResponse.json({ ok: true });
}

