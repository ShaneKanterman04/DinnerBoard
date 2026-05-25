import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { addGrocery, addRecipeIngredientsToGroceries, clearChecked, getGroceries, updateGrocery } from "@/lib/db";
import { broadcast } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  return NextResponse.json({ groceries: getGroceries(session.household.id) });
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    if (body.recipeId) {
      const count = addRecipeIngredientsToGroceries(session.household.id, session.member, body.recipeId);
      broadcast(session.household.id);
      return NextResponse.json({ count });
    }
    const item = addGrocery(session.household.id, session.member, body);
    broadcast(session.household.id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update groceries." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    updateGrocery(session.household.id, session.member, body.id, Boolean(body.checked));
    broadcast(session.household.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update groceries." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    clearChecked(session.household.id, session.member);
    broadcast(session.household.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not clear groceries." }, { status: 400 });
  }
}

