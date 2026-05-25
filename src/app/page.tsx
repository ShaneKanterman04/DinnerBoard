"use client";

import { CalendarDays, Check, ChefHat, ClipboardList, LogOut, Plus, Send, ShoppingCart, Sparkles, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Activity, GroceryItem, MealSlot, Member, Recipe, Session, Suggestion } from "@/lib/types";
import { dayNames, mondayOf } from "@/lib/week";

type AppState = {
  session: (Session & { members: Member[] }) | null;
  setup: boolean;
  recipes: Recipe[];
  slots: MealSlot[];
  groceries: GroceryItem[];
  suggestions: Suggestion[];
  activity: Activity[];
};

const sections = ["Produce", "Meat", "Dairy", "Pantry", "Frozen", "Bakery", "Household", "Recipe", "Other"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function Home() {
  const [state, setState] = useState<AppState>({ session: null, setup: false, recipes: [], slots: [], groceries: [], suggestions: [], activity: [] });
  const [tab, setTab] = useState("week");
  const [error, setError] = useState("");
  const weekStart = useMemo(() => mondayOf(), []);
  const isPlanner = state.session?.member.role === "planner";

  async function load() {
    const session = await api<any>("/api/session");
    if (!session.authenticated) {
      setState((s) => ({ ...s, session: null, setup: session.setup }));
      return;
    }
    const [recipes, week, groceries, suggestions, activity] = await Promise.all([
      api<{ recipes: Recipe[] }>("/api/recipes"),
      api<{ slots: MealSlot[] }>(`/api/week?weekStart=${weekStart}`),
      api<{ groceries: GroceryItem[] }>("/api/groceries"),
      api<{ suggestions: Suggestion[] }>("/api/suggestions"),
      api<{ activity: Activity[] }>("/api/activity").catch(() => ({ activity: [] })),
    ]);
    setState({ session, setup: true, recipes: recipes.recipes, slots: week.slots, groceries: groceries.groceries, suggestions: suggestions.suggestions, activity: activity.activity });
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!state.session) return;
    const events = new EventSource("/api/events");
    events.addEventListener("changed", () => load().catch(() => undefined));
    return () => events.close();
  }, [state.session?.member.id]);

  async function mutate<T>(fn: () => Promise<T>) {
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (!state.session) return <AuthScreen setup={state.setup} onDone={load} onError={setError} error={error} />;

  return (
    <main className="min-h-screen bg-[#f8f5ee] text-[#1f2933]">
      <header className="border-b border-[#d7d2c8] bg-[#fffaf0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#8b5e34]"><ChefHat size={18} /> DinnerBoard</div>
            <h1 className="text-2xl font-bold text-[#18212f]">{state.session.household.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={<Users size={16} />} text={`${state.session.member.name} · ${state.session.member.role}`} />
            <Pill text={`Invite ${state.session.household.inviteCode}`} />
            <button className="icon-button" onClick={() => mutate(() => api("/api/session", { method: "DELETE" }))} title="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3">
          {[
            ["week", CalendarDays, "This Week"],
            ["groceries", ShoppingCart, "Groceries"],
            ["recipes", ChefHat, "Recipes"],
            ["suggestions", Sparkles, "Suggestions"],
          ].map(([id, Icon, label]: any) => (
            <button key={id} className={`tab ${tab === id ? "tab-active" : ""}`} onClick={() => setTab(id)}><Icon size={17} /> {label}</button>
          ))}
        </nav>
      </header>
      {error && <div className="mx-auto mt-4 max-w-7xl px-4"><div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div></div>}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_330px]">
        <div>
          {tab === "week" && <WeekPanel slots={state.slots} recipes={state.recipes} isPlanner={isPlanner} mutate={mutate} weekStart={weekStart} />}
          {tab === "groceries" && <GroceryPanel groceries={state.groceries} isPlanner={isPlanner} mutate={mutate} />}
          {tab === "recipes" && <RecipePanel recipes={state.recipes} isPlanner={isPlanner} mutate={mutate} />}
          {tab === "suggestions" && <SuggestionPanel suggestions={state.suggestions} isPlanner={isPlanner} mutate={mutate} />}
        </div>
        <aside className="space-y-4">
          <QuickAdd mutate={mutate} />
          <div className="panel">
            <h2 className="panel-title"><ClipboardList size={18} /> Recent activity</h2>
            <div className="space-y-3 text-sm">
              {state.activity.length === 0 && <p className="muted">Changes will show up here.</p>}
              {state.activity.map((item) => <div key={item.id} className="rounded-md bg-white px-3 py-2 shadow-sm">{item.message}<div className="muted text-xs">{new Date(item.createdAt).toLocaleString()}</div></div>)}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function AuthScreen({ setup, onDone, onError, error }: { setup: boolean; onDone: () => void; onError: (x: string) => void; error: string }) {
  const [mode, setMode] = useState(setup ? "login" : "setup");
  useEffect(() => {
    setMode(setup ? "login" : "setup");
  }, [setup]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(mode === "setup" ? "/api/setup" : "/api/session", { method: "POST", body: JSON.stringify(data) });
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not continue.");
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f5ee] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-[#d7d2c8] bg-[#fffaf0] p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3"><ChefHat className="text-[#356859]" /><div><h1 className="text-2xl font-bold">DinnerBoard</h1><p className="muted">Plan dinners together.</p></div></div>
        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {mode === "setup" ? (
          <>
            <label>Household name<input name="householdName" className="input" defaultValue="Kanterman DinnerBoard" /></label>
            <label>Your name<input name="plannerName" className="input" defaultValue="Mom" /></label>
          </>
        ) : (
          <>
            <label>Name<input name="name" className="input" placeholder="Shane" /></label>
            <label>Invite code <span className="muted">(only needed the first time)</span><input name="inviteCode" className="input" placeholder="ABC123" /></label>
          </>
        )}
        <button className="primary mt-4 w-full">{mode === "setup" ? "Create board" : "Enter board"}</button>
        <button type="button" className="mt-3 w-full text-sm font-semibold text-[#356859]" onClick={() => setMode(mode === "setup" ? "login" : "setup")}>
          {mode === "setup" ? "I already have a board" : "Set up a new board"}
        </button>
      </form>
    </main>
  );
}

function WeekPanel({ slots, recipes, isPlanner, mutate, weekStart }: any) {
  const byDay = new Map(slots.map((slot: MealSlot) => [slot.dayIndex, slot]));
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{dayNames.map((day, index) => <MealCard key={day} day={day} index={index} slot={byDay.get(index)} recipes={recipes} isPlanner={isPlanner} mutate={mutate} weekStart={weekStart} />)}</div>;
}

function MealCard({ day, index, slot, recipes, isPlanner, mutate, weekStart }: any) {
  return (
    <form className="panel min-h-56" onSubmit={(e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget));
      mutate(() => api("/api/week", { method: "POST", body: JSON.stringify({ ...data, dayIndex: index, weekStart }) }));
    }}>
      <h2 className="panel-title">{day}</h2>
      <select name="kind" className="input" defaultValue={slot?.kind || "undecided"} disabled={!isPlanner}>
        <option value="undecided">Undecided</option><option value="recipe">Recipe</option><option value="custom">Custom</option><option value="leftovers">Leftovers</option><option value="takeout">Takeout</option>
      </select>
      <input name="title" className="input" defaultValue={slot?.title || ""} placeholder="Tacos, leftovers, takeout..." disabled={!isPlanner} />
      <select name="recipeId" className="input" defaultValue={slot?.recipeId || ""} disabled={!isPlanner}>
        <option value="">No recipe attached</option>{recipes.map((recipe: Recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
      </select>
      <textarea name="notes" className="input min-h-20" defaultValue={slot?.notes || ""} placeholder="Notes" disabled={!isPlanner} />
      {isPlanner && <button className="primary"><Check size={16} /> Save dinner</button>}
    </form>
  );
}

function GroceryPanel({ groceries, isPlanner, mutate }: any) {
  return <div className="panel"><div className="flex items-center justify-between gap-3"><h2 className="panel-title"><ShoppingCart size={18} /> Active grocery list</h2>{isPlanner && <button className="secondary" onClick={() => mutate(() => api("/api/groceries", { method: "DELETE" }))}>Clear checked</button>}</div><QuickAdd mutate={mutate} inline /> <div className="mt-4 divide-y">{groceries.map((item: GroceryItem) => <label key={item.id} className="flex items-center gap-3 py-3"><input type="checkbox" checked={item.checked} onChange={(e) => mutate(() => api("/api/groceries", { method: "PATCH", body: JSON.stringify({ id: item.id, checked: e.currentTarget.checked }) }))} className="h-5 w-5" /><span className={item.checked ? "flex-1 text-gray-400 line-through" : "flex-1"}>{item.quantity && <b>{item.quantity} </b>}{item.name}<span className="muted ml-2">/{item.section} · {item.addedByName}</span></span></label>)}</div></div>;
}

function QuickAdd({ mutate, inline = false }: any) {
  return <form className={inline ? "mt-4 grid gap-2 md:grid-cols-[1fr_100px_130px_auto]" : "panel space-y-2"} onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate(() => api("/api/groceries", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) })).then(() => form.reset()); }}>
    {!inline && <h2 className="panel-title"><Plus size={18} /> Quick add</h2>}
    <input name="name" className="input" placeholder="Milk, apples, paper towels" />
    <input name="quantity" className="input" placeholder="Qty" />
    <select name="section" className="input">{sections.map((s) => <option key={s}>{s}</option>)}</select>
    <button className="primary"><Plus size={16} /> Add</button>
  </form>;
}

