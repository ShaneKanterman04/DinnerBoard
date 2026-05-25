import { mondayOf } from "@/lib/week";

test("mondayOf returns the Monday for the current week", () => {
  expect(mondayOf(new Date("2026-05-25T12:00:00Z"))).toBe("2026-05-25");
  expect(mondayOf(new Date("2026-05-31T12:00:00Z"))).toBe("2026-05-25");
});

