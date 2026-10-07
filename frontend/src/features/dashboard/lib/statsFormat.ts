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