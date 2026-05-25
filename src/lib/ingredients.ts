export type IngredientSuggestion = {
  name: string;
  section: string;
  source: "learned" | "built-in";
};

export const builtInIngredients: IngredientSuggestion[] = [
  ...section("Produce", ["Apples", "Avocados", "Baby spinach", "Bananas", "Basil", "Bell peppers", "Blueberries", "Broccoli", "Brussels sprouts", "Cabbage", "Carrots", "Cauliflower", "Celery", "Cilantro", "Corn", "Cucumbers", "Garlic", "Ginger", "Grapes", "Green beans", "Green onions", "Kale", "Lemons", "Lettuce", "Limes", "Mushrooms", "Onions", "Oranges", "Parsley", "Potatoes", "Red onion", "Romaine", "Spinach", "Strawberries", "Sweet potatoes", "Tomatoes", "Zucchini"]),
  ...section("Meat", ["Bacon", "Beef roast", "Boneless chicken thighs", "Chicken breast", "Chicken thighs", "Deli turkey", "Ground beef", "Ground chicken", "Ground turkey", "Ham", "Italian sausage", "Pork chops", "Pork shoulder", "Salmon", "Shrimp", "Steak", "Turkey bacon"]),
  ...section("Dairy", ["Butter", "Cheddar cheese", "Cream cheese", "Eggs", "Greek yogurt", "Half and half", "Heavy cream", "Milk", "Mozzarella", "Parmesan", "Provolone", "Ricotta", "Sour cream", "String cheese", "Yogurt"]),
  ...section("Pantry", ["All-purpose flour", "Alfredo sauce", "Black beans", "Breadcrumbs", "Brown sugar", "Chicken broth", "Chocolate chips", "Coffee", "Diced tomatoes", "Honey", "Jasmine rice", "Ketchup", "Kidney beans", "Macaroni", "Marinara sauce", "Mayonnaise", "Mustard", "Olive oil", "Pancake mix", "Pasta", "Peanut butter", "Penne", "Pickles", "Pinto beans", "Ranch dressing", "Rice", "Salsa", "Soy sauce", "Spaghetti", "Taco shells", "Tortillas", "Tuna", "Vegetable oil", "White rice", "Ziti"]),
  ...section("Frozen", ["Chicken nuggets", "Frozen broccoli", "Frozen corn", "Frozen fries", "Frozen mixed vegetables", "Frozen peas", "Frozen pizza", "Ice cream", "Waffles"]),
  ...section("Bakery", ["Bagels", "Bread", "Burger buns", "Dinner rolls", "English muffins", "Hoagie rolls", "Hot dog buns", "Tortilla wraps"]),
  ...section("Household", ["Aluminum foil", "Dish soap", "Laundry detergent", "Napkins", "Paper towels", "Parchment paper", "Plastic wrap", "Sandwich bags", "Toilet paper", "Trash bags"]),
  ...section("Spices", ["Bay leaves", "Black pepper", "Chili powder", "Cinnamon", "Cumin", "Garlic powder", "Italian seasoning", "Onion powder", "Oregano", "Paprika", "Red pepper flakes", "Salt", "Taco seasoning", "Vanilla extract"]),
];

function section(sectionName: string, names: string[]) {
  return names.map((name) => ({ name, section: sectionName, source: "built-in" as const }));
}

export function normalizeIngredientName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+(\.\d+)?\b/g, " ")
    .replace(/\b(cans?|bags?|boxes?|lbs?|pounds?|oz|ounces?|gallons?|cups?|tbsp|tsp|cloves?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/oes$/, "o")
    .replace(/s$/, "");
}

export function rankIngredientSuggestions(query: string, learned: IngredientSuggestion[], limit = 10) {
  const q = normalizeIngredientName(query);
  const deduped = new Map<string, IngredientSuggestion>();
  for (const item of [...learned, ...builtInIngredients]) {
    const key = normalizeIngredientName(item.name);
    if (!deduped.has(key)) deduped.set(key, item);
  }
  if (!q) return [...deduped.values()].slice(0, limit);
  return [...deduped.values()]
    .map((item) => ({ item, score: score(q, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function score(query: string, item: IngredientSuggestion) {
  const name = normalizeIngredientName(item.name);
  const words = name.split(" ");
  let scoreValue = item.source === "learned" ? 20 : 0;
  if (name === query) scoreValue += 100;
  if (name.startsWith(query)) scoreValue += 80;
  if (words.some((word) => word.startsWith(query))) scoreValue += 55;
  if (name.includes(query)) scoreValue += 25;
  return scoreValue;
}
