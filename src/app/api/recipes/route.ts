import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getRecipes, saveRecipe } from "@/lib/db";
import { broadcast } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  return NextResponse.json({ recipes: getRecipes(session.household.id) });
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const recipe = saveRecipe(session.household.id, session.member, await request.json());
    broadcast(session.household.id);
    return NextResponse.json({ recipe });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save recipe." }, { status: 400 });
  }
}

