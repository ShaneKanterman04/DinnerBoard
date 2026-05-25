export type Role = "planner" | "member";

export type Member = {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
};

export type Household = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

export type Recipe = {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  servings: number;
  tags: string[];
  ingredients: string[];
  steps: string[];
  createdBy: string;
  updatedAt: string;
};

export type MealSlotKind = "recipe" | "custom" | "leftovers" | "takeout" | "undecided";

export type MealSlot = {
  id: string;
  weekStart: string;
  dayIndex: number;
  kind: MealSlotKind;
  title: string;
  notes: string;
  recipeId: string | null;
};

export type GroceryItem = {
  id: string;
  name: string;
  quantity: string;
  section: string;
  checked: boolean;
  source: string;
  addedBy: string;
  addedByName: string;
  createdAt: string;
  updatedAt: string;
};

export type Suggestion = {
  id: string;
  title: string;
  notes: string;
  status: "open" | "accepted" | "dismissed";
  suggestedBy: string;
  suggestedByName: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  kind: string;
  message: string;
  actorName: string;
  createdAt: string;
};

export type Session = {
  household: Household;
  member: Member;
};

