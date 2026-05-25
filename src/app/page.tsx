"use client";

import { CalendarDays, Check, ChefHat, ClipboardList, LogOut, Plus, Send, ShoppingCart, Sparkles, Trash2, Users, X } from "lucide-react";
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
const tabs = [
  ["week", CalendarDays, "Week"],
  ["groceries", ShoppingCart, "Groceries"],
  ["recipes", ChefHat, "Recipes"],
  ["suggestions", Sparkles, "Ideas"],
] as const;

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
    <main className="min-h-screen bg-[#f8f5ee] pb-24 text-[#1f2933] md:pb-0">
      <header className="sticky top-0 z-20 border-b border-[#d7d2c8] bg-[#fffaf0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#8b5e34]"><ChefHat size={18} /> DinnerBoard</div>
            <h1 className="text-xl font-bold text-[#18212f] md:text-2xl">{state.session.household.name}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Pill icon={<Users size={16} />} text={`${state.session.member.name} · ${state.session.member.role}`} />
            <span className="hidden sm:inline-flex"><Pill text={`Invite ${state.session.household.inviteCode}`} /></span>
            <button className="icon-button" onClick={() => mutate(() => api("/api/session", { method: "DELETE" }))} title="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:flex">
          {tabs.map(([id, Icon, label]: any) => (
            <button key={id} className={`tab ${tab === id ? "tab-active" : ""}`} onClick={() => setTab(id)}><Icon size={17} /> {label}</button>
          ))}
        </nav>
      </header>
      {error && <div className="mx-auto mt-4 max-w-7xl px-4"><div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div></div>}
      <section className="mx-auto grid max-w-7xl gap-5 px-3 py-4 sm:px-4 md:py-6 lg:grid-cols-[1fr_330px]">
        <div>
          {tab === "week" && <WeekPanel slots={state.slots} recipes={state.recipes} isPlanner={isPlanner} mutate={mutate} weekStart={weekStart} />}
          {tab === "groceries" && <GroceryPanel groceries={state.groceries} isPlanner={isPlanner} mutate={mutate} />}
          {tab === "recipes" && <RecipePanel recipes={state.recipes} isPlanner={isPlanner} mutate={mutate} />}
          {tab === "suggestions" && <SuggestionPanel suggestions={state.suggestions} isPlanner={isPlanner} mutate={mutate} />}
        </div>
        <aside className="hidden space-y-4 lg:block">
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
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#d7d2c8] bg-[#fffaf0] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_18px_rgba(31,41,51,0.08)] md:hidden">
        {tabs.map(([id, Icon, label]: any) => (
          <button key={id} className={`mobile-tab ${tab === id ? "mobile-tab-active" : ""}`} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span></button>
        ))}
      </nav>
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
  return <div className="space-y-3"><div className="sticky top-[73px] z-10 md:static"><QuickAdd mutate={mutate} inline /></div><div className="panel"><div className="flex items-center justify-between gap-3"><h2 className="panel-title mb-0"><ShoppingCart size={18} /> Active grocery list</h2>{isPlanner && <button className="secondary" onClick={() => mutate(() => api("/api/groceries", { method: "DELETE" }))}>Clear checked</button>}</div><div className="mt-4 divide-y divide-[#ece5d8]">{groceries.length === 0 && <EmptyState icon={<ShoppingCart />} title="No groceries yet" text="Add the first item above. Suggestions get smarter as you use DinnerBoard." />}{groceries.map((item: GroceryItem) => <label key={item.id} className="grocery-row"><input type="checkbox" checked={item.checked} onChange={(e) => mutate(() => api("/api/groceries", { method: "PATCH", body: JSON.stringify({ id: item.id, checked: e.currentTarget.checked }) }))} className="h-7 w-7 accent-[#356859]" /><span className={item.checked ? "min-w-0 flex-1 text-gray-400 line-through" : "min-w-0 flex-1"}><span className="block text-base font-extrabold">{item.name}</span><span className="muted block text-sm">{item.quantity || "No qty"} · {item.section} · added by {item.addedByName}</span></span></label>)}</div></div></div>;
}

