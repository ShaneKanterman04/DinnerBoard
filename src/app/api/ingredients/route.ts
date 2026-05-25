import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getIngredientSuggestions } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  const query = new URL(request.url).searchParams.get("q") || "";
  return NextResponse.json({ suggestions: getIngredientSuggestions(session.household.id, query) });
}
