import { addGrocery, addSuggestion, getRecipes, joinHousehold, saveRecipe, setupHousehold } from "../src/lib/db";

let context;
try {
  context = setupHousehold({ householdName: "Kanterman DinnerBoard", plannerName: "Mom" });
} catch {
  context = joinHousehold({ inviteCode: process.env.DINNERBOARD_INVITE || "", name: `Seeder ${Date.now()}` });
}

const recipes = [
  {
    title: "Chicken Taco Bowls",
    description: "Weeknight bowls with rice, seasoned chicken, beans, corn, and toppings.",
    sourceUrl: "",
    servings: 4,
    tags: ["quick", "family"],
    ingredients: ["1.5 lb chicken breast", "2 cups rice", "1 can black beans", "1 bag frozen corn", "Taco seasoning", "Shredded cheese", "Salsa"],
    steps: ["Cook rice.", "Season and cook chicken.", "Warm beans and corn.", "Build bowls with toppings."],
  },
  {
    title: "Baked Ziti",
    description: "Simple pasta bake for dinner and leftovers.",
    sourceUrl: "",
    servings: 6,
    tags: ["comfort", "leftovers"],
    ingredients: ["1 lb ziti", "24 oz marinara", "15 oz ricotta", "2 cups mozzarella", "Parmesan"],
    steps: ["Boil pasta.", "Mix with sauce and ricotta.", "Top with cheese.", "Bake until bubbling."],
  },
  {
    title: "Sheet Pan Sausage And Peppers",
    description: "Low-effort dinner with rolls or rice.",
    sourceUrl: "",
    servings: 4,
    tags: ["sheet-pan"],
    ingredients: ["1 pack Italian sausage", "3 bell peppers", "1 onion", "Hoagie rolls", "Provolone"],
    steps: ["Slice peppers and onion.", "Roast with sausage.", "Serve on rolls with cheese."],
  },
];

for (const recipe of recipes) saveRecipe(context.household.id, context.member, recipe);
addGrocery(context.household.id, context.member, { name: "Milk", quantity: "1 gallon", section: "Dairy" });
addGrocery(context.household.id, context.member, { name: "Apples", quantity: "1 bag", section: "Produce" });
addSuggestion(context.household.id, context.member, { title: "Breakfast for dinner", notes: "Pancakes, eggs, bacon" });

console.log(`Seeded ${getRecipes(context.household.id).length} recipes. Invite code: ${context.household.inviteCode}`);

