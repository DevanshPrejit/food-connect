import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MEALS_FACTOR: Record<string, number> = {
  cooked_meal:      4,   // 250g/serving
  bread_bakery:     6,   // 150g/serving
  snacks_starters:  5,   // 200g/serving
  dessert_sweets:   8,   // 125g/serving
  raw_produce:      3,   // 330g/serving
  dairy:            2,   // 500g/serving
  beverages:        4,   // 250ml/serving
  packaged_dry:     6,   // 150g/serving
};

export function calculateMeals(items: { category: string; quantity_kg: number }[]): number {
  return items.reduce((total, item) => {
    const factor = MEALS_FACTOR[item.category] ?? 3;
    return total + Math.round(item.quantity_kg * factor);
  }, 0);
}
