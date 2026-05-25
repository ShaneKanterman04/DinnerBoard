import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getActivity } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  return NextResponse.json({ activity: getActivity(session.household.id) });
}