function RecipePanel({ recipes, isPlanner, mutate }: any) {
  return <div className="space-y-4">{isPlanner && <RecipeForm mutate={mutate} />}<div className="grid gap-4 md:grid-cols-2">{recipes.map((recipe: Recipe) => <article className="panel" key={recipe.id}><h2 className="text-xl font-bold">{recipe.title}</h2><p className="muted">{recipe.description}</p><div className="my-3 flex flex-wrap gap-2">{recipe.tags.map((tag) => <span className="badge" key={tag}>{tag}</span>)}</div><h3 className="font-semibold">Ingredients</h3><ul className="list-disc pl-5 text-sm">{recipe.ingredients.map((x) => <li key={x}>{x}</li>)}</ul><h3 className="mt-3 font-semibold">Steps</h3><ol className="list-decimal pl-5 text-sm">{recipe.steps.map((x) => <li key={x}>{x}</li>)}</ol><button className="secondary mt-4" onClick={() => mutate(() => api("/api/groceries", { method: "POST", body: JSON.stringify({ recipeId: recipe.id }) }))}>Add ingredients to groceries</button></article>)}</div></div>;
}

function RecipeForm({ mutate }: any) {
  return <form className="panel grid gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); mutate(() => api("/api/recipes", { method: "POST", body: JSON.stringify({ ...data, servings: Number(data.servings || 4), tags: String(data.tags || "").split(","), ingredients: String(data.ingredients || "").split("\n"), steps: String(data.steps || "").split("\n") }) })).then(() => form.reset()); }}>
    <h2 className="panel-title"><ChefHat size={18} /> Add recipe</h2>
    <div className="grid gap-2 md:grid-cols-2"><input name="title" className="input" placeholder="Recipe title" /><input name="sourceUrl" className="input" placeholder="Source URL" /></div>
    <textarea name="description" className="input" placeholder="Short description" /><div className="grid gap-2 md:grid-cols-2"><input name="servings" className="input" placeholder="Servings" type="number" defaultValue={4} /><input name="tags" className="input" placeholder="Tags, comma separated" /></div>
    <textarea name="ingredients" className="input min-h-28" placeholder={"Ingredients, one per line"} /><textarea name="steps" className="input min-h-28" placeholder={"Steps, one per line"} />
    <button className="primary"><Check size={16} /> Save recipe</button>
  </form>;
}

