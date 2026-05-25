import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Activity, GroceryItem, Household, MealSlot, Member, Recipe, Role, Session, Suggestion } from "@/lib/types";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "dinnerboard.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(household_id, name_key)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_url TEXT NOT NULL,
  servings INTEGER NOT NULL,
  tags_json TEXT NOT NULL,
  ingredients_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meal_slots (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  day_index INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  UNIQUE(household_id, week_start, day_index)
);
CREATE TABLE IF NOT EXISTS grocery_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL,
  section TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  added_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  status TEXT NOT NULL,
  suggested_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  subscription_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function clean(input: unknown, max = 120) {
  return String(input || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function householdRow(row: any): Household {
  return { id: row.id, name: row.name, inviteCode: row.invite_code, createdAt: row.created_at };
}

function memberRow(row: any): Member {
  return { id: row.id, name: row.name, role: row.role, createdAt: row.created_at };
}

function recipeRow(row: any): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    servings: row.servings,
    tags: parseList(row.tags_json),
    ingredients: parseList(row.ingredients_json),
    steps: parseList(row.steps_json),
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export function isSetup() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM households").get() as { count: number };
  return Number(row.count) > 0;
}

export function setupHousehold(input: { householdName: string; plannerName: string }) {
  if (isSetup()) throw new Error("DinnerBoard is already set up.");
  const household: Household = { id: id(), name: clean(input.householdName, 64) || "Family DinnerBoard", inviteCode: inviteCode(), createdAt: now() };
  const member: Member = { id: id(), name: clean(input.plannerName, 48) || "Mom", role: "planner", createdAt: now() };
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO households VALUES (?, ?, ?, ?)").run(household.id, household.name, household.inviteCode, household.createdAt);
    db.prepare("INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)").run(member.id, household.id, member.name, nameKey(member.name), member.role, member.createdAt);
    activity(household.id, member, "setup", `${member.name} started ${household.name}.`);
  });
  tx();
  return { household, member };
}

export function joinHousehold(input: { inviteCode: string; name: string; role?: Role }) {
  const household = db.prepare("SELECT * FROM households WHERE invite_code = ?").get(clean(input.inviteCode, 16).toUpperCase()) as any;
  if (!household) throw new Error("Invite code was not found.");
  const member: Member = { id: id(), name: clean(input.name, 48), role: input.role || "member", createdAt: now() };
  if (!member.name) throw new Error("Enter a name.");
  db.prepare("INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)").run(member.id, household.id, member.name, nameKey(member.name), member.role, member.createdAt);
  activity(household.id, member, "member.joined", `${member.name} joined the board.`);
  return { household: householdRow(household), member };
}

export function login(name: string) {
  const member = db.prepare("SELECT * FROM members WHERE name_key = ? ORDER BY created_at LIMIT 1").get(nameKey(clean(name, 48))) as any;
  if (!member) throw new Error("That username is not on this DinnerBoard.");
  const household = db.prepare("SELECT * FROM households WHERE id = ?").get(member.household_id) as any;
  return { household: householdRow(household), member: memberRow(member) };
}

export function createSession(householdId: string, memberId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(token, householdId, memberId, now());
  return token;
}

export function getSession(token?: string): Session | null {
  if (!token) return null;
  const row = db.prepare(`SELECT h.*, m.id AS member_id, m.name AS member_name, m.role, m.created_at AS member_created_at
    FROM sessions s JOIN households h ON h.id = s.household_id JOIN members m ON m.id = s.member_id WHERE s.token = ?`).get(token) as any;
  if (!row) return null;
  return { household: householdRow(row), member: { id: row.member_id, name: row.member_name, role: row.role, createdAt: row.member_created_at } };
}

export function clearSession(token?: string) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getMembers(householdId: string) {
  return db.prepare("SELECT * FROM members WHERE household_id = ? ORDER BY role DESC, name").all(householdId).map(memberRow);
}

export function getRecipes(householdId: string) {
  return db.prepare("SELECT * FROM recipes WHERE household_id = ? ORDER BY title").all(householdId).map(recipeRow);
}

export function saveRecipe(householdId: string, member: Member, input: Partial<Recipe>) {
  requirePlanner(member);
  const recipe: Recipe = {
    id: input.id || id(),
    title: clean(input.title, 100),
    description: clean(input.description, 300),
    sourceUrl: clean(input.sourceUrl, 300),
    servings: Math.max(1, Number(input.servings || 4)),
    tags: (input.tags || []).map((x) => clean(x, 32)).filter(Boolean),
    ingredients: (input.ingredients || []).map((x) => clean(x, 120)).filter(Boolean),
    steps: (input.steps || []).map((x) => clean(x, 500)).filter(Boolean),
    createdBy: member.id,
    updatedAt: now(),
  };
  if (!recipe.title) throw new Error("Recipe title is required.");
  db.prepare(`INSERT INTO recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, source_url=excluded.source_url,
    servings=excluded.servings, tags_json=excluded.tags_json, ingredients_json=excluded.ingredients_json, steps_json=excluded.steps_json, updated_at=excluded.updated_at`)
    .run(recipe.id, householdId, recipe.title, recipe.description, recipe.sourceUrl, recipe.servings, JSON.stringify(recipe.tags), JSON.stringify(recipe.ingredients), JSON.stringify(recipe.steps), recipe.createdBy, recipe.updatedAt);
  activity(householdId, member, "recipe.saved", `${member.name} saved ${recipe.title}.`);
  return recipe;
}

