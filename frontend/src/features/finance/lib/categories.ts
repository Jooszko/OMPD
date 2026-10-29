export const CATEGORY_COLORS: Record<string, { color: string; tint: string }> = {
  cogs: { color: '#2a78d6', tint: '#dce9f8' },
  stock_losses: { color: '#7c5cc4', tint: '#ebe4f7' },
  salary: { color: '#eb6834', tint: '#fce4da' },
  rent: { color: '#1baf7a', tint: '#dcf3ea' },
  utility: { color: '#eda100', tint: '#fcefcc' },
  fuel: { color: '#e87ba4', tint: '#fbe7ef' },
  other: { color: '#008300', tint: '#d9eed9' },
};

const FALLBACK = { color: '#8a8482', tint: '#ebe7e7' };

export function categoryColors(key: string): { color: string; tint: string } {
  return CATEGORY_COLORS[key] ?? FALLBACK;
}