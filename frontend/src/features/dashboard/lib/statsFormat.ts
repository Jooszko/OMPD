export function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

export function formatMinutes(value: number | null): string {
  if (value === null) return '—';
  const total = Math.round(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} godz` : `${hours} godz ${minutes} min`;
}

export function niceTicks(max: number, targetCount = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10);
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) ticks.push(value);
  return ticks;
}