function QuickAdd({ mutate, inline = false }: any) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [section, setSection] = useState("Produce");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [duplicate, setDuplicate] = useState<any>(null);
  useEffect(() => {
    const handle = setTimeout(() => {
      api<{ suggestions: any[] }>(`/api/ingredients?q=${encodeURIComponent(name)}`).then((data) => setSuggestions(data.suggestions)).catch(() => setSuggestions([]));
    }, 90);
    return () => clearTimeout(handle);
  }, [name]);
  async function submitWithDuplicateCatch() {
    const response = await fetch("/api/groceries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, quantity, section }) });
    const data = await response.json();
    if (response.status === 409) { setDuplicate(data); return; }
    if (!response.ok) throw new Error(data.error || "Could not add grocery.");
    setName(""); setQuantity(""); setDuplicate(null);
  }
  return <div className={inline ? "panel" : "panel space-y-2"}>
    {!inline && <h2 className="panel-title"><Plus size={18} /> Quick add</h2>}
    <form className="grid gap-2 md:grid-cols-[1fr_100px_130px_auto]" onSubmit={(e) => { e.preventDefault(); mutate(submitWithDuplicateCatch); }}>
      <div className="relative">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input h-12" placeholder="Milk, chicken, paper towels" autoComplete="off" />
        {name && suggestions.length > 0 && <div className="suggestions-popover">{suggestions.map((item) => <button type="button" key={`${item.name}-${item.section}`} onClick={() => { setName(item.name); setSection(item.section === "Spices" ? "Pantry" : item.section); setSuggestions([]); }}><span>{item.name}</span><small>{item.section} · {item.source}</small></button>)}</div>}
      </div>
      <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input h-12" placeholder="Qty" />
      <select value={section} onChange={(e) => setSection(e.target.value)} className="input h-12">{sections.map((s) => <option key={s}>{s}</option>)}</select>
      <button className="primary h-12"><Plus size={18} /> Add</button>
    </form>
    {duplicate && <DuplicateSheet duplicate={duplicate} quantity={quantity} section={section} mutate={mutate} onClose={() => setDuplicate(null)} onDone={() => { setName(""); setQuantity(""); setDuplicate(null); }} />}
  </div>;
}

function DuplicateSheet({ duplicate, quantity, section, mutate, onClose, onDone }: any) {
  const existing = duplicate.duplicate;
  const pending = duplicate.pending;
  return <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center">
    <div className="w-full max-w-md rounded-lg bg-[#fffaf0] p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Already on the list</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <p className="muted mb-4">“{existing.name}” is already active. Update the existing quantity instead?</p>
      <div className="rounded-md border border-[#d7d2c8] bg-white p-3 text-sm"><b>Current:</b> {existing.quantity || "No qty"} · {existing.section}<br /><b>New:</b> {pending.quantity || quantity || "No qty"} · {pending.section || section}</div>
      <div className="mt-4 grid gap-2"><button className="primary h-12" onClick={() => mutate(() => api("/api/groceries", { method: "PATCH", body: JSON.stringify({ id: existing.id, name: existing.name, quantity: pending.quantity, section: pending.section, source: pending.source }) })).then(onDone)}><Check size={18} /> Update existing item</button><button className="secondary h-12" onClick={onClose}>Cancel</button></div>
    </div>
  </div>;
}

