import { normalizeIngredientName, rankIngredientSuggestions } from "@/lib/ingredients";

test("normalizes common grocery names for duplicate checks", () => {
  expect(normalizeIngredientName("2 cans Black Beans!")).toBe("black bean");
  expect(normalizeIngredientName("Tomatoes")).toBe("tomato");
});

test("ranks learned and prefix ingredient suggestions naturally", () => {
  const suggestions = rankIngredientSuggestions("chick", [{ name: "Chicken cutlets", section: "Meat", source: "learned" }], 5);
  expect(suggestions[0]).toEqual({ name: "Chicken cutlets", section: "Meat", source: "learned" });
  expect(suggestions.some((item) => item.name === "Chicken breast")).toBe(true);
});