function SuggestionPanel({ suggestions, isPlanner, mutate }: any) {
  return <div className="panel"><SuggestionForm mutate={mutate} /><div className="mt-5 grid gap-3">{suggestions.map((s: Suggestion) => <div key={s.id} className="rounded-md bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{s.title}</h3><p className="muted">{s.notes || `Suggested by ${s.suggestedByName}`}</p></div><span className="badge">{s.status}</span></div>{isPlanner && s.status === "open" && <div className="mt-3 flex gap-2"><button className="secondary" onClick={() => mutate(() => api("/api/suggestions", { method: "PATCH", body: JSON.stringify({ id: s.id, status: "accepted" }) }))}>Accept</button><button className="secondary" onClick={() => mutate(() => api("/api/suggestions", { method: "PATCH", body: JSON.stringify({ id: s.id, status: "dismissed" }) }))}>Dismiss</button></div>}</div>)}</div></div>;
}

function SuggestionForm({ mutate }: any) {
  return <form className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate(() => api("/api/suggestions", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) })).then(() => form.reset()); }}><input name="title" className="input" placeholder="Suggest dinner" /><input name="notes" className="input" placeholder="Notes" /><button className="primary"><Send size={16} /> Suggest</button></form>;
}

function Pill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return <span className="flex h-9 items-center gap-2 rounded-md border border-[#d7d2c8] bg-white px-3 text-sm font-semibold">{icon}{text}</span>;
}