function RecipePanel({ recipes, isPlanner, mutate }: any) {
  return <div className="space-y-4">{isPlanner && <RecipeForm mutate={mutate} />}<div className="grid gap-4 md:grid-cols-2">{recipes.map((recipe: Recipe) => <article className="panel" key={recipe.id}><h2 className="text-xl font-bold">{recipe.title}</h2><p className="muted">{recipe.description}</p><div className="my-3 flex flex-wrap gap-2">{recipe.tags.map((tag) => <span className="badge" key={tag}>{tag}</span>)}</div><h3 className="font-semibold">Ingredients</h3><ul className="list-disc pl-5 text-sm">{recipe.ingredients.map((x) => <li key={x}>{x}</li>)}</ul><h3 className="mt-3 font-semibold">Steps</h3><ol className="list-decimal pl-5 text-sm">{recipe.steps.map((x) => <li key={x}>{x}</li>)}</ol><button className="secondary mt-4" onClick={() => mutate(() => api("/api/groceries", { method: "POST", body: JSON.stringify({ recipeId: recipe.id }) }))}>Add ingredients to groceries</button></article>)}</div></div>;
}

function RecipeForm({ mutate }: any) {
  const [ingredients, setIngredients] = useState([""]);
  return <form className="panel grid gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); mutate(() => api("/api/recipes", { method: "POST", body: JSON.stringify({ ...data, servings: Number(data.servings || 4), tags: String(data.tags || "").split(","), ingredients, steps: String(data.steps || "").split("\n") }) })).then(() => { form.reset(); setIngredients([""]); }); }}>
    <h2 className="panel-title"><ChefHat size={18} /> Add recipe</h2>
    <div className="grid gap-2 md:grid-cols-2"><input name="title" className="input" placeholder="Recipe title" /><input name="sourceUrl" className="input" placeholder="Source URL" /></div>
    <textarea name="description" className="input" placeholder="Short description" /><div className="grid gap-2 md:grid-cols-2"><input name="servings" className="input" placeholder="Servings" type="number" defaultValue={4} /><input name="tags" className="input" placeholder="Tags, comma separated" /></div>
    <IngredientRows values={ingredients} onChange={setIngredients} /><textarea name="steps" className="input min-h-28" placeholder={"Steps, one per line"} />
    <button className="primary"><Check size={16} /> Save recipe</button>
  </form>;
}

function IngredientRows({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <div className="grid gap-2"><div className="font-bold">Ingredients</div>{values.map((value, index) => <IngredientInput key={index} value={value} onChange={(next) => onChange(values.map((item, i) => i === index ? next : item))} onEnter={() => onChange([...values, ""])} onRemove={() => onChange(values.filter((_, i) => i !== index).length ? values.filter((_, i) => i !== index) : [""])} />)}<button type="button" className="secondary h-11" onClick={() => onChange([...values, ""])}><Plus size={16} /> Add ingredient</button></div>;
}

function IngredientInput({ value, onChange, onEnter, onRemove }: { value: string; onChange: (next: string) => void; onEnter: () => void; onRemove: () => void }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    const handle = setTimeout(() => api<{ suggestions: any[] }>(`/api/ingredients?q=${encodeURIComponent(value)}`).then((data) => setSuggestions(data.suggestions)).catch(() => setSuggestions([])), 90);
    return () => clearTimeout(handle);
  }, [value]);
  return <div className="relative flex gap-2"><input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} className="input h-12" placeholder="Chicken breast, mozzarella..." autoComplete="off" /> <button type="button" className="icon-button h-12 w-12 shrink-0" onClick={onRemove}><Trash2 size={17} /></button>{value && suggestions.length > 0 && <div className="suggestions-popover left-0 right-14">{suggestions.map((item) => <button type="button" key={`${item.name}-${item.section}`} onClick={() => { onChange(item.name); setSuggestions([]); }}><span>{item.name}</span><small>{item.section}</small></button>)}</div>}</div>;
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

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="grid place-items-center rounded-md border border-dashed border-[#d7d2c8] bg-white px-4 py-8 text-center">{icon}<h3 className="mt-2 font-extrabold">{title}</h3><p className="muted max-w-sm text-sm">{text}</p></div>;
}