export function getWeek(householdId: string, weekStart: string) {
  return db.prepare("SELECT * FROM meal_slots WHERE household_id = ? AND week_start = ? ORDER BY day_index").all(householdId, weekStart) as MealSlot[];
}

export function saveMealSlot(householdId: string, member: Member, input: Partial<MealSlot>) {
  requirePlanner(member);
  const slot = {
    id: input.id || id(),
    household_id: householdId,
    week_start: clean(input.weekStart, 10),
    day_index: Number(input.dayIndex || 0),
    kind: clean(input.kind || "undecided", 16),
    title: clean(input.title, 120),
    notes: clean(input.notes, 240),
    recipe_id: input.recipeId || null,
  };
  db.prepare(`INSERT INTO meal_slots VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(household_id, week_start, day_index) DO UPDATE SET kind=excluded.kind, title=excluded.title, notes=excluded.notes, recipe_id=excluded.recipe_id`)
    .run(slot.id, slot.household_id, slot.week_start, slot.day_index, slot.kind, slot.title, slot.notes, slot.recipe_id);
  activity(householdId, member, "week.updated", `${member.name} updated the dinner plan.`);
  return slot;
}

export function getGroceries(householdId: string) {
  return db.prepare(`SELECT g.*, m.name AS added_by_name FROM grocery_items g JOIN members m ON m.id = g.added_by
    WHERE g.household_id = ? ORDER BY checked, section, created_at DESC`).all(householdId).map((row: any): GroceryItem => ({
      id: row.id, name: row.name, quantity: row.quantity, section: row.section, checked: Boolean(row.checked), source: row.source,
      addedBy: row.added_by, addedByName: row.added_by_name, createdAt: row.created_at, updatedAt: row.updated_at,
    }));
}

export function addGrocery(householdId: string, member: Member, input: Partial<GroceryItem>) {
  const item = { id: id(), name: clean(input.name, 100), quantity: clean(input.quantity, 40), section: clean(input.section, 40) || "Other", source: clean(input.source, 80), at: now() };
  if (!item.name) throw new Error("Grocery item name is required.");
  db.prepare("INSERT INTO grocery_items VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)").run(item.id, householdId, item.name, item.quantity, item.section, item.source, member.id, item.at, item.at);
  activity(householdId, member, "grocery.added", `${member.name} added ${item.name}.`);
  return item;
}

export function addRecipeIngredientsToGroceries(householdId: string, member: Member, recipeId: string) {
  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ? AND household_id = ?").get(recipeId, householdId);
  if (!recipe) throw new Error("Recipe was not found.");
  const parsed = recipeRow(recipe);
  const tx = db.transaction(() => {
    for (const ingredient of parsed.ingredients) addGrocery(householdId, member, { name: ingredient, section: "Recipe", source: parsed.title });
  });
  tx();
  return parsed.ingredients.length;
}

export function updateGrocery(householdId: string, member: Member, idValue: string, checked: boolean) {
  db.prepare("UPDATE grocery_items SET checked = ?, updated_at = ? WHERE id = ? AND household_id = ?").run(checked ? 1 : 0, now(), idValue, householdId);
  activity(householdId, member, "grocery.checked", `${member.name} updated the grocery list.`);
}

export function clearChecked(householdId: string, member: Member) {
  requirePlanner(member);
  db.prepare("DELETE FROM grocery_items WHERE household_id = ? AND checked = 1").run(householdId);
  activity(householdId, member, "grocery.cleared", `${member.name} cleared checked groceries.`);
}

export function getSuggestions(householdId: string) {
  return db.prepare(`SELECT s.*, m.name AS suggested_by_name FROM suggestions s JOIN members m ON m.id = s.suggested_by
    WHERE s.household_id = ? ORDER BY s.status, s.created_at DESC`).all(householdId).map((row: any): Suggestion => ({
      id: row.id, title: row.title, notes: row.notes, status: row.status, suggestedBy: row.suggested_by, suggestedByName: row.suggested_by_name, createdAt: row.created_at,
    }));
}

export function addSuggestion(householdId: string, member: Member, input: Partial<Suggestion>) {
  const suggestion = { id: id(), title: clean(input.title, 100), notes: clean(input.notes, 240), at: now() };
  if (!suggestion.title) throw new Error("Suggestion title is required.");
  db.prepare("INSERT INTO suggestions VALUES (?, ?, ?, ?, 'open', ?, ?)").run(suggestion.id, householdId, suggestion.title, suggestion.notes, member.id, suggestion.at);
  activity(householdId, member, "suggestion.added", `${member.name} suggested ${suggestion.title}.`);
  return suggestion;
}

export function setSuggestionStatus(householdId: string, member: Member, idValue: string, status: string) {
  requirePlanner(member);
  db.prepare("UPDATE suggestions SET status = ? WHERE id = ? AND household_id = ?").run(status, idValue, householdId);
  activity(householdId, member, "suggestion.updated", `${member.name} ${status} a suggestion.`);
}

export function getActivity(householdId: string) {
  return db.prepare("SELECT * FROM activities WHERE household_id = ? ORDER BY created_at DESC LIMIT 30").all(householdId).map((row: any): Activity => ({
    id: row.id, kind: row.kind, message: row.message, actorName: row.actor_name, createdAt: row.created_at,
  }));
}

function activity(householdId: string, member: Pick<Member, "id" | "name">, kind: string, message: string) {
  db.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?, ?)").run(id(), householdId, member.id, member.name, kind, message, now());
}

function requirePlanner(member: Member) {
  if (member.role !== "planner") throw new Error("Only the family planner can do that.");
}

export { db };
